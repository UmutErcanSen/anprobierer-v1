-- ============================================================================
-- Free-Tarif: nur das ERSTE Ergebnis in voller Aufloesung, Rest verdeckt
--
-- Hintergrund: 5 volle Gratis-Generierungen waren zu grosszuegig (echte
-- API-Kosten pro Versuch) UND liessen zu wenig Anreiz zum Upgrade. Neu:
-- 3 Credits bei Registrierung (statt 5), aber nur das ERSTE Ergebnis wird
-- unverdeckt gezeigt -- ab dem naechsten wird Bild (serverseitig geblurrt,
-- nicht per CSS -- siehe process.ts/lock.ts) und Verkaufstext (gekuerzt)
-- nur angeteasert, bis ein bezahlter Tarif aktiv ist. Bewaehrtes Muster
-- (Remove.bg, Canva u.ae.): der Nutzer hat schon investiert (eigenes Foto,
-- Wartezeit) und sieht, dass es funktioniert hat -- das ist ein staerkerer
-- Umwandlungs-Hebel als schlicht weniger Versuche zu geben.
--
-- WICHTIG fuer Fairness: Ein fehlgeschlagenes erstes Ergebnis darf nicht die
-- einzige kostenlose Vorschau verbrauchen -- refund_generation() setzt
-- free_preview_used in diesem Fall zurueck.
-- ============================================================================

-- "Starter" -> "Basic": klarerer Name, kein inhaltlicher Bezug zu "man
-- startet hier" -- einfach die zweite von drei Stufen.
alter type public.plan_key rename value 'starter' to 'basic';

alter table public.profiles
  add column free_preview_used boolean not null default false;
comment on column public.profiles.free_preview_used is
  'Ob der Nutzer sein einziges kostenloses, unverdecktes Vorschauergebnis (Free-Tarif) bereits verbraucht hat.';

alter table public.generations
  add column is_free_reveal boolean not null default false;
comment on column public.generations.is_free_reveal is
  'true = dieses Ergebnis wird unabhaengig vom aktuellen Tarif in voller Aufloesung gezeigt (die eine kostenlose Vorschau). Ab dem naechsten Ergebnis im Free-Tarif wird Bild/Text verdeckt, bis ein bezahlter Tarif aktiv ist.';

-- Neue Registrierungen bekommen 3 statt 5 Credits.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));

  insert into public.credit_ledger (user_id, delta, reason)
  values (new.id, 3, 'signup_bonus');

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- spend_credits: ermittelt zusaetzlich, ob dies die eine kostenlose Vorschau ist
-- ---------------------------------------------------------------------------
create or replace function public.spend_credits(
  p_user_id           uuid,
  p_mode              public.generation_mode,
  p_quality           public.image_quality,
  p_image_count       integer default 1,
  p_clothing_type     text default null,
  p_notes             text default null,
  p_person_image_path text default null,
  p_clothing_types    text[] default '{}',
  p_sizes             text[] default '{}',
  p_colors            text[] default '{}'
)
returns public.generations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit       integer;
  v_cost       integer;
  v_balance    integer;
  v_plan       public.plan_key;
  v_free_used  boolean;
  v_is_reveal  boolean;
  v_generation public.generations;
begin
  if p_image_count < 1 or p_image_count > 20 then
    raise exception 'Ungueltige Bildanzahl: %', p_image_count using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  v_unit := public.credits_for_quality(p_quality);
  if v_unit is null then
    raise exception 'Unbekannte Qualitaet' using errcode = 'check_violation';
  end if;
  v_cost := v_unit * p_image_count;

  select coalesce(sum(delta), 0) into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  if v_balance < v_cost then
    raise exception 'Guthaben reicht nicht: % vorhanden, % benoetigt', v_balance, v_cost
      using errcode = 'insufficient_privilege';
  end if;

  select plan, free_preview_used into v_plan, v_free_used
  from public.profiles where id = p_user_id;

  v_is_reveal := (v_plan = 'free' and not coalesce(v_free_used, false));
  if v_is_reveal then
    update public.profiles set free_preview_used = true where id = p_user_id;
  end if;

  insert into public.generations (user_id, status, mode, quality, credits_charged,
                                  clothing_type, notes, person_image_path,
                                  clothing_types, sizes, colors, is_free_reveal)
  values (p_user_id, 'queued', p_mode, p_quality, v_cost,
          p_clothing_type, p_notes, p_person_image_path,
          p_clothing_types, p_sizes, p_colors, v_is_reveal)
  returning * into v_generation;

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
  values (p_user_id, -v_cost, 'generation_charge', v_generation.id);

  return v_generation;
end;
$$;

-- ---------------------------------------------------------------------------
-- refund_generation: gibt die kostenlose Vorschau zurueck, falls sie diese war
-- ---------------------------------------------------------------------------
create or replace function public.refund_generation(
  p_generation_id uuid,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid;
  v_charged   integer;
  v_is_reveal boolean;
begin
  select user_id, credits_charged, is_free_reveal into v_user_id, v_charged, v_is_reveal
  from public.generations
  where id = p_generation_id;

  if v_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (
    select 1 from public.credit_ledger
    where generation_id = p_generation_id and reason = 'generation_refund'
  ) then
    return false;
  end if;

  update public.generations
  set status = 'failed',
      error_message = p_error_message,
      completed_at = now()
  where id = p_generation_id;

  if v_charged > 0 then
    insert into public.credit_ledger (user_id, delta, reason, generation_id)
    values (v_user_id, v_charged, 'generation_refund', p_generation_id);
  end if;

  -- Fairness: ein komplett fehlgeschlagenes Ergebnis darf nicht die einzige
  -- kostenlose Vorschau verbrauchen -- der naechste Versuch bekommt sie zurueck.
  if v_is_reveal then
    update public.profiles set free_preview_used = false where id = v_user_id;
  end if;

  return true;
end;
$$;

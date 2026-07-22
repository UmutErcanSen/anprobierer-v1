-- ============================================================================
-- Credit-Abbuchung skaliert mit der Anzahl erzeugter Bilder
--
-- Grund: Im Einzelmodus erzeugen N Kleidungsstuecke N Anprobebilder — also
-- N-fache Kosten. Wuerde dafuer nur 1 Credit abgebucht, entstuende bei jedem
-- Mehrfach-Auftrag ein realer Verlust. Deshalb bucht spend_credits jetzt
-- (Kosten pro Bild) × (Anzahl Bilder) ab.
--
--   Einzeln, N Stuecke  -> image_count = N -> N × Credits
--   Kombiniert          -> image_count = 1 -> 1 × Credits
--
-- Zusaetzlich eine Teil-Rueckerstattung: Wenn im Einzelmodus einige Bilder
-- gelingen und andere scheitern, werden nur die fehlgeschlagenen erstattet.
-- ============================================================================

-- Alte Signatur entfernen (die neue hat einen zusaetzlichen Parameter).
drop function if exists public.spend_credits(uuid, public.generation_mode, public.image_quality, text, text, text);

create function public.spend_credits(
  p_user_id           uuid,
  p_mode              public.generation_mode,
  p_quality           public.image_quality,
  p_image_count       integer default 1,
  p_clothing_type     text default null,
  p_notes             text default null,
  p_person_image_path text default null
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
  v_generation public.generations;
begin
  -- Sanity-Grenze: schuetzt vor absurden Werten, unabhaengig von den
  -- Plan-Limits, die die Route ohnehin prueft.
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

  insert into public.generations (user_id, status, mode, quality, credits_charged,
                                  clothing_type, notes, person_image_path)
  values (p_user_id, 'queued', p_mode, p_quality, v_cost,
          p_clothing_type, p_notes, p_person_image_path)
  returning * into v_generation;

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
  values (p_user_id, -v_cost, 'generation_charge', v_generation.id);

  return v_generation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teil-Rueckerstattung fuer teilweise fehlgeschlagene Auftraege
-- ---------------------------------------------------------------------------
create or replace function public.refund_credits(
  p_generation_id uuid,
  p_credits       integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_credits <= 0 then
    return false;
  end if;

  select user_id into v_user_id from public.generations where id = p_generation_id;
  if v_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  -- Nicht mehr zurueckbuchen als urspruenglich abgebucht wurde. Verhindert,
  -- dass Rechenfehler in der Route Credits aus dem Nichts erzeugen.
  if p_credits > (
    select coalesce(-sum(delta), 0) from public.credit_ledger
    where generation_id = p_generation_id and reason = 'generation_charge'
  ) then
    return false;
  end if;

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
  values (v_user_id, p_credits, 'generation_refund', p_generation_id);

  return true;
end;
$$;

-- Ausfuehrungsrechte: nur der Server.
revoke execute on function public.spend_credits(uuid, public.generation_mode, public.image_quality, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, public.generation_mode, public.image_quality, integer, text, text, text) to service_role;
grant execute on function public.refund_credits(uuid, integer) to service_role;

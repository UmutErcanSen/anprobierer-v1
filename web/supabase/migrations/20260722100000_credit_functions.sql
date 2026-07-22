-- ============================================================================
-- Credit-Buchung: atomares Abbuchen und Rückerstatten
--
-- Warum in der Datenbank und nicht im Anwendungscode:
-- Zwei parallele Generierungen desselben Nutzers dürfen nicht beide dasselbe
-- Guthaben ausgeben. Nur eine Transaktion mit Sperre garantiert das
-- zuverlässig — im Anwendungscode („lies Stand, prüfe, schreibe") klafft
-- immer ein Zeitfenster, in dem beide Anfragen denselben alten Stand sehen.
-- Genau solche Races kosten bei kostenpflichtiger Generierung echtes Geld.
--
-- Aufrufbar ausschliesslich über den service_role-Key (Server). Am Ende der
-- Datei wird das Ausführungsrecht allen anderen Rollen ausdrücklich entzogen —
-- sonst könnte ein angemeldeter Nutzer sich selbst Credits gutschreiben.
-- ============================================================================

-- Preis pro Qualität an einer einzigen Stelle. Die Funktion leitet die Kosten
-- selbst daraus ab, statt sie sich vom Aufrufer sagen zu lassen — so kann kein
-- manipulierter Wert eine HD-Generierung zum Standardpreis erschleichen.
create or replace function public.credits_for_quality(p_quality public.image_quality)
returns integer
language sql
immutable
as $$
  select case p_quality
    when 'standard' then 1
    when 'hd'       then 4
  end;
$$;

-- ---------------------------------------------------------------------------
-- spend_credits: bucht ab und legt den Generierungs-Job an — beides oder nichts
-- ---------------------------------------------------------------------------
create or replace function public.spend_credits(
  p_user_id           uuid,
  p_mode              public.generation_mode,
  p_quality           public.image_quality,
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
  v_cost       integer;
  v_balance    integer;
  v_generation public.generations;
begin
  -- Serialisiert alle gleichzeitigen Buchungen DIESES Nutzers. Andere Nutzer
  -- bleiben unberührt. Die Sperre gilt bis zum Ende der Transaktion und macht
  -- das „prüfen und abbuchen" unteilbar.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  v_cost := public.credits_for_quality(p_quality);
  if v_cost is null then
    raise exception 'Unbekannte Qualitaet' using errcode = 'check_violation';
  end if;

  select coalesce(sum(delta), 0) into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  if v_balance < v_cost then
    -- Sauber unterscheidbarer Fehler, damit der Server daraus eine echte
    -- „Guthaben reicht nicht"-Antwort (402) machen kann statt eines 500ers.
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
-- refund_generation: bucht nach einem fehlgeschlagenen Job die Credits zurück
--
-- Idempotent: Ein zweiter Aufruf für dieselbe Generierung tut nichts. Ohne das
-- könnte ein wiederholter Aufruf (Retry, doppeltes Event) Credits vermehren.
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
  v_user_id uuid;
  v_charged integer;
begin
  select user_id, credits_charged into v_user_id, v_charged
  from public.generations
  where id = p_generation_id;

  if v_user_id is null then
    return false; -- Generierung existiert nicht
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  -- Schon zurückerstattet? Dann nichts tun. Das ist die Idempotenz-Sperre.
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

  -- Nur zurückbuchen, wenn tatsächlich etwas abgebucht wurde.
  if v_charged > 0 then
    insert into public.credit_ledger (user_id, delta, reason, generation_id)
    values (v_user_id, v_charged, 'generation_refund', p_generation_id);
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ausführungsrechte: NUR der Server.
-- Postgres vergibt execute standardmäßig an PUBLIC — das wird hier widerrufen.
-- ---------------------------------------------------------------------------
revoke execute on function public.spend_credits(uuid, public.generation_mode, public.image_quality, text, text, text) from public, anon, authenticated;
revoke execute on function public.refund_generation(uuid, text) from public, anon, authenticated;

-- Und ausdrücklich nur dem Server zurückgeben. service_role ist kein
-- Superuser — ohne diesen grant könnte nach dem revoke oben niemand mehr die
-- Funktionen ausführen, auch der Server nicht.
grant execute on function public.spend_credits(uuid, public.generation_mode, public.image_quality, text, text, text) to service_role;
grant execute on function public.refund_generation(uuid, text) to service_role;

-- ============================================================================
-- Aufräumen hängengebliebener Generierungen (+ verwaister Uploads)
--
-- Problem: processGeneration() laeuft nach der HTTP-Antwort in after() weiter
-- und setzt den Status auf 'processing'. Wird der Vorgang abgebrochen, OHNE
-- seinen catch-Block zu erreichen -- Serverless-Instanz beendet, maxDuration
-- (300 s) ueberschritten, Deploy mitten in der Generierung, Out-of-Memory --,
-- bleibt die Zeile fuer immer auf 'processing'.
--
-- Zwei Folgen, beide schlimm:
--   1. rate-limit.ts wertete das als "laeuft noch" -> der Nutzer konnte NIE
--      wieder eine Anprobe starten (dort inzwischen zusaetzlich per
--      STALE_AFTER_MS entschaerft, damit es auch ohne diesen Cron wirkt).
--   2. Die Credits blieben abgebucht, obwohl es nie ein Ergebnis gab.
--
-- Diese Funktion raeumt beides auf: Status auf 'failed', Credits zurueck
-- (ueber das bestehende, idempotente refund_generation) -- und loescht
-- nebenbei Upload-Reste, die beim Abbruch liegengeblieben sind. Letzteres ist
-- nicht nur Speicherhygiene: Laut Datenschutzerklaerung wird das Personenfoto
-- "unmittelbar nach der Generierung geloescht" -- bei einem Abbruch passierte
-- das bisher nie.
-- ============================================================================

-- Muss mit STALE_AFTER_MS in lib/generation/rate-limit.ts uebereinstimmen.
-- Grosszuegig gegenueber maxDuration (300 s): lieber ein paar Minuten zu spaet
-- aufraeumen als einen echten, noch laufenden Job abschiessen.
create or replace function public.fail_stale_generations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   record;
  v_count integer := 0;
begin
  for v_row in
    select id
    from public.generations
    where status in ('queued', 'processing')
      and created_at < now() - interval '10 minutes'
  loop
    -- refund_generation ist idempotent (prueft auf eine bereits vorhandene
    -- Rueckbuchung) und setzt zusaetzlich die kostenlose Free-Vorschau
    -- zurueck, falls ausgerechnet die betroffen war.
    perform public.refund_generation(
      v_row.id,
      'Die Generierung wurde unterbrochen und automatisch abgebrochen.'
    );
    v_count := v_count + 1;
  end loop;

  -- Upload-Reste abgebrochener Laeufe. Der Normalfall raeumt selbst auf
  -- (process.ts entfernt die Dateien am Ende); was nach 24 h noch im
  -- 'uploads'-Bucket liegt, gehoert zu einem Lauf, der nie zu Ende kam --
  -- eine laufende Generierung dauert nie laenger als wenige Minuten.
  delete from storage.objects
  where bucket_id = 'uploads'
    and created_at < now() - interval '24 hours';

  return v_count;
end;
$$;

comment on function public.fail_stale_generations is
  'Setzt haengengebliebene Generierungen auf failed, bucht die Credits zurueck und entfernt verwaiste Upload-Dateien. Wird per pg_cron minuetlich aufgerufen.';

-- Nur der Server bzw. der Cron-Job darf das ausfuehren -- niemals ein
-- angemeldeter Nutzer (sonst liesse sich fremdes Aufraeumen anstossen).
revoke execute on function public.fail_stale_generations() from public, anon, authenticated;
grant execute on function public.fail_stale_generations() to service_role;

-- ---------------------------------------------------------------------------
-- Zeitplan
--
-- pg_cron muss auf Supabase einmalig aktiviert sein
-- (Dashboard -> Database -> Extensions -> "pg_cron" einschalten).
-- Der DO-Block unten legt den Job nur an, WENN die Extension vorhanden ist --
-- sonst laeuft diese Migration trotzdem sauber durch und die Funktion steht
-- bereit, sie wird dann eben nur nicht automatisch aufgerufen.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Vorherige Fassung entfernen, damit ein erneutes Einspielen der Migration
    -- den Job nicht doppelt anlegt.
    perform cron.unschedule('fail-stale-generations')
    where exists (select 1 from cron.job where jobname = 'fail-stale-generations');

    perform cron.schedule(
      'fail-stale-generations',
      '* * * * *',
      $cron$ select public.fail_stale_generations(); $cron$
    );
    raise notice 'pg_cron-Job "fail-stale-generations" eingerichtet (minuetlich).';
  else
    raise notice 'pg_cron ist nicht aktiviert -- fail_stale_generations() existiert, wird aber nicht automatisch aufgerufen. Extension im Supabase-Dashboard aktivieren und diesen Block erneut ausfuehren.';
  end if;
end;
$$;

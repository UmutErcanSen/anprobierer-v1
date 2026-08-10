-- ===========================================================================
-- KORREKTUR zu 20260810140000_verwaiste_ergebnisdateien.sql
--
-- Befund beim Testen: delete_orphaned_results() bricht ab mit
--
--     Direct deletion from storage tables is not allowed.
--     Use the Storage API instead.
--
-- Supabase unterbindet `delete from storage.objects` per Trigger
-- (storage.protect_delete). Genau derselbe Fehler hatte schon einmal
-- zugeschlagen: 20260730120000_fix_stale_cleanup.sql musste deshalb den
-- Aufraeumteil aus fail_stale_generations() entfernen. Ich habe ihn hier
-- unbeabsichtigt wieder eingebaut -- diesmal faellt es sofort auf, weil die
-- Funktion nichts anderes tut und der Fehler nicht stillschweigend eine
-- Credit-Rueckbuchung mitreisst.
--
-- Konsequenz: Aus SQL laesst sich im Storage nichts loeschen. Punkt. Die
-- Funktion wird deshalb entfernt und der taegliche Cron-Job abgemeldet,
-- statt jede Nacht mit einem Fehler zu enden.
--
-- Was BLEIBT, weil es lesend einwandfrei funktioniert: die Sichten. Sie
-- zeigen zuverlaessig, WAS aufzuraeumen waere -- das eigentliche Loeschen
-- muss ueber die Storage-API laufen, also aus der Anwendung heraus.
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('delete-orphaned-results')
    where exists (select 1 from cron.job where jobname = 'delete-orphaned-results');
  end if;
end;
$$;

drop function if exists public.delete_orphaned_results();


-- ---------------------------------------------------------------------------
-- Zweite Sicht: liegengebliebene Uploads.
--
-- Das ist der datenschutzrechtlich heiklere Fall von beiden. Der uploads-
-- Bucket enthaelt PERSONENFOTOS, und die Datenschutzerklaerung sagt zu, dass
-- sie unmittelbar nach der Generierung geloescht werden -- bei einem Abbruch
-- spaetestens nach 24 Stunden. Der Normalfall funktioniert (process.ts raeumt
-- am Ende jedes Laufs selbst auf); nur abgebrochene Laeufe hinterlassen Reste,
-- und fuer die gab es seit dem 30.07. keinen funktionierenden Aufraeumweg mehr.
--
-- Diese Sicht macht sichtbar, ob und wie lange etwas liegt.
-- ---------------------------------------------------------------------------
create or replace view admin.alte_uploads as
select
  o.name                                                        as pfad,
  o.created_at                                                  as hochgeladen_am,
  round(extract(epoch from (now() - o.created_at)) / 3600)::int as alter_stunden
from storage.objects o
where o.bucket_id = 'uploads'
  and o.created_at < now() - interval '24 hours'
order by o.created_at;

comment on view admin.alte_uploads is
  'Personenfotos/Kleidungsfotos, die laenger als 24 Stunden im uploads-Bucket liegen. SOLLTE LEER SEIN -- Inhalt bedeutet: die zugesagte Loeschfrist wird nicht eingehalten.';

revoke all on admin.alte_uploads from anon, authenticated;
grant select on admin.alte_uploads to service_role;

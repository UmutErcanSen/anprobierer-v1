-- ===========================================================================
-- Verwaiste Ergebnisdateien aufraeumen
--
-- Anlass: Das Loeschen der Storage-Dateien ist an mehreren Stellen bewusst
-- "best effort" -- beim Loeschen einer einzelnen Anprobe
-- (api/generate/[id]/route.ts), beim Massenloeschen (api/generate/route.ts)
-- und vor allem bei der Kontoloeschung (api/account/route.ts), wo der
-- Auth-Nutzer bereits weg ist, wenn das Aufraeumen laeuft. Schlaegt
-- storage.remove() dort fehl, ist die Datenbankzeile fort, die Bilddatei
-- aber bleibt -- und niemand kennt danach noch ihren Pfad.
--
-- Das ist nicht nur Speicherhygiene: Die Datenschutzerklaerung sagt zu, dass
-- Ergebnisbilder bei Loeschung entfernt werden (Art. 17 DSGVO). Eine
-- Zusicherung, die im Fehlerfall still unerfuellt bliebe, waere ein echtes
-- Datenschutzproblem -- nicht nur ein technischer Schoenheitsfehler.
--
-- Ansatz: Der Speicherpfad enthaelt die Generierungs-ID
--   results/<user_id>/<generation_id>/<n>.png
--   results/<user_id>/<generation_id>/<n>-locked.jpg
-- Existiert zu dieser ID keine Zeile mehr in public.generations, ist die
-- Datei verwaist und darf weg. Die ID steht bei beiden Varianten im zweiten
-- Pfadsegment, ein Sonderfall fuer die Vorschau-Dateien ist also nicht noetig.
-- ===========================================================================

create or replace function public.delete_orphaned_results()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anzahl integer;
begin
  with verwaist as (
    delete from storage.objects o
     where o.bucket_id = 'results'
       -- Sicherheitsabstand: Eine gerade laufende Generierung hat ihre Zeile
       -- zwar bereits angelegt (siehe api/generate/route.ts, die Zeile
       -- entsteht VOR dem Bild), aber der Abstand kostet nichts und schuetzt
       -- vor jeder kuenftigen Umstellung dieser Reihenfolge.
       and o.created_at < now() - interval '1 hour'
       and not exists (
         select 1
           from public.generations g
          where g.id::text = split_part(o.name, '/', 2)
       )
    returning 1
  )
  select count(*) into v_anzahl from verwaist;

  if v_anzahl > 0 then
    raise notice 'delete_orphaned_results: % verwaiste Ergebnisdatei(en) entfernt.', v_anzahl;
  end if;

  return v_anzahl;
end;
$$;

comment on function public.delete_orphaned_results() is
  'Entfernt Dateien im results-Bucket, zu denen keine generations-Zeile mehr existiert (fehlgeschlagenes best-effort-Aufraeumen). Sollte regelmaessig 0 liefern.';

revoke all on function public.delete_orphaned_results from public, anon, authenticated;
grant execute on function public.delete_orphaned_results to service_role;


-- ---------------------------------------------------------------------------
-- Zeitplan -- taeglich, nicht minuetlich: Der Normalfall raeumt bereits
-- direkt beim Loeschen auf, das hier ist reine Nachsorge. Ein voller Scan
-- ueber storage.objects lohnt nicht im Minutentakt.
--
-- Wie beim bestehenden fail-stale-generations-Job: nur einrichten, wenn
-- pg_cron aktiviert ist, sonst laeuft die Migration trotzdem sauber durch und
-- die Funktion steht fuer den manuellen Aufruf bereit.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('delete-orphaned-results')
    where exists (select 1 from cron.job where jobname = 'delete-orphaned-results');

    perform cron.schedule(
      'delete-orphaned-results',
      '17 3 * * *',
      $cron$ select public.delete_orphaned_results(); $cron$
    );
    raise notice 'pg_cron-Job "delete-orphaned-results" eingerichtet (taeglich 03:17 UTC).';
  else
    raise notice 'pg_cron ist nicht aktiviert -- delete_orphaned_results() existiert, wird aber nicht automatisch aufgerufen.';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- Auswertung: Wie viele verwaiste Dateien liegen gerade herum?
-- Sollte dauerhaft 0 sein. Steht hier dauerhaft etwas, scheitert das
-- Aufraeumen systematisch und die Ursache gehoert untersucht.
-- ---------------------------------------------------------------------------
create or replace view admin.verwaiste_dateien as
select
  o.name                                              as pfad,
  o.created_at                                        as angelegt_am,
  round((o.metadata->>'size')::numeric / 1024, 1)     as groesse_kb
from storage.objects o
where o.bucket_id = 'results'
  and not exists (
    select 1
      from public.generations g
     where g.id::text = split_part(o.name, '/', 2)
  )
order by o.created_at;

comment on view admin.verwaiste_dateien is
  'Ergebnisdateien ohne zugehoerige Generierung. SOLLTE LEER SEIN -- Inhalt bedeutet: zugesagte Loeschung ist nicht vollstaendig erfolgt.';

revoke all on admin.verwaiste_dateien from anon, authenticated;
grant select on admin.verwaiste_dateien to service_role;

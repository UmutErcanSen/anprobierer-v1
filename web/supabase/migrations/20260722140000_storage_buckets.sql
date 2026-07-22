-- ============================================================================
-- Storage: zwei private Buckets
--
-- 'uploads'  — hochgeladene Personen- und Kleidungsfotos. Kurzlebig: das
--              Personenfoto wird direkt nach der Generierung serverseitig
--              gelöscht (Datensparsamkeit, DSGVO Art. 5).
-- 'results'  — die generierten Bilder. Bleiben dauerhaft, damit der Nutzer
--              sein bezahltes Ergebnis nicht beim Schliessen des Tabs verliert
--              (der teuerste Fehler der Altanwendung).
--
-- Beide Buckets sind PRIVAT. Kein Objekt ist über eine öffentliche URL
-- erreichbar; der Server gibt bei Bedarf zeitlich begrenzte signierte Links
-- aus. Personenfotos dürfen nicht über eine erratbare URL im Netz stehen.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false), ('results', 'results', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Zugriffsregeln auf storage.objects
--
-- Konvention: Jede Datei liegt unter {user_id}/... — der erste Pfadteil ist
-- die UID des Eigentümers. storage.foldername(name)[1] liefert genau diesen
-- Teil. So kann niemand fremde Ordner sehen oder beschreiben.
-- ---------------------------------------------------------------------------

-- Uploads: der Nutzer legt eigene Dateien an und darf sie lesen. Das
-- serverseitige Löschen läuft über den service_role-Key und umgeht diese
-- Regeln ohnehin — hier ist bewusst KEINE delete-Policy für Clients nötig.
create policy "Eigene Uploads anlegen"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Eigene Uploads lesen"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'uploads'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Ergebnisse: der Nutzer darf nur LESEN. Geschrieben wird ausschliesslich
-- serverseitig, damit niemand fremde oder gefälschte Ergebnisbilder einspielt.
create policy "Eigene Ergebnisse lesen"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'results'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

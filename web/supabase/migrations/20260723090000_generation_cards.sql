-- ============================================================================
-- Live-Fortschritt fuer die asynchrone Generierung
--
-- Bisher schrieb die Generierungs-Route alles erst am Ende in EINEM Request.
-- Das blockiert den Client ueber die gesamte Laufzeit (bis zu mehreren
-- Minuten bei mehreren Kleidungsstuecken) und uebersteigt auf den meisten
-- Hosting-Plattformen das Zeitlimit einer einzelnen Anfrage.
--
-- Ab jetzt startet POST /api/generate nur noch die Verarbeitung und antwortet
-- sofort mit der generation_id. Ein GET /api/generate/[id] liefert den
-- laufenden Fortschritt, den der Client per Polling abfragt.
--
-- 'cards' haelt den strukturierten Zwischen- und Endstand: pro erzeugtem
-- Bild bzw. Verkaufstext ein Eintrag {itemIndex, title, imagePath, saleText}.
-- Bewusst werden hier STORAGE-PFADE gespeichert, keine signierten URLs — die
-- laufen nach einer Stunde ab und wuerden im Datensatz veralten. Der Poll-
-- Endpunkt signiert bei jedem Abruf frisch.
-- ============================================================================

alter table public.generations
  add column cards jsonb not null default '[]'::jsonb;

comment on column public.generations.cards is
  'Zwischen-/Endstand pro Bild bzw. Verkaufstext: [{itemIndex, title, imagePath, saleText}]. Speichert Storage-Pfade, keine signierten URLs.';

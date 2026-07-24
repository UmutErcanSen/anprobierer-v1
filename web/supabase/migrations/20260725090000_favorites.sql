-- ============================================================================
-- Favoriten fuer Generierungen
--
-- Eine Generierung als Favorit markieren -- z.B. um sie von der (noch zu
-- planenden) automatischen Loeschung nach Ablauf der tarifabhaengigen
-- Aufbewahrungsfrist auszunehmen.
--
-- generations hatte bisher KEINE Update-Policy fuer Clients (nur lesen und
-- loeschen) -- alles andere lief serverseitig. is_favorite ist die erste
-- Ausnahme: rein kosmetisch, kein Geldwert, daher unbedenklich direkt vom
-- Client aus per Supabase-JS aenderbar. Genau wie bei profiles.display_name
-- schuetzen Spaltenrechte (nicht RLS) davor, dass ueber denselben Weg auch
-- andere Spalten (status, credits_charged, ...) manipuliert werden koennten.
-- ============================================================================

alter table public.generations
  add column is_favorite boolean not null default false;

comment on column public.generations.is_favorite is
  'Vom Nutzer gesetzt. Soll spaeter automatische Loeschung nach Aufbewahrungsfrist verhindern.';

create policy "Eigene Generierung aktualisieren"
  on public.generations for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke update on public.generations from authenticated;
grant update (is_favorite) on public.generations to authenticated;

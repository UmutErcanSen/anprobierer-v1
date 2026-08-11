-- ===========================================================================
-- "Wohin habe ich das schon eingestellt?"
--
-- Wer zwanzig Teile ausmistet, erstellt die Anproben an einem Abend und
-- stellt sie ueber Tage verteilt ein. Danach steht er vor einem Raster aus
-- gleich aussehenden Karten und weiss nicht mehr, welche schon online sind.
-- Bisher gab es darauf keine Antwort: Die Karte sah vor und nach dem Export
-- identisch aus.
--
-- WARUM PRO KARTE, nicht pro Generierung: Im Einzeln-Modus entsteht je
-- Kleidungsstueck eine eigene Karte -- und jedes Stueck wird als EIGENES
-- Inserat eingestellt. Eine Markierung auf Generierungsebene waere bei
-- mehreren Stuecken schlicht falsch. Die Ablage in cards[].exports folgt
-- damit demselben Muster wie cards[].platformTexts.
--
-- WARUM EINE FUNKTION statt eines Spaltenrechts: Beim Favoriten-Stern
-- (20260725090000) genuegte `grant update (is_favorite)`, weil dort nur ein
-- Boolean geschrieben wird. Hier waere das Gegenstueck `grant update (cards)`
-- -- damit koennte ein Nutzer seine gesamten Karten ueberschreiben, inklusive
-- Bildpfaden und Verkaufstexten, und beliebig grosse JSON-Strukturen ablegen.
-- Diese Funktion schreibt stattdessen genau ein Feld, prueft die Plattform
-- gegen eine feste Liste und den Eigentuemer gegen auth.uid().
-- ===========================================================================

create or replace function public.mark_card_export(
  p_generation_id uuid,
  p_item_index    int,
  p_platform      text,
  p_gesetzt       boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid;
  v_aufrufer uuid;
  v_cards    jsonb;
  v_pos      int;
  v_exports  jsonb;
begin
  -- Feste Liste statt freiem Text: Sonst landet beliebiger Inhalt als
  -- Schluessel im JSON, und die Anzeige muesste damit umgehen koennen.
  if p_platform not in ('vinted', 'kleinanzeigen', 'ebay') then
    raise exception 'Unbekannte Plattform: %', p_platform;
  end if;

  v_aufrufer := (select auth.uid());

  select user_id, coalesce(cards, '[]'::jsonb)
    into v_user_id, v_cards
    from public.generations
   where id = p_generation_id;

  /*
    Kein Unterschied zwischen "gibt es nicht" und "gehoert jemand anderem" --
    dieselbe Regel wie in den API-Routen, damit sich fremde IDs nicht durch
    Ausprobieren bestaetigen lassen.

    ACHTUNG, hier steckte ein echter Fehler: Die Pruefung lautete zuerst nur
    `v_user_id is null or v_user_id <> (select auth.uid())`. Ohne angemeldeten
    Nutzer liefert auth.uid() aber NULL, und `uuid <> NULL` ergibt in SQL
    weder true noch false, sondern NULL -- `if NULL then` gilt als nicht
    erfuellt, die Pruefung fiel also durch und der Schreibzugriff wurde
    ZUGELASSEN. Deshalb wird der Aufrufer jetzt zuerst separat auf NULL
    geprueft. (Aufgefallen beim Test gegen die echte Datenbank; ohne diesen
    Test waere es unbemerkt geblieben, weil ueber die Anwendung immer ein
    JWT vorliegt.)
  */
  if v_aufrufer is null or v_user_id is null or v_user_id <> v_aufrufer then
    raise exception 'Generierung nicht gefunden.';
  end if;

  -- Die Position im Array ist NICHT zwangslaeufig der itemIndex: Im
  -- Kombiniert-Modus steht an Position 0 das gemeinsame Bild mit
  -- itemIndex = -1, die Textkarten folgen erst danach.
  select ordinalitaet - 1
    into v_pos
    from jsonb_array_elements(v_cards) with ordinality as t(element, ordinalitaet)
   where (element ->> 'itemIndex')::int = p_item_index
   limit 1;

  if v_pos is null then
    raise exception 'Karte nicht gefunden.';
  end if;

  v_exports := coalesce(v_cards -> v_pos -> 'exports', '{}'::jsonb);

  if p_gesetzt then
    v_exports := v_exports || jsonb_build_object(p_platform, now());
  else
    v_exports := v_exports - p_platform;
  end if;

  -- create_missing = true: Bei Karten aus der Zeit vor dieser Migration
  -- existiert der Schluessel "exports" noch gar nicht.
  v_cards := jsonb_set(v_cards, array[v_pos::text, 'exports'], v_exports, true);

  update public.generations set cards = v_cards where id = p_generation_id;

  return v_exports;
end;
$$;

comment on function public.mark_card_export(uuid, int, text, boolean) is
  'Merkt je Karte, fuer welche Plattform ein Inserat vorbereitet wurde. Schreibt ausschliesslich cards[].exports -- der uebrige Karteninhalt bleibt unantastbar.';

revoke all on function public.mark_card_export(uuid, int, text, boolean) from public, anon;
grant execute on function public.mark_card_export(uuid, int, text, boolean) to authenticated;

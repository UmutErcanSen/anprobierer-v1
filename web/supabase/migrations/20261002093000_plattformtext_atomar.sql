-- Plattformtext atomar in generations.cards schreiben.
--
-- DAS PROBLEM: /api/generate/[id]/platform-text las bisher das komplette
-- cards-Array, setzte darin einen Text und schrieb das GANZE Array zurueck.
-- Zwei gleichzeitige Anfragen -- etwa weil jemand zuegig zwischen den
-- Plattform-Reitern wechselt -- lesen beide denselben Stand, und die zweite
-- Antwort ueberschreibt die erste. Der zwischengespeicherte Text der ersten
-- Plattform ist dann weg und wird beim naechsten Aufruf erneut kostenpflichtig
-- bei OpenAI erzeugt.
--
-- Der Schaden ist klein (ein paar Cent, heilt sich beim naechsten Aufruf),
-- aber die Ursache ist eine klassische Lost-Update-Situation: Lesen, Aendern
-- und Schreiben liefen in drei getrennten Schritten ueber zwei Systeme hinweg.
--
-- Hier passiert alles in EINER Transaktion, mit `for update` auf der Zeile --
-- zwei gleichzeitige Aufrufe reihen sich damit hintereinander ein, statt sich
-- gegenseitig zu ueberschreiben.

create or replace function public.setze_plattformtext(
  p_generation_id uuid,
  p_item_index    integer,
  p_platform      text,
  p_text          text,
  p_cost_usd      numeric,
  -- Fuer Altzeilen ohne cards-Spalte: Die Route leitet die Karten aus
  -- result_paths/sale_text ab (resolveCardRows) und reicht sie hier herein.
  -- Dadurch wird die Zeile beim ersten Plattformtext zugleich materialisiert.
  p_fallback_cards jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cards jsonb;
  v_pos   integer;
begin
  select coalesce(nullif(cards, '[]'::jsonb), p_fallback_cards)
    into v_cards
  from public.generations
  where id = p_generation_id
  for update;  -- sperrt die Zeile bis zum Ende dieser Transaktion

  if v_cards is null then
    raise exception 'Generierung % nicht gefunden', p_generation_id;
  end if;

  -- Position der Karte im Array. jsonb-Pfade sind nullbasiert, `ordinality`
  -- zaehlt ab 1.
  select pos - 1
    into v_pos
  from jsonb_array_elements(v_cards) with ordinality as k(karte, pos)
  where (k.karte->>'itemIndex')::integer = p_item_index
  limit 1;

  if v_pos is null then
    raise exception 'Karte % nicht in Generierung %', p_item_index, p_generation_id;
  end if;

  -- Zwei Schritte, weil jsonb_set nur das LETZTE Pfadelement anlegen kann:
  -- fehlt platformTexts noch ganz, schluege ein direkter Zugriff darauf fehl.
  v_cards := jsonb_set(
    v_cards,
    array[v_pos::text, 'platformTexts'],
    coalesce(v_cards -> v_pos -> 'platformTexts', '{}'::jsonb),
    true
  );
  v_cards := jsonb_set(
    v_cards,
    array[v_pos::text, 'platformTexts', p_platform],
    to_jsonb(p_text),
    true
  );

  update public.generations
     set cards    = v_cards,
         cost_usd = coalesce(cost_usd, 0) + coalesce(p_cost_usd, 0)
   where id = p_generation_id;
end;
$$;

comment on function public.setze_plattformtext(uuid, integer, text, text, numeric, jsonb) is
  'Schreibt EINEN Plattformtext in generations.cards, ohne das uebrige Array zu ueberschreiben. Siehe /api/generate/[id]/platform-text.';

-- Nur fuer den Server. Die Funktion prueft bewusst KEINE Eigentuemerschaft --
-- das tut die Route vorher (sie vergleicht user_id und wertet die
-- Bezahlschranke aus). Waere sie fuer `authenticated` aufrufbar, liesse sich
-- damit in fremde Generierungen schreiben.
revoke execute on function public.setze_plattformtext(uuid, integer, text, text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.setze_plattformtext(uuid, integer, text, text, numeric, jsonb)
  to service_role;

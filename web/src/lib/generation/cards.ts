/**
 * Karten aus einer generations-Zeile ableiten -- mit Rueckfallebene fuer
 * Generierungen von VOR der `cards`-Spalte (siehe Migration
 * 20260723090000_generation_cards.sql). Diese aelteren Zeilen haben
 * `cards: []`, aber echte Daten in `result_paths` (Bildpfade in Reihenfolge)
 * und `sale_text` (alle Texte mit '\n---\n' zusammengefuegt, siehe die
 * damalige Route). Ohne diesen Fallback zeigte der Verlauf für jede
 * Generierung vor diesem Datum leere Bilder und leere Texte, obwohl die
 * Daten tatsaechlich vorhanden waren.
 */

export type CardRow = {
  itemIndex: number;
  title: string;
  imagePath: string | null;
  saleText: string | null;
  /** Fuer welche Plattformen dieses Stueck bereits vorbereitet wurde --
   *  gesetzt von mark_card_export (Migration 20260810180000). Bei Karten aus
   *  der Zeit davor schlicht nicht vorhanden. */
  exports?: Record<string, string>;
};

export function resolveCardRows(generation: {
  mode: string;
  cards: unknown;
  result_paths: string[] | null;
  sale_text: string | null;
}): CardRow[] {
  const cards = (generation.cards ?? []) as CardRow[];
  if (cards.length > 0) return cards;

  const resultPaths = generation.result_paths ?? [];
  const texts = generation.sale_text ? generation.sale_text.split('\n---\n') : [];
  if (resultPaths.length === 0 && texts.length === 0) return [];

  // itemIndex dient hier nur der Typkonsistenz -- diese Zeilen existieren
  // nicht in generations.cards (das ist bei Legacy-Zeilen leer), ein
  // Plattform-Text laesst sich dafuer also nicht serverseitig zwischen-
  // speichern (siehe /api/generate/[id]/platform-text: findIndex laeuft
  // dort ohnehin ins Leere und faellt auf unbeschriftetes Neu-Erstellen
  // ohne Caching zurueck).
  if (generation.mode === 'combined') {
    const rows: CardRow[] = [{ itemIndex: -1, title: 'Kombiniertes Bild', imagePath: resultPaths[0] ?? null, saleText: null }];
    texts.forEach((text, i) => rows.push({ itemIndex: i, title: `Stück ${i + 1}`, imagePath: null, saleText: text }));
    return rows;
  }

  const count = Math.max(resultPaths.length, texts.length);
  return Array.from({ length: count }, (_, i) => ({
    itemIndex: i,
    title: `Stück ${i + 1}`,
    imagePath: resultPaths[i] ?? null,
    saleText: texts[i] ?? null,
  }));
}

/**
 * Wie viele Stuecke einer Generierung wurden schon fuer eine Plattform
 * vorbereitet? Fuer das Abzeichen im Verlauf-Raster.
 *
 * Gezaehlt werden nur Karten mit Verkaufstext: Im Kombiniert-Modus gibt es
 * zusaetzlich eine reine Bildkarte (itemIndex -1) ohne Text -- die laesst
 * sich gar nicht einzeln inserieren und wuerde die Quote sonst dauerhaft
 * unvollstaendig aussehen lassen ("1/2", obwohl alles erledigt ist).
 */
export function exportStand(cards: CardRow[]): {
  fertig: number;
  gesamt: number;
  /** Alle Plattformen, fuer die mindestens ein Stueck vorbereitet wurde --
   *  in der festen Reihenfolge von PLATFORMS, damit das Abzeichen nicht je
   *  nach Klickreihenfolge die Icons umsortiert. */
  plattformen: string[];
} {
  const inserierbar = cards.filter((c) => c.saleText);
  const gesehen = new Set<string>();
  for (const c of inserierbar) {
    for (const key of Object.keys(c.exports ?? {})) gesehen.add(key);
  }
  const REIHENFOLGE = ['vinted', 'kleinanzeigen', 'ebay'];
  return {
    fertig: inserierbar.filter((c) => c.exports && Object.keys(c.exports).length > 0).length,
    gesamt: inserierbar.length,
    plattformen: REIHENFOLGE.filter((k) => gesehen.has(k)),
  };
}

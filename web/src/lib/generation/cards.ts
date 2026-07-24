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

export type CardRow = { title: string; imagePath: string | null; saleText: string | null };

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

  if (generation.mode === 'combined') {
    const rows: CardRow[] = [{ title: 'Kombiniertes Bild', imagePath: resultPaths[0] ?? null, saleText: null }];
    texts.forEach((text, i) => rows.push({ title: `Stück ${i + 1}`, imagePath: null, saleText: text }));
    return rows;
  }

  const count = Math.max(resultPaths.length, texts.length);
  return Array.from({ length: count }, (_, i) => ({
    title: `Stück ${i + 1}`,
    imagePath: resultPaths[i] ?? null,
    saleText: texts[i] ?? null,
  }));
}

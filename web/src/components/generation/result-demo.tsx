'use client';

import { useState } from 'react';
import { ResultView, type ResultCard } from '@/components/generation/result-view';

/*
  TEMPORÄR — nur zum Testen des Ergebnis-Designs ohne echte API-Aufrufe.
  Vor dem Livegang zusammen mit /test-ergebnis entfernen.

  Nutzt bewusst dieselbe ResultView wie der echte Ablauf, damit Designaenderungen
  hier sofort sichtbar sind und die Testseite nicht auseinanderlaeuft.
*/

const DEMO_TEXT = `✨ Traumhaftes Spitzen-Top in Weiß – luftig & feminin ✨

Wunderschönes Top aus filigraner Häkelspitze mit verspieltem Zackensaum. Der
schmale Trägerschnitt und der gerade Ausschnitt wirken leicht und sommerlich,
die durchgehende Musterung gibt dem Oberteil einen hochwertigen Look.

Ohne Verschluss, unterlegt. Ideal für warme Tage oder laue Sommerabende.

Größe: M (38/10)`;

const DEMO_TEXT_2 = `🌸 Sportleggings in kräftigem Pink – hoher Bund 🌸

Figurbetonte Leggings mit breitem, hohem Taillenbund und Logo-Schriftzug am
Saum. Nahtlos gestrickt, ohne Seitennähte, mit elastischem Materialmix und
dezenter Struktur an der Rückseite.

Blickdicht verarbeitet, keine Taschen, kein Verschluss.

Größe: S (36/8)`;

const DEMO_CARDS: ResultCard[] = [
  { title: 'Stück 1', imageUrl: '/examples/beispiel-1.png', saleText: DEMO_TEXT },
  { title: 'Stück 2', imageUrl: '/examples/beispiel-1.png', saleText: DEMO_TEXT_2 },
  { title: 'Stück 3', imageUrl: null, saleText: DEMO_TEXT },
];

export function ResultDemo() {
  const [key, setKey] = useState(0);
  return (
    <ResultView
      key={key}
      cards={DEMO_CARDS}
      failures={1}
      remaining={97}
      onReset={() => setKey((k) => k + 1)}
    />
  );
}

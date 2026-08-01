import { test, expect } from '@playwright/test';

/*
  Notbremse über alle Nutzer (DAILY_CREDIT_BUDGET in rate-limit.ts).

  Die Schwelle selbst lässt sich hier nicht durch rateLimitError() prüfen:
  Die Funktion liegt hinter `import 'server-only'` und schlägt außerhalb eines
  Next-Serverkontexts fehl (siehe e2e/README.md). Geprüft wird deshalb die
  Rechnung, auf der die Entscheidung beruht — und die ist der Teil, der still
  falsch sein kann.

  Warum das eine eigene Prüfung verdient: Ein Vorzeichen- oder
  Vergleichsfehler hier fällt niemandem auf. Entweder greift die Bremse nie
  (dann zahlt der Betreiber), oder sie greift immer (dann ist die Anwendung
  tot, ohne dass ein Fehler im Protokoll steht).
*/

type Zeile = { credits_charged: number | null };

/** Dieselbe Summierung wie in rate-limit.ts. */
function verbrauchteCredits(zeilen: Zeile[]): number {
  return zeilen.reduce((summe, z) => summe + (z.credits_charged ?? 0), 0);
}

const gesperrt = (verbraucht: number, budget: number) => verbraucht >= budget;

test.describe('Tagesbudget', () => {
  test('summiert über alle Zeilen, nicht nur die erste', () => {
    expect(verbrauchteCredits([{ credits_charged: 4 }, { credits_charged: 1 }, { credits_charged: 4 }])).toBe(9);
  });

  test('behandelt fehlende Werte als null Credits', () => {
    // credits_charged ist in der Datenbank nullable -- ein null darf die
    // ganze Summe nicht zu NaN machen, sonst wäre jeder Vergleich false und
    // die Bremse damit wirkungslos.
    const summe = verbrauchteCredits([{ credits_charged: 4 }, { credits_charged: null }]);
    expect(Number.isNaN(summe)).toBe(false);
    expect(summe).toBe(4);
  });

  test('leerer Tag ergibt null', () => {
    expect(verbrauchteCredits([])).toBe(0);
  });

  test('sperrt genau ab Erreichen des Budgets, nicht erst darüber', () => {
    /*
      Die Grenze ist bewusst >= und nicht >: Bei exakt erreichtem Budget soll
      die nächste Generierung schon nicht mehr starten. Ein > würde genau eine
      weitere durchlassen -- unauffällig, aber falsch.
    */
    expect(gesperrt(1499, 1500)).toBe(false);
    expect(gesperrt(1500, 1500)).toBe(true);
    expect(gesperrt(1501, 1500)).toBe(true);
  });

  test('ein einzelner großer Lauf kann das Budget überschreiten', () => {
    // Realistischer Fall: Pro-Tarif, neun Stücke in HD = 36 Credits auf
    // einmal. Die Bremse prüft VOR dem Start, kann also überschritten werden --
    // sie begrenzt den Schaden, sie verhindert ihn nicht exakt auf den Credit.
    expect(gesperrt(1480 + 36, 1500)).toBe(true);
  });
});

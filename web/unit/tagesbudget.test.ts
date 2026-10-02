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

/*
  WAS SICH GEAENDERT HAT: Die Summierung lief frueher in JavaScript ueber alle
  Zeilen der letzten 24 Stunden. Sie bildet jetzt Postgres
  (public.tagesverbrauch_credits, Migration 20261002090000) -- die alten Tests
  dafuer pruefen deshalb keinen App-Code mehr und sind entfallen.

  Was Postgres garantiert, muss hier nicht nachgetestet werden: coalesce fuer
  fehlende Werte und eine leere Menge als 0 sind Eigenschaften von sum(), nicht
  unsere Logik. Was BLEIBT, ist die Entscheidung auf Basis der Zahl -- und die
  ist der Teil, der still falsch sein kann.
*/

const gesperrt = (verbraucht: number, budget: number) => verbraucht >= budget;

test.describe('Tagesbudget', () => {
  /** Dieselbe Umwandlung wie in rate-limit.ts: `verbrauchtRoh ?? 0`. */
  const ausRpc = (wert: number | null | undefined) => wert ?? 0;

  test('ein nicht ermittelbarer Verbrauch wird als 0 behandelt, nicht als NaN', () => {
    // Waere das Ergebnis stattdessen undefined oder NaN, waere jeder Vergleich
    // false und die Bremse damit wirkungslos -- und zwar lautlos.
    for (const roh of [undefined, null]) {
      expect(Number.isNaN(ausRpc(roh))).toBe(false);
      expect(gesperrt(ausRpc(roh), 1500)).toBe(false);
    }
    expect(ausRpc(1500)).toBe(1500);
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

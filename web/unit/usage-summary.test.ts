import { test, expect } from '@playwright/test';
import { monthlyUsage, lastGrant, usedSince, buildTip, type LedgerRow } from '@/lib/usage/summary';

/*
  Auswertung des Credit-Ledgers für die Konto-Übersicht.

  Läuft ohne Browser und ohne Server: Der Playwright-Runner führt hier reinen
  Node-Code aus, die Datei fordert nie ein `page`-Fixture an. Deshalb die
  eigene Konfiguration ohne webServer (playwright.unit.config.ts).

  Aufruf:  npm run test:unit
*/

/** Kürzel, damit die Testdaten lesbar bleiben statt aus Objektliteralen zu bestehen. */
const verbrauch = (datum: string, menge: number): LedgerRow => ({
  delta: -menge,
  reason: 'generation_charge',
  created_at: new Date(datum).toISOString(),
});
const rueckbuchung = (datum: string, menge: number): LedgerRow => ({
  delta: menge,
  reason: 'generation_refund',
  created_at: new Date(datum).toISOString(),
});
const gutschrift = (datum: string, menge: number): LedgerRow => ({
  delta: menge,
  reason: 'subscription_grant',
  created_at: new Date(datum).toISOString(),
});

test.describe('monthlyUsage', () => {
  test('bildet die Monatskörbe auch am 31. korrekt — Regression', () => {
    /*
      DER WICHTIGSTE TEST DIESER DATEI.

      Genau hier steckte ein echter Fehler: Der Aufruf lautete ursprünglich
      `setMonth(getMonth() - 5)`. Steht "heute" auf dem 29., 30. oder 31.,
      rollt der Zieltag über das Monatsende hinaus -- der 31. Mai minus einen
      Monat ergibt den 1. Juli statt Juni. Ein Monat wurde dadurch doppelt
      gezählt und einer gar nicht.

      Referenzdatum ist bewusst der 31. Juli, der schärfste Fall: Juni, April
      und Februar haben allesamt weniger Tage.
    */
    const heute = new Date(2026, 6, 31); // 31. Juli 2026
    const koerbe = monthlyUsage([], 6, heute);

    expect(koerbe.map((m) => m.label)).toEqual([
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
    ]);
    // Genau ein laufender Monat, und zwar der letzte.
    expect(koerbe.filter((m) => m.isCurrent)).toHaveLength(1);
    expect(koerbe.at(-1)!.isCurrent).toBe(true);
  });

  test('rechnet Rückbuchungen gegen Abbuchungen auf', () => {
    /*
      Ohne diese Verrechnung zeigte das Diagramm Verbrauch an, der nie
      stattgefunden hat: Eine fehlgeschlagene Generierung wird zurückgebucht,
      der Nutzer hat also nichts verbraucht.
    */
    const heute = new Date(2026, 6, 15);
    const koerbe = monthlyUsage(
      [verbrauch('2026-07-05', 4), rueckbuchung('2026-07-06', 3)],
      6,
      heute,
    );

    expect(koerbe.at(-1)!.used).toBe(1);
  });

  test('klemmt negative Summen auf null', () => {
    // Eine Rückbuchung kann in den Folgemonat fallen, wenn die Abbuchung noch
    // im alten lag. Ein negativer Balken wäre sinnlos.
    const heute = new Date(2026, 6, 15);
    const koerbe = monthlyUsage([rueckbuchung('2026-07-02', 5)], 6, heute);

    expect(koerbe.at(-1)!.used).toBe(0);
  });

  test('ignoriert Gutschriften — sie sind kein Verbrauch', () => {
    const heute = new Date(2026, 6, 15);
    const koerbe = monthlyUsage([gutschrift('2026-07-01', 60)], 6, heute);

    expect(koerbe.every((m) => m.used === 0)).toBe(true);
  });
});

test.describe('lastGrant und usedSince', () => {
  test('findet die jüngste Gutschrift, nicht die erste', () => {
    const treffer = lastGrant([
      gutschrift('2026-05-01', 60),
      gutschrift('2026-07-01', 200),
      gutschrift('2026-06-01', 60),
    ]);

    expect(treffer?.amount).toBe(200);
  });

  test('zählt nur Verbrauch nach der Gutschrift', () => {
    const zeilen = [
      verbrauch('2026-06-20', 10), // davor — darf nicht zählen
      verbrauch('2026-07-05', 3),
      verbrauch('2026-07-09', 2),
    ];

    expect(usedSince(zeilen, new Date('2026-07-01').toISOString())).toBe(5);
  });
});

test.describe('buildTip', () => {
  test('schweigt bei dünner Datenlage', () => {
    /*
      Bewusstes Verhalten, kein Versehen: Ein Tipp ohne Substanz ("Nutze deine
      Credits!") ist schlechter als gar keiner. Erst ab drei abgeschlossenen
      Monaten mit Verbrauch gibt es eine Aussage.
    */
    const monate = monthlyUsage([verbrauch('2026-07-05', 5)], 6, new Date(2026, 6, 15));

    const tipp = buildTip({
      plan: 'basic',
      balance: 55,
      grantAmount: 60,
      usedSinceGrant: 5,
      monthly: monate,
    });

    expect(tipp).toBeNull();
  });

  test('rät einem Pro-Konto bei Unterauslastung zum günstigeren Tarif', () => {
    /*
      Der Tipp darf gegen den eigenen Umsatz raten. Das ist der ehrliche
      Umgang mit den eigenen Daten -- wer sich nicht überzahlt fühlt, kündigt
      seltener ganz.
    */
    const heute = new Date(2026, 6, 15);
    const zeilen = [
      verbrauch('2026-04-10', 15),
      verbrauch('2026-05-10', 18),
      verbrauch('2026-06-10', 12),
    ];

    const tipp = buildTip({
      plan: 'pro',
      balance: 400,
      grantAmount: 200,
      usedSinceGrant: 10,
      monthly: monthlyUsage(zeilen, 6, heute),
    });

    expect(tipp).not.toBeNull();
    expect(tipp!.text).toContain('Basic');
    // Der Tipp muss die Zahl nennen, auf der er beruht — sonst ist er
    // Behauptung statt Auswertung.
    expect(tipp!.text).toMatch(/\d+ von 200/);
  });

  test('weist im Free-Tarif auf aufgebrauchtes Guthaben hin', () => {
    const tipp = buildTip({
      plan: 'free',
      balance: 0,
      grantAmount: 3,
      usedSinceGrant: 3,
      monthly: monthlyUsage([], 6, new Date(2026, 6, 15)),
    });

    expect(tipp?.cta?.href).toBe('/preise');
  });
});

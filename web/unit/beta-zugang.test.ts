import { test, expect } from '@playwright/test';

/*
  Die Zugangssperre der geschlossenen Beta (lib/beta/config.ts).

  Warum als Unit-Test und nicht per E2E: Die E2E-Suite laeuft bewusst mit
  NEXT_PUBLIC_BETA=false, damit sie das oeffentliche Produkt prueft (siehe
  playwright.config.ts). Die Sperre selbst waere dort also nie aktiv. Sie sitzt
  aber in einer reinen Funktion -- die laesst sich hier ohne Server pruefen.

  Warum sie Tests verdient: Sie entscheidet, wer sich ueberhaupt anmelden darf.
  Faellt sie aus, steht die Anwendung waehrend der Beta offen, ohne dass
  irgendetwas kaputt aussieht. Und die Standardrichtung ist das Heikle: Eine
  vergessene Variable muss SPERREN, nicht oeffnen.

  BETA_AKTIV wird beim Import festgehalten, deshalb wird das Modul in jedem
  Test frisch geladen -- mit `?${n}` an der Kennung, weil Node sonst die
  zwischengespeicherte Fassung liefert.

  Bewusst mit RELATIVEM Pfad statt ueber den @/-Alias: Den loest der Bundler
  nur bei statischen Importen auf, ein dynamischer Import mit zusammengesetzter
  Zeichenkette laeuft an ihm vorbei ("Cannot find package '@/lib'").
*/

let n = 0;
async function ladeFrisch(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import(`../src/lib/beta/config.ts?${n++}`) as Promise<typeof import('@/lib/beta/config')>;
}

test.describe('betaZugangErlaubt', () => {
  test('ohne gesetzte Variable ist die Beta AN -- die sichere Richtung', async () => {
    const m = await ladeFrisch({ NEXT_PUBLIC_BETA: undefined, BETA_ALLOWLIST: 'a@b.de' });
    expect(m.BETA_AKTIV).toBe(true);
    expect(m.betaZugangErlaubt('fremder@example.com')).toBe(false);
  });

  /*
    Der gefaehrlichste Fall: Beta an, aber die Liste fehlt. Hier muss die
    Antwort "niemand" sein. Waere der Standard "alle", haette eine vergessene
    Variable die Anwendung still geoeffnet -- ein Fehler, den man erst bemerkt,
    wenn Fremde drin sind.
  */
  test('leere Allowlist sperrt ALLE aus, nicht alle hinein', async () => {
    const m = await ladeFrisch({ NEXT_PUBLIC_BETA: 'true', BETA_ALLOWLIST: undefined });
    expect(m.betaZugangErlaubt('a@b.de')).toBe(false);
    expect(m.betaZugangErlaubt('')).toBe(false);
  });

  test('freigeschaltete Adresse kommt durch', async () => {
    const m = await ladeFrisch({ NEXT_PUBLIC_BETA: 'true', BETA_ALLOWLIST: 'a@b.de,zweite@c.de' });
    expect(m.betaZugangErlaubt('a@b.de')).toBe(true);
    expect(m.betaZugangErlaubt('zweite@c.de')).toBe(true);
    expect(m.betaZugangErlaubt('dritte@c.de')).toBe(false);
  });

  test('Gross-/Kleinschreibung und Leerzeichen aendern nichts', async () => {
    // Adressen kommen aus einem Formular -- getippte Leerzeichen und
    // Grossschreibung sind der Normalfall, kein Sonderfall.
    const m = await ladeFrisch({ NEXT_PUBLIC_BETA: 'true', BETA_ALLOWLIST: '  A@B.de , zweite@c.de ' });
    expect(m.betaZugangErlaubt('a@b.de')).toBe(true);
    expect(m.betaZugangErlaubt('  A@B.DE  ')).toBe(true);
  });

  test('abgeschaltete Beta laesst jeden durch', async () => {
    const m = await ladeFrisch({ NEXT_PUBLIC_BETA: 'false', BETA_ALLOWLIST: undefined });
    expect(m.BETA_AKTIV).toBe(false);
    expect(m.betaZugangErlaubt('irgendwer@example.com')).toBe(true);
  });

  test('nur exakt "false" schaltet ab -- nicht "0", "nein" oder "False"', async () => {
    // Sonst haette ein Tippfehler in der Umgebungsvariablen die Sperre
    // lautlos aufgehoben.
    for (const wert of ['0', 'nein', 'False', 'FALSE', '']) {
      const m = await ladeFrisch({ NEXT_PUBLIC_BETA: wert, BETA_ALLOWLIST: undefined });
      expect(m.BETA_AKTIV, `NEXT_PUBLIC_BETA="${wert}" haette die Sperre aufgehoben`).toBe(true);
    }
  });
});

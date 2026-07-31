import { test, expect } from '@playwright/test';
import { isGenerationLocked, lockedImagePath, redactSaleText } from '@/lib/generation/lock';
import type { PlanKey } from '@/lib/generation/constants';

/*
  Die Bezahlschranke — wirtschaftlich der wichtigste reine Codepfad.

  Bricht sie, verschenken wir das Produkt: Jeder Free-Nutzer bekäme alle
  Ergebnisse in voller Auflösung samt vollständigem Verkaufstext. Der Fehler
  wäre dabei völlig lautlos — nichts stürzt ab, nichts wird protokolliert, die
  Einnahmen bleiben nur aus. Genau solche Fehler findet man nur mit Tests.
*/

test.describe('isGenerationLocked', () => {
  /*
    Vollständige Wahrheitstabelle statt Stichproben. Bei zwei Eingaben mit
    drei bzw. zwei Werten sind das sechs Fälle -- die kann man alle prüfen,
    statt zu hoffen, die richtigen ausgewählt zu haben.
  */
  const faelle: Array<[PlanKey, boolean, boolean, string]> = [
    ['free', false, true, 'Free ohne Freigabe: verdeckt — der Regelfall ab dem 2. Ergebnis'],
    ['free', true, false, 'Free mit Freigabe: sichtbar — das eine Gratis-Ergebnis'],
    ['basic', false, false, 'Basic: nie verdeckt'],
    ['basic', true, false, 'Basic mit Freigabe: nie verdeckt'],
    ['pro', false, false, 'Pro: nie verdeckt'],
    ['pro', true, false, 'Pro mit Freigabe: nie verdeckt'],
  ];

  for (const [plan, freigabe, erwartet, beschreibung] of faelle) {
    test(beschreibung, () => {
      expect(isGenerationLocked(plan, freigabe)).toBe(erwartet);
    });
  }

  test('ein Upgrade schaltet alte Ergebnisse rückwirkend frei', () => {
    /*
      Bewusst als eigener Test, weil es ein Versprechen an den Kunden ist und
      auf der Preisseite so beworben wird ("ein Upgrade schaltet dann auch
      alle bisherigen Ergebnisse rückwirkend frei"). Dieselbe Generierung,
      nur ein anderer Tarif.
    */
    expect(isGenerationLocked('free', false)).toBe(true);
    expect(isGenerationLocked('basic', false)).toBe(false);
  });
});

test.describe('lockedImagePath', () => {
  test('leitet den Pfad der unscharfen Variante ab', () => {
    expect(lockedImagePath('abc/def/ergebnis-0.png')).toBe('abc/def/ergebnis-0-locked.jpg');
  });

  test('greift auch bei großgeschriebener Endung', () => {
    expect(lockedImagePath('a/b/C.PNG')).toBe('a/b/C-locked.jpg');
  });

  test('lässt einen Pfad ohne .png-Endung unverändert', () => {
    /*
      Wichtig für die Sicherheit: Käme hier ein unveränderter Pfad heraus, der
      trotzdem als "verdeckt" behandelt wird, lieferte die App das ORIGINAL
      aus. Der Test hält fest, dass die Funktion nur .png umschreibt -- und
      dass Aufrufer sich nicht auf eine stille Umwandlung verlassen dürfen.
    */
    expect(lockedImagePath('a/b/c.jpg')).toBe('a/b/c.jpg');
  });
});

test.describe('redactSaleText', () => {
  const langerText =
    'Wunderschöne Jeans in Größe 38, kaum getragen und in tadellosem Zustand. ' +
    'Perfekt für den Alltag und lässige Anlässe.';

  test('kürzt lange Texte und markiert die Kürzung', () => {
    const gekuerzt = redactSaleText(langerText);

    expect(gekuerzt.length).toBeLessThan(langerText.length);
    expect(gekuerzt.endsWith('…')).toBe(true);
  });

  test('gibt nicht mehr preis als vorgesehen', () => {
    /*
      Der eigentliche Schutzzweck: Der Ausschnitt darf nicht so lang werden,
      dass der Text auch ohne Bezahlung brauchbar ist. 70 Zeichen plus das
      Auslassungszeichen ist die Obergrenze.
    */
    expect(redactSaleText(langerText).length).toBeLessThanOrEqual(71);
  });

  test('lässt kurze Texte unangetastet', () => {
    // Kein irreführendes Auslassungszeichen, wenn gar nichts fehlt.
    expect(redactSaleText('Kurzer Text')).toBe('Kurzer Text');
  });

  test('schneidet an einer Wortgrenze, nicht mitten im Wort', () => {
    /*
      Die Prüfung muss am ORIGINAL ansetzen, nicht am Ergebnis: Der erste
      Versuch erwartete ein Leerzeichen vor dem Auslassungszeichen und schlug
      fehl -- zu Recht, denn die Funktion entfernt es bewusst (sauberere
      Typografie). Der Fehler lag also im Test, nicht im Code.

      Richtig ist: Das gekürzte Stück muss ein Präfix des Originals sein, und
      im Original muss an der Schnittstelle ein Leerzeichen folgen. Genau das
      bedeutet "an einer Wortgrenze geschnitten".
    */
    const gekuerzt = redactSaleText(langerText);
    const ohneAuslassung = gekuerzt.slice(0, -1);

    expect(langerText.startsWith(ohneAuslassung)).toBe(true);
    expect(langerText[ohneAuslassung.length]).toBe(' ');
  });

  test('kommt mit leerem Text zurecht', () => {
    expect(redactSaleText('   ')).toBe('');
  });
});

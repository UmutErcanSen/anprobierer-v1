import { test, expect } from '@playwright/test';
import { bewerteAntwort, PruefungNichtMoeglich, HARTE_SCHWELLEN } from '@/lib/generation/moderation-policy';

/*
  Auswertung der Moderations-Antwort (lib/generation/moderation-policy.ts).

  Warum ausgerechnet das Tests verdient: Diese Regel entscheidet, ob
  strafbares Material in unsere Verarbeitung gelangt -- allen voran
  sexualisierte Darstellungen Minderjaehriger. Ein Fehler hier ist voellig
  lautlos: Es stuerzt nichts ab, es wird nur nichts mehr geblockt. Genau
  deshalb wird hier nicht die API von OpenAI geprueft (die ist deren Sache),
  sondern UNSERE Auswertung ihrer Antwort.
*/

/** Antwort mit einem Ergebnis, wie die API sie liefert. */
function antwort(opts: { flagged?: boolean; categories?: Record<string, boolean>; scores?: Record<string, number> }) {
  return {
    results: [
      {
        flagged: opts.flagged ?? false,
        categories: { violence: false, sexual: false, 'sexual/minors': false, ...(opts.categories ?? {}) },
        category_scores: { violence: 0, sexual: 0.001, 'sexual/minors': 0.001, ...(opts.scores ?? {}) },
      },
    ],
  };
}

test.describe('bewerteAntwort', () => {
  test('laesst eine unbedenkliche Antwort durch', () => {
    const r = bewerteAntwort(antwort({}));
    expect(r.beanstandet).toBe(false);
    expect(r.kategorien).toEqual([]);
  });

  test('erkennt eine Beanstandung und nennt die Kategorie fuers Protokoll', () => {
    const r = bewerteAntwort(antwort({ flagged: true, categories: { violence: true }, scores: { violence: 0.97 } }));
    expect(r.beanstandet).toBe(true);
    expect(r.kategorien).toContain('violence');
  });

  /*
    Der wichtigste Test der Datei: unsere einzige Regel, die STRENGER ist als
    der Anbieter. OpenAI beanstandet hier nicht (flagged: false), der Wert
    liegt aber ueber unserer eigenen Schwelle. Ohne diesen Test koennte die
    Verschaerfung unbemerkt verschwinden -- und niemand wuerde es merken,
    weil weiterhin alles "funktioniert".
  */
  test('blockt Minderjaehrigen-Verdacht auch dann, wenn OpenAI selbst nicht beanstandet', () => {
    const knappDarueber = HARTE_SCHWELLEN['sexual/minors'] + 0.01;
    const r = bewerteAntwort(antwort({ flagged: false, scores: { 'sexual/minors': knappDarueber } }));
    expect(r.beanstandet).toBe(true);
    expect(r.kategorien).toContain('sexual/minors');
  });

  test('greift genau AB der Schwelle, nicht erst darueber', () => {
    const genau = HARTE_SCHWELLEN['sexual/minors'];
    expect(bewerteAntwort(antwort({ scores: { 'sexual/minors': genau } })).beanstandet).toBe(true);
    expect(bewerteAntwort(antwort({ scores: { 'sexual/minors': genau - 0.001 } })).beanstandet).toBe(false);
  });

  test('beanstandet, sobald EIN Ergebnis auffaellt -- nicht erst wenn alle auffallen', () => {
    // Mehrere Eingaben (Text + Bilder) ergeben mehrere Ergebnisse. Ein
    // sauberes Personenfoto darf ein problematisches Kleidungsbild nicht
    // aufwiegen.
    const gemischt = {
      results: [...antwort({}).results, ...antwort({ flagged: true, categories: { sexual: true } }).results],
    };
    expect(bewerteAntwort(gemischt).beanstandet).toBe(true);
  });

  /*
    Eine Antwort, die wir nicht verstehen, darf NICHT als unbedenklich
    durchgehen -- sonst waere ein Formatwechsel beim Anbieter stillschweigend
    eine abgeschaltete Pruefung.
  */
  test('sperrt bei unverstaendlicher Antwort, statt sie als unbedenklich zu lesen', () => {
    expect(() => bewerteAntwort({ unerwartet: true })).toThrow(PruefungNichtMoeglich);
    expect(() => bewerteAntwort(null)).toThrow(PruefungNichtMoeglich);
    expect(() => bewerteAntwort({ results: [{ flagged: 'ja' }] })).toThrow(PruefungNichtMoeglich);
  });

  test('leere Ergebnisliste gilt als unbedenklich', () => {
    expect(bewerteAntwort({ results: [] }).beanstandet).toBe(false);
  });
});

import { z } from 'zod';

/*
  Unsere Regeln zur Auswertung einer Moderations-Antwort -- bewusst getrennt
  vom Aufruf selbst (lib/openai/moderation.ts).

  Der Grund fuer die Trennung ist Pruefbarkeit: Das Aufrufmodul traegt
  'server-only' und den Betreiber-Schluessel, laesst sich also nicht in einem
  Unit-Test laden. Hier steckt kein I/O, kein Schluessel und keine Adresse --
  nur die Entscheidung. Und genau die ist der Teil, der bei einem Fehler
  lautlos versagt: Es stuerzt nichts ab, es wird nur nichts mehr geblockt.
*/

/*
  Zusaetzliche, deutlich schaerfere Schwelle fuer die schwerwiegendste
  Kategorie. `flagged` allein entscheidet nach den Standardschwellen von
  OpenAI -- fuer sexualisierte Darstellungen Minderjaehriger ist uns das zu
  grosszuegig. Hier gilt: schon ein leiser Verdacht blockiert. Ein
  faelschlich abgelehnter Auftrag kostet einen Nutzer eine Minute; ein
  faelschlich durchgelassener kostet uns die Existenz.
*/
export const HARTE_SCHWELLEN: Record<string, number> = {
  'sexual/minors': 0.05,
};

export type PruefErgebnis = {
  beanstandet: boolean;
  /** Ausgeloeste Kategorien -- ausschliesslich fuer das Serverprotokoll.
   *  Dem Nutzer nennen wir sie NICHT (siehe /api/generate). */
  kategorien: string[];
};

/** Die Pruefung war nicht moeglich (Netz, Ausfall, unverstaendliche Antwort).
 *
 *  Bewusst OHNE Parameter-Eigenschaft (`constructor(readonly ursache: string)`),
 *  obwohl OpenAIError in lib/openai/images.ts es so macht: Node kann diese
 *  TypeScript-Kurzform in seinem Strip-Modus nicht uebersetzen. Die Ursache
 *  steckt ohnehin in der Meldung -- ein eigenes Feld waere doppelt. */
export class PruefungNichtMoeglich extends Error {
  constructor(ursache: string) {
    super(`Inhaltspruefung nicht moeglich: ${ursache}`);
    this.name = 'PruefungNichtMoeglich';
  }
}

const antwortSchema = z.object({
  results: z.array(
    z.object({
      flagged: z.boolean(),
      categories: z.record(z.string(), z.boolean()),
      category_scores: z.record(z.string(), z.number()),
    }),
  ),
});

/**
 * Wertet die Rohantwort der Moderations-API nach unseren Regeln aus.
 *
 * Wirft `PruefungNichtMoeglich`, wenn die Antwort nicht dem erwarteten Format
 * entspricht. Das ist Absicht und kein uebertriebener Eifer: Eine Antwort, die
 * wir nicht verstehen, darf NICHT als "unbedenklich" durchgehen -- sonst waere
 * ein Formatwechsel beim Anbieter stillschweigend eine abgeschaltete Pruefung.
 */
export function bewerteAntwort(roh: unknown): PruefErgebnis {
  const geparst = antwortSchema.safeParse(roh);
  if (!geparst.success) throw new PruefungNichtMoeglich('unerwartetes Antwortformat');

  const kategorien = new Set<string>();
  for (const r of geparst.data.results) {
    if (r.flagged) {
      for (const [name, treffer] of Object.entries(r.categories)) {
        if (treffer) kategorien.add(name);
      }
    }
    for (const [name, schwelle] of Object.entries(HARTE_SCHWELLEN)) {
      if ((r.category_scores[name] ?? 0) >= schwelle) kategorien.add(name);
    }
  }

  return { beanstandet: kategorien.size > 0, kategorien: [...kategorien] };
}

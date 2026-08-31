/*
  Welche fertigen Anproben wurden dem Nutzer schon gezeigt?

  Gemeinsam genutzt von der globalen Leiste (laufende-anprobe.tsx) und der
  Warteansicht im Erstellen-Formular (generate-flow.tsx). Ohne diesen
  gemeinsamen Merkzettel meldet die Leiste eine Anprobe als frische Neuigkeit,
  die der Nutzer eine Sekunde vorher auf dem Erstellen-Formular in voller
  Groesse vor sich hatte -- die Meldung waere dann keine Information mehr,
  sondern Laerm.

  Bewusst localStorage und nicht die Datenbank: Es geht ausschliesslich darum,
  ob DIESER Browser die Meldung schon gezeigt hat. Ein zweites Geraet soll die
  Meldung durchaus noch bekommen. Und ein Datenbankfeld dafuer waere ein
  Schreibzugriff pro Blick -- viel Aufwand fuer eine Kleinigkeit, die nichts
  kostet, wenn sie mal verloren geht.
*/

const KEY = 'anprobe:gemeldet';

/** Nur gegen kurzfristige Doppelmeldungen -- kein Archiv. */
const MAX_EINTRAEGE = 20;

export function gemeldeteLesen(): string[] {
  try {
    const roh = localStorage.getItem(KEY);
    const liste: unknown = roh ? JSON.parse(roh) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // Privater Modus, blockierte Site-Daten, Vorschau-Kontexte: Der Zugriff
    // selbst kann werfen, und ein beschaedigter Eintrag laesst JSON.parse
    // werfen. Ohne Gedaechtnis funktioniert alles weiter -- es wird dann
    // hoechstens einmal zu viel gemeldet.
    return [];
  }
}

export function alsGemeldetMerken(id: string): void {
  try {
    const neu = [id, ...gemeldeteLesen().filter((x) => x !== id)].slice(0, MAX_EINTRAEGE);
    localStorage.setItem(KEY, JSON.stringify(neu));
  } catch {
    /* siehe gemeldeteLesen() */
  }
}

/**
 * Geschlossene Beta.
 *
 * EIN Schalter fuer alles: Banner, ausgeblendete Anmelde-/Registrier-Knoepfe,
 * serverseitige Sperre. Zum Livegang genuegt es, `NEXT_PUBLIC_BETA=false` zu
 * setzen und neu zu deployen -- es muss nichts auskommentiert oder
 * zurueckgebaut werden.
 *
 * WARUM NEXT_PUBLIC: Der Wert wird auch im Browser gebraucht (Header blendet
 * Knoepfe aus). Next.js setzt solche Variablen zur BAUZEIT ein, ein Umschalten
 * erfordert also einen neuen Build. Das ist hier gewollt: Der Uebergang von
 * Beta zu Live ist ohnehin ein bewusster Deploy, kein Schalter, den man
 * versehentlich umlegt.
 *
 * Standard ist AN. Wer die Variable vergisst, landet also in der sicheren
 * Variante (geschlossen) statt versehentlich offen.
 */
export const BETA_AKTIV = process.env.NEXT_PUBLIC_BETA !== 'false';

/**
 * Wer sich waehrend der Beta anmelden darf -- Komma-getrennte Liste in
 * BETA_ALLOWLIST. Bewusst OHNE NEXT_PUBLIC: Die Adressen der Testenden
 * gehoeren nicht ins Browser-Bundle.
 *
 * Leere Liste bedeutet: niemand kommt rein. Auch das ist die sichere
 * Richtung -- eine vergessene Variable sperrt aus, statt zu oeffnen.
 */
function erlaubteMails(): string[] {
  return (process.env.BETA_ALLOWLIST ?? '')
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Darf sich diese Adresse waehrend der Beta anmelden?
 *
 * Ausserhalb der Beta immer `true` -- so muessen die Aufrufer nicht selbst
 * zwischen den Zustaenden unterscheiden.
 */
export function betaZugangErlaubt(email: string): boolean {
  if (!BETA_AKTIV) return true;
  return erlaubteMails().includes(email.trim().toLowerCase());
}

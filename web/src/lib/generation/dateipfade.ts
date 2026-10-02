import { lockedImagePath } from '@/lib/generation/lock';
import { thumbnailPath } from '@/lib/generation/prepare-image';

/*
  Alle Storage-Dateien, die zu EINEM Ergebnisbild gehoeren.

  Warum es diese Funktion gibt: Zu jedem Ergebnis entstehen in process.ts drei
  Dateien -- das Original, die unscharfe Vorschau fuer gesperrte Ergebnisse
  (lockedImagePath) und die kleine Rastervariante (thumbnailPath). Die drei
  Loeschpfade kannten aber nur die ersten beiden. Die Thumbnails blieben nach
  jeder Loeschung im Speicher liegen -- auch nach "Konto endgueltig loeschen".

  Das war nicht nur unsauber, sondern ein Rechtsproblem: Die
  Datenschutzerklaerung sagt zu Ergebnisbildern "bis zur Loeschung deines
  Kontos", der Bestaetigungsdialog sagt "unwiderruflich geloescht". Beides war
  unwahr, solange abgeleitete Bilder der Person liegen blieben (DSGVO Art. 17).

  Der Fehler entstand, weil die Thumbnails SPAETER dazukamen als die
  Loeschpfade und niemand die drei Stellen gleichzeitig im Blick hatte. Genau
  deshalb steht die Liste jetzt an EINER Stelle: Kommt eine vierte Variante
  dazu, wird sie hier ergaenzt und gilt sofort ueberall.
*/

/**
 * Jeder Pfad, der zu `imagePath` im results-Bucket existieren kann.
 *
 * Bewusst unbedingt alle drei, ohne vorher zu pruefen, ob es sie gibt:
 * `storage.remove()` ignoriert nicht vorhandene Eintraege stillschweigend,
 * und eine Existenzpruefung waere ein zusaetzlicher Netzaufruf je Datei --
 * fuer nichts.
 */
export function alleDateienZuBild(imagePath: string): string[] {
  return [imagePath, lockedImagePath(imagePath), thumbnailPath(imagePath)];
}

/**
 * Dieselbe Liste fuer mehrere Bilder, dedupliziert.
 *
 * Die Aufrufer sammeln Pfade aus `cards[].imagePath` UND dem alten
 * `result_paths`-Array (siehe cards.ts) -- dabei kommen Pfade doppelt vor.
 */
export function alleDateienZuBildern(imagePfade: Iterable<string>): string[] {
  const alle = new Set<string>();
  for (const p of imagePfade) for (const datei of alleDateienZuBild(p)) alle.add(datei);
  return [...alle];
}

import type { PlanKey } from '@/lib/generation/constants';

/**
 * Free-Tarif: nur das ERSTE Ergebnis (generations.is_free_reveal) wird in
 * voller Aufloesung/Laenge gezeigt. Ab bezahltem Tarif ist nichts mehr
 * verdeckt, unabhaengig vom Alter der Generierung -- ein Upgrade schaltet
 * rueckwirkend alle bisherigen Ergebnisse frei.
 *
 * Diese Entscheidung faellt ausschliesslich serverseitig (siehe die Nutzung
 * in den API-/Server-Component-Dateien): der Client bekommt bei einer
 * verdeckten Generierung gar nicht erst die echte Bild-URL oder den vollen
 * Text zu sehen (siehe lockedImagePath/redactSaleText) -- eine reine
 * CSS-Verpixelung im Browser waere trivial per DevTools zu umgehen.
 */
export function isGenerationLocked(plan: PlanKey, isFreeReveal: boolean): boolean {
  return plan === 'free' && !isFreeReveal;
}

/**
 * Pfad der serverseitig vorbereiteten, unscharfen Vorschau-Variante --
 * abgeleitet aus dem Original-Pfad, damit keine zusaetzliche Spalte/kein
 * zusaetzliches Feld noetig ist. Wird in process.ts beim Hochladen des
 * Ergebnisses IMMER miterzeugt (auch fuer zahlende Nutzer -- einfacher als
 * bedingte Erzeugung, und schuetzt auch bei einem spaeteren Downgrade).
 */
export function lockedImagePath(path: string): string {
  return path.replace(/\.png$/i, '-locked.jpg');
}

const PREVIEW_CHARS = 70;

/** Kuerzt den Verkaufstext auf einen neugierig machenden Ausschnitt, statt
 *  den vollen (kostenlos nutzbaren) Text ungeschuetzt auszuliefern. */
export function redactSaleText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_CHARS) return trimmed;
  const cut = trimmed.slice(0, PREVIEW_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : PREVIEW_CHARS)}…`;
}

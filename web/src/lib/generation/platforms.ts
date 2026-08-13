/**
 * Ziel-Plattformen für den "Für X vorbereiten"-Export im Ergebnis/Verlauf.
 *
 * WICHTIG: Weder Vinted noch Kleinanzeigen bieten eine öffentliche Listing-
 * API für Drittanbieter an (Stand dieser Einschätzung). Eine inoffizielle
 * Anbindung über nicht-öffentliche Endpunkte würde gegen deren Nutzungs-
 * bedingungen verstoßen und könnte Nutzerkonten gefährden — das bauen wir
 * bewusst NICHT. Stattdessen bereiten wir Titel/Beschreibung passend
 * gekürzt vor, laden das Bild herunter und öffnen die normale "Inserat
 * erstellen"-Seite der Plattform in einem neuen Tab; Einfügen und
 * Hochladen bleibt beim Nutzer. Für eBay gäbe es später einen echten
 * API-Weg (offizielles Sell-API-Programm, OAuth pro Nutzerkonto) — das ist
 * ein eigenes, größeres Feature und hier bewusst noch nicht umgesetzt.
 *
 * ACHTUNG: URLs und Zeichenlimits ändern sich, wenn die Plattformen ihre
 * Formulare überarbeiten. Vor dem Live-Gang und danach in regelmäßigen
 * Abständen gegen die echten Seiten prüfen.
 */

export type PlatformKey = 'vinted' | 'kleinanzeigen' | 'ebay';

export type Platform = {
  key: PlatformKey;
  label: string;
  newListingUrl: string;
  titleMaxLength: number;
  descriptionMaxLength: number;
  /**
   * In einem Satz: Was unterscheidet den Text dieser Plattform von den
   * anderen? Wird direkt unter der Tab-Leiste angezeigt.
   *
   * Grund: Die Anpassung ist die eigentliche Leistung dieses Bereichs -- und
   * sie war vollstaendig unsichtbar. Man haette zwischen den Tabs hin- und
   * herklicken und aufmerksam lesen muessen, um ueberhaupt zu bemerken, dass
   * der Text umgeschrieben wurde. Der Aufwand steckte drin, kam aber nicht
   * an. Dieser Satz macht ihn in einer Zeile sichtbar.
   */
  hinweis: string;
};

export const PLATFORMS: Platform[] = [
  {
    key: 'vinted',
    label: 'Vinted',
    newListingUrl: 'https://www.vinted.de/items/new',
    titleMaxLength: 60,
    descriptionMaxLength: 1000,
    hinweis: 'Lockerer Ton mit Emojis — so verfasst, wie es auf Vinted üblich ist.',
  },
  {
    key: 'kleinanzeigen',
    label: 'Kleinanzeigen',
    newListingUrl: 'https://www.kleinanzeigen.de/p-anzeige-aufgeben-schritt2.html',
    titleMaxLength: 65,
    descriptionMaxLength: 4000,
    hinweis: 'Sachlich umgeschrieben, ohne Emojis und Hashtags.',
  },
  {
    key: 'ebay',
    label: 'eBay',
    newListingUrl: 'https://www.ebay.de/sl/sell',
    titleMaxLength: 80,
    descriptionMaxLength: 4000,
    hinweis: 'Strukturiert umgeschrieben, mit Stichpunkten zu Zustand und Größe.',
  },
];

/** Zeile, die zu einer Aufzählung gehört ("- ", "• ", "1. "). */
const LISTENPUNKT = /^([-•*]|\d+[.)])\s+/;

/**
 * Entfernt Markdown-Reste, die das Sprachmodell trotz Anweisung gelegentlich
 * einstreut. In einem Plattform-Formular ist "### Größe" schlicht falscher
 * Text -- dort gibt es kein Markdown, das gerendert würde.
 * Listenzeichen bleiben absichtlich stehen: Sie sind im eBay-Stil erwünscht
 * und dort auch als reiner Text lesbar.
 */
function bereinige(zeile: string): string {
  return zeile
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .trim();
}

/**
 * Zerlegt unseren generierten Verkaufstext (Überschrift in der ersten Zeile,
 * danach die Beschreibung, siehe buildSalePrompt in prompts.ts) und kürzt
 * beides auf das Limit der Zielplattform, ohne mitten im Wort abzuschneiden.
 *
 * WICHTIG ist die Behandlung der Zeilenumbrüche. Sprachmodelle brechen Sätze
 * gern mitten im Absatz um ("weiche" Umbrüche). Diese Funktion trennte
 * vorher an JEDEM \n und fügte alles mit \n\n wieder zusammen -- aus einem
 * umbrochenen Satz wurden dadurch zwei Absätze, und die Vorschau (und damit
 * das, was bei Vinted eingefügt wurde) sah so aus:
 *
 *     Wunderschönes Top aus filigraner Häkelspitze mit Zackensaum. Der
 *
 *     schmale Trägerschnitt und der gerade Ausschnitt wirken leicht,
 *
 * Ein mitten entzweigerissener Satz -- genau der Eindruck von Nachlässigkeit,
 * den ein Verkaufstext nicht machen darf.
 *
 * Jetzt gilt: Eine LEERZEILE trennt Absätze, ein einfacher Umbruch innerhalb
 * eines Absatzes ist ein weicher Umbruch und wird zu einem Leerzeichen.
 * Ausnahme sind Aufzählungen -- die behalten ihre eigene Zeile, sonst würde
 * aus dem strukturierten eBay-Text eine einzige Wurst.
 */
export function formatSaleTextForPlatform(
  saleText: string,
  platform: Platform,
): { title: string; description: string } {
  const zeilen = saleText.replace(/\r\n/g, '\n').split('\n');

  // Titel ist die erste Zeile MIT Inhalt -- führende Leerzeilen kommen vor.
  const titelIndex = zeilen.findIndex((z) => z.trim());
  const rawTitle = titelIndex === -1 ? '' : bereinige(zeilen[titelIndex]);

  const absaetze = zeilen
    .slice(titelIndex + 1)
    .join('\n')
    .split(/\n\s*\n/) // echte Absatzgrenze: mindestens eine Leerzeile
    .map((absatz) => {
      // Innerhalb eines Absatzes: weiche Umbrüche zusammenziehen, echte
      // Aufzählungspunkte auf eigener Zeile lassen.
      const teile: string[] = [];
      for (const roh of absatz.split('\n')) {
        const zeile = bereinige(roh);
        if (!zeile) continue;
        if (teile.length === 0 || LISTENPUNKT.test(zeile)) teile.push(zeile);
        else teile[teile.length - 1] += ` ${zeile}`;
      }
      return teile.join('\n');
    })
    .filter(Boolean);

  const body = absaetze.join('\n\n') || rawTitle;

  return {
    title: truncate(rawTitle, platform.titleMaxLength),
    description: truncate(body, platform.descriptionMaxLength),
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  // Nur am Wortende kuerzen, wenn dabei nicht zu viel verloren geht --
  // sonst lieber hart abschneiden als ein Drittel des Textes zu verwerfen.
  const safe = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trimEnd()}…`;
}

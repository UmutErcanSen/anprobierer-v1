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
};

export const PLATFORMS: Platform[] = [
  {
    key: 'vinted',
    label: 'Vinted',
    newListingUrl: 'https://www.vinted.de/items/new',
    titleMaxLength: 60,
    descriptionMaxLength: 1000,
  },
  {
    key: 'kleinanzeigen',
    label: 'Kleinanzeigen',
    newListingUrl: 'https://www.kleinanzeigen.de/p-anzeige-aufgeben-schritt2.html',
    titleMaxLength: 65,
    descriptionMaxLength: 4000,
  },
  {
    key: 'ebay',
    label: 'eBay',
    newListingUrl: 'https://www.ebay.de/sl/sell',
    titleMaxLength: 80,
    descriptionMaxLength: 4000,
  },
];

/**
 * Zerlegt unseren generierten Verkaufstext (Überschrift in der ersten
 * Zeile, ggf. mit Markdown "**" umrandet, danach die Beschreibung, siehe
 * buildSalePrompt in prompts.ts) und kürzt beides auf das Limit der
 * Zielplattform, ohne mitten im Wort abzuschneiden.
 */
export function formatSaleTextForPlatform(
  saleText: string,
  platform: Platform,
): { title: string; description: string } {
  const lines = saleText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const rawTitle = (lines[0] ?? '').replace(/\*\*/g, '').trim();
  const body = lines.slice(1).join('\n\n') || rawTitle;

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

/**
 * Zentrale Fakten der Bildgenerierung: Kleidungstypen, Qualität pro Plan,
 * Credit-Kosten, Modell und Formate.
 *
 * Aus der alten api.js/utils.js übernommen, aber an einer Stelle gebündelt
 * und typisiert. Preise und Modellname müssen noch gegen die tatsächliche
 * OpenAI-Rechnung geprüft werden (siehe unten).
 */

export type Quality = 'standard' | 'hd';
export type GenerationMode = 'single' | 'combined';
export type PlanKey = 'free' | 'starter' | 'pro';

/** Kleidungstypen (Schlüssel = DB-Wert, EN = für den Prompt, DE = fürs UI). */
export const CLOTHING_TYPES = {
  jacket_coat: { de: 'Jacken & Mäntel', en: 'jacket or coat' },
  sweater: { de: 'Pullover & Strickpullover', en: 'sweater or pullover' },
  blazer_suit: { de: 'Blazer & Anzüge', en: 'blazer or suit' },
  dress: { de: 'Kleider', en: 'dress' },
  skirt: { de: 'Röcke', en: 'skirt' },
  skort: { de: 'Skorts', en: 'skort' },
  top_tshirt: { de: 'Tops & T-Shirts', en: 'top or t-shirt' },
  jeans: { de: 'Jeans', en: 'jeans' },
  pants_leggings: { de: 'Hosen & Leggings', en: 'pants or leggings' },
  shorts: { de: 'Shorts', en: 'shorts' },
  jumpsuit: { de: 'Jumpsuits & Playsuits', en: 'jumpsuit or playsuit' },
  swimwear: { de: 'Bademode', en: 'swimwear' },
  underwear: { de: 'Unterwäsche & Nachtwäsche', en: 'underwear or loungewear' },
  activewear: { de: 'Activewear', en: 'activewear' },
  costume: { de: 'Kostüme & Besonderes', en: 'costume or special outfit' },
} as const;

export type ClothingType = keyof typeof CLOTHING_TYPES;

export function isClothingType(value: unknown): value is ClothingType {
  return typeof value === 'string' && value in CLOTHING_TYPES;
}

/**
 * Farben für die Verkaufstext-Angabe. Fließt bewusst NICHT in die Bild-
 * generierung ein (dort zu fehleranfällig), sondern nur in den Verkaufstext —
 * genau wie in der Altanwendung.
 */
export const COLORS = [
  'Schwarz', 'Weiß', 'Grau', 'Rot', 'Blau', 'Grün', 'Gelb', 'Pink', 'Lila',
  'Orange', 'Braun', 'Beige', 'Navy', 'Türkis', 'Bordeaux', 'Silber', 'Gold',
  'Denim', 'Mehrfarbig',
] as const;

/** CSS-Farbwert je Farbname -- fuer das kleine Muster-Kreis-Icon im
 * Farbfilter des Verlaufs. "Mehrfarbig" bekommt einen Verlauf statt einer
 * Flaechenfarbe, da es keine einzelne Farbe repraesentiert. */
export const COLOR_SWATCH: Record<(typeof COLORS)[number], string> = {
  Schwarz: '#111111',
  Weiß: '#ffffff',
  Grau: '#9ca3af',
  Rot: '#dc2626',
  Blau: '#2563eb',
  Grün: '#16a34a',
  Gelb: '#eab308',
  Pink: '#ec4899',
  Lila: '#9333ea',
  Orange: '#f97316',
  Braun: '#78350f',
  Beige: '#e7d9c1',
  Navy: '#1e3a5f',
  Türkis: '#14b8a6',
  Bordeaux: '#7f1d3d',
  Silber: '#c4c9cf',
  Gold: '#d4af37',
  Denim: '#4a6fa5',
  Mehrfarbig: 'conic-gradient(from 90deg, #dc2626, #eab308, #16a34a, #2563eb, #9333ea, #dc2626)',
};

/**
 * Konfektionsgrößen für das Pflicht-Dropdown, aus der Altanwendung übernommen.
 * Format: Buchstabengröße mit deutscher/internationaler Entsprechung.
 */
export const SIZES = [
  'XXS (30/2)',
  'XS (34/6)',
  'S (36/8)',
  'M (38/10)',
  'L (40/12)',
  'XL (42/14)',
  'XXL (44/16)',
  '3XL (46/18)',
  '4XL (48/20)',
  '5XL (50/22)',
] as const;

/**
 * Qualität wird NICHT vom Nutzer gewählt, sondern folgt dem Plan. So kann
 * niemand über das Formular eine teurere Stufe erzwingen. Free und Starter
 * teilen sich Standard; HD ist Pro vorbehalten.
 */
export function qualityForPlan(plan: PlanKey): Quality {
  return plan === 'pro' ? 'hd' : 'standard';
}

/**
 * Credit-Kosten pro Qualität. MUSS mit credits_for_quality() in der
 * Postgres-Migration übereinstimmen — die DB ist die Autorität, das hier
 * dient nur der Anzeige „diese Generierung kostet X Credits" vor dem Klick.
 */
export const CREDITS_PER_QUALITY: Record<Quality, number> = {
  standard: 1,
  hd: 4,
};

/**
 * OpenAI-Parameter. `quality` mappt auf die API-Werte des Bildmodells.
 *
 * ACHTUNG: gpt-image-2 und diese Formate sind aus der Altanwendung
 * übernommen und noch nicht gegen eine echte Rechnung validiert. Der erste
 * reale Generierungslauf muss die tatsächlichen Kosten bestätigen, bevor die
 * Credit-Preise final gesetzt werden.
 */
export const IMAGE_MODEL = 'gpt-image-2';
export const TEXT_MODEL = 'gpt-4o-mini';

/** Abbildung interne Qualität -> OpenAI-quality-Parameter. */
export const OPENAI_QUALITY: Record<Quality, 'medium' | 'high'> = {
  standard: 'medium',
  hd: 'high',
};

/** Hochformat als Standard — passt zu Kleidungsanzeigen auf Vinted/Kleinanzeigen. */
export const IMAGE_SIZE = '1024x1536';

/** Grenzen für Uploads, serverseitig erzwungen. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_UPLOAD_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Wie viele Kleidungsstücke ein Plan pro Generierung kombinieren darf. */
export function maxItemsForPlan(plan: PlanKey): number {
  if (plan === 'pro') return 9;
  if (plan === 'starter') return 5;
  return 1;
}

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

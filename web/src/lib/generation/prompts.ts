import { CLOTHING_TYPES, type ClothingType } from './constants';

/**
 * Prompt-Vorlagen, wortgetreu aus der alten api.js übernommen. Sie waren das
 * eigentliche Ergebnis von Umuts Vorarbeit — welche Formulierungen brauchbare
 * Anproben und saubere Verkaufstexte liefern. Deshalb hier unverändert, nur
 * an einen serverseitigen Ort verlegt.
 */

/** Einzelmodus: ein Kleidungsstück auf die Person. */
export function buildTryOnPrompt(
  clothingType: ClothingType,
  size?: string | null,
  extraNotes?: string | null,
): string {
  const t = CLOTHING_TYPES[clothingType]?.en ?? 'clothing item';
  const sizeHint = size ? ` It should correspond to size ${size}.` : '';
  const notes = extraNotes ? `\n\nZusätzliche Anweisungen des Nutzers: ${extraNotes}` : '';
  return `Virtually try on this ${t} (shown in image 2) onto the person in image 1. The ${t} should fit naturally and realistically, matching the person's pose and body shape.${sizeHint} Keep the person's original background, face, hairstyle, and all other clothing items unchanged. The result must look like a realistic photograph.${notes}`;
}

/** Kombimodus: mehrere Kleidungsstücke gleichzeitig. */
export const COMBINED_PROMPT = `Virtually dress this person (image 1) with all the provided clothing items (images 2+). Put each item on the correct body part (top on upper body, bottoms on lower body, shoes on feet, etc.). Make everything fit naturally and realistically. Keep the person's original background, face, and hairstyle. The result must look like a realistic full-body outfit photograph.`;

/** Verkaufstext für Vinted/Kleinanzeigen. */
export function buildSalePrompt(
  clothingType?: ClothingType | null,
  size?: string | null,
  colors?: string[] | null,
  extraNotes?: string | null,
): string {
  const typeInfo = clothingType ? ` (a ${CLOTHING_TYPES[clothingType]?.en ?? clothingType})` : '';
  const sizeInfo = size ? `Size: ${size}. ` : '';
  const hasColor = colors && colors.length > 0 && colors[0];
  const notes = extraNotes ? `\n\nZusätzliche Anweisungen des Nutzers: ${extraNotes}` : '';
  const colorInfo = hasColor
    ? `The item is ${colors.join(' and ')}. Use "${colors.join(' and ')}" as the color(s) in your description - do NOT guess from the photo. `
    : 'DO NOT guess or invent a color from the photo. Describe the item without mentioning a color. ';
  return `Write a German Vinted sales listing for the clothing item shown in this photo${typeInfo}. The photo shows a person wearing the item, but you MUST pretend the garment is photographed alone (flat lay on a table).

STRICT RULES:
- Describe ONLY the garment itself: cut, color, pattern, neckline, sleeves, pockets, zippers, hemline, etc.
- NEVER mention how it looks "on the person" or "on the model"
- NEVER use phrases like "looks great", "sits perfectly", "flattering", "schmeichelt der Figur", "betont die Taille", "sitzt perfekt", "auf dem Model"
- NEVER describe the person's body, pose, or appearance
- Do NOT guess the material, do NOT suggest a price
- Do NOT include condition, fit-on-body, or style tips
${colorInfo}${sizeInfo}
Structure: Überschrift (SEO, max 80 Zeichen, Emojis) | Beschreibung (nur das Kleidungsstück) | Größe. Use an engaging tone with emojis. Max 130 words.${notes}`;
}

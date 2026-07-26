import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { generateTryOn } from '@/lib/openai/images';
import { generateSaleText } from '@/lib/openai/text';
import { buildTryOnPrompt, buildSalePrompt, COMBINED_PROMPT } from '@/lib/generation/prompts';
import { createLockedPreview } from '@/lib/generation/prepare-image';
import { lockedImagePath } from '@/lib/generation/lock';
import { isClothingType, type ClothingType } from '@/lib/generation/constants';
import type { Quality } from '@/lib/generation/constants';

/**
 * Die eigentliche Generierung — läuft nach der Antwort im Hintergrund
 * (aufgerufen aus after() in der Route). Deshalb bekommt sie ausschließlich
 * bereits eingelesene Buffer statt des Request-Objekts: Sobald die Antwort
 * gesendet ist, kann der ursprüngliche Request-Stream nicht mehr gelesen
 * werden.
 *
 * Schreibt den Fortschritt fortlaufend in generations.cards, damit ein Poll
 * mitten in der Verarbeitung bereits fertige Bilder zeigen kann, statt alles
 * erst am Ende auf einmal zu liefern.
 */

export type PreparedImage = { bytes: Buffer; filename: string; mimeType: string };

export type ProcessGenerationInput = {
  generationId: string;
  userId: string;
  mode: 'single' | 'combined';
  quality: Quality;
  notes?: string | null;
  unitCost: number;
  person: PreparedImage;
  clothing: PreparedImage[];
  types: string[];
  sizes: string[];
  colors: string[];
};

type CardRow = { itemIndex: number; title: string; imagePath: string | null; saleText: string | null };

export async function processGeneration(input: ProcessGenerationInput): Promise<void> {
  const { generationId: genId, userId, mode, quality, notes, unitCost, person, clothing, types, sizes, colors } = input;
  const admin = createAdminClient();
  const dir = `${userId}/${genId}`;
  const personUpload = `${dir}/person`;

  // Karten-Zwischenstand fortlaufend in die DB schreiben, damit Polls
  // waehrenddessen bereits fertige Ergebnisse zeigen koennen.
  const cards: CardRow[] = [];
  async function pushCard(card: CardRow) {
    cards.push(card);
    await admin.from('generations').update({ cards, status: 'processing' }).eq('id', genId);
  }

  try {
    await admin.from('generations').update({ status: 'processing' }).eq('id', genId);

    await admin.storage.from('uploads').upload(personUpload, person.bytes, {
      contentType: person.mimeType,
      upsert: true,
    });
    const clothingUploads = clothing.map((_, i) => `${dir}/clothing-${i}`);
    await Promise.all(
      clothing.map((c, i) => admin.storage.from('uploads').upload(clothingUploads[i], c.bytes, { contentType: c.mimeType, upsert: true })),
    );

    let failures = 0;
    let anyImage = false;
    let model = '';
    let costUsd = 0;

    if (mode === 'combined') {
      try {
        const r = await generateTryOn({ person, clothing, prompt: COMBINED_PROMPT, quality });
        const path = `${dir}/0.png`;
        const { error: upErr } = await admin.storage.from('results').upload(path, r.image, { contentType: r.mimeType, upsert: true });
        if (!upErr) {
          anyImage = true;
          model = r.model;
          costUsd += r.costUsd ?? 0;
          await uploadLockedPreview(admin, path, r.image);
          await pushCard({ itemIndex: -1, title: 'Kombiniertes Bild', imagePath: path, saleText: null });
        } else {
          failures = 1;
        }
      } catch (err) {
        console.error('[process] combined fehlgeschlagen', genId, err);
        failures = 1;
      }

      // Verkaufstext je Kleidungsstueck, auch im Kombiniert-Modus — verkauft
      // wird jedes Stueck einzeln.
      for (let i = 0; i < clothing.length; i++) {
        const type = types[i];
        if (!isClothingType(type)) continue;
        const result = await safeSaleText(type, sizes[i], colors[i], notes, clothing[i]);
        costUsd += result?.costUsd ?? 0;
        if (result) await pushCard({ itemIndex: i, title: `Stück ${i + 1}`, imagePath: null, saleText: result.text });
      }
    } else {
      // Einzeln: pro Stueck ein Bild UND ein Verkaufstext, in einer Karte.
      for (let i = 0; i < clothing.length; i++) {
        const type = types[i];
        if (!isClothingType(type)) { failures++; continue; }

        let imagePath: string | null = null;
        try {
          const r = await generateTryOn({
            person,
            clothing: [clothing[i]],
            prompt: buildTryOnPrompt(type, sizes[i], notes),
            quality,
          });
          const path = `${dir}/${i}.png`;
          const { error: upErr } = await admin.storage.from('results').upload(path, r.image, { contentType: r.mimeType, upsert: true });
          if (!upErr) {
            imagePath = path;
            anyImage = true;
            model = r.model;
            costUsd += r.costUsd ?? 0;
            await uploadLockedPreview(admin, path, r.image);
          } else {
            failures++;
          }
        } catch (err) {
          console.error('[process] single item', i, 'fehlgeschlagen', genId, err);
          failures++;
        }

        const result = await safeSaleText(type, sizes[i], colors[i], notes, clothing[i]);
        costUsd += result?.costUsd ?? 0;
        await pushCard({ itemIndex: i, title: `Stück ${i + 1}`, imagePath, saleText: result?.text ?? null });
      }
    }

    // Uploads entfernen — Datensparsamkeit, das Personenfoto ist die
    // sensibelste Datei und soll nur so lange existieren wie noetig.
    await admin.storage.from('uploads').remove([personUpload, ...clothingUploads]);

    if (!anyImage) {
      await admin.rpc('refund_generation', { p_generation_id: genId, p_error_message: 'Alle Bilder fehlgeschlagen.' });
      return;
    }

    if (failures > 0) {
      await admin.rpc('refund_credits', { p_generation_id: genId, p_credits: failures * unitCost });
    }

    const resultPaths = cards.map((c) => c.imagePath).filter((p): p is string => Boolean(p));
    const savedText = cards.map((c) => c.saleText).filter(Boolean).join('\n---\n') || null;

    await admin.from('generations').update({
      status: 'succeeded',
      result_paths: resultPaths,
      sale_text: savedText,
      model: model || null,
      cost_usd: costUsd || null,
      person_image_path: null,
      completed_at: new Date().toISOString(),
    }).eq('id', genId);
  } catch (err) {
    // Unerwarteter Fehler ausserhalb der einzelnen Bild-/Text-Versuche.
    console.error('[process] unerwarteter Fehler', genId, err);
    await admin.rpc('refund_generation', { p_generation_id: genId, p_error_message: 'Unerwarteter Fehler.' });
    await admin.storage.from('uploads').remove([personUpload, ...clothing.map((_, i) => `${dir}/clothing-${i}`)]).catch(() => {});
  }
}

/**
 * Laedt zusaetzlich zum echten Ergebnis eine unscharfe, kleine Vorschau-
 * Variante hoch (siehe lock.ts/prepare-image.ts) -- fuer Free-Tarif-Nutzer ab
 * ihrem zweiten Ergebnis. "Best effort": schlaegt das fehl, bleibt das echte
 * (bezahlte) Bild trotzdem gueltig, nur die Vorschau-Funktion greift dann fuer
 * genau dieses Bild nicht.
 */
async function uploadLockedPreview(
  admin: ReturnType<typeof createAdminClient>,
  path: string,
  image: Buffer,
): Promise<void> {
  try {
    const preview = await createLockedPreview(image);
    await admin.storage.from('results').upload(lockedImagePath(path), preview, { contentType: 'image/jpeg', upsert: true });
  } catch (err) {
    console.error('[process] Vorschau-Variante fehlgeschlagen', path, err);
  }
}

/** Verkaufstext ist "best effort": scheitert er, bleibt das bezahlte Bild gueltig. */
async function safeSaleText(
  type: ClothingType,
  size: string,
  color: string | undefined,
  notes: string | null | undefined,
  clothingInput: PreparedImage,
): Promise<{ text: string; costUsd: number } | null> {
  try {
    const { text, costUsd } = await generateSaleText({
      prompt: buildSalePrompt(type, size, color ? [color] : null, notes),
      imageBytes: clothingInput.bytes,
      mimeType: clothingInput.mimeType,
    });
    return { text, costUsd: costUsd ?? 0 };
  } catch (err) {
    console.error('[process] Verkaufstext fehlgeschlagen', err);
    return null;
  }
}

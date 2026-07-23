import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTryOn, OpenAIError } from '@/lib/openai/images';
import { generateSaleText } from '@/lib/openai/text';
import { prepareImage } from '@/lib/generation/prepare-image';
import { buildTryOnPrompt, buildSalePrompt, COMBINED_PROMPT } from '@/lib/generation/prompts';
import {
  ALLOWED_UPLOAD_MIME,
  CREDITS_PER_QUALITY,
  MAX_UPLOAD_BYTES,
  isClothingType,
  maxItemsForPlan,
  qualityForPlan,
  type PlanKey,
} from '@/lib/generation/constants';

/*
  Serverseitige Generierung fuer beide Modi:

    Einzeln (single):     N Kleidungsstuecke -> N Bilder -> N × Credits
    Kombiniert (combined): mehrere Stuecke   -> 1 Bild   -> 1 × Credits

  Reihenfolge: Auth + Validierung VOR jeder Abbuchung. Erst danach bucht
  spend_credits (Kosten pro Bild × Bildanzahl) atomar ab. Scheitern im
  Einzelmodus einzelne Bilder, werden nur diese per refund_credits erstattet;
  scheitern alle, wird der komplette Auftrag zurueckgebucht.
*/

export const runtime = 'nodejs';

const scalarSchema = z.object({
  mode: z.enum(['single', 'combined']),
  notes: z.string().max(2000).optional(),
});

function fileError(file: File): string | null {
  if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(file.type)) return 'Nur JPG, PNG oder WebP sind erlaubt.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Jedes Bild darf höchstens 10 MB groß sein.';
  if (file.size === 0) return 'Eine hochgeladene Datei ist leer.';
  return null;
}

async function prepare(file: File, filename: string) {
  const p = await prepareImage(Buffer.from(await file.arrayBuffer()));
  return { bytes: p.bytes, filename, mimeType: p.mimeType };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Bitte bestätige zuerst deine E-Mail-Adresse.' }, { status: 403 });
  }

  const { data: profile } = await supabase.from('profiles').select('plan').single();
  const plan = (profile?.plan ?? 'free') as PlanKey;
  const quality = qualityForPlan(plan);
  const unitCost = CREDITS_PER_QUALITY[quality];

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const scalar = scalarSchema.safeParse({ mode: form.get('mode'), notes: form.get('notes') || undefined });
  if (!scalar.success) return NextResponse.json({ error: 'Angaben unvollständig oder ungültig.' }, { status: 400 });
  const { mode, notes } = scalar.data;

  const person = form.get('person');
  const clothing = form.getAll('clothing').filter((c): c is File => c instanceof File);
  // Parallele Arrays zu den Kleidungsdateien (nur im Einzelmodus genutzt).
  const types = form.getAll('clothingType').map(String);
  const sizes = form.getAll('size').map(String);
  const colors = form.getAll('color').map(String); // nur fuer den Verkaufstext

  if (!(person instanceof File) || clothing.length === 0) {
    return NextResponse.json({ error: 'Bitte lade ein Personenfoto und mindestens ein Kleidungsstück hoch.' }, { status: 400 });
  }

  const maxItems = maxItemsForPlan(plan);
  if (clothing.length > maxItems) {
    return NextResponse.json({ error: `Dein Tarif erlaubt höchstens ${maxItems} Kleidungsstück(e) pro Anprobe.` }, { status: 403 });
  }

  for (const file of [person, ...clothing]) {
    const err = fileError(file);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  // Typ und Groesse sind in BEIDEN Modi Pflicht: Sie speisen den Verkaufstext,
  // den es pro Kleidungsstueck gibt — unabhaengig von der Bildanzahl.
  for (let i = 0; i < clothing.length; i++) {
    if (!isClothingType(types[i]) || !sizes[i]) {
      return NextResponse.json({ error: 'Bitte gib zu jedem Kleidungsstück Typ und Größe an.' }, { status: 400 });
    }
  }

  const imageCount = mode === 'combined' ? 1 : clothing.length;

  // Abbuchen: Kosten pro Bild × Bildanzahl, atomar.
  const admin = createAdminClient();
  const { data: generation, error: spendError } = await admin.rpc('spend_credits', {
    p_user_id: user.id,
    p_mode: mode,
    p_quality: quality,
    p_image_count: imageCount,
    p_clothing_type: mode === 'single' && isClothingType(types[0]) ? types[0] : null,
    p_notes: notes ?? null,
  });

  if (spendError || !generation) {
    const insufficient = spendError?.code === '42501' || spendError?.message?.includes('Guthaben');
    return NextResponse.json(
      {
        error: insufficient
          ? `Dein Guthaben reicht nicht (${unitCost * imageCount} Credits nötig).`
          : 'Die Generierung konnte nicht gestartet werden.',
      },
      { status: insufficient ? 402 : 500 },
    );
  }

  const genId: string = generation.id;
  const dir = `${user.id}/${genId}`;
  const personUpload = `${dir}/person`;

  try {
    const personInput = await prepare(person, personUpload);
    await admin.storage.from('uploads').upload(personInput.filename, personInput.bytes, {
      contentType: personInput.mimeType,
      upsert: true,
    });

    // Alle Kleidungsbilder einmal vorbereiten — sie werden fuer die
    // Bildgenerierung UND die Verkaufstexte gebraucht.
    const clothingInputs = await Promise.all(clothing.map((c, i) => prepare(c, `${dir}/clothing-${i}`)));

    type Produced = { image: Buffer; mimeType: string; model: string; costUsd: number | null };
    const produced: Produced[] = [];
    let failures = 0;

    if (mode === 'combined') {
      // Kombiniert: ein Bild aus allen Stuecken.
      try {
        produced.push(await generateTryOn({ person: personInput, clothing: clothingInputs, prompt: COMBINED_PROMPT, quality }));
      } catch (err) {
        console.error('[generate] combined fehlgeschlagen', genId, err);
        failures = 1;
      }
    } else {
      // Einzeln: pro Stueck ein Bild. Ein Fehlschlag stoppt die anderen nicht.
      for (let i = 0; i < clothingInputs.length; i++) {
        const type = types[i];
        if (!isClothingType(type)) { failures++; continue; }
        try {
          produced.push(await generateTryOn({
            person: personInput,
            clothing: [clothingInputs[i]],
            prompt: buildTryOnPrompt(type, sizes[i], notes),
            quality,
          }));
        } catch (err) {
          console.error('[generate] single item', i, 'fehlgeschlagen', genId, err);
          failures++;
        }
      }
    }

    // Alle fehlgeschlagen -> kompletter Auftrag zurueck.
    if (produced.length === 0) {
      await admin.rpc('refund_generation', { p_generation_id: genId, p_error_message: 'Alle Bilder fehlgeschlagen.' });
      await admin.storage.from('uploads').remove([personUpload, ...clothing.map((_, i) => `${dir}/clothing-${i}`)]);
      return NextResponse.json(
        { error: 'Die Generierung ist fehlgeschlagen. Deine Credits wurden zurückgebucht.' },
        { status: 502 },
      );
    }

    // Verkaufstext je Kleidungsstueck — in BEIDEN Modi, denn verkauft wird
    // jedes Stueck einzeln, egal ob es in einem oder mehreren Bildern steckt.
    // "Best effort": scheitert ein Text, bleibt das bezahlte Bild gueltig.
    const saleTexts: (string | null)[] = [];
    for (let i = 0; i < clothingInputs.length; i++) {
      const type = types[i];
      if (!isClothingType(type)) { saleTexts.push(null); continue; }
      try {
        saleTexts.push(
          await generateSaleText({
            prompt: buildSalePrompt(type, sizes[i], colors[i] ? [colors[i]] : null, notes),
            imageBytes: clothingInputs[i].bytes,
            mimeType: clothingInputs[i].mimeType,
          }),
        );
      } catch (textErr) {
        console.error('[generate] Verkaufstext', i, 'fehlgeschlagen', genId, textErr);
        saleTexts.push(null);
      }
    }

    // Erfolgreiche Bilder dauerhaft speichern.
    const resultPaths: string[] = [];
    for (let i = 0; i < produced.length; i++) {
      const path = `${dir}/${i}.png`;
      const { error: upErr } = await admin.storage.from('results').upload(path, produced[i].image, {
        contentType: produced[i].mimeType,
        upsert: true,
      });
      if (!upErr) resultPaths.push(path);
    }

    const costUsd = produced.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
    // Verkaufstexte zusammengefuehrt in der DB ablegen (fuer die Historie).
    const savedText = saleTexts.filter(Boolean).join('\n---\n') || null;

    await admin.from('generations').update({
      status: 'succeeded',
      result_paths: resultPaths,
      sale_text: savedText,
      model: produced[0].model,
      cost_usd: costUsd || null,
      person_image_path: null,
      completed_at: new Date().toISOString(),
    }).eq('id', genId);

    // Teil-Rueckerstattung fuer fehlgeschlagene Einzelbilder.
    if (failures > 0) {
      await admin.rpc('refund_credits', { p_generation_id: genId, p_credits: failures * unitCost });
    }

    // Uploads entfernen (Datensparsamkeit).
    await admin.storage.from('uploads').remove([personUpload, ...clothing.map((_, i) => `${dir}/clothing-${i}`)]);

    // Signierte Links auf die privaten Ergebnisse.
    const signed = await Promise.all(
      resultPaths.map((p) => admin.storage.from('results').createSignedUrl(p, 60 * 60)),
    );

    return NextResponse.json({
      generationId: genId,
      resultUrls: signed.map((s) => s.data?.signedUrl ?? null),
      saleTexts,
      creditsCharged: produced.length * unitCost,
      failures,
    });
  } catch (err) {
    console.error('[generate] unerwarteter Fehler', genId, err);
    await admin.rpc('refund_generation', { p_generation_id: genId, p_error_message: 'Unerwarteter Fehler.' });
    await admin.storage.from('uploads').remove([personUpload, ...clothing.map((_, i) => `${dir}/clothing-${i}`)]).catch(() => {});
    void err;
    return NextResponse.json({ error: 'Die Generierung ist fehlgeschlagen. Deine Credits wurden zurückgebucht.' }, { status: 502 });
  }
}

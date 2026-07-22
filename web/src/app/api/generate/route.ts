import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTryOn, OpenAIError } from '@/lib/openai/images';
import { prepareImage } from '@/lib/generation/prepare-image';
import { buildTryOnPrompt, COMBINED_PROMPT } from '@/lib/generation/prompts';
import {
  ALLOWED_UPLOAD_MIME,
  CREDITS_PER_QUALITY,
  MAX_UPLOAD_BYTES,
  isClothingType,
  maxItemsForPlan,
  qualityForPlan,
  type PlanKey,
} from '@/lib/generation/constants';

/**
 * Der Kern von Phase 2: eine Generierung, komplett serverseitig.
 *
 * Reihenfolge ist bewusst gewählt:
 *  1. Authentifizierung und Validierung — VOR jeder Abbuchung. Nichts kostet
 *     Credits, was schon an der Eingabe scheitert.
 *  2. spend_credits — legt den Job an und bucht atomar ab (Race-sicher, s.
 *     Migration). Reicht das Guthaben nicht, endet es hier mit 402.
 *  3. OpenAI-Aufruf mit dem Betreiber-Key.
 *  4a. Erfolg: Ergebnis dauerhaft speichern, Personenfoto sofort löschen.
 *  4b. Fehler: refund_generation bucht die Credits automatisch zurück.
 */

// Node-Runtime erzwingen: Der OpenAI-Client und der Admin-Client nutzen
// Server-Geheimnisse und dürfen nicht in die Edge-Runtime geraten.
export const runtime = 'nodejs';

const scalarSchema = z.object({
  mode: z.enum(['single', 'combined']),
  clothingType: z.string().optional(),
  size: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

function fileError(file: File): string | null {
  if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(file.type)) {
    return 'Nur JPG, PNG oder WebP sind erlaubt.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'Jedes Bild darf höchstens 10 MB groß sein.';
  }
  if (file.size === 0) {
    return 'Eine hochgeladene Datei ist leer.';
  }
  return null;
}

async function toInput(file: File, filename: string) {
  // Vor dem Versand verkleinern: schneller, günstiger, umgeht Größenlimits
  // und entfernt EXIF-Metadaten. Das Ergebnis ist immer PNG.
  const prepared = await prepareImage(Buffer.from(await file.arrayBuffer()));
  return { bytes: prepared.bytes, filename, mimeType: prepared.mimeType };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1a. Angemeldet?
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }

  // 1b. E-Mail bestätigt? Pflicht vor der ersten Generierung — eine der
  // Bremsen gegen Wegwerf-Accounts, die ab jetzt echtes Geld kosten würden.
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: 'Bitte bestätige zuerst deine E-Mail-Adresse.' },
      { status: 403 },
    );
  }

  // Plan bestimmt Qualität und erlaubte Stückzahl — serverseitig, nicht aus
  // dem Formular. Läuft unter RLS, liefert also nur das eigene Profil.
  const { data: profile } = await supabase.from('profiles').select('plan').single();
  const plan = (profile?.plan ?? 'free') as PlanKey;
  const quality = qualityForPlan(plan);

  // 1c. Eingaben lesen und prüfen.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const scalar = scalarSchema.safeParse({
    mode: form.get('mode'),
    clothingType: form.get('clothingType') || undefined,
    size: form.get('size') || undefined,
    notes: form.get('notes') || undefined,
  });
  if (!scalar.success) {
    return NextResponse.json({ error: 'Angaben unvollständig oder ungültig.' }, { status: 400 });
  }

  const person = form.get('person');
  const clothing = form.getAll('clothing').filter((c): c is File => c instanceof File);

  if (!(person instanceof File) || clothing.length === 0) {
    return NextResponse.json(
      { error: 'Bitte lade ein Personenfoto und mindestens ein Kleidungsstück hoch.' },
      { status: 400 },
    );
  }

  const maxItems = maxItemsForPlan(plan);
  if (clothing.length > maxItems) {
    return NextResponse.json(
      { error: `Dein Tarif erlaubt höchstens ${maxItems} Kleidungsstück(e) pro Generierung.` },
      { status: 403 },
    );
  }

  for (const file of [person, ...clothing]) {
    const err = fileError(file);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  // Im Einzelmodus ist der Kleidungstyp Pflicht (er steuert den Prompt).
  if (scalar.data.mode === 'single' && !isClothingType(scalar.data.clothingType)) {
    return NextResponse.json({ error: 'Bitte wähle einen Kleidungstyp.' }, { status: 400 });
  }

  const clothingType = isClothingType(scalar.data.clothingType) ? scalar.data.clothingType : null;
  const prompt =
    scalar.data.mode === 'single' && clothingType
      ? buildTryOnPrompt(clothingType, scalar.data.size, scalar.data.notes)
      : COMBINED_PROMPT;

  // 2. Abbuchen — erst ab hier kostet es Credits. Ab diesem Punkt muss jeder
  // Fehlerpfad die Rückerstattung auslösen.
  const admin = createAdminClient();
  const { data: generation, error: spendError } = await admin.rpc('spend_credits', {
    p_user_id: user.id,
    p_mode: scalar.data.mode,
    p_quality: quality,
    p_clothing_type: clothingType,
    p_notes: scalar.data.notes ?? null,
  });

  if (spendError || !generation) {
    // insufficient_privilege ist der errcode, den spend_credits bei zu wenig
    // Guthaben wirft (siehe Migration) — daraus wird ein sauberes 402.
    const insufficient = spendError?.code === '42501' || spendError?.message?.includes('Guthaben');
    return NextResponse.json(
      {
        error: insufficient
          ? 'Dein Guthaben reicht für diese Generierung nicht aus.'
          : 'Die Generierung konnte nicht gestartet werden.',
        cost: CREDITS_PER_QUALITY[quality],
      },
      { status: insufficient ? 402 : 500 },
    );
  }

  const genId: string = generation.id;
  const uploadDir = `${user.id}/${genId}`;

  try {
    // 3. Bilder in Buffer lesen und in den Upload-Bucket legen.
    const personInput = await toInput(person, `${uploadDir}/person`);
    const clothingInputs = await Promise.all(
      clothing.map((c, i) => toInput(c, `${uploadDir}/clothing-${i}`)),
    );

    await admin.storage.from('uploads').upload(personInput.filename, personInput.bytes, {
      contentType: person.type,
      upsert: true,
    });

    // 4. OpenAI-Aufruf mit dem Betreiber-Key.
    const result = await generateTryOn({
      person: personInput,
      clothing: clothingInputs,
      prompt,
      quality,
    });

    // 4a. Ergebnis dauerhaft speichern.
    const resultPath = `${user.id}/${genId}/0.png`;
    const { error: uploadError } = await admin.storage
      .from('results')
      .upload(resultPath, result.image, { contentType: result.mimeType, upsert: true });
    if (uploadError) throw new Error(`Ergebnis konnte nicht gespeichert werden: ${uploadError.message}`);

    await admin
      .from('generations')
      .update({
        status: 'succeeded',
        result_paths: [resultPath],
        model: result.model,
        cost_usd: result.costUsd,
        person_image_path: null, // wird sofort gelöscht, siehe unten
        completed_at: new Date().toISOString(),
      })
      .eq('id', genId);

    // Datensparsamkeit: hochgeladene Fotos direkt entfernen. Das Personenfoto
    // ist die sensibelste Datei — sie soll nur so lange existieren wie nötig.
    await admin.storage
      .from('uploads')
      .remove([personInput.filename, ...clothingInputs.map((c) => c.filename)]);

    // Zeitlich begrenzter Link auf das private Ergebnis.
    const { data: signed } = await admin.storage
      .from('results')
      .createSignedUrl(resultPath, 60 * 60);

    return NextResponse.json({
      generationId: genId,
      resultUrl: signed?.signedUrl ?? null,
      costUsd: result.costUsd,
      creditsCharged: generation.credits_charged,
    });
  } catch (err) {
    // 4b. Ab hier wurde bereits abgebucht -> zurückerstatten.
    const message = err instanceof OpenAIError ? err.message : 'Unerwarteter Fehler bei der Generierung.';
    // Vollständige Ursache ins Serverlog; die Nutzerantwort bleibt vage.
    console.error('[generate] fehlgeschlagen, Generierung', genId, '-', err);
    await admin.rpc('refund_generation', { p_generation_id: genId, p_error_message: message });

    // Aufräumen: Uploads dieses Jobs entfernen, damit nichts liegen bleibt.
    await admin.storage
      .from('uploads')
      .remove([`${uploadDir}/person`, ...clothing.map((_, i) => `${uploadDir}/clothing-${i}`)]);

    const status = err instanceof OpenAIError && err.type === 'insufficient_quota' ? 503 : 502;
    return NextResponse.json(
      {
        error:
          status === 503
            ? 'Der Bilddienst ist gerade nicht verfügbar. Deine Credits wurden zurückgebucht.'
            : 'Die Generierung ist fehlgeschlagen. Deine Credits wurden zurückgebucht.',
      },
      { status },
    );
  }
}

import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { prepareImage } from '@/lib/generation/prepare-image';
import { processGeneration, type PreparedImage } from '@/lib/generation/process';
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
  Serverseitige Generierung fuer beide Modi — asynchron:

    Einzeln (single):      N Kleidungsstuecke -> N Bilder -> N × Credits
    Kombiniert (combined): mehrere Stuecke    -> 1 Bild   -> 1 × Credits

  Dieser Handler validiert, bucht Credits atomar ab und liefert SOFORT die
  generation_id zurueck. Die eigentliche Bildgenerierung (bis zu mehreren
  Minuten bei mehreren Stuecken) laeuft danach in after() weiter, ohne dass
  der Client darauf wartet -- der Client pollt GET /api/generate/[id].
  Grund: Ein einzelner Request, der 1-2 Minuten offen bleibt, uebersteigt auf
  den meisten Hosting-Plattformen das Zeitlimit fuer eine Anfrage.

  WICHTIG: after() verlaengert die Lebensdauer der Server-Funktion nur bis zur
  konfigurierten maxDuration der Plattform (siehe unten). Bei Selbst-Hosting
  (Node-Server/Docker) gibt es kein Limit; bei klassischem Kurzzeit-Serverless
  (z.B. Vercel Hobby, hart bei 60s) reicht das fuer mehrere Bilder NICHT aus.
  Das ist ein echter Faktor fuer die noch offene Hosting-Entscheidung.
*/

export const runtime = 'nodejs';
// Obergrenze, die die meisten Plattformen mit erweiterter Funktionsdauer
// unterstuetzen (z.B. Vercel Pro/Fluid). Selbst-Hosting ignoriert das Limit.
export const maxDuration = 300;

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

/** Liest die Datei sofort in einen Buffer — nötig, weil nach der Antwort
 *  (in after()) der ursprüngliche Request-Stream nicht mehr existiert. */
async function toPrepared(file: File, filename: string): Promise<PreparedImage> {
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

  const personFile = form.get('person');
  const clothingFiles = form.getAll('clothing').filter((c): c is File => c instanceof File);
  const types = form.getAll('clothingType').map(String);
  const sizes = form.getAll('size').map(String);
  const colors = form.getAll('color').map(String); // nur fuer den Verkaufstext

  if (!(personFile instanceof File) || clothingFiles.length === 0) {
    return NextResponse.json({ error: 'Bitte lade ein Personenfoto und mindestens ein Kleidungsstück hoch.' }, { status: 400 });
  }

  const maxItems = maxItemsForPlan(plan);
  if (clothingFiles.length > maxItems) {
    return NextResponse.json({ error: `Dein Tarif erlaubt höchstens ${maxItems} Kleidungsstück(e) pro Anprobe.` }, { status: 403 });
  }

  for (const file of [personFile, ...clothingFiles]) {
    const err = fileError(file);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  // Typ und Groesse sind in BEIDEN Modi Pflicht: Sie speisen den Verkaufstext,
  // den es pro Kleidungsstueck gibt — unabhaengig von der Bildanzahl.
  for (let i = 0; i < clothingFiles.length; i++) {
    if (!isClothingType(types[i]) || !sizes[i]) {
      return NextResponse.json({ error: 'Bitte gib zu jedem Kleidungsstück Typ und Größe an.' }, { status: 400 });
    }
  }

  const imageCount = mode === 'combined' ? 1 : clothingFiles.length;

  // Abbuchen: Kosten pro Bild × Bildanzahl, atomar. Ab hier ist bezahlt --
  // jeder Fehlerpfad danach muss zurückbuchen.
  const admin = createAdminClient();
  const { data: generation, error: spendError } = await admin.rpc('spend_credits', {
    p_user_id: user.id,
    p_mode: mode,
    p_quality: quality,
    p_image_count: imageCount,
    p_clothing_type: mode === 'single' && isClothingType(types[0]) ? types[0] : null,
    p_notes: notes ?? null,
    // Ein Eintrag je Kleidungsstueck -- Grundlage fuer die Mehrfachfilter
    // (Kategorie/Groesse/Farbe) im Verlauf.
    p_clothing_types: types.filter(isClothingType),
    p_sizes: sizes.filter(Boolean),
    p_colors: colors.filter(Boolean),
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

  // Dateien SOFORT einlesen — nach dem Return ist der Request-Stream weg.
  let person: PreparedImage;
  let clothing: PreparedImage[];
  try {
    const dir = `${user.id}/${genId}`;
    person = await toPrepared(personFile, `${dir}/person`);
    clothing = await Promise.all(clothingFiles.map((c, i) => toPrepared(c, `${dir}/clothing-${i}`)));
  } catch (err) {
    console.error('[generate] Bildvorbereitung fehlgeschlagen', genId, err);
    await admin.rpc('refund_generation', { p_generation_id: genId, p_error_message: 'Bildvorbereitung fehlgeschlagen.' });
    return NextResponse.json({ error: 'Die Fotos konnten nicht verarbeitet werden.' }, { status: 400 });
  }

  // Verarbeitung laeuft nach dem Response weiter -- der Client wartet nicht.
  after(() =>
    processGeneration({
      generationId: genId,
      userId: user.id,
      mode,
      quality,
      notes,
      unitCost,
      person,
      clothing,
      types,
      sizes,
      colors,
    }),
  );

  return NextResponse.json({ generationId: genId }, { status: 202 });
}

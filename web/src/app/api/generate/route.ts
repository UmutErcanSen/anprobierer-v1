import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { prepareImage, createModerationCopy } from '@/lib/generation/prepare-image';
import { pruefeInhalte, PruefungNichtMoeglich, type PruefEingabe } from '@/lib/openai/moderation';
import { processGeneration, type PreparedImage } from '@/lib/generation/process';
import { rateLimitError } from '@/lib/generation/rate-limit';
import { tarifAbgleichen } from '@/lib/stripe/abgleich';
import { alleDateienZuBildern } from '@/lib/generation/dateipfade';
import {
  CREDITS_PER_QUALITY,
  MAX_UPLOAD_BYTES,
  UNSUPPORTED_FORMAT_ERROR,
  isAllowedImageFile,
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
  if (!isAllowedImageFile(file.type, file.name)) return UNSUPPORTED_FORMAT_ERROR;
  if (file.size > MAX_UPLOAD_BYTES) return 'Jedes Bild darf höchstens 10 MB groß sein.';
  if (file.size === 0) return 'Eine hochgeladene Datei ist leer.';
  return null;
}

/** Liest die Datei sofort in einen Buffer — nötig, weil nach der Antwort
 *  (in after()) der ursprüngliche Request-Stream nicht mehr existiert. */
async function toPrepared(file: File, filename: string): Promise<PreparedImage> {
  const p = await prepareImage(Buffer.from(await file.arrayBuffer()), file.type, file.name);
  return { bytes: p.bytes, filename, mimeType: p.mimeType };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Bitte bestätige zuerst deine E-Mail-Adresse.' }, { status: 403 });
  }

  // Vor jeder weiteren Arbeit pruefen: verhindert, dass ein Account mit
  // Guthaben beliebig viele parallele/schnell aufeinanderfolgende
  // Generierungen lostritt (CLAUDE.md §9 Missbrauchsschutz).
  const rateLimitMsg = await rateLimitError(supabase, user.id);
  if (rateLimitMsg) return NextResponse.json({ error: rateLimitMsg }, { status: 429 });

  /*
    Tarif gegen Stripe abgleichen, BEVOR er ueber Kosten und Grenzen
    entscheidet. Loest fast immer gar keinen API-Aufruf aus (siehe
    lib/stripe/abgleich-regeln.ts) -- nur wenn der eigene Datensatz danach
    aussieht, als waere ein Webhook-Ereignis ausgeblieben.

    Genau hier faellt der Schaden an: Stand in der Datenbank faelschlich noch
    'pro', bekaeme das Konto Pro-Bildqualitaet und Pro-Stueckzahlen fuer
    Basic-Geld -- bei jeder einzelnen Generierung aufs Neue.
  */
  await tarifAbgleichen(user.id);

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

  const admin = createAdminClient();

  /*
    Bilder einlesen und aufbereiten -- BEVOR abgebucht wird.

    Die Reihenfolge ist Absicht und war vorher andersherum: Erst wurde
    bezahlt, dann aufbereitet, und ein Fehler dabei musste umstaendlich
    zurueckgebucht werden. Jetzt kann hier nichts mehr schiefgehen, wofuer
    jemand bezahlt hat.

    Der Speicherpfad haengt an der Generierungs-ID, die es erst nach dem
    Abbuchen gibt -- die Dateinamen werden deshalb weiter unten nachgetragen.
  */
  let vorbereitetePerson: PreparedImage;
  let vorbereiteteKleidung: PreparedImage[];
  try {
    vorbereitetePerson = await toPrepared(personFile, 'person');
    vorbereiteteKleidung = await Promise.all(clothingFiles.map((c, i) => toPrepared(c, `clothing-${i}`)));
  } catch (err) {
    console.error('[generate] Bildvorbereitung fehlgeschlagen', user.id, err);
    return NextResponse.json({ error: 'Die Fotos konnten nicht verarbeitet werden.' }, { status: 400 });
  }

  /*
    Inhaltspruefung -- ebenfalls vor dem Abbuchen, und vor dem ersten
    kostenpflichtigen Aufruf.

    Geprueft wird BEIDES: der freie Notiztext und jedes hochgeladene Bild.
    Ein abgelehnter Auftrag kostet dadurch weder Credits noch OpenAI-Gebuehren,
    und es landet nichts davon in unserem Speicher.
  */
  const zuPruefen: PruefEingabe[] = [];
  if (notes?.trim()) zuPruefen.push({ art: 'text', text: notes });
  try {
    for (const bild of [vorbereitetePerson, ...vorbereiteteKleidung]) {
      zuPruefen.push({ art: 'bild', bytes: await createModerationCopy(bild.bytes), mimeType: 'image/jpeg' });
    }
  } catch (err) {
    console.error('[generate] Pruefkopie fehlgeschlagen', user.id, err);
    return NextResponse.json({ error: 'Die Fotos konnten nicht verarbeitet werden.' }, { status: 400 });
  }

  try {
    const pruefung = await pruefeInhalte(zuPruefen);
    if (pruefung.beanstandet) {
      /*
        Fuer die Missbrauchserkennung protokollieren -- ohne Inhalt, nur die
        Tatsache und die Kategorien. Wer hier wiederholt auffaellt, laesst
        sich damit finden, ohne dass wir das Material aufbewahren.
      */
      console.warn('[moderation] abgelehnt', user.id, pruefung.kategorien.join(','));
      await admin.from('usage_events').insert({
        user_id: user.id,
        event_type: `moderation_blocked:${pruefung.kategorien[0] ?? 'unbekannt'}`.slice(0, 60),
      });
      /*
        Bewusst OHNE Nennung der ausgeloesten Kategorie: Eine genaue Auskunft
        waere eine Anleitung zum Umgehen ("welcher Satz rutscht durch?").
        Der Hinweis auf die Regeln reicht, um einen ehrlichen Fehler zu
        korrigieren.
      */
      return NextResponse.json(
        {
          error:
            'Diese Anfrage wurde abgelehnt. Erlaubt sind ausschließlich Fotos volljähriger Personen, die der Aufnahme zugestimmt haben, sowie sachliche Angaben zur Kleidung.',
        },
        { status: 422 },
      );
    }
  } catch (err) {
    /*
      Bewusst SPERREN statt durchlassen, wenn die Pruefung ausfaellt. Eine
      stillschweigend uebersprungene Pruefung waere schlimmer als eine
      voruebergehend nicht nutzbare Funktion -- zumal die Generierung selbst
      denselben Dienst braucht und ohnehin nicht laufen wuerde.
    */
    console.error('[generate] Inhaltspruefung nicht moeglich', user.id, err);
    const grund = err instanceof PruefungNichtMoeglich ? 'derzeit nicht erreichbar' : 'fehlgeschlagen';
    return NextResponse.json(
      { error: `Die Sicherheitsprüfung ist ${grund}. Bitte versuche es in ein paar Minuten erneut.` },
      { status: 503 },
    );
  }

  // Abbuchen: Kosten pro Bild × Bildanzahl, atomar. Ab hier ist bezahlt --
  // jeder Fehlerpfad danach muss zurückbuchen.
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

  // Speicherpfade nachtragen: Die Bilder liegen laengst aufbereitet vor
  // (siehe oben), erst jetzt ist die Generierungs-ID dafuer bekannt.
  const dir = `${user.id}/${genId}`;
  const person: PreparedImage = { ...vorbereitetePerson, filename: `${dir}/person` };
  const clothing: PreparedImage[] = vorbereiteteKleidung.map((c, i) => ({ ...c, filename: `${dir}/clothing-${i}` }));

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

type CardRow = { imagePath: string | null };

/**
 * Loescht ALLE eigenen Generierungen -- der Verlauf ist paginiert (12 pro
 * Seite), "Mehrere auswaehlen" (siehe history/selection.tsx) kann deshalb nur
 * die auf der aktuellen Seite sichtbaren markieren. Ohne diese Route musste
 * man sich seitenweise durchklicken, um wirklich ALLES loeschen zu koennen --
 * genau das war die gemeldete Luecke.
 *
 * Laufende Generierungen (queued/processing) werden bewusst NICHT geloescht:
 * process.ts schreibt waehrenddessen aktiv in die Zeile; ein Loeschen mitten
 * im Lauf wuerde am Ende verwaiste Storage-Dateien hinterlassen, ohne dass
 * noch jemand ihre Pfade kennt (die stuenden nur in der geloeschten Zeile).
 * Die kleine Verzoegerung bis zum naechsten Aufraeumen ist der sicherere Weg.
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const admin = createAdminClient();

  const { data: generations, error: fetchError } = await admin
    .from('generations')
    .select('id, cards, result_paths')
    .eq('user_id', user.id)
    .not('status', 'in', '(queued,processing)');

  if (fetchError) {
    console.error('[generate] Massenloeschung: Abfrage fehlgeschlagen', user.id, fetchError);
    return NextResponse.json({ error: 'Die Anproben konnten nicht geladen werden.' }, { status: 500 });
  }

  const rows = generations ?? [];
  if (rows.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  const paths = new Set<string>();
  for (const g of rows) {
    for (const c of (g.cards ?? []) as CardRow[]) if (c.imagePath) paths.add(c.imagePath);
    for (const p of g.result_paths ?? []) paths.add(p);
  }
  const allPaths = alleDateienZuBildern(paths);

  if (allPaths.length > 0) {
    const { error: removeError } = await admin.storage.from('results').remove(allPaths);
    if (removeError) console.error('[generate] Massenloeschung: Storage-Aufraeumen fehlgeschlagen', user.id, removeError);
  }

  const ids = rows.map((g) => g.id);
  const { error: deleteError } = await admin.from('generations').delete().in('id', ids);
  if (deleteError) {
    console.error('[generate] Massenloeschung fehlgeschlagen', user.id, deleteError);
    return NextResponse.json({ error: 'Die Anproben konnten nicht gelöscht werden.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: ids.length });
}

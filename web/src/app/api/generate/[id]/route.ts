import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CREDITS_PER_QUALITY, type PlanKey, type Quality } from '@/lib/generation/constants';
import { isGenerationLocked, lockedImagePath, redactSaleText } from '@/lib/generation/lock';

/*
  Status-Endpunkt fuer eine laufende oder abgeschlossene Generierung. Der
  Client pollt hier, statt auf eine einzelne lang offene Antwort zu warten
  (siehe POST /api/generate).

  Nutzt den Admin-Client, weil er signierte URLs fuer die privaten Storage-
  Buckets ausstellen muss — RLS wird deshalb hier NICHT automatisch
  durchgesetzt und die Eigentuemerschaft manuell geprueft.
*/

export const runtime = 'nodejs';

type CardRow = { itemIndex: number; title: string; imagePath: string | null; saleText: string | null };

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: generation, error }, { data: profile }] = await Promise.all([
    admin
      .from('generations')
      .select('id, user_id, status, cards, credits_charged, quality, error_message, is_free_reveal')
      .eq('id', id)
      .single(),
    supabase.from('profiles').select('plan').single(),
  ]);

  // Kein Unterschied zwischen "existiert nicht" und "gehört jemand anderem" —
  // sonst liesse sich durch Ausprobieren erraten, welche IDs es gibt.
  if (error || !generation || generation.user_id !== user.id) {
    return NextResponse.json({ error: 'Generierung nicht gefunden.' }, { status: 404 });
  }

  // Free-Tarif: nur das eine kostenlose Vorschau-Ergebnis ist unverdeckt --
  // siehe lock.ts. Die Entscheidung faellt HIER, serverseitig: bei einer
  // verdeckten Generierung bekommt der Client gar nicht erst die echte
  // Bild-URL oder den vollen Text zu sehen.
  const locked = isGenerationLocked((profile?.plan as PlanKey) ?? 'free', generation.is_free_reveal);

  const cards = (generation.cards ?? []) as CardRow[];

  // Signierte Links frisch pro Abfrage — die Pfade in der DB sind dauerhaft,
  // die URLs laufen nach einer Stunde ab.
  const signedCards = await Promise.all(
    cards.map(async (c) => ({
      itemIndex: c.itemIndex,
      title: c.title,
      saleText: locked && c.saleText ? redactSaleText(c.saleText) : c.saleText,
      imageUrl: c.imagePath
        ? (await admin.storage.from('results').createSignedUrl(locked ? lockedImagePath(c.imagePath) : c.imagePath, 60 * 60)).data
            ?.signedUrl ?? null
        : null,
    })),
  );

  if (generation.status === 'succeeded' || generation.status === 'failed') {
    // Nettobetrag: urspruenglich abgebucht minus zwischenzeitlich erstattet.
    const { data: refunds } = await admin
      .from('credit_ledger')
      .select('delta')
      .eq('generation_id', id)
      .eq('reason', 'generation_refund');
    const refunded = (refunds ?? []).reduce((sum, r) => sum + r.delta, 0);

    // Jede Rückerstattung entspricht genau den Kosten eines fehlgeschlagenen
    // Bildes (siehe refund_credits-Aufruf in process.ts) — daraus lässt sich
    // die Anzahl der Fehlschläge exakt zurückrechnen.
    const unitCost = CREDITS_PER_QUALITY[generation.quality as Quality] ?? 1;
    const failures = unitCost > 0 ? Math.round(refunded / unitCost) : 0;

    return NextResponse.json({
      status: generation.status,
      cards: signedCards,
      creditsCharged: (generation.credits_charged ?? 0) - refunded,
      failures,
      error: generation.status === 'failed' ? generation.error_message : null,
      locked,
    });
  }

  // Noch in Arbeit: Zwischenstand zeigen, damit die Warteansicht nicht leer bleibt.
  return NextResponse.json({ status: generation.status, cards: signedCards, locked });
}

/**
 * Loescht eine eigene Generierung unwiderruflich (DSGVO Art. 17 und schlicht
 * Aufraeumen -- die DB-Policy dafuer existiert bereits seit dem Grundschema).
 * Die reine DB-Zeile duerfte der Nutzer per RLS auch selbst per Client-SDK
 * loeschen, aber die zugehoerigen Storage-Dateien (results-Bucket) haben dort
 * bewusst KEINE Delete-Policy (nur der Server darf Ergebnisse schreiben/
 * loeschen) -- deshalb laeuft das komplett ueber diese Route mit dem
 * Admin-Client.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const admin = createAdminClient();
  const { data: generation, error } = await admin
    .from('generations')
    .select('id, user_id, cards, result_paths')
    .eq('id', id)
    .single();

  if (error || !generation || generation.user_id !== user.id) {
    return NextResponse.json({ error: 'Generierung nicht gefunden.' }, { status: 404 });
  }

  // Beide moeglichen Quellen fuer Bildpfade abdecken: die neue cards-Spalte
  // UND das Legacy-result_paths-Array (siehe lib/generation/cards.ts). Fuer
  // jeden Pfad zusaetzlich die verdeckte Vorschau-Variante mitloeschen --
  // existiert sie nicht, ignoriert storage.remove() den Eintrag einfach.
  const cards = (generation.cards ?? []) as CardRow[];
  const paths = new Set<string>();
  for (const c of cards) if (c.imagePath) paths.add(c.imagePath);
  for (const p of generation.result_paths ?? []) paths.add(p);
  const allPaths = [...paths].flatMap((p) => [p, lockedImagePath(p)]);

  if (allPaths.length > 0) {
    const { error: removeError } = await admin.storage.from('results').remove(allPaths);
    if (removeError) console.error('[generate] Loeschen der Ergebnisdateien fehlgeschlagen', id, removeError);
  }

  const { error: deleteError } = await admin.from('generations').delete().eq('id', id);
  if (deleteError) {
    console.error('[generate] Loeschen der Generierung fehlgeschlagen', id, deleteError);
    return NextResponse.json({ error: 'Die Anprobe konnte nicht gelöscht werden.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

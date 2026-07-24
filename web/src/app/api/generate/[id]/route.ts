import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CREDITS_PER_QUALITY, type Quality } from '@/lib/generation/constants';

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
  const { data: generation, error } = await admin
    .from('generations')
    .select('id, user_id, status, cards, credits_charged, quality, error_message')
    .eq('id', id)
    .single();

  // Kein Unterschied zwischen "existiert nicht" und "gehört jemand anderem" —
  // sonst liesse sich durch Ausprobieren erraten, welche IDs es gibt.
  if (error || !generation || generation.user_id !== user.id) {
    return NextResponse.json({ error: 'Generierung nicht gefunden.' }, { status: 404 });
  }

  const cards = (generation.cards ?? []) as CardRow[];

  // Signierte Links frisch pro Abfrage — die Pfade in der DB sind dauerhaft,
  // die URLs laufen nach einer Stunde ab.
  const signedCards = await Promise.all(
    cards.map(async (c) => ({
      itemIndex: c.itemIndex,
      title: c.title,
      saleText: c.saleText,
      imageUrl: c.imagePath
        ? (await admin.storage.from('results').createSignedUrl(c.imagePath, 60 * 60)).data?.signedUrl ?? null
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
    });
  }

  // Noch in Arbeit: Zwischenstand zeigen, damit die Warteansicht nicht leer bleibt.
  return NextResponse.json({ status: generation.status, cards: signedCards });
}

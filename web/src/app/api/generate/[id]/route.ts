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

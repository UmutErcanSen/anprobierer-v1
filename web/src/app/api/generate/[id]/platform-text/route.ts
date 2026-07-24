import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rewriteSaleTextForPlatform, type RewritablePlatform } from '@/lib/openai/platform-text';

/*
  Schreibt den Verkaufstext einer Karte fuer eine andere Plattform um
  (Kleinanzeigen/eBay -- Vinted braucht das nicht, siehe platform-text.ts).

  Wird zwingend zwischengespeichert (generations.cards[].platformTexts), BEVOR
  ein zweiter Aufruf erneut kostet: derselbe Nutzer soll denselben Tab beliebig
  oft oeffnen koennen, ohne dass jedes Mal ein neuer OpenAI-Aufruf faellig wird.
  Bei Legacy-Generierungen (vor der cards-Spalte, siehe lib/generation/cards.ts)
  gibt es keine Karte zum Zwischenspeichern -- dort wird ohne Cache erzeugt,
  das betrifft nur eine schrumpfende Menge alter Zeilen.
*/

export const runtime = 'nodejs';

const bodySchema = z.object({
  itemIndex: z.number(),
  platform: z.enum(['kleinanzeigen', 'ebay']),
  // Fallback fuer Legacy-Generierungen (vor der cards-Spalte): dort ist
  // generations.cards leer, der Server kennt den Ausgangstext also nicht.
  // Der Client schickt ihn deshalb mit -- er zeigt ohnehin genau diesen
  // Text bereits an, kein zusaetzliches Risiko.
  baseText: z.string().max(4000).optional(),
});

type CardRow = {
  itemIndex: number;
  title: string;
  imagePath: string | null;
  saleText: string | null;
  platformTexts?: Partial<Record<RewritablePlatform, string>>;
};

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  const { itemIndex, platform, baseText: fallbackBaseText } = parsed.data;

  const admin = createAdminClient();
  const { data: generation, error } = await admin
    .from('generations')
    .select('id, user_id, cards')
    .eq('id', id)
    .single();

  // Kein Unterschied zwischen "existiert nicht" und "gehört jemand anderem".
  if (error || !generation || generation.user_id !== user.id) {
    return NextResponse.json({ error: 'Generierung nicht gefunden.' }, { status: 404 });
  }

  const cards = (generation.cards ?? []) as CardRow[];
  const cardPos = cards.findIndex((c) => c.itemIndex === itemIndex);
  const card = cardPos !== -1 ? cards[cardPos] : null;

  const baseText = card?.saleText ?? fallbackBaseText;
  if (!baseText) {
    return NextResponse.json({ error: 'Kein Ausgangstext für diese Karte vorhanden.' }, { status: 400 });
  }

  const cached = card?.platformTexts?.[platform];
  if (cached) return NextResponse.json({ text: cached });

  let text: string;
  try {
    text = await rewriteSaleTextForPlatform(baseText, platform);
  } catch (err) {
    console.error('[platform-text] Umschreibung fehlgeschlagen', id, itemIndex, platform, err);
    return NextResponse.json({ error: 'Text konnte nicht erstellt werden.' }, { status: 502 });
  }

  // Nur echte (nicht-Legacy) Karten koennen zwischengespeichert werden --
  // cardPos ist bei Legacy-Generierungen immer -1, da generations.cards dort
  // leer ist (siehe resolveCardRows in lib/generation/cards.ts).
  if (cardPos !== -1) {
    cards[cardPos] = { ...cards[cardPos], platformTexts: { ...cards[cardPos].platformTexts, [platform]: text } };
    await admin.from('generations').update({ cards }).eq('id', id);
  }

  return NextResponse.json({ text });
}

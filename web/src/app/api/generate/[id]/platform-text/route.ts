import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rewriteSaleTextForPlatform, type RewritablePlatform } from '@/lib/openai/platform-text';
import { isGenerationLocked } from '@/lib/generation/lock';
import { resolveCardRows } from '@/lib/generation/cards';
import type { PlanKey } from '@/lib/generation/constants';

/*
  Schreibt den Verkaufstext einer Karte fuer eine andere Plattform um
  (Kleinanzeigen/eBay -- Vinted braucht das nicht, siehe platform-text.ts).

  Dieser Endpunkt loest einen ECHTEN, kostenpflichtigen OpenAI-Aufruf aus.
  Zwei Eigenschaften halten die Kosten deshalb hart begrenzt:

  1. Jedes Ergebnis wird zwischengespeichert (generations.cards[].platformTexts).
     Frueher galt das NUR fuer Zeilen mit gefuellter cards-Spalte -- bei
     Legacy-Generierungen (vor Migration 20260723090000) lief jeder Aufruf
     ungecacht durch, derselbe Aufruf in einer Schleife erzeugte also
     unbegrenzt Kosten. Jetzt werden Legacy-Karten beim ersten Aufruf einmalig
     aus result_paths/sale_text materialisiert (exakt dieselbe Ableitung wie
     resolveCardRows, die Anzeige aendert sich dadurch nicht), womit der Cache
     ausnahmslos greift. Damit ist die Obergrenze: Karten × 2 Plattformen,
     einmalig je Generierung -- und neue Generierungen kosten Credits und
     unterliegen bereits dem Rate-Limit.

  2. Der Ausgangstext kommt AUSSCHLIESSLICH aus der Datenbank. Frueher durfte
     der Client fuer Legacy-Zeilen einen eigenen `baseText` (bis 4000 Zeichen)
     mitschicken -- damit war der Endpunkt faktisch ein kostenloser
     LLM-Umschreibedienst fuer beliebige Texte. Der Server leitet ihn jetzt
     selbst ab; das Feld wird ignoriert.
*/

export const runtime = 'nodejs';

const bodySchema = z.object({
  itemIndex: z.number(),
  platform: z.enum(['kleinanzeigen', 'ebay']),
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
  const { itemIndex, platform } = parsed.data;

  const admin = createAdminClient();
  const [{ data: generation, error }, { data: profile }] = await Promise.all([
    // mode/result_paths/sale_text zusaetzlich: noetig, um Legacy-Karten
    // serverseitig abzuleiten (resolveCardRows) statt sie vom Client zu
    // uebernehmen.
    admin
      .from('generations')
      .select('id, user_id, mode, cards, result_paths, sale_text, cost_usd, is_free_reveal')
      .eq('id', id)
      .single(),
    supabase.from('profiles').select('plan').single(),
  ]);

  // Kein Unterschied zwischen "existiert nicht" und "gehört jemand anderem".
  if (error || !generation || generation.user_id !== user.id) {
    return NextResponse.json({ error: 'Generierung nicht gefunden.' }, { status: 404 });
  }

  // Verteidigung in der Tiefe: der Export-Button ist im UI bereits verdeckt
  // (siehe result-view.tsx), aber ein direkter API-Aufruf muss ebenfalls
  // scheitern -- sonst liesse sich die Vorschau-Sperre umgehen.
  if (isGenerationLocked((profile?.plan as PlanKey) ?? 'free', generation.is_free_reveal)) {
    return NextResponse.json({ error: 'Für dieses Ergebnis ist ein bezahlter Tarif nötig.' }, { status: 403 });
  }

  // Bei Legacy-Zeilen (cards leer) leitet resolveCardRows die Karten aus
  // result_paths/sale_text ab -- exakt wie die Anzeige es ohnehin tut. Das
  // Ergebnis wird unten mitgespeichert, wodurch die Zeile ab dann eine
  // normale cards-Zeile ist und der Cache greift.
  const cards = resolveCardRows(generation) as CardRow[];
  const cardPos = cards.findIndex((c) => c.itemIndex === itemIndex);
  if (cardPos === -1) {
    return NextResponse.json({ error: 'Kein Ausgangstext für diese Karte vorhanden.' }, { status: 400 });
  }
  const card = cards[cardPos];

  const cached = card.platformTexts?.[platform];
  if (cached) return NextResponse.json({ text: cached });

  // Ausschliesslich der serverseitig bekannte Text -- kein vom Client
  // geschickter Inhalt (siehe Kopfkommentar).
  const baseText = card.saleText;
  if (!baseText) {
    return NextResponse.json({ error: 'Kein Ausgangstext für diese Karte vorhanden.' }, { status: 400 });
  }

  let text: string;
  let costUsd: number | null;
  try {
    ({ text, costUsd } = await rewriteSaleTextForPlatform(baseText, platform));
  } catch (err) {
    console.error('[platform-text] Umschreibung fehlgeschlagen', id, itemIndex, platform, err);
    return NextResponse.json({ error: 'Text konnte nicht erstellt werden.' }, { status: 502 });
  }

  // Kosten nachtragen -- ein realer OpenAI-Aufruf ist gerade passiert.
  const newCostUsd = (generation.cost_usd ?? 0) + (costUsd ?? 0);

  // Immer schreiben: Bei Legacy-Zeilen materialisiert das zusaetzlich die
  // abgeleiteten Karten, sodass jeder weitere Aufruf aus dem Cache bedient
  // wird statt erneut zu kosten.
  cards[cardPos] = { ...card, platformTexts: { ...card.platformTexts, [platform]: text } };
  await admin.from('generations').update({ cards, cost_usd: newCostUsd }).eq('id', id);

  return NextResponse.json({ text });
}

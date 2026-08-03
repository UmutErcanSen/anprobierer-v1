import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveCardRows } from '@/lib/generation/cards';

/*
  Datenexport nach DSGVO Art. 15 (Auskunft) und Art. 20 (Datenuebertragbarkeit).
  Liefert reine Daten (JSON mit frisch signierten Bild-URLs) -- das Zippen mit
  den tatsaechlichen Bildern passiert clientseitig in ExportDataButton, gleiches
  Muster wie beim bestehenden ZIP-Download im Verlauf (siehe selection.tsx).

  WICHTIG: bewusst IMMER die echten, unverdeckten Bilder/Texte -- die
  "locked"-Vorschau (siehe lib/generation/lock.ts) ist ein Bezahlschranken-
  Mechanismus fuer die ANZEIGE gegenueber Dritten/vor dem Upgrade, kein
  Zugriffsschutz gegen den Eigentuemer der Daten selbst. Ein Auskunfts-
  anspruch nach Art. 15 gilt fuer die eigenen Daten unabhaengig vom Tarif.
*/

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: profile }, { data: subscription }, { data: ledger }, { data: generations }] = await Promise.all([
    admin.from('profiles').select('display_name, plan, created_at').eq('id', user.id).single(),
    admin.from('subscriptions').select('plan, status, current_period_end').eq('user_id', user.id).maybeSingle(),
    admin
      .from('credit_ledger')
      .select('delta, reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    admin
      .from('generations')
      .select('id, status, mode, quality, credits_charged, clothing_types, sizes, colors, cards, result_paths, sale_text, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ]);

  const generierungen = await Promise.all(
    (generations ?? []).map(async (g) => {
      const cardRows = resolveCardRows(g);
      const bilder = await Promise.all(
        cardRows
          .filter((c) => c.imagePath)
          .map(async (c) => {
            // 10 Minuten reichen fuer den unmittelbar folgenden Download im
            // Browser -- kein Grund, laenger gueltige Links auszustellen.
            const { data } = await admin.storage.from('results').createSignedUrl(c.imagePath!, 60 * 10);
            return { titel: c.title, url: data?.signedUrl ?? null, verkaufstext: c.saleText };
          }),
      );

      return {
        id: g.id,
        erstelltAm: g.created_at,
        status: g.status,
        modus: g.mode,
        qualitaet: g.quality,
        verbrauchteCredits: g.credits_charged,
        kategorien: g.clothing_types ?? [],
        groessen: g.sizes ?? [],
        farben: g.colors ?? [],
        bilder,
      };
    }),
  );

  return NextResponse.json({
    konto: {
      email: user.email,
      name: profile?.display_name || null,
      tarif: profile?.plan ?? 'free',
      registriertAm: profile?.created_at ?? user.created_at,
    },
    abo: subscription
      ? { tarif: subscription.plan, status: subscription.status, naechsteAbrechnung: subscription.current_period_end }
      : null,
    creditVerlauf: (ledger ?? []).map((l) => ({ aenderung: l.delta, grund: l.reason, am: l.created_at })),
    generierungen,
  });
}

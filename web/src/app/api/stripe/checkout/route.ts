import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';
import { priceIdFor } from '@/lib/stripe/plans';

/*
  Erstellt eine Stripe Checkout Session fuer ein Abo und gibt deren URL
  zurueck -- der Client leitet den Browser dorthin weiter. Kein Cent Zahlungs-
  daten laeuft ueber unseren Server; Stripe Checkout ist eine von Stripe
  gehostete Seite (CLAUDE.md §9: "OpenAI/Zahlungs-API niemals direkt vom
  Browser", hier zusaetzlich: Kartendaten sieht nicht mal unser Server).

  client_reference_id + subscription_data.metadata.user_id tragen dieselbe
  Nutzer-ID redundant an zwei Stellen ein. Grund: subscription_data.metadata
  landet auf dem Subscription-Objekt selbst und ist damit bei JEDEM
  spaeteren subscription.*- und invoice.*-Event verfuegbar (ueber
  invoice.parent.subscription_details.metadata) -- unabhaengig davon, ob und
  wann checkout.session.completed verarbeitet wurde. Der Webhook-Handler
  verlaesst sich ausschliesslich auf diesen Weg, nicht auf die Ereignis-
  Reihenfolge.
*/

export const runtime = 'nodejs';

const bodySchema = z.object({
  plan: z.enum(['basic', 'pro']),
  interval: z.enum(['monthly', 'yearly']),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte melde dich zuerst an.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Ungültiger Tarif.' }, { status: 400 });
  const { plan, interval } = parsed.data;

  let priceId: string;
  try {
    priceId = priceIdFor(plan, interval);
  } catch (err) {
    console.error('[stripe/checkout] Price-ID fehlt', err);
    return NextResponse.json({ error: 'Dieser Tarif ist gerade nicht verfügbar.' }, { status: 500 });
  }

  // Vorhandenen Stripe-Kunden wiederverwenden statt bei jedem Kauf einen
  // neuen anzulegen (sonst haeufen sich Karteileichen im Dashboard, und ein
  // Umstieg von Basic auf Pro wuerde als zweiter, unabhaengiger Kunde landen).
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .maybeSingle();

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      ...(existingSub?.stripe_customer_id
        ? { customer: existingSub.stripe_customer_id }
        : { customer_email: user.email ?? undefined }),
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${origin}/konto?checkout=erfolg`,
      cancel_url: `${origin}/preise?checkout=abgebrochen`,
    });
  } catch (err) {
    console.error('[stripe/checkout] Session konnte nicht erstellt werden', err);
    return NextResponse.json({ error: 'Checkout konnte nicht gestartet werden.' }, { status: 500 });
  }

  if (!session.url) {
    return NextResponse.json({ error: 'Checkout konnte nicht gestartet werden.' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}

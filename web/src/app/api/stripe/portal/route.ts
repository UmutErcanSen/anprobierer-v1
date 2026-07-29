import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

/*
  Stripe Customer Portal statt eigener Kuendigungs-/Rechnungs-Verwaltung --
  Stripe uebernimmt Zahlungsmittel aendern, Rechnungen einsehen, kuendigen.
  Alles, was dort passiert, kommt ueber den Webhook zurueck (customer.
  subscription.updated/deleted), nie direkt vom Client geschrieben.
*/

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Bitte melde dich zuerst an.' }, { status: 401 });

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'Du hast noch kein Abo abgeschlossen.' }, { status: 404 });
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/konto`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal] Session konnte nicht erstellt werden', err);
    return NextResponse.json({ error: 'Kontoverwaltung konnte nicht geöffnet werden.' }, { status: 500 });
  }
}

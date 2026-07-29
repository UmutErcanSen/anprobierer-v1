import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { CREDITS_PER_MONTH, monthsForInterval, planForPriceId } from '@/lib/stripe/plans';

/*
  Einzige Wahrheitsquelle fuer Abo-Status und abo-gebundene Credits. Der
  Client schreibt profiles.plan/subscriptions nirgends selbst (RLS verbietet
  es, siehe initial_schema.sql) -- ausschliesslich dieser Handler, ueber den
  Admin-Client.

  Rohkoerper + Signaturpruefung: anders als /api/generate braucht dieser
  Handler request.text() statt request.json(), weil Stripe die Signatur ueber
  die exakten Rohbytes berechnet -- ein bereits geparster/neu serialisierter
  Body wuerde nicht mehr passen.

  Event-Auswahl (bewusst nicht "jedes Stripe-Event"):
    customer.subscription.created/updated  -> Bestand spiegeln (Plan/Status),
                                               OHNE Credits gutzuschreiben
    customer.subscription.deleted          -> zurueck auf 'free'
    invoice.paid                           -> Credits gutschreiben (einzige
                                               Stelle dafuer -- siehe Migration
                                               20260729100000)
    invoice.payment_failed                 -> Status 'past_due', Zugriff
                                               bleibt bis zur echten Kuendigung
                                               bestehen (Stripe Smart Retries
                                               laufen vorher durch)
*/

export const runtime = 'nodejs';

function mapStatus(
  status: Stripe.Subscription.Status,
): 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
    case 'paused':
      return 'canceled';
    case 'incomplete':
    default:
      return 'incomplete';
  }
}

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === 'string' ? customer : customer.id;
}

async function handleSubscriptionUpsert(admin: ReturnType<typeof createAdminClient>, subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.error('[stripe/webhook] Subscription ohne user_id-Metadata', subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const mapped = item?.price?.id ? planForPriceId(item.price.id) : null;
  if (!mapped) {
    console.error('[stripe/webhook] Unbekannte Price-ID auf Subscription', item?.price?.id, subscription.id);
    return;
  }

  const { error } = await admin.rpc('upsert_subscription', {
    p_user_id: userId,
    p_plan: mapped.plan,
    p_status: mapStatus(subscription.status),
    p_stripe_customer_id: customerId(subscription.customer),
    p_stripe_subscription_id: subscription.id,
    p_current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
  });
  if (error) console.error('[stripe/webhook] upsert_subscription fehlgeschlagen', error);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET fehlt in .env.local.');
    return NextResponse.json({ error: 'Server nicht konfiguriert.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error('Signatur-Header fehlt.');
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Ungültige Signatur — Anfrage verworfen', err);
    return NextResponse.json({ error: 'Ungültige Signatur.' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscriptionUpsert(admin, event.data.object);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.user_id;
        if (!userId) {
          console.error('[stripe/webhook] Kündigung ohne user_id-Metadata', subscription.id);
          break;
        }
        const { error } = await admin.rpc('upsert_subscription', {
          p_user_id: userId,
          p_plan: 'free',
          p_status: 'canceled',
          p_stripe_customer_id: customerId(subscription.customer),
          p_stripe_subscription_id: subscription.id,
          p_current_period_end: null,
          p_cancel_at_period_end: false,
        });
        if (error) console.error('[stripe/webhook] Kündigung konnte nicht gespeichert werden', error);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const userId = invoice.parent?.subscription_details?.metadata?.user_id;
        const priceDetails = invoice.lines.data[0]?.pricing?.price_details;
        const priceId = typeof priceDetails?.price === 'string' ? priceDetails.price : priceDetails?.price?.id;
        const mapped = priceId ? planForPriceId(priceId) : null;

        if (!userId || !mapped) {
          console.error('[stripe/webhook] invoice.paid ohne verwertbare Daten', invoice.id, { userId, priceId });
          break;
        }

        const credits = CREDITS_PER_MONTH[mapped.plan] * monthsForInterval(mapped.interval);
        const { data: granted, error } = await admin.rpc('grant_subscription_credits', {
          p_user_id: userId,
          p_credits: credits,
          p_stripe_event_id: event.id,
          p_note: `Rechnung ${invoice.id} (${mapped.plan}, ${mapped.interval})`,
        });
        if (error) console.error('[stripe/webhook] Credit-Gutschrift fehlgeschlagen', error);
        else if (!granted) console.log('[stripe/webhook] Event bereits verarbeitet (Idempotenz)', event.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const userId = invoice.parent?.subscription_details?.metadata?.user_id;
        if (userId) {
          const { error } = await admin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('user_id', userId);
          if (error) console.error('[stripe/webhook] Status past_due fehlgeschlagen', error);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[stripe/webhook] Unerwarteter Fehler bei', event.type, err);
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

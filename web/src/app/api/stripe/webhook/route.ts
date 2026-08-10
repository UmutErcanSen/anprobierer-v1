import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { CREDITS_PER_MONTH, monthsForInterval, planForPriceId } from '@/lib/stripe/plans';
import type { PlanKey } from '@/lib/generation/constants';

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

/**
 * Liest einen fuer die Zukunft geplanten Tarifwechsel aus.
 *
 * Stripe fuehrt eine HERABSTUFUNG nicht sofort aus, sondern legt sie auf das
 * Ende der bezahlten Periode -- technisch ueber ein `subscription_schedule`
 * mit zwei Phasen: die laufende (alter Tarif) und die kuenftige (neuer
 * Tarif). Die Subscription selbst zeigt bis dahin unveraendert den alten
 * Preis. Genau deshalb sah eine Herabstufung in der App bisher wirkungslos
 * aus: Der Webhook spiegelte korrekt den weiterhin gueltigen Tarif, und der
 * geplante Wechsel tauchte nirgends auf.
 *
 * Gibt `{ plan: null, at: null }` zurueck, wenn nichts ansteht -- diese
 * Werte werden bewusst mitgeschrieben, damit ein zurueckgenommener Wechsel
 * (subscription_schedule.released) den Hinweis wieder verschwinden laesst.
 */
async function readScheduledChange(
  subscription: Stripe.Subscription,
  aktuellerPreis: string | undefined,
): Promise<{ plan: PlanKey | null; at: string | null }> {
  const leer = { plan: null, at: null };
  if (!subscription.schedule) return leer;

  try {
    const scheduleId =
      typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule.id;
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);

    // Die erste Phase, die einen ANDEREN Preis als den aktuell laufenden
    // vorsieht. Ein Zeitplan kann auch nur die bestehende Periode abbilden
    // (etwa direkt nach einem Upgrade) -- dann steht kein Wechsel an.
    for (const phase of schedule.phases) {
      const preis = phase.items?.[0]?.price;
      const preisId = typeof preis === 'string' ? preis : preis?.id;
      if (!preisId || preisId === aktuellerPreis) continue;

      const mapped = planForPriceId(preisId);
      if (!mapped) {
        console.error('[stripe/webhook] Geplante Phase mit unbekannter Price-ID', preisId, scheduleId);
        continue;
      }
      return { plan: mapped.plan, at: new Date(phase.start_date * 1000).toISOString() };
    }
    return leer;
  } catch (err) {
    // Bewusst kein Werfen: Der geplante Wechsel ist eine Zusatzinformation.
    // Ein Fehler beim Nachladen darf nicht verhindern, dass der tatsaechlich
    // gueltige Tarif gespeichert wird -- das waere die deutlich schlimmere
    // Folge.
    console.error('[stripe/webhook] Zeitplan konnte nicht gelesen werden', subscription.id, err);
    return leer;
  }
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

  const geplant = await readScheduledChange(subscription, item?.price?.id);

  const { error } = await admin.rpc('upsert_subscription', {
    p_user_id: userId,
    p_plan: mapped.plan,
    p_status: mapStatus(subscription.status),
    p_stripe_customer_id: customerId(subscription.customer),
    p_stripe_subscription_id: subscription.id,
    p_current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_scheduled_plan: geplant.plan,
    p_scheduled_change_at: geplant.at,
  });
  // Werfen statt nur loggen: Der Aufrufer antwortet daraufhin mit 500 und
  // Stripe wiederholt das Event. Frueher wurde der Fehler nur protokolliert
  // und trotzdem 200 zurueckgegeben -- Stripe hielt das fuer erfolgreich,
  // wiederholte nie, und der Abo-Zustand blieb dauerhaft falsch.
  if (error) throw new Error(`upsert_subscription fehlgeschlagen: ${error.message}`);
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

  /*
    Eingang protokollieren, BEVOR verarbeitet wird. Erst dadurch laesst sich
    spaeter ueberhaupt unterscheiden, ob ein Event nie ankam (keine Zeile) oder
    ankam und scheiterte (Zeile mit status 'failed') -- siehe Migration
    20260810130000_stripe_event_protokoll.sql.

    onConflict: Stripe wiederholt Events; die vorhandene Zeile bleibt dabei
    unangetastet (ignoreDuplicates), damit ein frueherer Fehlerstand nicht
    ueberschrieben wird, bevor der neue Versuch sein Ergebnis kennt.
  */
  await admin
    .from('stripe_events')
    .upsert({ id: event.id, type: event.type, status: 'received' }, { onConflict: 'id', ignoreDuplicates: true });

  async function protokolliere(status: 'processed' | 'ignored' | 'failed', fehler?: string) {
    await admin
      .from('stripe_events')
      .update({ status, error_message: fehler ?? null, processed_at: new Date().toISOString() })
      .eq('id', event.id);
  }

  let verarbeitet = true;

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
          // Kein Wiederholen: fehlende Metadaten heilen sich nicht von selbst,
          // eine Endlosschleife brächte nichts. Aber als 'failed' vermerken,
          // damit es in admin.webhook_fehler auffaellt.
          console.error('[stripe/webhook] Kündigung ohne user_id-Metadata', subscription.id);
          verarbeitet = false;
          await protokolliere('failed', `Kündigung ohne user_id-Metadata (${subscription.id})`);
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
        if (error) throw new Error(`Kündigung konnte nicht gespeichert werden: ${error.message}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const userId = invoice.parent?.subscription_details?.metadata?.user_id;

        // Bei einem Tarifwechsel MITTEN in der Periode (Upgrade/Downgrade ueber
        // das Customer Portal) enthaelt die naechste Rechnung zusaetzlich zur
        // regulaeren Verlaengerung ein oder zwei Proration-Posten (Gutschrift
        // fuer den alten Tarif, Nachbelastung fuer den neuen). lines.data[0]
        // waere dann nicht verlaesslich der "echte" Posten -- deshalb gezielt
        // die NICHT-Proration-Zeile suchen, die die tatsaechliche volle
        // Periode beschreibt. Reine Proration-Rechnungen (keine solche Zeile
        // vorhanden) loesen bewusst KEINE Credit-Gutschrift aus.
        const line = invoice.lines.data.find(
          (l) => l.parent?.subscription_item_details?.proration === false,
        );
        const priceDetails = line?.pricing?.price_details;
        const priceId = typeof priceDetails?.price === 'string' ? priceDetails.price : priceDetails?.price?.id;
        const mapped = priceId ? planForPriceId(priceId) : null;

        if (!userId) {
          // Zahlung erfolgt, aber niemand zuzuordnen -- der schlimmste Fall,
          // muss zwingend sichtbar werden.
          console.error('[stripe/webhook] invoice.paid ohne user_id-Metadata', invoice.id);
          verarbeitet = false;
          await protokolliere('failed', `invoice.paid ohne user_id-Metadata (${invoice.id})`);
          break;
        }
        if (!line) {
          // Kein Fehler: reine Proration-Rechnungen sollen bewusst keine
          // Credits ausloesen.
          console.log('[stripe/webhook] invoice.paid enthält nur Proration-Posten — keine Gutschrift', invoice.id);
          verarbeitet = false;
          await protokolliere('ignored');
          break;
        }
        if (!mapped) {
          console.error('[stripe/webhook] invoice.paid mit unbekannter Price-ID', invoice.id, { priceId });
          verarbeitet = false;
          await protokolliere('failed', `Unbekannte Price-ID ${priceId} (${invoice.id})`);
          break;
        }

        const credits = CREDITS_PER_MONTH[mapped.plan] * monthsForInterval(mapped.interval);
        const { data: granted, error } = await admin.rpc('grant_subscription_credits', {
          p_user_id: userId,
          p_credits: credits,
          p_stripe_event_id: event.id,
          p_note: `Rechnung ${invoice.id} (${mapped.plan}, ${mapped.interval})`,
        });
        if (error) throw new Error(`Credit-Gutschrift fehlgeschlagen: ${error.message}`);
        // granted === false ist KEIN Fehler, sondern die Idempotenzsperre:
        // dieses Event wurde bereits gutgeschrieben (Stripe-Wiederholung).
        if (!granted) console.log('[stripe/webhook] Event bereits verarbeitet (Idempotenz)', event.id);
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
          if (error) throw new Error(`Status past_due fehlgeschlagen: ${error.message}`);
        }
        break;
      }

      default:
        // Event-Typ, den wir bewusst nicht auswerten.
        verarbeitet = false;
        await protokolliere('ignored');
        break;
    }
  } catch (err) {
    console.error('[stripe/webhook] Unerwarteter Fehler bei', event.type, err);
    await protokolliere('failed', err instanceof Error ? err.message : String(err));
    // 500 ist hier Absicht: Stripe wiederholt das Event dann nach eigenem
    // Zeitplan (bis zu drei Tage). Ein voreiliges 200 wuerde den Fehlschlag
    // endgueltig machen.
    return NextResponse.json({ error: 'Verarbeitung fehlgeschlagen.' }, { status: 500 });
  }

  if (verarbeitet) await protokolliere('processed');

  return NextResponse.json({ received: true });
}

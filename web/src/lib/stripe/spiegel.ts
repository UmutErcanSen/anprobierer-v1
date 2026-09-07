import 'server-only';

import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import type { createAdminClient } from '@/lib/supabase/admin';
import { planForPriceId } from '@/lib/stripe/plans';
import type { PlanKey } from '@/lib/generation/constants';

/*
  Ein Stripe-Abo in unsere Tabellen spiegeln.

  Lag frueher im Webhook-Handler. Herausgeloest, weil es jetzt ZWEI Wege gibt,
  auf denen ein Abo bei uns ankommt:

    1. Stripe schiebt ein Ereignis (customer.subscription.*) -- der Normalfall
    2. Wir holen den Stand aktiv, weil ein Ereignis ausgeblieben ist
       (lib/stripe/abgleich.ts)

  Beide muessen zwingend zum selben Ergebnis fuehren. Zwei Kopien derselben
  Logik waeren genau die Art Fehler, die man erst Monate spaeter bemerkt --
  wenn ein Konto je nach Weg einen anderen Tarif bekommt.
*/

type Admin = ReturnType<typeof createAdminClient>;

export function mapStatus(
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

export function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === 'string' ? customer : customer.id;
}

/**
 * Liest einen fuer die Zukunft geplanten Tarifwechsel aus.
 *
 * Stripe fuehrt eine HERABSTUFUNG nicht sofort aus, sondern legt sie auf das
 * Ende der bezahlten Periode -- technisch ueber ein `subscription_schedule`
 * mit zwei Phasen: die laufende (alter Tarif) und die kuenftige (neuer
 * Tarif). Die Subscription selbst zeigt bis dahin unveraendert den alten
 * Preis. Genau deshalb sah eine Herabstufung in der App einmal wirkungslos
 * aus: Der Webhook spiegelte korrekt den weiterhin gueltigen Tarif, und der
 * geplante Wechsel tauchte nirgends auf.
 *
 * Gibt `{ plan: null, at: null }` zurueck, wenn nichts ansteht -- diese
 * Werte werden bewusst mitgeschrieben, damit ein zurueckgenommener Wechsel
 * (subscription_schedule.released) den Hinweis wieder verschwinden laesst.
 */
export async function readScheduledChange(
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
        console.error('[stripe/spiegel] Geplante Phase mit unbekannter Price-ID', preisId, scheduleId);
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
    console.error('[stripe/spiegel] Zeitplan konnte nicht gelesen werden', subscription.id, err);
    return leer;
  }
}

/**
 * Schreibt den Stand einer Stripe-Subscription in unsere Tabellen.
 *
 * Wirft bei einem Datenbankfehler. Der Webhook antwortet daraufhin mit 500
 * und Stripe wiederholt das Ereignis. Frueher wurde der Fehler nur
 * protokolliert und trotzdem 200 zurueckgegeben -- Stripe hielt das fuer
 * erfolgreich, wiederholte nie, und der Abo-Zustand blieb dauerhaft falsch.
 */
export async function spiegleAbo(admin: Admin, subscription: Stripe.Subscription): Promise<PlanKey | null> {
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.error('[stripe/spiegel] Subscription ohne user_id-Metadata', subscription.id);
    return null;
  }

  const item = subscription.items.data[0];
  const mapped = item?.price?.id ? planForPriceId(item.price.id) : null;
  if (!mapped) {
    console.error('[stripe/spiegel] Unbekannte Price-ID auf Subscription', item?.price?.id, subscription.id);
    return null;
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
  if (error) throw new Error(`upsert_subscription fehlgeschlagen: ${error.message}`);

  return mapped.plan;
}

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
 * Ergebnis von spiegleAbo.
 *
 * `ok: false` heisst ausdruecklich: dauerhaft nicht zuzuordnen, ein erneuter
 * Versuch braechte nichts. Alles, was sich durch Wiederholen HEILEN kann,
 * wirft stattdessen -- siehe dort.
 */
export type SpiegelErgebnis = { ok: true; plan: PlanKey } | { ok: false; grund: string };

/**
 * Zu welchem Nutzer gehoert diese Subscription?
 *
 * Erste Quelle sind die Metadaten, die unser Checkout setzt. Faellt die weg
 * (Abo von Hand im Stripe-Dashboard angelegt, oder ein Altbestand von vor der
 * Einfuehrung), hilft der Kunde weiter: Zu ihm steht die Zuordnung bereits in
 * unserer Tabelle. Ohne diesen Rueckfall waere so ein Abo unrettbar, obwohl
 * wir den Nutzer sehr wohl kennen.
 */
async function findeNutzer(admin: Admin, subscription: Stripe.Subscription): Promise<string | null> {
  const ausMetadaten = subscription.metadata?.user_id;
  if (ausMetadaten) return ausMetadaten;

  const kunde = customerId(subscription.customer);
  const { data } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', kunde)
    .maybeSingle();

  if (data?.user_id) {
    console.warn('[stripe/spiegel] user_id fehlte in den Metadaten, ueber den Kunden zugeordnet', subscription.id);
    return data.user_id as string;
  }
  return null;
}

/**
 * Schreibt den Stand einer Stripe-Subscription in unsere Tabellen.
 *
 * WIRFT bei allem, was sich durch Wiederholen heilen kann -- Datenbankfehler
 * und unbekannte Price-ID. Der Webhook antwortet daraufhin mit 500 und Stripe
 * wiederholt ueber rund drei Tage.
 *
 * Dass die unbekannte Price-ID dazugehoert, ist der Punkt: Sie bedeutet fast
 * immer eine fehlende oder falsche STRIPE_PRICE_*-Variable. Vorher wurde das
 * nur protokolliert und 200 zurueckgegeben -- Stripe hielt das Ereignis fuer
 * zugestellt, wiederholte nie, und ein zahlender Kunde bekam dauerhaft keinen
 * Tarif, ohne dass irgendetwas Alarm schlug. Mit dem Wurf bleibt das Ereignis
 * in der Wiederholung haengen, bis die Variable stimmt.
 *
 * Gibt `ok: false` nur zurueck, wenn sich das NICHT heilen kann: Die
 * Subscription laesst sich keinem Nutzer zuordnen, auch nicht ueber den
 * Kunden. Dann gehoert sie schlicht nicht zu uns, und eine Endlosschleife
 * braechte nichts -- der Webhook vermerkt sie als 'failed' und sie faellt in
 * admin.webhook_fehler auf.
 */
export async function spiegleAbo(admin: Admin, subscription: Stripe.Subscription): Promise<SpiegelErgebnis> {
  const userId = await findeNutzer(admin, subscription);
  if (!userId) {
    console.error('[stripe/spiegel] Subscription keinem Nutzer zuzuordnen', subscription.id);
    return { ok: false, grund: `Subscription ohne zuordenbaren Nutzer (${subscription.id})` };
  }

  const item = subscription.items.data[0];
  const mapped = item?.price?.id ? planForPriceId(item.price.id) : null;
  if (!mapped) {
    console.error('[stripe/spiegel] Unbekannte Price-ID auf Subscription', item?.price?.id, subscription.id);
    throw new Error(
      `Unbekannte Price-ID ${item?.price?.id} auf ${subscription.id} — ` +
        'STRIPE_PRICE_*-Variablen pruefen. Stripe wiederholt das Ereignis.',
    );
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

  return { ok: true, plan: mapped.plan };
}

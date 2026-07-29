import 'server-only';

/*
  Zentrale Zuordnung Stripe-Price-ID <-> (Plan, Abrechnungsintervall).

  Bewusst NICHT aus Stripe's `price.recurring` ausgelesen: Da wir die vier
  Preise selbst anlegen, kennen wir Intervall und Credit-Menge ohnehin --
  ein zusaetzlicher API-Aufruf zum Expandieren waere ueberfluessig und
  fehleranfaelliger als die eigene, feste Zuordnung.

  Bewusst lazy (Funktionen statt Modul-weiter Objekt-Literale): Wuerde die
  Zuordnung beim Modul-Import aufgebaut, wuerde ein fehlender Price-ID-Wert
  in .env.local schon beim ersten Import (z.B. waehrend `next build`) werfen,
  nicht erst wenn der jeweilige Tarif tatsaechlich gebraucht wird.
*/

export type PaidPlan = 'basic' | 'pro';
export type BillingInterval = 'monthly' | 'yearly';

// Menge pro abgedecktem Monat -- bei Jahresabos wird das x12 im Voraus
// gutgeschrieben (siehe grant_subscription_credits-Aufruf im Webhook).
// Credits verfallen laut Preismodell nie, ein Jahresvorschuss ist daher
// wirtschaftlich unproblematisch und braucht keinen separaten Monats-Cron.
export const CREDITS_PER_MONTH: Record<PaidPlan, number> = {
  basic: 60,
  pro: 200,
};

const ENV_VARS: Record<PaidPlan, Record<BillingInterval, string>> = {
  basic: { monthly: 'STRIPE_PRICE_BASIC_MONTHLY', yearly: 'STRIPE_PRICE_BASIC_YEARLY' },
  pro: { monthly: 'STRIPE_PRICE_PRO_MONTHLY', yearly: 'STRIPE_PRICE_PRO_YEARLY' },
};

export function priceIdFor(plan: PaidPlan, interval: BillingInterval): string {
  const envVar = ENV_VARS[plan][interval];
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`${envVar} fehlt in .env.local — Price-ID im Stripe-Dashboard anlegen und eintragen.`);
  }
  return value;
}

export function planForPriceId(priceId: string): { plan: PaidPlan; interval: BillingInterval } | null {
  for (const plan of Object.keys(ENV_VARS) as PaidPlan[]) {
    for (const interval of Object.keys(ENV_VARS[plan]) as BillingInterval[]) {
      if (process.env[ENV_VARS[plan][interval]] === priceId) return { plan, interval };
    }
  }
  return null;
}

export function monthsForInterval(interval: BillingInterval): number {
  return interval === 'yearly' ? 12 : 1;
}

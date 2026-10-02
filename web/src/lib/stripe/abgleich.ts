import 'server-only';

import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { spiegleAbo } from '@/lib/stripe/spiegel';
import { brauchtAbgleich, type AboAbbild } from '@/lib/stripe/abgleich-regeln';
import type { PlanKey } from '@/lib/generation/constants';

/*
  Zweite, ZIEHENDE Quelle fuer den Abo-Zustand -- neben dem Webhook, der
  schiebt.

  Warum es das braucht, steht ausfuehrlich in abgleich-regeln.ts. Kurz: Ein
  verlorenes Webhook-Ereignis hinterliess bisher eine dauerhaft falsche
  Datenbank, ohne dass irgendetwas es je bemerkt haette. Hier wird der Stand
  bei Stripe geholt, sobald der eigene Datensatz danach aussieht, als haette
  ein Ereignis kommen muessen.

  Bewusst KEIN Hintergrundjob: Der braeuchte einen Scheduler, und die
  Hosting-Frage ist noch offen. Der Abgleich laeuft stattdessen dort, wo der
  Tarif tatsaechlich zaehlt -- vor dem Abbuchen von Credits und beim Blick
  ins Konto. Ein Konto, das niemand benutzt, muss auch nicht stimmen.

  Kostenpunkt: Fuer Free-Konten (die Mehrheit) entsteht nie ein API-Aufruf,
  fuer zahlende hoechstens einer alle fuenf Minuten -- und auch das nur,
  solange der Datensatz veraltet aussieht.
*/

/**
 * Gleicht den Tarif eines Kontos mit Stripe ab, falls noetig.
 *
 * Gibt den gueltigen Tarif zurueck, wenn abgeglichen wurde, sonst `null`
 * (= es war nichts zu tun, der vorhandene Stand gilt weiter).
 *
 * Wirft NICHT: Ein Ausfall bei Stripe darf den Aufrufer nicht blockieren.
 * Der Aufrufer arbeitet dann mit dem bisherigen Stand weiter -- das ist
 * derselbe Zustand wie vor diesem Abgleich und damit kein Rueckschritt.
 */
export async function tarifAbgleichen(userId: string): Promise<PlanKey | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, current_period_end, scheduled_change_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[stripe/abgleich] Abo konnte nicht gelesen werden', userId, error);
    return null;
  }
  if (!brauchtAbgleich(data as AboAbbild | null, new Date())) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(data!.stripe_subscription_id!);
    const ergebnis = await spiegleAbo(admin, subscription);
    if (!ergebnis.ok) {
      console.error('[stripe/abgleich] Abo nicht zuzuordnen', userId, ergebnis.grund);
      return null;
    }
    console.warn(
      '[stripe/abgleich] Abo nachgezogen -- ein Webhook-Ereignis ist offenbar verloren gegangen.',
      userId,
      'neuer Tarif:',
      ergebnis.plan,
    );
    return ergebnis.plan;
  } catch (err) {
    console.error('[stripe/abgleich] Abgleich mit Stripe fehlgeschlagen', userId, err);
    return null;
  }
}

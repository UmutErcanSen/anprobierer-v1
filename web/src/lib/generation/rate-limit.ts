import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Schutz gegen Kostenmissbrauch (CLAUDE.md §9): ohne diese Grenzen kann ein
 * Account mit ausreichend Guthaben beliebig viele Generierungen parallel oder
 * in schneller Folge lostreten. Bewusst keine externe Queue-Infrastruktur
 * (BullMQ o. ae.) -- bei der aktuellen Nutzerzahl reicht eine Zaehlung gegen
 * die bestehende generations-Tabelle voellig aus; eine echte Job-Queue waere
 * hier nur totes Gewicht. Die Concurrency-Sperre uebernimmt faktisch die
 * Rolle der Queue: es laeuft nie mehr als ein Job pro Nutzer gleichzeitig.
 *
 * Werte sind ein erster Schaetzwert, keine gemessene Grenze -- bei Bedarf
 * (echte Nutzung, Support-Rueckmeldungen) anpassen.
 */
export const HOURLY_LIMIT = 10;
export const DAILY_LIMIT = 30;

const RUNNING_STATUSES = ['queued', 'processing'] as const;

/** Liefert eine Nutzer-lesbare Fehlermeldung, oder `null` wenn alles im Rahmen ist. */
export async function rateLimitError(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: running }, { count: lastHour }, { count: lastDay }] = await Promise.all([
    supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', RUNNING_STATUSES),
    supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', hourAgo),
    supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayAgo),
  ]);

  if ((running ?? 0) > 0) {
    return 'Du hast bereits eine laufende Generierung. Bitte warte, bis sie fertig ist.';
  }
  if ((lastHour ?? 0) >= HOURLY_LIMIT) {
    return `Du hast das Stundenlimit von ${HOURLY_LIMIT} Generierungen erreicht. Bitte versuche es später erneut.`;
  }
  if ((lastDay ?? 0) >= DAILY_LIMIT) {
    return `Du hast das Tageslimit von ${DAILY_LIMIT} Generierungen erreicht. Bitte versuche es morgen erneut.`;
  }
  return null;
}

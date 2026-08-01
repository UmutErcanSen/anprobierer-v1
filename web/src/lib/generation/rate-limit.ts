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

/**
 * NOTBREMSE ueber ALLE Nutzer hinweg — in Credits pro Tag.
 *
 * Die Grenzen oben wirken je Nutzer. Das schuetzt gegen einen einzelnen
 * Vielnutzer, aber nicht gegen viele: Registrieren sich fuenfzig Leute, sind
 * das fuenfzig mal drei Gratis-Credits, und niemand haelt das auf. Ein
 * weitergereichter Anmeldelink genuegt. Das Ausgabenlimit im OpenAI-Konto
 * greift erst, wenn das Geld bereits ausgegeben ist -- und schaltet dann die
 * echte Anwendung ab, nicht nur den Missbrauch.
 *
 * Der Wert ist ueber DAILY_CREDIT_BUDGET einstellbar, damit er sich ohne
 * Deploy anheben laesst, wenn die Nutzung wirklich waechst. Standard 1500
 * Credits ≈ 25-60 USD pro Tag (die Spanne kommt von Standard gegen HD) --
 * grosszuegig fuer den heutigen Stand, aber eine harte Decke gegen den Fall,
 * dass etwas aus dem Ruder laeuft.
 */
export const DAILY_CREDIT_BUDGET = Number(process.env.DAILY_CREDIT_BUDGET ?? 1500);

const RUNNING_STATUSES = ['queued', 'processing'] as const;

/**
 * Ab wann ein noch als "laufend" markierter Job als tot gilt.
 *
 * Der eigentliche Ablauf ist nach spaetestens `maxDuration` (300 s, siehe
 * api/generate/route.ts) vorbei. Bleibt eine Zeile darueber hinaus auf
 * 'processing', wurde der Vorgang abgebrochen, OHNE seinen catch-Block zu
 * erreichen: Serverless-Instanz beendet, Deploy mitten in der Generierung,
 * Out-of-Memory. Ohne diese Grenze zaehlte so eine Leiche fuer immer als
 * "laufende Generierung" und sperrte den Account dauerhaft fuer jede weitere
 * Anprobe -- bei bereits abgebuchten Credits.
 *
 * 10 min sind bewusst grosszuegig gegenueber den 300 s: lieber ein paar
 * Minuten zu spaet freigeben als einen echten, noch laufenden Job doppelt
 * starten lassen.
 *
 * Muss mit STALE_AFTER in der SQL-Funktion fail_stale_generations()
 * uebereinstimmen (Migration 20260727090000_stale_generations.sql), die
 * dieselben Zeilen anschliessend auch wirklich aufraeumt und die Credits
 * zurueckbucht. Diese Pruefung hier wirkt sofort, auch bevor der Cron laeuft.
 */
const STALE_AFTER_MS = 10 * 60 * 1000;

/** Liefert eine Nutzer-lesbare Fehlermeldung, oder `null` wenn alles im Rahmen ist. */
export async function rateLimitError(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const staleBefore = new Date(now - STALE_AFTER_MS).toISOString();

  const [{ count: running }, { count: lastHour }, { count: lastDay }] = await Promise.all([
    supabase
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', RUNNING_STATUSES)
      // Nur wirklich frische Jobs blockieren -- alles Aeltere ist eine Leiche
      // (siehe STALE_AFTER_MS) und darf den Nutzer nicht aussperren.
      .gte('created_at', staleBefore),
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

  /*
    Zuletzt die Notbremse ueber alle Nutzer. Bewusst als LETZTE Pruefung:
    Sie ist die teuerste (sie liest fremde Zeilen und braucht deshalb den
    Admin-Client) und der mit Abstand seltenste Fall. Die guenstigen,
    nutzereigenen Pruefungen haben vorher schon abgelehnt.

    Der Admin-Client ist hier noetig, weil Row Level Security den uebergebenen
    Client auf die eigenen Zeilen begrenzt -- eine Summe ueber ALLE Nutzer
    waere damit gar nicht ermittelbar.
  */
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { data: heute } = await createAdminClient()
    .from('generations')
    .select('credits_charged')
    .gte('created_at', dayAgo);

  const verbraucht = (heute ?? []).reduce((summe, zeile) => summe + (zeile.credits_charged ?? 0), 0);

  if (verbraucht >= DAILY_CREDIT_BUDGET) {
    // Bewusst ohne Zahlen: Das Tagesbudget des BETREIBERS geht den Nutzer
    // nichts an, und die Meldung soll nicht wie ein Fehler seines Kontos
    // wirken. Serverseitig wird der Fall dagegen deutlich protokolliert.
    console.error(
      `[rate-limit] TAGESBUDGET ERREICHT: ${verbraucht}/${DAILY_CREDIT_BUDGET} Credits in 24 h. ` +
        'Generierungen sind fuer alle Nutzer gesperrt, bis der Wert faellt oder ' +
        'DAILY_CREDIT_BUDGET angehoben wird.',
    );
    return 'Wir sind heute ungewöhnlich stark ausgelastet und pausieren neue Anproben kurz. Bitte versuch es später noch einmal — dein Guthaben bleibt selbstverständlich erhalten.';
  }

  return null;
}

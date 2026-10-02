import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/*
  Rate-Limits fuer teure Endpunkte AUSSERHALB der Bildgenerierung.

  Die Generierung hat ihre eigene, deutlich ausfuehrlichere Begrenzung
  (lib/generation/rate-limit.ts) -- dort geht es um echte OpenAI-Kosten,
  Nebenlaeufigkeit und ein globales Tagesbudget. Hier geht es um etwas
  Einfacheres: Endpunkte, die viel Datenbank-, Speicher- oder Fremdsystem-
  Last erzeugen und deshalb nicht beliebig oft angestossen werden sollten.

  Bewusst getrennt gehalten statt in die bestehende Datei gequetscht: Die
  beiden loesen verschiedene Probleme und haben verschiedene Grenzwerte.

  Zaehlung serverseitig ueber public.aktion_erlaubt() -- Pruefen und Zaehlen
  in einer Transaktion, damit zwei gleichzeitige Anfragen nicht beide
  durchrutschen (siehe Migration 20260810170000).
*/

/** Was begrenzt wird, mit Begruendung des jeweiligen Werts. */
export const LIMITS = {
  /* Der teuerste Endpunkt der App nach der Generierung: liest alle
     Generierungen, signiert jede Bild-URL, der Client laedt danach jede
     Datei. Drei pro Stunde decken jeden ehrlichen Anwendungsfall ab (auch
     "hat nicht geklappt, nochmal") und machen die Schleife wertlos.
     DSGVO Art. 15 verlangt Auskunft unverzueglich, nicht unbegrenzt oft. */
  export: { aktion: 'account_export', proStunde: 3 },
  /* Jeder Aufruf legt ein Objekt bei Stripe an. Zehn Anlaeufe pro Stunde
     sind grosszuegig -- wer zehnmal zur Kasse geht, hat ein anderes Problem
     als ein Limit. */
  checkout: { aktion: 'stripe_checkout', proStunde: 10 },
  /* Analog fuers Kundenportal. Etwas hoeher, weil man dort legitim mehrfach
     hin- und herwechselt (Tarif ansehen, kuendigen, doch nicht). */
  portal: { aktion: 'stripe_portal', proStunde: 15 },
  /* Der einzige Endpunkt ausser der Generierung, der ECHTE OpenAI-Kosten
     ausloest. Der Zwischenspeicher je Karte und Plattform begrenzt den
     Schaden bereits (jede Kombination kostet genau einmal), aber die
     Begrenzung war bisher ein Nebeneffekt des Zwischenspeichers, keine
     Absicht -- und damit genau die Art Schutz, die bei der naechsten
     Aenderung still wegfaellt. 40 pro Stunde decken selbst neun Stuecke mal
     drei Plattformen samt Wiederholungen ab. */
  plattformtext: { aktion: 'plattform_text', proStunde: 40 },
} as const;

type LimitKey = keyof typeof LIMITS;

/**
 * Prueft und zaehlt in einem Schritt.
 *
 * @returns `null` wenn erlaubt, sonst eine fertige Meldung fuer den Nutzer.
 *
 * Faellt die Pruefung selbst aus (Datenbank nicht erreichbar), wird
 * ABSICHTLICH durchgelassen: Ein kaputtes Limit darf nicht dazu fuehren,
 * dass niemand mehr seine Daten exportieren oder ein Abo abschliessen kann.
 * Der Schaden eines zu grosszuegigen Limits ist deutlich kleiner als der
 * eines gesperrten Bezahlvorgangs.
 */
export async function limitUeberschritten(userId: string, key: LimitKey): Promise<string | null> {
  const { aktion, proStunde } = LIMITS[key];

  const { data, error } = await createAdminClient().rpc('aktion_erlaubt', {
    p_user_id: userId,
    p_aktion: aktion,
    p_pro_stunde: proStunde,
  });

  if (error) {
    console.error('[rate-limit] Pruefung fehlgeschlagen, Aufruf wird durchgelassen', aktion, error);
    return null;
  }
  if (data === false) {
    console.warn(`[rate-limit] ${aktion}: Limit von ${proStunde}/Stunde erreicht`, userId);
    return 'Das hast du gerade sehr oft angefordert. Bitte versuch es in einer Stunde noch einmal.';
  }
  return null;
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CREDITS_PER_QUALITY, type Quality } from '@/lib/generation/constants';

/*
  Welche Anproben des angemeldeten Nutzers laufen gerade -- und welche sind
  eben fertig geworden?

  Grundlage fuer die Leiste, die auf JEDER Seite anzeigt, dass im Hintergrund
  etwas entsteht. Damit loesen wir das Versprechen "du kannst die Seite
  schliessen" endlich ein: Der Status haengt nicht mehr daran, dass der
  Erstellen-Tab offen bleibt, sondern kommt aus der Datenbank.

  Bewusst der normale Client, nicht der Admin-Client: Hier braucht niemand
  signierte Bild-URLs, also soll RLS ("Eigene Generierungen lesen") die
  Eigentuemerschaft durchsetzen, statt sie von Hand zu pruefen. Weniger Code,
  der falsch sein kann.

  Bewusst OHNE Bilder und ohne Verkaufstexte: Dieser Endpunkt wird im
  Sekundentakt gepollt. Er liefert nur Zahlen, damit die Antwort winzig
  bleibt und die Bezahlschranke (siehe lock.ts) hier gar nicht erst greifen
  muss -- es gibt schlicht nichts zu verdecken.
*/

export const runtime = 'nodejs';

/** Wie lange eine fertige Anprobe noch gemeldet wird. Kurz genug, dass beim
 *  Wiederkommen am naechsten Tag keine alte Meldung aufpoppt; lang genug,
 *  dass ein Neuladen kurz nach dem Fertigwerden sie noch zeigt. */
const FERTIG_FENSTER_MINUTEN = 15;

type CardRow = { imagePath: string | null };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const seit = new Date(Date.now() - FERTIG_FENSTER_MINUTEN * 60_000).toISOString();

  /*
    Zwei Gruppen in einer Abfrage: alles was laeuft (unabhaengig vom Alter --
    ein haengender Job soll nicht aus der Anzeige verschwinden) und alles was
    kuerzlich fertig wurde. `or` statt zweier Abfragen, damit der Poll genau
    einen Roundtrip kostet.
  */
  const { data, error } = await supabase
    .from('generations')
    .select('id, status, quality, credits_charged, cards, created_at, completed_at')
    .or(`status.in.(queued,processing),completed_at.gte.${seit}`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[generate/laufend] Abfrage fehlgeschlagen', error);
    return NextResponse.json({ error: 'Status nicht abrufbar.' }, { status: 500 });
  }

  const jobs = (data ?? []).map((g) => {
    const karten = (g.cards ?? []) as CardRow[];
    const fertig = karten.filter((c) => c.imagePath).length;

    /*
      Die Gesamtzahl der Bilder steht nirgends als eigene Spalte -- sie laesst
      sich aber exakt zurueckrechnen: Beim Start wurde `Kosten pro Bild ×
      Bildanzahl` abgebucht (siehe POST /api/generate). Erstattungen aendern
      credits_charged NICHT (die laufen ueber credit_ledger), der Wert bleibt
      also die urspruengliche Bestellmenge. Division durch 0 ist ausgeschlossen,
      weil beide Qualitaeten Kosten > 0 haben -- der Fallback ist reine
      Absicherung gegen einen spaeteren Gratis-Tarif.
    */
    const proBild = CREDITS_PER_QUALITY[g.quality as Quality] ?? 1;
    const gesamt = proBild > 0 ? Math.max(1, Math.round((g.credits_charged ?? 0) / proBild)) : 1;

    return {
      id: g.id as string,
      status: g.status as 'queued' | 'processing' | 'succeeded' | 'failed',
      fertig,
      gesamt,
    };
  });

  return NextResponse.json({ jobs });
}

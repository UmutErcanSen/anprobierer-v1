import 'server-only';

import { z } from 'zod';
import { OPENAI_BASE_URL } from '@/lib/openai/base-url';
import {
  bewerteAntwort,
  PruefungNichtMoeglich,
  type PruefErgebnis,
} from '@/lib/generation/moderation-policy';

/**
 * Inhaltspruefung fuer Texte UND Bilder, bevor irgendetwas generiert wird.
 *
 * Warum das sein muss: Das Notizfeld ist freier Text, und die Uploads sind
 * beliebige Bilder. Ohne Pruefung koennte damit strafbares Material in
 * unsere Verarbeitung und in unseren Speicher gelangen -- allen voran
 * sexualisierte Darstellungen Minderjaehriger. Dass OpenAI solche Anfragen
 * am Ende selbst ablehnt, reicht nicht: Bis dahin haetten wir das Material
 * bereits entgegengenommen, in Storage abgelegt und bezahlt.
 *
 * Die Moderations-API von OpenAI ist kostenlos und beherrscht seit
 * omni-moderation sowohl Text als auch Bilder. Der Aufruf laeuft mit
 * demselben Betreiber-Schluessel wie alles andere und niemals im Browser
 * ('server-only' oben bricht den Build ab, falls diese Datei je in eine
 * Client-Komponente gezogen wird).
 *
 * Hier steht ausschliesslich der AUFRUF. Die Auswertung -- also welche
 * Antwort als beanstandet gilt -- liegt in lib/generation/moderation-policy,
 * damit sie ohne Schluessel und ohne Netz pruefbar ist (siehe
 * unit/moderation.test.ts).
 */

const apiKey = z
  .string()
  .min(1, 'OPENAI_API_KEY fehlt in .env.local')
  .parse(process.env.OPENAI_API_KEY);

const MODELL = 'omni-moderation-latest';

export type PruefEingabe =
  | { art: 'text'; text: string }
  | { art: 'bild'; bytes: Buffer; mimeType: string };

export { PruefungNichtMoeglich, type PruefErgebnis };

export async function pruefeInhalte(eingaben: PruefEingabe[]): Promise<PruefErgebnis> {
  if (eingaben.length === 0) return { beanstandet: false, kategorien: [] };

  const input = eingaben.map((e) =>
    e.art === 'text'
      ? { type: 'text' as const, text: e.text }
      : {
          type: 'image_url' as const,
          image_url: { url: `data:${e.mimeType};base64,${e.bytes.toString('base64')}` },
        },
  );

  let res: Response;
  try {
    res = await fetch(`${OPENAI_BASE_URL}/moderations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELL, input }),
      // Kuerzer als bei der Generierung: Die Pruefung sitzt VOR dem
      // Fortschrittsbalken, der Nutzer wartet hier ohne jede Rueckmeldung.
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new PruefungNichtMoeglich((err as Error).message);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) detail = body.error.message;
    } catch {
      // Fehlerkoerper nicht lesbar -- Standardtext bleibt.
    }
    console.error('[moderation] Aufruf fehlgeschlagen:', res.status, detail);
    throw new PruefungNichtMoeglich(detail);
  }

  return bewerteAntwort(await res.json());
}

import 'server-only';

import { z } from 'zod';
import { TEXT_MODEL } from '@/lib/generation/constants';
import { OpenAIError } from '@/lib/openai/images';

/**
 * Schreibt einen bestehenden Verkaufstext fuer eine andere Plattform um --
 * rein textbasiert, ohne erneuten Bildzugriff. Der Vinted-Text selbst
 * braucht das nicht: buildSalePrompt (siehe prompts.ts) verfasst ihn von
 * Anfang an im Vinted-Ton, eine Umschreibung waere verschwendetes Geld.
 * Nur fuer Kleinanzeigen (nuechtern, ohne Hashtags) und eBay (strukturiert,
 * professionell) lohnt sich die Anpassung.
 *
 * Kostenaspekt: ein Text-only gpt-4o-mini-Aufruf ohne Bild ist deutlich
 * billiger als die urspruengliche Text-Generierung (die ein Foto mitschickt)
 * -- im Centbereich vernachlaessigbar. Trotzdem wird das Ergebnis von der
 * aufrufenden Route dauerhaft zwischengespeichert (generations.cards), damit
 * wiederholtes Ansehen desselben Tabs nicht erneut kostet.
 */

const OPENAI_API = 'https://api.openai.com/v1';

const apiKey = z
  .string()
  .min(1, 'OPENAI_API_KEY fehlt in .env.local')
  .parse(process.env.OPENAI_API_KEY);

export type RewritablePlatform = 'kleinanzeigen' | 'ebay';

const PLATFORM_STYLE: Record<RewritablePlatform, string> = {
  kleinanzeigen:
    'Schreibe ihn im nuechternen, sachlichen Kleinanzeigen-Stil um: knapp, direkt, ohne Hashtags, ohne Emojis und ohne uebertriebene Werbesprache. Zustand und Groesse klar benennen.',
  ebay:
    'Schreibe ihn im strukturierten, professionellen eBay-Stil um: sachlich, in kurzen Absaetzen oder Stichpunkten (Zustand, Material falls bekannt, Groesse), ohne Emojis und ohne Hashtags.',
};

export async function rewriteSaleTextForPlatform(baseText: string, platform: RewritablePlatform): Promise<string> {
  const prompt = `Hier ist ein bestehender deutscher Verkaufstext für ein Kleidungsstück (verfasst im lockeren Vinted-Stil mit Emojis):

"""
${baseText}
"""

${PLATFORM_STYLE[platform]}

Struktur: Überschrift in der ersten Zeile, danach eine Leerzeile, danach die Beschreibung. Antworte NUR mit dem neuen Text, ohne Erklärungen und ohne Anführungszeichen drumherum.`;

  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TEXT_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.error?.message) message = body.error.message;
    } catch {
      // Standardmeldung bleibt.
    }
    console.error('[openai] Plattform-Umschreibung fehlgeschlagen:', res.status, message);
    throw new OpenAIError(res.status, message, 'text');
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.trim() ? text.trim() : baseText;
}

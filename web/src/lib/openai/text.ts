import 'server-only';

import { OPENAI_BASE_URL } from '@/lib/openai/base-url';

import { z } from 'zod';
import { TEXT_MODEL } from '@/lib/generation/constants';
import { OpenAIError } from '@/lib/openai/images';

/**
 * Verkaufstext-Generierung mit dem Betreiber-Key (server-only).
 *
 * gpt-4o-mini bekommt das Kleidungsfoto und den Prompt und schreibt daraus
 * die Vinted-Anzeige. Die Farbe kommt aus dem Prompt (buildSalePrompt), nicht
 * aus dem Foto — so wie in der Altanwendung, wo Farb-Raten zu viele Fehler
 * verursachte.
 */

const OPENAI_API = OPENAI_BASE_URL;

const apiKey = z
  .string()
  .min(1, 'OPENAI_API_KEY fehlt in .env.local')
  .parse(process.env.OPENAI_API_KEY);

/**
 * gpt-4o-mini wird nach Tokens abgerechnet. Diese Preise sind aus der
 * oeffentlichen OpenAI-Preisliste uebernommen, aber -- anders als die
 * Bildkosten in images.ts, die bereits per echtem Testlauf bestaetigt sind --
 * NOCH NICHT gegen eine echte Rechnung dieses Projekts geprueft. Dient
 * vorerst der Groessenordnung, nicht der finalen Preiskalkulation.
 */
const TEXT_PRICE_PER_TOKEN = {
  input: 0.15 / 1_000_000,
  output: 0.6 / 1_000_000,
};

type ChatUsage = { prompt_tokens?: number; completion_tokens?: number };

export function costForTextUsage(usage: ChatUsage | undefined): number | null {
  if (!usage) return null;
  const inTok = usage.prompt_tokens ?? 0;
  const outTok = usage.completion_tokens ?? 0;
  return inTok * TEXT_PRICE_PER_TOKEN.input + outTok * TEXT_PRICE_PER_TOKEN.output;
}

export type SaleTextResult = { text: string; costUsd: number | null };

export async function generateSaleText(params: {
  prompt: string;
  imageBytes: Buffer;
  mimeType: string;
  signal?: AbortSignal;
}): Promise<SaleTextResult> {
  const dataUrl = `data:${params.mimeType};base64,${params.imageBytes.toString('base64')}`;
  const timeout = AbortSignal.timeout(60_000);
  const signal = params.signal ? AbortSignal.any([params.signal, timeout]) : timeout;

  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TEXT_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: params.prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.error?.message) message = body.error.message;
    } catch {
      // Standardmeldung bleibt.
    }
    console.error('[openai] chat/completions fehlgeschlagen:', res.status, message);
    throw new OpenAIError(res.status, message, 'text');
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return {
    text: typeof text === 'string' ? text.trim() : '',
    costUsd: costForTextUsage(data?.usage),
  };
}

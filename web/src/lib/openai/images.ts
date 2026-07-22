import 'server-only';

import { z } from 'zod';
import { IMAGE_MODEL, IMAGE_SIZE, OPENAI_QUALITY, type Quality } from '@/lib/generation/constants';

/**
 * Serverseitiger Aufruf der OpenAI-Bildbearbeitung mit dem BETREIBER-Key.
 *
 * Das ist der ganze Grund für den Umbau: In der Altanwendung rief der Browser
 * OpenAI direkt mit dem Schlüssel des Nutzers auf. Hier verlässt der Schlüssel
 * niemals den Server. Der 'server-only'-Import oben lässt den Build abbrechen,
 * falls diese Datei je in eine Client-Komponente gezogen wird.
 */

const OPENAI_API = 'https://api.openai.com/v1';

const apiKey = z
  .string()
  .min(1, 'OPENAI_API_KEY fehlt in .env.local')
  .parse(process.env.OPENAI_API_KEY);

/** Unterscheidbarer Fehlertyp, damit die Route gezielt reagieren kann. */
export class OpenAIError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly type: string = 'unknown',
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export type TryOnResult = {
  /** Das erzeugte Bild als Rohdaten, bereit zum Speichern in Storage. */
  image: Buffer;
  mimeType: string;
  /** Tatsächliche Kosten laut OpenAI, sofern die Antwort sie liefert. */
  costUsd: number | null;
  model: string;
};

type ImageInput = { bytes: Buffer; filename: string; mimeType: string };

/**
 * Führt eine Anprobe aus: Personenbild + ein oder mehrere Kleidungsbilder ->
 * ein generiertes Bild. Reihenfolge der Bilder ist bedeutsam (image[0] =
 * Person), deshalb ein Array statt einzelner Felder.
 */
export async function generateTryOn(params: {
  person: ImageInput;
  clothing: ImageInput[];
  prompt: string;
  quality: Quality;
  signal?: AbortSignal;
}): Promise<TryOnResult> {
  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('prompt', params.prompt);
  form.append('size', IMAGE_SIZE);
  form.append('quality', OPENAI_QUALITY[params.quality]);
  form.append('n', '1');

  const toBlob = (img: ImageInput) =>
    new File([new Uint8Array(img.bytes)], img.filename, { type: img.mimeType });

  form.append('image[]', toBlob(params.person));
  for (const item of params.clothing) {
    form.append('image[]', toBlob(item));
  }

  // Großzügiges eigenes Timeout: gpt-image-2 braucht real 45–90 s. Ohne
  // explizites Limit läuft die Anfrage in undurchsichtige Plattformgrenzen
  // (der ursprüngliche 60-s-Abbruch). 150 s gibt genug Luft und liefert bei
  // echtem Hänger eine klare Meldung statt eines stummen Abbruchs.
  const timeout = AbortSignal.timeout(150_000);
  const signal = params.signal
    ? AbortSignal.any([params.signal, timeout])
    : timeout;

  let res: Response;
  try {
    res = await fetch(`${OPENAI_API}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new OpenAIError(504, 'Zeitüberschreitung beim Bilddienst.', 'timeout');
    }
    throw new OpenAIError(502, `Netzwerkfehler zum Bilddienst: ${(err as Error).message}`, 'network');
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let type = 'unknown';
    try {
      const body = await res.json();
      if (body.error?.message) message = body.error.message;
      if (body.error?.type) type = body.error.type;
      if (body.error?.code === 'insufficient_quota') type = 'insufficient_quota';
    } catch {
      // Fehlerkörper nicht lesbar — Standardmeldung bleibt.
    }
    // Serverseitig protokollieren: Die Nutzerantwort bleibt bewusst vage,
    // aber wir müssen die echte Ursache sehen können.
    console.error('[openai] images/edits fehlgeschlagen:', res.status, type, message);
    throw new OpenAIError(res.status, message, type);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') {
    throw new OpenAIError(502, 'OpenAI lieferte kein Bild zurück.', 'no_image');
  }

  return {
    image: Buffer.from(b64, 'base64'),
    mimeType: 'image/png',
    costUsd: extractCostUsd(data),
    model: data?.model ?? IMAGE_MODEL,
  };
}

/**
 * gpt-image-2 wird nach Tokens abgerechnet, nicht als fertiger Dollarbetrag.
 * Preise pro 1 Mio. Tokens, Stand Juli 2026 (per Websuche bestätigt).
 *
 * ACHTUNG: Diese Preise sind die einzige Stelle, die manuell aktuell gehalten
 * werden muss. Ändert OpenAI die Preise, stimmt die berechnete cost_usd nicht
 * mehr — der Wert dient der internen Margenkontrolle, nicht der Abrechnung
 * gegenüber dem Nutzer (die läuft über Credits). Zur Gegenprobe immer die
 * echte OpenAI-Rechnung heranziehen.
 */
const PRICE_PER_TOKEN = {
  textInput: 5.0 / 1_000_000,
  imageInput: 8.0 / 1_000_000,
  imageOutput: 30.0 / 1_000_000,
};

type Usage = {
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  output_tokens_details?: { image_tokens?: number };
};

/**
 * Berechnet die realen Kosten aus den Token-Zahlen der Antwort. Grundlage für
 * generations.cost_usd — die Zahl, an der sich zeigt, ob das Preismodell trägt.
 */
function extractCostUsd(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null;
  const usage = (data as { usage?: Usage }).usage;
  if (!usage) return null;

  const textIn = usage.input_tokens_details?.text_tokens ?? 0;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const imageOut = usage.output_tokens_details?.image_tokens ?? 0;

  return (
    textIn * PRICE_PER_TOKEN.textInput +
    imageIn * PRICE_PER_TOKEN.imageInput +
    imageOut * PRICE_PER_TOKEN.imageOutput
  );
}

const OPENAI_API = 'https://api.openai.com/v1';
const IMAGE_MODEL = 'gpt-image-2';
const TEXT_MODEL = 'gpt-4o-mini';

class OpenAIError extends Error {
  constructor(status, message, type) {
    super(message);
    this.status = status;
    this.type = type || 'unknown';
  }
}

const QUALITY_PRICES = {
  low: { perImage: 0.006, label: 'Niedrig (~$0.006/Bild)', desc: 'Schnell, günstig' },
  medium: { perImage: 0.041, label: 'Mittel (~$0.041/Bild)', desc: 'Gute Qualität' },
  high: { perImage: 0.165, label: 'Hoch (~$0.165/Bild)', desc: 'Beste Qualität' },
};

const IMAGE_SIZES = {
  '1024x1536': 'Hochformat (1024×1536)',
  '1024x1024': 'Quadrat (1024×1024)',
  '1536x1024': 'Querformat (1536×1024)',
};

function buildTryOnPrompt(clothingType, size) {
  const t = TYPE_EN[clothingType] || 'clothing item';
  const sizeHint = size ? ` It should correspond to size ${size}.` : '';
  return `Virtually try on this ${t} (shown in image 2) onto the person in image 1. The ${t} should fit naturally and realistically, matching the person's pose and body shape.${sizeHint} Keep the person's original background, face, hairstyle, and all other clothing items unchanged. The result must look like a realistic photograph.`;
}

const COMBINED_PROMPT = `Virtually dress this person (image 1) with all the provided clothing items (images 2+). Put each item on the correct body part (top on upper body, bottoms on lower body, shoes on feet, etc.). Make everything fit naturally and realistically. Keep the person's original background, face, and hairstyle. The result must look like a realistic full-body outfit photograph.`;

function buildSalePrompt(clothingType, size) {
  const typeInfo = clothingType ? ` (a ${clothingType})` : '';
  const sizeInfo = size ? `Size: ${size}. ` : '';
  return `Write a German Vinted sales listing for the clothing item shown in this photo${typeInfo}. The photo shows a person wearing the item, but you MUST pretend the garment is photographed alone (flat lay on a table).

STRICT RULES:
- Describe ONLY the garment itself: cut, color, pattern, neckline, sleeves, pockets, zippers, hemline, etc.
- NEVER mention how it looks "on the person" or "on the model"
- NEVER use phrases like "looks great", "sits perfectly", "flattering", "schmeichelt der Figur", "betont die Taille", "sitzt perfekt", "auf dem Model"
- NEVER describe the person's body, pose, or appearance
- Do NOT guess the material, do NOT suggest a price
- Do NOT include condition, fit-on-body, or style tips
${sizeInfo}
Structure: Überschrift (SEO, max 80 Zeichen, Emojis) | Beschreibung (nur das Kleidungsstück) | Größe. Use an engaging tone with emojis. Max 130 words.`;
}

async function callImageEdit({ personPhoto, clothingItems, prompt, apiKey, signal, size, quality }) {
  const formData = new FormData();

  formData.append('model', IMAGE_MODEL);
  formData.append('prompt', prompt);
  formData.append('size', size || '1024x1536');
  formData.append('quality', quality || 'medium');
  formData.append('n', '1');

  const personBlob = base64ToBlob(personPhoto.base64, personPhoto.mimeType);
  const personFile = new File([personBlob], personPhoto.name || 'person.jpg', { type: personPhoto.mimeType });
  formData.append('image[]', personFile);

  for (const item of clothingItems) {
    const blob = base64ToBlob(item.base64, item.mimeType);
    const file = new File([blob], item.name || 'clothing.jpg', { type: item.mimeType });
    formData.append('image[]', file);
  }

  const res = await fetch(`${OPENAI_API}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    let type = 'unknown';
    try {
      const errBody = await res.json();
      if (errBody.error?.message) msg = errBody.error.message;
      if (errBody.error?.type) type = errBody.error.type;
      if (errBody.error?.code === 'insufficient_quota') type = 'insufficient_quota';
    } catch (_) {}
    throw new OpenAIError(res.status, msg, type);
  }

  return res.json();
}

async function callChatCompletion({ messages, apiKey, signal }) {
  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages,
      max_tokens: 1000,
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    let type = 'unknown';
    try {
      const errBody = await res.json();
      if (errBody.error?.message) msg = errBody.error.message;
      if (errBody.error?.type) type = errBody.error.type;
    } catch (_) {}
    throw new OpenAIError(res.status, msg, type);
  }

  return res.json();
}

async function testApiKey(key) {
  const res = await fetch(`${OPENAI_API}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (res.ok) return true;
  const errBody = await res.json().catch(() => ({}));
  const msg = errBody.error?.message || '';
  throw new OpenAIError(res.status, msg, errBody.error?.type);
}

function estimateCost(itemCount, mode, quality) {
  const price = QUALITY_PRICES[quality]?.perImage || 0.041;
  const calls = mode === 'single' ? itemCount : 1;
  const total = calls * price;
  return { calls, perImage: price, total };
}

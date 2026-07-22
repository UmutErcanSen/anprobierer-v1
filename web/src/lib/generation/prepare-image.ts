import 'server-only';

import sharp from 'sharp';

/**
 * Verkleinert ein hochgeladenes Foto auf eine für die Generierung sinnvolle
 * Größe, bevor es an OpenAI geht.
 *
 * Warum: Handyfotos sind oft mehrere Megapixel groß. Je größer das Eingabe-
 * bild, desto länger dauert die Generierung — und ab ~60 s bricht die Anfrage
 * ab (genau der Fehler, der hier aufgetreten ist). Kleinere Eingaben sind
 * schneller, günstiger und umgehen OpenAIs Größenlimits, ohne dass die
 * sichtbare Qualität des Ergebnisses leidet: Das Zielbild ist ohnehin
 * höchstens 1024×1536.
 *
 * Zusätzlicher Nebeneffekt: EXIF-Metadaten (u.a. GPS-Standort des Fotos)
 * werden dabei entfernt — Datensparsamkeit ohne Zusatzaufwand.
 */
export async function prepareImage(input: Buffer): Promise<{ bytes: Buffer; mimeType: string }> {
  const bytes = await sharp(input)
    // Auf Kantenlänge 1536 begrenzen, aber nie hochskalieren.
    .rotate() // richtet nach EXIF-Orientierung aus, bevor die Metadaten fallen
    .resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  return { bytes, mimeType: 'image/png' };
}

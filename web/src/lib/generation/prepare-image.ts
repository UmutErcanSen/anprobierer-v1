import 'server-only';

import sharp from 'sharp';
// @ts-expect-error -- heic-convert liefert keine eigenen Typdefinitionen.
import convertHeic from 'heic-convert';

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
 *
 * HEIC/HEIF (iPhone-Standardformat "Hohe Effizienz"): `sharp`/`libvips` kann
 * das nicht direkt decodieren -- der HEVC-Codec fehlt in den vorkompilierten
 * Builds aus Lizenzgruenden (nur AVIF/AV1 ist enthalten). `heic-convert`
 * nutzt stattdessen eine eigene, lizenzrechtlich unbedenkliche libheif-JS-
 * Bibliothek, um HEIC zuerst nach JPEG umzuwandeln -- danach laeuft das
 * Ergebnis durch dieselbe sharp-Pipeline wie jedes andere Format.
 */
export async function prepareImage(
  input: Buffer,
  mimeType?: string,
  filename?: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif' || /\.hei[cf]$/i.test(filename ?? '');

  const source = isHeic
    ? Buffer.from(await convertHeic({ buffer: input, format: 'JPEG', quality: 0.92 }))
    : input;

  const bytes = await sharp(source)
    // Auf Kantenlänge 1536 begrenzen, aber nie hochskalieren.
    .rotate() // richtet nach EXIF-Orientierung aus, bevor die Metadaten fallen
    .resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  return { bytes, mimeType: 'image/png' };
}

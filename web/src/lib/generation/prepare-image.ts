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

/**
 * Stark verkleinerte, verwaschene Variante eines Ergebnisbilds -- fuer die
 * Vorschau, die Free-Tarif-Nutzer ab ihrem zweiten Ergebnis statt des echten
 * Bilds sehen (siehe lock.ts). Wird IMMER erzeugt, auch fuer zahlende Nutzer
 * (einfacher als bedingte Erzeugung, minimale Zusatzkosten, schuetzt auch bei
 * einem spaeteren Downgrade). Bewusst als JPEG mit niedriger Qualitaet: klein
 * genug, um Details/Wasserzeichen der Kleidung nicht erkennbar zu machen,
 * aber genug Farbe/Form, um Neugier zu wecken.
 */
export async function createLockedPreview(resultBytes: Buffer): Promise<Buffer> {
  return sharp(resultBytes)
    .resize({ width: 240, withoutEnlargement: true })
    .blur(18)
    .jpeg({ quality: 55 })
    .toBuffer();
}

/**
 * Scharfe, kleine Variante fuer das Karten-Raster in Verlauf und Konto.
 *
 * Vorher zeigte das Raster die ECHTEN Ergebnisbilder: rund 3,2 MB je PNG, bei
 * zwoelf Karten also ~38 MB pro Seitenaufruf -- fuer Kacheln, die auf dem
 * Handy keine 200 Pixel breit sind. Kurios dabei: Free-Nutzer bekamen dank der
 * unscharfen Vorschau (2 KB) die schnelle Seite, waehrend ausgerechnet
 * zahlende Nutzer die volle Datenmenge luden.
 *
 * 480 px Breite deckt auch zweispaltige Handy-Raster auf Bildschirmen mit
 * hoher Pixeldichte ab. WebP statt JPEG, weil diese Datei den Browser nie
 * verlaesst -- fuer das herunterladbare Ergebnis waere die Formatfrage eine
 * andere (Vinted/Kleinanzeigen muessen es annehmen), hier gibt es dieses
 * Risiko schlicht nicht.
 */
export async function createThumbnail(resultBytes: Buffer): Promise<Buffer> {
  return sharp(resultBytes)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Speicherpfad der Rasterr-Variante, aus dem Pfad des Ergebnisbilds
 * abgeleitet -- gleiches Prinzip wie lockedImagePath() in lock.ts, damit
 * keine zusaetzliche Spalte noetig ist.
 *
 * ACHTUNG bei Generierungen von VOR dieser Aenderung: Zu ihnen existiert
 * keine solche Datei. Die Aufrufer muessen das beruecksichtigen (siehe
 * `hatThumbnail` in konto/page.tsx und konto/verlauf/page.tsx) -- eine
 * signierte URL entsteht auch fuer nicht vorhandene Objekte, das Bild liefe
 * sonst still in einen 404.
 */
export function thumbnailPath(path: string): string {
  return path.replace(/\.png$/i, '-thumb.webp');
}

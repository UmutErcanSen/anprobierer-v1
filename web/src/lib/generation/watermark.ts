import 'server-only';

import sharp from 'sharp';

/**
 * Kennzeichnung KI-generierter Bilder nach Art. 50 Abs. 4 EU AI Act (ab
 * 2. August 2026 anwendbar): Wer ein KI-generiertes/-manipuliertes Bild, das
 * eine reale Person zeigt ("Deepfake" im Sinne der Verordnung), im Rahmen
 * einer beruflichen Taetigkeit bereitstellt, muss offenlegen, dass es
 * kuenstlich erzeugt wurde. Unsere Anprobebilder zeigen genau das: eine
 * reale, identifizierbare Person in KI-generierter Kleidung. Betroffen sind
 * sowohl wir (als Anbieter, der das Bild erzeugt) als auch unsere Nutzer
 * (die es anschliessend auf Vinted/Kleinanzeigen/eBay veroeffentlichen).
 *
 * Zwei Kennzeichnungsebenen, beide bewusst UNBEZAHLBAR und fuer JEDEN Tarif
 * gleich (Free/Basic/Pro) -- eine Rechtspflicht darf keine Bezahlfunktion
 * sein, das waere sowohl rechtlich als auch als Vertrauenssignal fatal:
 *
 * 1. Sichtbares Badge (erfuellt "klar und erkennbar" aus Art. 50 Abs. 4):
 *    reist mit dem Bild mit, egal wohin es kopiert/veroeffentlicht wird --
 *    anders als ein Hinweistext nur in unserer eigenen App, der bei einer
 *    Veroeffentlichung ausserhalb verloren ginge.
 * 2. EXIF-Metadaten (maschinenlesbar, Ansatz zu Art. 50 Abs. 2): kein
 *    Ersatz fuer eine vollwertige C2PA-Signatur (kryptografisch gesichert,
 *    von Plattformen wie Vinted zunehmend erkannt), aber ein Standard-Feld,
 *    das ohne zusaetzliche Infrastruktur schon heute funktioniert. C2PA
 *    waere der naechste Ausbauschritt, kein Ersatz fuer das hier.
 *
 * WICHTIG, kein Ersatz fuer Rechtsberatung: Diese Umsetzung ist eine
 * technische Einschaetzung, keine rechtliche Freigabe. Vor dem Livegang mit
 * echten Nutzern sollte ein Anwalt Wortlaut und Platzierung des Badges
 * gegenpruefen -- genau wie bei Datenschutzerklaerung/Impressum.
 */

const BADGE_LABEL = 'KI-generiert';
const EXIF_DISCLOSURE =
  'Dieses Bild wurde mit Kuenstlicher Intelligenz erzeugt (Art. 50 EU AI Act). This image was generated using artificial intelligence.';

/**
 * Seitenverhaeltnis der Verlauf-Karten (history-card.tsx: `aspect-[3/4]`,
 * `object-cover`). Ergebnisbilder kommen immer als 1024x1536 (2:3, siehe
 * IMAGE_SIZE) aus der Generierung -- schlanker als die 3:4-Karte, dadurch
 * schneidet object-cover oben UND unten symmetrisch etwas vom Bild ab, um
 * die Kartenflaeche zu fuellen. Das Badge muss ausserhalb dieser
 * abgeschnittenen Zone liegen, sonst ist es im Verlauf unsichtbar und erst
 * in der Grossansicht zu sehen -- genau das war das gemeldete Problem.
 */
const HISTORY_CARD_ASPECT = 3 / 4;

/**
 * Baut das Badge als SVG proportional zur Bildbreite -- feste Pixelwerte
 * saehen bei einem 512px-Vorschaubild riesig und bei einem 1536px-Ergebnis
 * winzig aus. clamp() haelt Schriftgroesse innerhalb sinnvoller Grenzen,
 * auch bei ungewoehnlichen Seitenverhaeltnissen.
 *
 * Die Mindestgroesse ist bewusst grosszuegig: das Badge wird nie in
 * Originalgroesse betrachtet, sondern immer stark verkleinert -- als
 * Verlauf-Thumbnail (2-6 Spalten Raster) oder auf einem Handybildschirm in
 * der Grossansicht. Bei zu knapper Mindestgroesse wirkt der Text dort
 * winzig, obwohl er im Bild selbst korrekt skaliert.
 */
function buildBadgeSvg(imageWidth: number): { svg: Buffer; width: number; height: number } {
  const fontSize = Math.min(42, Math.max(26, Math.round(imageWidth * 0.032)));
  const paddingX = Math.round(fontSize * 0.9);
  const paddingY = Math.round(fontSize * 0.55);
  // Grobe Breitenschaetzung statt echter Textmessung (die bräuchte eine
  // Font-Metrik-Bibliothek serverseitig) -- muss nicht pixelgenau sein, weil
  // der Text unten per text-anchor="middle" IM Badge zentriert wird. Eine zu
  // knapp/grosszuegig geschaetzte Breite verschiebt so höchstens die Pille
  // als Ganzes ein paar Pixel, statt den Text darin sichtbar aus der Mitte
  // zu ruecken (das war der Grund fuer die "ungleichmaessige" Pille).
  const textWidth = Math.round((BADGE_LABEL.length + 2) * fontSize * 0.6);
  const width = textWidth + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const radius = height / 2;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}"
            fill="#ffffff" fill-opacity="0.94" stroke="#00000022" stroke-width="1" />
      <text x="${width / 2}" y="${height / 2 + 1}" text-anchor="middle" dominant-baseline="central"
            font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
            font-size="${fontSize}" font-weight="600" fill="#0a0a0a">
        ✦ ${BADGE_LABEL}
      </text>
    </svg>`;

  return { svg: Buffer.from(svg), width, height };
}

/**
 * Traegt das Kennzeichnungs-Badge auf ein fertiges Ergebnisbild auf und
 * schreibt zusaetzlich einen EXIF-Hinweis. Wird auf JEDES Ergebnisbild
 * angewendet, bevor es hochgeladen wird -- unabhaengig von Tarif oder
 * Qualitaetsstufe.
 */
export async function watermarkResultImage(image: Buffer): Promise<Buffer> {
  const base = sharp(image);
  const meta = await base.metadata();
  const imageWidth = meta.width ?? 1024;
  const imageHeight = meta.height ?? 1024;

  const { svg, width: badgeWidth, height: badgeHeight } = buildBadgeSvg(imageWidth);

  // Rechter Rand: normal proportional, wird von object-cover in der
  // Verlauf-Karte nicht beschnitten (nur oben/unten, siehe unten).
  const marginRight = Math.round(imageWidth * 0.025);
  const left = Math.max(0, imageWidth - badgeWidth - marginRight);

  // Unterer Rand: MUSS ausserhalb der Zone liegen, die object-cover in der
  // 3:4-Verlauf-Karte oben/unten abschneidet -- sonst ist das Badge nur in
  // der Grossansicht sichtbar, nicht im Raster (das war der gemeldete Bug).
  // Schneidet die Karte enger zu (imageAspect < HISTORY_CARD_ASPECT), wird
  // symmetrisch oben und unten beschnitten; croppedFraction ist der Anteil
  // der Bildhoehe, der auf JEDER Seite wegfaellt.
  const imageAspect = imageWidth / imageHeight;
  const croppedFraction = imageAspect < HISTORY_CARD_ASPECT ? (1 - imageAspect / HISTORY_CARD_ASPECT) / 2 : 0;
  // +4 Prozentpunkte Sicherheitsabstand oberhalb der berechneten Kante --
  // ohne Puffer laege das Badge exakt auf der Schnittkante, und schon eine
  // leicht abweichende Kartenbreite (Rundungen, andere Bildschirmgroessen)
  // wuerde es wieder anschneiden.
  const safeMargin = Math.round(imageHeight * (croppedFraction + 0.04));
  const margin = Math.max(marginRight, safeMargin);
  const top = Math.max(0, imageHeight - badgeHeight - margin);

  return base
    .composite([{ input: svg, left, top }])
    // withExifMerge statt withExif: erhaelt evtl. vorhandene EXIF-Daten
    // (z.B. vom Modell gesetzte), ergaenzt nur unser Feld, statt alles zu
    // ueberschreiben.
    .withExifMerge({
      IFD0: {
        ImageDescription: EXIF_DISCLOSURE,
        Software: 'Anprobierer -- KI-Bildgenerierung',
      },
    })
    .png()
    .toBuffer();
}

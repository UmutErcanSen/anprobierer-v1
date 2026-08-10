import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

/*
 * Content-Security-Policy.
 *
 * Einzige fremde Herkunft, die die Anwendung zur Laufzeit braucht: Supabase
 * (signierte Bild-URLs aus dem Storage, Auth- und REST-Aufrufe). Die
 * Schriften kommen trotz `next/font/google` NICHT von Google — Next.js laedt
 * sie zur Bauzeit herunter und liefert sie selbst aus, `font-src 'self'`
 * genuegt also. OpenAI und Stripe stehen bewusst NICHT in der Liste: OpenAI
 * wird ausschliesslich serverseitig aufgerufen (CLAUDE.md §9), und der Weg zu
 * Stripe ist eine Weiterleitung des ganzen Fensters, kein Aufruf aus der
 * Seite heraus.
 *
 * OFFEN, bewusst und dokumentiert: `script-src` enthaelt weiterhin
 * 'unsafe-inline'. Next.js schreibt pro Seite eigene Inline-Skripte
 * (Hydration-Daten), die sich weder vorab hashen noch weglassen lassen. Sauber
 * schliessen laesst sich das nur mit einem Nonce pro Antwort — der zwingt
 * aber JEDE Seite in dynamisches Rendering (kein statisches Ausliefern, kein
 * CDN-Caching, hoehere Hosting-Kosten). Diese Abwaegung haengt an der noch
 * offenen Hosting-Entscheidung und wird dort getroffen.
 *
 * Alles andere ist trotzdem scharf gestellt und wirkt sofort: `default-src`
 * verhindert Nachladen von fremden Servern, `object-src 'none'` schliesst
 * Flash/Java-Altlasten aus, `base-uri` verhindert das Umbiegen aller
 * relativen URLs per eingeschleustem <base>, `form-action` verhindert, dass
 * ein Formular seine Daten an einen fremden Server schickt.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
})();

const csp = [
  `default-src 'self'`,
  // 'unsafe-eval' nur in der Entwicklung: React nutzt dort eval, um
  // Server-Fehlerstapel im Browser zu rekonstruieren. In Produktion nicht noetig.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Tailwind setzt Stile teils als style-Attribut (z.B. Balkenhoehen in der
  // Verbrauchsuebersicht) -- ohne 'unsafe-inline' bliebe das Layout kaputt.
  `style-src 'self' 'unsafe-inline'`,
  // blob:/data: fuer clientseitig erzeugte Vorschauen (Upload-Vorschau,
  // ZIP-Download), Supabase fuer die signierten Ergebnisbilder.
  `img-src 'self' blob: data: ${supabaseOrigin}`.trim(),
  `font-src 'self'`,
  // ws:/wss: nur in der Entwicklung -- Next.js' Hot Reload haelt eine
  // WebSocket-Verbindung offen.
  `connect-src 'self' ${supabaseOrigin}${isDev ? ' ws: wss:' : ''}`.trim(),
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  // Clickjacking-Schutz: niemand darf die Seite in einen Rahmen einbetten und
  // Klicks auf „Generieren" oder „Löschen" abfangen. Moderner Ersatz fuer
  // X-Frame-Options, das unten fuer aeltere Browser zusaetzlich gesetzt bleibt.
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const nextConfig: NextConfig = {
  // sharp ist ein natives Modul und darf nicht mitgebündelt werden — sonst
  // bricht es zur Laufzeit. Explizit als externes Server-Paket markiert.
  serverExternalPackages: ['sharp'],

  /*
   * Sicherheits-Header für ALLE Antworten.
   *
   * Die Anwendung verarbeitet Personenfotos und Zahlungsdaten — die folgenden
   * Header sind für so eine Seite Standard und kosten nichts. Die
   * Content-Security-Policy selbst ist oben zusammengesetzt und dort
   * begründet.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Erzwingt HTTPS für zwei Jahre. Ohne `preload`: die Aufnahme in die
          // Browser-Preload-Liste ist praktisch nicht mehr rückgängig zu
          // machen und sollte erst fallen, wenn die endgültige Domain steht.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Verhindert, dass der Browser den Inhaltstyp „errät" — sonst kann
          // eine hochgeladene Datei als Skript ausgeführt werden.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Beim Wechsel auf fremde Seiten nur die Herkunft mitgeben, nie den
          // vollen Pfad (der z. B. eine Generierungs-ID enthalten kann).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
          // Für ältere Browser, die frame-ancestors noch nicht kennen.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Die App braucht keinen dieser Sensoren — Zugriff pauschal absagen,
          // damit ein eingeschleustes Skript ihn auch nicht erfragen kann.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

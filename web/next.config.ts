import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ist ein natives Modul und darf nicht mitgebündelt werden — sonst
  // bricht es zur Laufzeit. Explizit als externes Server-Paket markiert.
  serverExternalPackages: ['sharp'],

  /*
   * Sicherheits-Header für ALLE Antworten.
   *
   * Die Anwendung verarbeitet Personenfotos und Zahlungsdaten (sobald Stripe
   * angebunden ist) — die folgenden Header sind für so eine Seite Standard und
   * kosten nichts. Bewusst NICHT dabei: eine vollständige Content-Security-
   * Policy mit `script-src`. Next.js braucht dafür pro Antwort einen Nonce
   * (die Hydration-Skripte sind inline, ebenso das Theme-Skript in
   * layout.tsx); das erfordert einen Umbau im Proxy und gründliches
   * Durchtesten aller Seiten. Eine halb richtige CSP bricht im Zweifel die
   * App, ohne echten Schutz zu bringen — deshalb hier nur der Teil, der ohne
   * Nonce zuverlässig funktioniert (`frame-ancestors`), der Rest ist als
   * eigener Schritt in TODO.md vermerkt.
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
          // Clickjacking-Schutz: niemand darf die Seite in einen Rahmen
          // einbetten und Klicks auf „Generieren" oder „Löschen" abfangen.
          // frame-ancestors ist der moderne Ersatz für X-Frame-Options;
          // letzteres bleibt für ältere Browser zusätzlich gesetzt.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
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

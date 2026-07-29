'use client';

import { useEffect } from 'react';

/*
  Letzte Rueckfallebene: greift nur, wenn der Fehler im ROOT-LAYOUT selbst
  auftritt. Dann existiert kein Layout mehr, das die Seite umschliessen
  koennte -- deshalb muss diese Datei <html> und <body> selbst mitbringen.

  Bewusst mit Inline-Styles statt der Design-Tokens aus globals.css: Wenn das
  Root-Layout scheitert, ist nicht garantiert, dass Schriften und Stylesheet
  ueberhaupt geladen wurden. Diese Seite muss auch dann lesbar sein.
  `color-scheme` ueberlaesst Hell/Dunkel dem System, damit der Text in beiden
  Faellen Kontrast hat.
*/
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] Schwerer Fehler im Root-Layout', error);
  }, [error]);

  return (
    <html lang="de" style={{ colorScheme: 'light dark' }}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
            Die Seite konnte nicht geladen werden
          </h1>
          <p style={{ marginTop: '0.75rem', lineHeight: 1.6, opacity: 0.8 }}>
            Bei uns ist etwas grundlegend schiefgelaufen. Lade die Seite neu —
            wenn das nicht hilft, versuch es bitte später noch einmal.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.75rem',
              borderRadius: '999px',
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            Neu laden
          </button>

          {error.digest && (
            <p style={{ marginTop: '2rem', fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
              Fehlerkennung: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

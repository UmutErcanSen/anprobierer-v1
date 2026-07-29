'use client';

import { useEffect } from 'react';
import { Button, LinkButton } from '@/components/ui/button';

/*
  Auffangnetz fuer unerwartete Fehler innerhalb einer Seite. Ohne diese Datei
  zeigt Next.js in Produktion nur "Application error: a server-side exception
  has occurred" -- ohne jeden Weg zurueck, ausgerechnet in dem Moment, in dem
  Vertrauen am wichtigsten ist.

  Muss eine Client-Komponente sein (Vorgabe von Next.js): der reset()-Aufruf
  laeuft im Browser.
*/
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Solange es kein Monitoring gibt (siehe TODO.md, "Architektur & Betrieb"),
    // ist die Browser-Konsole die einzige Spur. Sobald Sentry o.ae. steht,
    // gehoert der Aufruf hierhin.
    console.error('[app] Unerwarteter Fehler', error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md text-center">
        <p className="kicker">Etwas ist schiefgelaufen</p>
        <h1 className="display mt-5 text-4xl md:text-5xl">
          Da hat etwas <em>gehakt</em>.
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
          Der Fehler liegt bei uns, nicht bei dir. Versuch es noch einmal — wenn
          es weiterhin nicht klappt, schau später wieder vorbei.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} size="lg">Erneut versuchen</Button>
          <LinkButton href="/konto" variant="outline" size="lg">Zu meinem Konto</LinkButton>
        </div>

        {/* Die digest-Kennung ist die einzige Bruecke zwischen dem, was der
            Nutzer sieht, und dem Server-Log -- ohne sie ist eine Supportanfrage
            praktisch nicht nachvollziehbar. Der eigentliche Fehlertext bleibt
            bewusst verborgen (koennte interne Details preisgeben). */}
        {error.digest && (
          <p className="mt-8 font-mono text-xs text-muted">Fehlerkennung: {error.digest}</p>
        )}
      </div>
    </main>
  );
}

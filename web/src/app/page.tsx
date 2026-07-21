import Link from 'next/link';

/*
 * Platzhalter-Startseite. Die richtige Landing Page entsteht in Phase 4
 * zusammen mit dem Design-System — hier geht es vorerst nur darum, die
 * Einstiegspunkte erreichbar zu machen.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Anprobebilder und Verkaufstexte aus zwei Fotos
        </h1>
        <p className="opacity-70">
          Lade ein Foto von dir und ein Kleidungsstück hoch — du bekommst
          realistische Anprobebilder und fertige Anzeigentexte für Vinted und
          Kleinanzeigen.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/registrieren"
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Kostenlos starten
        </Link>
        <Link
          href="/anmelden"
          className="rounded-lg border border-black/15 px-5 py-2.5 text-sm transition-opacity hover:opacity-70 dark:border-white/20"
        >
          Anmelden
        </Link>
      </div>

      <p className="text-xs opacity-60">
        5 Gratis-Credits zum Ausprobieren. Keine Zahlungsdaten nötig.
      </p>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Seite nicht gefunden" };

/*
  404 im Stil der Landing Page (Display-Typo mit Serifen-Kursiv-Akzent) statt
  der nackten Next.js-Standardseite. Bewusst mit zwei Auswegen: die
  Startseite fuer Besucher, das Konto fuer Angemeldete -- eine Sackgasse ist
  der haeufigste Grund, warum jemand an dieser Stelle einfach abspringt.
*/
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md text-center">
        <p className="kicker">Fehler 404</p>
        <h1 className="display mt-5 text-4xl md:text-5xl">
          Diese Seite gibt es <em>nicht</em>.
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
          Vielleicht wurde sie verschoben, oder der Link hat sich vertippt.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <LinkButton href="/" size="lg">Zur Startseite</LinkButton>
          <LinkButton href="/konto" variant="outline" size="lg">Zu meinem Konto</LinkButton>
        </div>

        <p className="mt-8 text-sm text-muted">
          Etwas stimmt nicht?{" "}
          <Link href="/impressum" className="underline underline-offset-4 hover:text-ink">
            Kontakt
          </Link>
        </p>
      </div>
    </main>
  );
}

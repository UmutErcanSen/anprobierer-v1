import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/site/theme-toggle";

/*
  Header fuer eingeloggte Seiten. Zeigt das Guthaben (der wichtigste Wert fuer
  den Nutzer) prominent und bietet die Kernnavigation. Bewusst getrennt vom
  Marketing-Header, der stattdessen zur Registrierung fuehrt.
*/
export function AppHeader({ credits }: { credits?: number }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/konto" className="text-[15px] font-medium uppercase tracking-[0.16em] text-ink">
          Anprobierer
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          {typeof credits === "number" && (
            <Link
              href="/preise"
              className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong sm:inline-flex"
            >
              <span className="font-medium tabular-nums">{credits}</span>
              <span className="text-muted">{credits === 1 ? "Credit" : "Credits"}</span>
            </Link>
          )}

          <nav className="flex items-center gap-5 text-sm text-muted">
            <Link href="/anzeige-erstellen" className="transition-colors hover:text-ink">
              Erstellen
            </Link>
            <Link href="/konto" className="hidden transition-colors hover:text-ink sm:inline">
              Konto
            </Link>
          </nav>

          {/* Trennlinie isoliert die Utility-Icons (Theme) von den Textlinks
              und der Abmelden-Aktion — vorher stand der Umschalter unvermittelt
              zwischen zwei Textlinks. */}
          <span className="hidden h-5 w-px bg-line sm:inline-block" aria-hidden="true" />

          <ThemeToggle />

          <form action={signOutAction}>
            <button type="submit" className="text-sm text-muted transition-colors hover:text-ink">
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

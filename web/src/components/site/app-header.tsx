import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { MobileNav } from "@/components/site/mobile-nav";

/*
  Header fuer eingeloggte Seiten. Zeigt das Guthaben (der wichtigste Wert fuer
  den Nutzer) prominent und bietet die Kernnavigation. Bewusst getrennt vom
  Marketing-Header, der stattdessen zur Registrierung fuehrt.

  Die Wortmarke fuehrt bewusst zur Startseite (/) statt zum Konto -- das ist
  die universelle Erwartung an ein Logo, unabhaengig vom Anmeldestatus.
*/
export function AppHeader({ credits }: { credits?: number }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-[15px] font-medium uppercase tracking-[0.16em] text-ink">
          Anprobierer
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          {typeof credits === "number" && (
            <Link
              href="/preise"
              className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong md:inline-flex"
            >
              <span className="font-medium tabular-nums">{credits}</span>
              <span className="text-muted">{credits === 1 ? "Credit" : "Credits"}</span>
            </Link>
          )}

          <nav className="hidden items-center gap-5 text-sm text-muted md:flex">
            <Link href="/anzeige-erstellen" className="transition-colors hover:text-ink">
              Erstellen
            </Link>
            <Link href="/konto/verlauf" className="transition-colors hover:text-ink">
              Verlauf
            </Link>
            <Link href="/konto" className="transition-colors hover:text-ink">
              Konto
            </Link>
          </nav>

          {/* Trennlinie isoliert die Utility-Icons (Theme) von den Textlinks
              und der Abmelden-Aktion. Ab md sichtbar, weil der Theme-
              Umschalter selbst erst ab md inline erscheint (auf Mobil steckt
              er im Burger-Menue). */}
          <span className="hidden h-5 w-px bg-line md:inline-block" aria-hidden="true" />

          <ThemeToggle display="hidden md:flex" />

          {/* Leicht roter Ton (der App-Akzent ist ohnehin ein warmes
              Terrakotta) signalisiert "verlaesst den Bereich", ohne eine
              zweite Akzentfarbe einzufuehren -- dieselbe Farbe, die schon
              Fehlermeldungen und den Fehlgeschlagen-Status traegt. */}
          <form action={signOutAction} className="hidden md:block">
            <button type="submit" className="text-sm text-accent/80 transition-colors hover:text-accent">
              Abmelden
            </button>
          </form>

          {/* Auf Mobil ersetzt das Burger-Menue Erstellen/Konto/Theme/
              Abmelden komplett -- vorher gab es dafuer gar keinen Ersatz,
              die Links verschwanden unterhalb von sm einfach ohne
              Alternative. */}
          <MobileNav
            items={[
              { href: "/anzeige-erstellen", label: "Erstellen" },
              { href: "/konto/verlauf", label: "Verlauf" },
              { href: "/konto", label: "Konto" },
            ]}
          >
            <ThemeToggle variant="row" />
            <form action={signOutAction}>
              <button type="submit" className="w-full py-4 text-left text-lg text-accent/80 transition-colors hover:text-accent">
                Abmelden
              </button>
            </form>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}

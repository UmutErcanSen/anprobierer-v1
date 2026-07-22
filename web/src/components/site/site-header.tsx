import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

/*
  Marketing-Navigation. Bewusst minimal: Wortmarke links, wenige Links,
  eine gefuellte Aktion rechts. Der Name ist ein Platzhalter bis Phase 5
  (Rebranding) und liegt zentral hier, damit der Austausch eine Stelle ist.
*/

const NAV = [
  { href: "/#so-gehts", label: "So funktioniert's" },
  { href: "/preise", label: "Preise" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-[15px] font-medium uppercase tracking-[0.16em] text-ink"
        >
          Anprobierer
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
          <Link href="/anmelden" className="transition-colors hover:text-ink">
            Anmelden
          </Link>
        </nav>

        <LinkButton href="/registrieren" size="md">
          Kostenlos starten
        </LinkButton>
      </div>
    </header>
  );
}

import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { MobileNav } from "@/components/site/mobile-nav";

/*
  Marketing-Navigation. Wortmarke links, wenige Links, eine gefuellte Aktion
  rechts. Auf Mobil klappt die Navigation ins Overlay (MobileNav), damit auch
  dort alle Ziele — inkl. Anmelden — erreichbar sind.
*/

const NAV = [
  { href: "/#so-gehts", label: "So funktioniert's" },
  { href: "/preise", label: "Preise" },
  { href: "/anmelden", label: "Anmelden" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-[15px] font-medium uppercase tracking-[0.16em] text-ink">
          Anprobierer
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {/* Trennlinie isoliert den Theme-Umschalter von der CTA. */}
          <span className="hidden h-5 w-px bg-line sm:inline-block" aria-hidden="true" />
          <LinkButton href="/registrieren" size="md" className="hidden sm:inline-flex">
            Kostenlos starten
          </LinkButton>
          <MobileNav items={[...NAV, { href: "/registrieren", label: "Kostenlos starten" }]} />
        </div>
      </div>
    </header>
  );
}

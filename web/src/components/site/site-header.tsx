import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { MobileNav } from "@/components/site/mobile-nav";
import { createClient } from "@/lib/supabase/server";

/*
  Marketing-Navigation. Wortmarke links, wenige Links, eine gefuellte Aktion
  rechts. Auf Mobil klappt die Navigation ins Overlay (MobileNav).

  Async Server Component: prueft den Anmeldestatus, damit ein bereits
  angemeldeter Nutzer, der z.B. ueber "/preise" oder die Startseite
  navigiert, nicht weiterhin "Anmelden" und "Kostenlos starten" sieht --
  das wirkte inkonsistent, weil der eingeloggte Header (AppHeader) an
  anderer Stelle bereits einen ganz anderen Zustand zeigt.
*/

const BASE_NAV = [
  { href: "/#so-gehts", label: "So funktioniert's" },
  { href: "/preise", label: "Preise" },
];

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nav = user ? BASE_NAV : [...BASE_NAV, { href: "/anmelden", label: "Anmelden" }];
  const cta = user
    ? { href: "/konto", label: "Mein Konto" }
    : { href: "/registrieren", label: "Kostenlos starten" };

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-[15px] font-medium uppercase tracking-[0.16em] text-ink">
          Anprobierer
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Auf Mobil wandert der Umschalter ins Burger-Menue (siehe unten);
              ab md bleibt er wie bisher direkt im Header sichtbar. */}
          <ThemeToggle display="hidden md:flex" />
          <span className="hidden h-5 w-px bg-line md:inline-block" aria-hidden="true" />
          {/* Sichtbarkeit ueber einen Wrapper steuern, nicht direkt am Button:
              Button/LinkButton bringen selbst schon ein unbedingtes
              "inline-flex" in ihrer Basis-Klasse mit. Ein zusaetzliches
              "hidden sm:inline-flex" DIREKT am Button kollidiert damit auf
              gleicher Spezifitaet -- welche Regel gewinnt, haengt dann von
              der Reihenfolge im generierten Stylesheet ab, nicht vom
              className-String, und das "hidden" verlor diesen Wettstreit
              (der Button blieb entgegen der Absicht immer sichtbar). Ein
              Wrapper mit eigenem display hat dieses Problem nicht: bei
              display:none verschwindet das gesamte Kind unabhaengig von
              dessen eigenem inline-flex. */}
          <span className="hidden sm:inline-flex">
            <LinkButton href={cta.href} size="md">
              {cta.label}
            </LinkButton>
          </span>
          <MobileNav items={[...nav, cta]}>
            <div className="flex items-center justify-between border-b border-line py-4 text-lg text-ink">
              <span>Design</span>
              <ThemeToggle />
            </div>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}

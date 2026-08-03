import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { MobileNav } from "@/components/site/mobile-nav";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth/actions";

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

  // "Mein Konto" gehoerte hier bisher NICHT dazu -- fuer angemeldete Nutzer
  // war der Desktop-Header damit eine Sackgasse: Auf einer Marketing-Seite
  // (z.B. der Startseite) gab es keinen einzigen Link zur Kontouebersicht.
  // Erst ein Umweg ueber "Erstellen" -> AppHeader zeigte ueberhaupt Credits/
  // Tarif/Konto an. Jetzt direkt hier verfuegbar, ohne den Umweg.
  const nav = user
    ? [...BASE_NAV, { href: "/konto", label: "Mein Konto" }]
    : [...BASE_NAV, { href: "/anmelden", label: "Anmelden" }];
  // "Erstellen" bleibt trotzdem die primaere, gefuellte Aktion: "Kostenlos
  // starten" heisst "ich will jetzt etwas erstellen", nicht "ich will meine
  // Kontouebersicht sehen".
  const cta = user
    ? { href: "/anzeige-erstellen", label: "Erstellen" }
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
          {/* Immer sichtbar (auch auf Mobil) -- ein taeglich genutzter
              Schalter gehoert nicht ins Burger-Menue, zwei Taps entfernt. */}
          <ThemeToggle />
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
          {/*
            Eigene Reihenfolge fuer Mobil statt einfach [cta, ...nav]:

            Vorher stand "Anmelden" ganz unten, nach den Info-Links (So
            funktioniert's, Preise) -- von der anderen Konto-Aktion
            "Kostenlos starten" oben im Menue durch zwei fachfremde Links
            getrennt. Jetzt stehen beide Konto-Aktionen direkt
            nebeneinander, Info-Links folgen danach.

            Fuer angemeldete Nutzer fehlten ausserdem "Mein Konto" und
            "Abmelden" komplett -- auf einer Marketing-Seite (z.B. der
            Startseite) kam man mobil nur ueber den Umweg "Erstellen" ->
            AppHeader an diese Punkte. Jetzt direkt hier verfuegbar, ohne
            dass der Desktop-Header (der uebers Klicken von "Erstellen"
            ohnehin schnell zum AppHeader kommt) etwas davon mitbekommt.
          */}
          <MobileNav
            items={
              user
                ? [cta, { href: "/konto", label: "Mein Konto" }, ...BASE_NAV]
                : [cta, { href: "/anmelden", label: "Anmelden" }, ...BASE_NAV]
            }
          >
            {user && (
              <form action={signOutAction}>
                <button type="submit" className="w-full py-4 text-left text-lg text-accent/80 transition-colors hover:text-accent">
                  Abmelden
                </button>
              </form>
            )}
          </MobileNav>
        </div>
      </div>
    </header>
  );
}

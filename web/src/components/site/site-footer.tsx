import Link from "next/link";
import { siVisa, siMastercard, siApplepay, siGooglepay, siKlarna, type SimpleIcon } from "simple-icons";

/*
  Nur, was unsere Stripe Checkout Session tatsaechlich anbietet (per
  Stripe-API an echten Checkout-Sessions geprueft, 31.07.2026:
  payment_method_types = ["card", "klarna", "link", "amazon_pay", "satispay"]).
  Vorher stand hier PayPal -- das wird von unserer Konfiguration gar nicht
  angeboten, ein Vertrauenssignal fuer eine Zahlmethode, die es beim Bezahlen
  dann gar nicht gibt, waere das Gegenteil von Vertrauensaufbau.

  Visa/Mastercard stehen stellvertretend fuer "card", Apple Pay/Google Pay
  sind automatisch eingeblendete Wallets innerhalb von "card". Fuer Link und
  Amazon Pay gibt es in simple-icons keine Marke -- deshalb als Text
  ergaenzt statt als Icon erfunden.

  Markenfarben statt Einheitsfarbe: Nutzer erkennen Visa/Mastercard/Klarna
  ueber Jahre antrainiert an ihrer Farbe schneller als an der Form allein --
  hier zaehlt Wiedererkennung mehr als das eine-Akzentfarbe-Prinzip der
  restlichen Seite.

  JEDES Zeichen sitzt deshalb auf einer hellen Kachel. Grund: Diese
  Markenfarben sind fuer helle Untergruende entworfen -- Visa ist ein sehr
  dunkles Marineblau (#1A1F71), das im dunklen Theme direkt auf dem
  Hintergrund praktisch verschwand. Die Kachel loest das, ohne die
  Wiedererkennung zu opfern, und ist ausserdem die Darstellungsform, die man
  von Kassenseiten gewohnt ist.

  Weil die Kachel IMMER hell ist, bekommt Apple Pay ein festes Schwarz statt
  `var(--ink)`: Apples Richtlinien verlangen Schwarz oder Weiss je nach
  Untergrund, und der Untergrund ist hier in beiden Themes hell. Mit
  `var(--ink)` waere es im dunklen Theme hell auf hell gewesen -- also genau
  der Fehler, den die Kachel beheben soll.
*/
function PaymentIcon({ icon, color }: { icon: SimpleIcon; color?: string }) {
  return (
    <span className="flex h-8 w-11 items-center justify-center rounded-md border border-black/5 bg-white">
      <svg role="img" viewBox="0 0 24 24" width={22} height={22} fill={color ?? `#${icon.hex}`} aria-label={icon.title}>
        <path d={icon.path} />
      </svg>
    </span>
  );
}

const PAYMENT_ICONS: { icon: SimpleIcon; color?: string }[] = [
  { icon: siVisa },
  { icon: siMastercard },
  { icon: siApplepay, color: "#000000" },
  { icon: siGooglepay },
  { icon: siKlarna },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <span className="uppercase tracking-[0.16em] text-ink">Anprobierer</span>
        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href="/preise" className="transition-colors hover:text-ink">Preise</Link>
          <Link href="/datenschutz" className="transition-colors hover:text-ink">Datenschutz</Link>
          <Link href="/impressum" className="transition-colors hover:text-ink">Impressum</Link>
        </nav>
        <span>© {new Date().getFullYear()} Anprobierer</span>
      </div>

      {/*
        EIN gemeinsames Kleingedruckt-Band statt zwei getrennter Zeilen mit
        Trennlinie dazwischen. Der Markenhinweis stand zuerst als eigener
        Block ganz unten und wirkte dort angeklebt -- beides ist Kleintext
        derselben Art (Zahlungsarten, rechtliche Klarstellung) und gehoert
        deshalb sichtbar zusammen.

        Der Markenhinweis selbst stand urspruenglich direkt unter dem
        Logo-Laufband der Startseite. Dort unterbrach er die Bewegung des
        Bands; hier ist er ausserdem auf JEDER Seite sichtbar, nicht nur
        dort, wo die Logos laufen.

        Inhaltlich zwei Aussagen, beide bewusst: Der Upload bleibt beim
        Nutzer (weder Vinted noch Kleinanzeigen bieten Dritten eine
        Listing-Schnittstelle, siehe lib/generation/platforms.ts), und es
        besteht keine Verbindung zu den Anbietern -- Letzteres ist bei so
        prominent gezeigten fremden Logos auch markenrechtlich sauberer.
      */}
      <div className="border-t border-line bg-surface/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 text-xs text-muted">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
            <span>Sichere Bezahlung mit</span>
            {/* Engerer Abstand als zuvor: Die Kacheln bringen eigene Raender
                mit, mit gap-3 wirkte die Reihe dadurch auseinandergezogen. */}
            <div className="flex items-center gap-1.5">
              {PAYMENT_ICONS.map(({ icon, color }) => (
                <PaymentIcon key={icon.title} icon={icon} color={color} />
              ))}
            </div>
            <span>sowie Link &amp; Amazon Pay</span>
          </div>

          {/* max-w-3xl: Ueber die volle Breite von 1152px waere eine
              einzelne Kleintextzeile kaum noch lesbar -- zu lange Zeilen
              verlieren beim Zurueckspringen den Anschluss. */}
          <p className="max-w-3xl text-center leading-relaxed md:text-left">
            Vinted, Kleinanzeigen und eBay sind Marken der jeweiligen Anbieter. Es besteht keine Verbindung zu ihnen:
            Wir bereiten Titel, Text und Bild passend auf — eingestellt wird das Inserat von dir.
          </p>
        </div>
      </div>
    </footer>
  );
}

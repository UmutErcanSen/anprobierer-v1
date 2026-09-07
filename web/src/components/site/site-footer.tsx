import Link from "next/link";
import { MarkeMitClaim } from "@/components/site/wortmarke";
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
    /*
      EINE Zeile statt zweier Baender. Die Zahlungsarten standen zuvor in
      einem eigenen Streifen darunter; zusammen mit dem inzwischen nach
      /datenschutz verschobenen Markenhinweis blieb dort ein halbleeres Band
      uebrig. Jetzt gehoeren Marke, Rechtslinks, Zahlungsarten und Copyright
      sichtbar zusammen.

      Der Markenhinweis zu Vinted/Kleinanzeigen/eBay steht jetzt in der
      Datenschutzerklaerung (Abschnitt 13). Dort passt er auch inhaltlich
      besser als in den Footer: Beim Klick auf "Bei X oeffnen" verlaesst man
      unsere Seite, ab dann gilt die Datenschutzerklaerung der Plattform --
      das ist eine Aussage ueber Datenverarbeitung, keine Fussnote.
    */
    <footer className="mt-auto border-t border-line">
      <div /* flex-wrap ab md: Mit dem Claim unter der Wortmarke passte die Zeile
           auf exakt 925px -- also mit null Reserve. Die Folge war kein
           Umbruch, sondern Quetschen: Claim und Rechtslinks brachen mitten
           im Satz um. Jetzt rutschen bei Platzmangel ganze Bloecke in die
           naechste Zeile, statt dass einzelne Woerter zerfallen. */
        className="mx-auto flex w-full max-w-6xl flex-col items-center gap-x-8 gap-y-6 px-6 py-10 text-sm text-muted md:flex-row md:flex-wrap md:justify-between">
        {/* Der volle Sperrsatz mit Claim -- hier ist Platz dafuer, und das
            Signet darf die im Handbuch geforderten 56px erreichen. Der Claim
            steht bewusst nur an dieser einen Stelle: zweimal dieselbe Aussage
            auf einer Seite schwaecht sie, statt sie zu verstaerken. */}
        <MarkeMitClaim />

        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          <Link href="/preise" className="transition-colors hover:text-ink">Preise</Link>
          <Link href="/datenschutz" className="transition-colors hover:text-ink">Datenschutz</Link>
          <Link href="/impressum" className="transition-colors hover:text-ink">Impressum</Link>
        </nav>

        {/*
          Ohne begleitenden Text ("Sichere Bezahlung mit … sowie Link &
          Amazon Pay") -- in einer gemeinsamen Zeile mit Marke, Links und
          Copyright waere das zu viel. Die Information geht trotzdem nicht
          verloren: aria-label nennt alle Zahlungsarten fuer Screenreader,
          title zeigt sie beim Darueberfahren. Link und Amazon Pay sind dort
          mit aufgefuehrt, obwohl es fuer sie in simple-icons keine Marke
          gibt und sie deshalb kein eigenes Zeichen bekommen.
        */}
        <div
          className="flex items-center gap-1.5"
          role="img"
          aria-label="Sichere Bezahlung mit Visa, Mastercard, Apple Pay, Google Pay, Klarna sowie Link und Amazon Pay"
          title="Sichere Bezahlung mit Visa, Mastercard, Apple Pay, Google Pay, Klarna sowie Link und Amazon Pay"
        >
          {PAYMENT_ICONS.map(({ icon, color }) => (
            <PaymentIcon key={icon.title} icon={icon} color={color} />
          ))}
        </div>

        <span>© {new Date().getFullYear()} Wearify</span>
      </div>
    </footer>
  );
}

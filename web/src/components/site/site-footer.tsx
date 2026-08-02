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
  restigen Seite. Apple Pay bildet dabei die Ausnahme: Apples Richtlinien
  verlangen Schwarz oder Weiss je nach Hintergrund, nie eine Markenfarbe --
  deshalb `var(--ink)` statt Marken-Hex, damit es im dunklen Theme nicht
  unsichtbar wird.
*/
function PaymentIcon({ icon, color }: { icon: SimpleIcon; color?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" width={20} height={20} fill={color ?? `#${icon.hex}`} aria-label={icon.title}>
      <path d={icon.path} />
    </svg>
  );
}

const PAYMENT_ICONS: { icon: SimpleIcon; color?: string }[] = [
  { icon: siVisa },
  { icon: siMastercard },
  { icon: siApplepay, color: "var(--ink)" },
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

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-6 text-xs text-muted sm:flex-row sm:justify-center md:justify-start">
          <span>Sichere Bezahlung mit</span>
          <div className="flex items-center gap-3">
            {PAYMENT_ICONS.map(({ icon, color }) => (
              <PaymentIcon key={icon.title} icon={icon} color={color} />
            ))}
          </div>
          <span>sowie Link &amp; Amazon Pay</span>
        </div>
      </div>
    </footer>
  );
}

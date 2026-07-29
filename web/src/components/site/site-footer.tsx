import Link from "next/link";
import { siVisa, siMastercard, siPaypal, siApplepay, siGooglepay, type SimpleIcon } from "simple-icons";

/*
  Monochrome statt Markenfarben: ein einzelner bunter Logo-Streifen (Blau,
  Gelb, Rot, Schwarz nebeneinander) haette dem "eine Akzentfarbe"-Prinzip der
  restlichen Seite widersprochen. `currentColor` uebernimmt stattdessen die
  gedeckte --muted-Textfarbe der Zeile, die Logos bleiben trotzdem an ihrer
  Form erkennbar.
*/
function PaymentIcon({ icon }: { icon: SimpleIcon }) {
  return (
    <svg role="img" viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-label={icon.title}>
      <path d={icon.path} />
    </svg>
  );
}

const PAYMENT_ICONS = [siVisa, siMastercard, siPaypal, siApplepay, siGooglepay];

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
          <div className="flex items-center gap-3 text-muted">
            {PAYMENT_ICONS.map((icon) => (
              <PaymentIcon key={icon.title} icon={icon} />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

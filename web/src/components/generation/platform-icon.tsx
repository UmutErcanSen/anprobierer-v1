import { siEbay, siKleinanzeigen, siVinted, type SimpleIcon } from 'simple-icons';
import type { PlatformKey } from '@/lib/generation/platforms';

/*
  Gemeinsame Markenicons fuer Vinted/Kleinanzeigen/eBay -- genutzt sowohl im
  PlatformExport (Verlauf/Ergebnis) als auch auf der Landing Page. Reine
  Praesentationskomponente ohne Client-spezifische APIs, daher in Server
  Components genauso einsetzbar.
*/

export const PLATFORM_ICONS: Record<PlatformKey, SimpleIcon> = {
  vinted: siVinted,
  kleinanzeigen: siKleinanzeigen,
  ebay: siEbay,
};

export function PlatformIcon({
  icon,
  size = 14,
  className,
}: {
  icon: SimpleIcon;
  size?: number;
  /** Fuer responsives Skalieren (z.B. "h-8 w-8 md:h-11 md:w-11") -- die
   * CSS-Breite/Hoehe einer Klasse hat Vorrang vor den width/height-Attributen
   * oben, die nur als Basisgroesse dienen. */
  className?: string;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill={`#${icon.hex}`}
      className={className}
    >
      <path d={icon.path} />
    </svg>
  );
}

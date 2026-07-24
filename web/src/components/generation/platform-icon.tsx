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

export function PlatformIcon({ icon, size = 14 }: { icon: SimpleIcon; size?: number }) {
  return (
    <svg role="img" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill={`#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  );
}

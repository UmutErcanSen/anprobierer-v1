'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { SunMoon } from 'lucide-react';

/*
  Hell/Dunkel-Umschalter. Hell ist Standard; Dunkel wird per data-theme am
  <html> gesetzt und in localStorage gemerkt. Das Setzen vor dem Paint
  uebernimmt das Inline-Skript im <head> (siehe layout.tsx) — dieser Button
  spiegelt nur den Zustand und schaltet um.

  Steht jetzt IMMER sichtbar im Header (vorher auf Mobil im Burger-Menue
  versteckt -- ein taeglich genutzter Schalter sollte nicht zwei Taps
  entfernt sein). Eigener Rahmen statt reinem Ghost-Icon, damit er neben den
  Textlinks im Header als eigenstaendiger Knopf erkennbar bleibt.
*/
/*
  Das data-theme-Attribut am <html> ist die einzige Wahrheit ueber das Theme --
  gesetzt vom Inline-Skript vor dem ersten Paint (siehe layout.tsx) und hier
  beim Umschalten.

  Frueher wurde es zusaetzlich in React-State gespiegelt und per Effekt beim
  Mounten nachgezogen. Das war doppelte Buchfuehrung: Zwei Quellen fuer
  dieselbe Aussage, die auseinanderlaufen koennen, plus eine ueberfluessige
  zweite Renderrunde nach jedem Mounten.

  useSyncExternalStore ist fuer genau diesen Fall gebaut -- ein Wert, der
  ausserhalb von React lebt. Der dritte Parameter liefert den Serverwert:
  Dort gibt es kein DOM, und der Server kennt die Wahl des Nutzers ohnehin
  nicht. React weiss dadurch, dass die beiden Staende abweichen DUERFEN, und
  meldet keinen Hydration-Fehler. Sichtbar ist der Unterschied nicht -- der
  Wert steuert ausschliesslich das aria-label.
*/
function themeAbonnieren(beiAenderung: () => void) {
  const beobachter = new MutationObserver(beiAenderung);
  beobachter.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => beobachter.disconnect();
}

const istDunkel = () => document.documentElement.getAttribute('data-theme') === 'dark';

export function ThemeToggle() {
  const dark = useSyncExternalStore(themeAbonnieren, istDunkel, () => false);

  /* Dauer muss zur .theme-wechselt-Regel in globals.css passen. */
  const UEBERGANG_MS = 320;
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function toggle() {
    const next = !dark;
    // Kein setState noetig: Das Setzen des Attributs weiter unten meldet der
    // MutationObserver, und React rendert daraufhin neu.

    /*
      Uebergangsklasse nur waehrend des Wechsels: Damit fahren alle Farben
      weich ineinander, statt schlagartig umzuspringen. Danach kommt sie
      wieder weg -- dauerhaft gesetzt wuerde sie auch jeden Hover-Zustand
      verzoegern (siehe Begruendung in globals.css).

      Beim mehrfachen schnellen Umschalten wird der laufende Timer verworfen
      und neu gesetzt, sonst nimmt der erste Timer die Klasse mitten im
      zweiten Uebergang weg.
    */
    const wurzel = document.documentElement;
    wurzel.classList.add('theme-wechselt');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      wurzel.classList.remove('theme-wechselt');
      timer.current = null;
    }, UEBERGANG_MS);

    wurzel.setAttribute('data-theme', next ? 'dark' : 'light');
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // localStorage kann blockiert sein — dann gilt die Wahl nur fuer diese Sitzung.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-line-strong hover:bg-surface"
    >
      <SunMoon size={17} aria-hidden />
    </button>
  );
}

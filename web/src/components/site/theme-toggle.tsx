'use client';

import { useEffect, useRef, useState } from 'react';
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
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  /* Dauer muss zur .theme-wechselt-Regel in globals.css passen. */
  const UEBERGANG_MS = 320;
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function toggle() {
    const next = !dark;
    setDark(next);

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

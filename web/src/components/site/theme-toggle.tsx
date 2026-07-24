'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/*
  Hell/Dunkel-Umschalter. Hell ist Standard; Dunkel wird per data-theme am
  <html> gesetzt und in localStorage gemerkt. Das Setzen vor dem Paint
  uebernimmt das Inline-Skript im <head> (siehe layout.tsx) — dieser Button
  spiegelt nur den Zustand und schaltet um.

  Zwei Varianten:
    'icon' — kompakter Rundknopf fuer den Header (nur Icon, per `display`
             gesteuerte Sichtbarkeit).
    'row'  — volle Zeile fuers Mobil-Menue: Label benennt die AKTION statt
             eines statischen "Design" ("Dunkles Design aktivieren"), Icon
             sitzt direkt neben dem Text statt an den rechten Rand gespreizt
             (vorher `justify-between` liess Text und Icon wie zwei getrennte
             Elemente wirken, obwohl beide zusammen einen einzigen Schalter
             bilden).
*/
export function ThemeToggle({ display = 'flex', variant = 'icon' }: { display?: string; variant?: 'icon' | 'row' }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // localStorage kann blockiert sein — dann gilt die Wahl nur fuer diese Sitzung.
    }
  }

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 border-b border-line py-4 text-left text-lg text-ink"
      >
        {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        {dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
      // `display` als eigener Parameter (statt freier className), damit der
      // Aufrufer nur die Sichtbarkeit steuert (z.B. "hidden md:flex" im
      // Header-Kontext), ohne aus Versehen Groesse/Farbe zu ueberschreiben.
      className={`${display} h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink`}
    >
      {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}

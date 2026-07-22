'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/*
  Hell/Dunkel-Umschalter. Hell ist Standard; Dunkel wird per data-theme am
  <html> gesetzt und in localStorage gemerkt. Das Setzen vor dem Paint
  uebernimmt das Inline-Skript im <head> (siehe layout.tsx) — dieser Button
  spiegelt nur den Zustand und schaltet um.
*/
export function ThemeToggle() {
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

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
    >
      {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}

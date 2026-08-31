'use client';

import { useEffect, useRef } from 'react';

/*
  Klebende Leisten-Ebene ganz oben: Beta-Hinweis und laufende Anprobe.

  Warum ein eigener Wrapper statt `sticky` an jedem Banner:
  Zwei uebereinander klebende Elemente mit jeweils `top-0` wuerden sich
  gegenseitig verdecken. Hier klebt EIN Container, die Banner stapeln sich
  darin in normalem Fluss -- das bleibt auch dann richtig, wenn spaeter ein
  dritter Hinweis dazukommt.

  Warum die Hoehe gemessen und nicht fest gesetzt wird:
  Der Beta-Text bricht je nach Breite auf ein bis zwei Zeilen um, und ob eine
  Anprobe laeuft, aendert sich zur Laufzeit. Ein fester Wert waere entweder zu
  klein (der Header rutscht unter die Leiste) oder zu gross (sichtbare
  Luecke). Der gemessene Wert landet als --chrome-oben auf <html>; beide
  Header kleben bei top: var(--chrome-oben) und stapeln sich damit korrekt
  darunter -- ohne dass sie wissen muessen, welche Banner es gerade gibt.

  Der ResizeObserver deckt beide Faelle in einem ab: Umbruch bei Groessen-
  aenderung UND Ein-/Ausblenden eines Banners (beides aendert die Hoehe des
  Containers).
*/
export function ChromeOben({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const setzen = () => {
      // Auf ganze Pixel runden: Subpixel-Hoehen erzeugen sonst eine
      // Haarlinie zwischen Leiste und Header, durch die der Inhalt beim
      // Scrollen durchblitzt.
      const hoehe = Math.round(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--chrome-oben', `${hoehe}px`);
    };

    setzen();
    const beobachter = new ResizeObserver(setzen);
    beobachter.observe(el);

    return () => {
      beobachter.disconnect();
      // Aufraeumen, damit ein Header nicht mit einem Abstand fuer eine
      // Leiste zurueckbleibt, die es nicht mehr gibt.
      document.documentElement.style.removeProperty('--chrome-oben');
    };
  }, []);

  return (
    /* z-60 statt z-50: Der Header (z-50) muss beim Scrollen UNTER diese
       Leiste rutschen, nicht darueber -- sonst schoebe sich seine
       Hintergrundunschaerfe ueber den Hinweis. */
    <div ref={ref} className="sticky top-0 z-[60]">
      {children}
    </div>
  );
}

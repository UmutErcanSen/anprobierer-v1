'use client';

import { useEffect, useRef } from 'react';

/*
  Zaehlt eine Zahl beim Erreichen des Sichtbereichs von 0 auf ihren Zielwert
  hoch, statt einfach dazustehen. Nur der Zahlenteil animiert -- Praefix/
  Suffix (" gratis", " Plattformen") bleiben fester Text, ein hochzaehlendes
  "€" waere unsinnig.

  Eigener rAF-Loop statt CSS: eine ganzzahlige Anzeige laesst sich mit reinem
  CSS nicht sauber interpolieren (CSS animiert Zahlen nicht als Textinhalt).

  WARUM DIE ZAHL DIREKT INS DOM GESCHRIEBEN WIRD und nicht ueber React-State:

  Der Zaehler lief frueher ueber `useState` und loeste damit bei jedem
  Animationsbild eine Renderrunde aus -- rund 60 pro Sekunde, fuer eine
  Zierde. Ausserdem musste der Startwert per Effekt gesetzt werden, was
  React zu Recht als "setState im Effekt" beanstandet.

  Hier schreibt die Animation den Text direkt. Das ist gefahrlos, weil React
  gegen seinen VORIGEN Renderbaum vergleicht, nicht gegen das echte DOM:
  Solange dieselbe Komponente dasselbe JSX erzeugt -- und das tut sie, die
  Werte sind Konstanten der Startseite -- fasst React den Textknoten nicht an.

  Server und erste Client-Runde zeigen beide "0" plus Suffix. Es gibt damit
  keinen Hydration-Unterschied; die echte Zahl kommt erst danach.
*/
export function CountUp({ value, suffix = '', duration = 900 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const zeige = (n: number) => {
      el.textContent = `${n}${suffix}`;
    };

    // Nichts zu animieren: Zielwert 0, oder der Nutzer hat reduzierte
    // Bewegung eingestellt. In beiden Faellen sofort der Endwert.
    if (value === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      zeige(value);
      return;
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
          zeige(Math.round(eased * value));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, suffix, duration]);

  return (
    <span ref={ref}>
      {0}
      {suffix}
    </span>
  );
}

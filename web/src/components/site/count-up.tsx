'use client';

import { useEffect, useRef, useState } from 'react';

/*
  Zaehlt eine Zahl beim Erreichen des Sichtbereichs von 0 auf ihren Zielwert
  hoch, statt einfach dazustehen. Nur der Zahlenteil animiert -- Praefix/
  Suffix (" gratis", " Plattformen") bleiben fester Text, ein hochzaehlendes
  "€" waere unsinnig.

  Eigener rAF-Loop statt CSS: eine ganzzahlige Anzeige laesst sich mit reinem
  CSS nicht sauber interpolieren (CSS animiert Zahlen nicht als Textinhalt).
*/
export function CountUp({ value, suffix = '', duration = 900 }: { value: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0) {
      setDisplay(value);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
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
          setDisplay(Math.round(eased * value));
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
  }, [value, duration]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

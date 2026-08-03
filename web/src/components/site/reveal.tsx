'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/*
  Scroll-Reveal: blendet seinen Inhalt sanft ein (Fade + leichtes Hochfahren),
  sobald er in den Sichtbereich scrollt, statt fertig gerendert dazustehen.
  IntersectionObserver statt Scroll-Handler -- feuert nur bei tatsaechlicher
  Sichtbarkeitsaenderung, kein Dauerlauf bei jedem Scroll-Event. `unobserve`
  nach dem ersten Treffer: Der Effekt soll einmal beim Hereinscrollen
  passieren, nicht bei jedem erneuten Ein-/Ausscrollen erneut ausloesen.

  `delay` (ms) erlaubt gestaffeltes Einblenden mehrerer Geschwister-Elemente
  (z.B. drei Feature-Karten nacheinander statt gleichzeitig).

  `variant` waehlt die Bewegungsrichtung -- verschiedene Abschnitte der Seite
  sollen sich beim Einblenden unterscheiden lassen, statt dass jede Section
  optisch identisch "hochfaehrt":
    'up'    Standard: faehrt von unten hoch (Ueberschriften, Standard-Bloecke)
    'scale' waechst leicht aus der Mitte -- fuer Karten mit eigenem Icon/Fokuspunkt
    'left'  faehrt von links ein -- fuer Inhalte mit erkennbarer Lesereihenfolge
            (nummerierte Schritte, Tabellenzeilen)

  Reduzierte Bewegung ist bereits ueber die globale
  `prefers-reduced-motion`-Regel in globals.css abgedeckt (setzt
  transition-duration global auf ~0) -- keine gesonderte Behandlung noetig.
*/
export function Reveal({
  children,
  delay = 0,
  variant = 'up',
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  variant?: 'up' | 'scale' | 'left';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal reveal--${variant}${visible ? ' reveal-visible' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

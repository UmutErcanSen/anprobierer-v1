'use client';

import { BadgeCheck, Layers, RotateCw, Ruler, ScanFace, Shirt, Sparkle, Sun } from 'lucide-react';

/*
  Icon-Panel fuer die Wartephase (Desktop, siehe generate-flow.tsx). Ersetzt
  ein generisches Foto/Symbol durch ein Icon, das zum jeweils AKTUELLEN
  Schritt der echten Checkliste passt -- wechselt also mit progressIdx mit,
  statt die ganze Wartezeit ueber statisch zu sein. Ein Fortschrittsring
  daneben spiegelt denselben Prozentwert wie der Balken in generate-flow.tsx.

  Auf Mobil ausgeblendet (siehe hidden md:flex im Aufrufer) -- fuer ein
  zweites Panel ist auf schmalen Bildschirmen kein sinnvoller Platz.
*/

const STEP_ICONS = [ScanFace, Shirt, Ruler, Layers, RotateCw, Sun, BadgeCheck];

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Wirkt zufaellig verstreut, ist aber deterministisch (kein Math.random()) --
// sonst waeren die Positionen bei jedem Rerender neu gewuerfelt und der Rest
// des Panels wuerde sich fuer den Nutzer sichtbar "verschieben".
const SPARKLES = Array.from({ length: 10 }, (_, i) => ({
  top: 6 + ((i * 37) % 88),
  left: 6 + ((i * 53) % 88),
  size: 6 + (i % 3) * 2,
  delay: (i * 0.9) % 3.2,
}));

export function GenerationIconPanel({ progressIdx, pct }: { progressIdx: number; pct: number }) {
  const Icon = STEP_ICONS[Math.min(progressIdx, STEP_ICONS.length - 1)];
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  return (
    <div className="relative hidden aspect-[3/4] w-[220px] shrink-0 items-center justify-center overflow-hidden border-line border-r bg-surface md:flex">
      {SPARKLES.map((s, i) => (
        <Sparkle
          key={i}
          size={s.size}
          aria-hidden
          className="sparkle absolute text-accent"
          style={{ top: `${s.top}%`, left: `${s.left}%`, animationDelay: `${s.delay}s` }}
        />
      ))}

      <svg viewBox="0 0 64 64" className="absolute h-[100px] w-[100px] -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={RADIUS} strokeWidth={2.5} className="fill-none stroke-[var(--line)]" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="fill-none stroke-[var(--success)] transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>

      {/* key erzwingt ein Neu-Mounten bei jedem Schrittwechsel, damit die
          icon-pop-Animation garantiert frisch abspielt (gleiches Prinzip wie
          der Generieren-Button in generate-flow.tsx). */}
      <Icon key={progressIdx} size={40} className="icon-pop relative text-ink" aria-hidden />
    </div>
  );
}

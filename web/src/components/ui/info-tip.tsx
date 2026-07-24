'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Info } from 'lucide-react';

/*
  Kleiner Info-Knopf mit Popover — fuer Erklaerungen, die nicht staendig auf
  der Seite stehen muessen, aber bei Bedarf griffbereit sind (z.B. Tipps fuer
  ein gutes Foto, oder was ein Modus konkret bedeutet).

  Auf <details>/<summary> aufgebaut statt einem Hover-Tooltip: funktioniert
  identisch per Klick/Tap auf Touch UND Desktop, ist per Tastatur bedienbar
  und braucht kein State-Management. Ein Klick ausserhalb schliesst das
  Popover wieder (native <details> bleibt sonst offen, bis erneut geklickt).
*/
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) {
        ref.current.open = false;
      }
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  return (
    <details ref={ref} className="relative inline-block align-middle">
      <summary
        aria-label={label}
        className="inline-flex h-[18px] w-[18px] cursor-pointer list-none items-center justify-center rounded-full text-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden"
      >
        <Info size={14} aria-hidden />
      </summary>
      <div className="absolute left-0 top-6 z-20 w-72 rounded-lg border border-line-strong bg-paper p-3.5 text-xs leading-relaxed text-ink-soft">
        {children}
      </div>
    </details>
  );
}

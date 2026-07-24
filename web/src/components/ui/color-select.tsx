'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { COLORS, COLOR_SWATCH } from '@/lib/generation/constants';

/*
  Einzelauswahl fuer die Farbe eines Kleidungsstuecks -- im selben
  details/summary-Schema wie die Filter im Verlauf (SingleSelect/MultiSelect
  in history-filters.tsx), samt Musterkreis je Farbe. Ein natives <select>
  kann Farbkreise nicht in seinen <option>-Eintraegen darstellen, deshalb hier
  dieselbe eigens gestaltete Dropdown-Variante statt des generischen
  Select aus field.tsx.
*/
export function ColorSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  function choose(v: string) {
    onChange(v);
    if (ref.current) ref.current.open = false;
  }

  const swatch = value ? COLOR_SWATCH[value as keyof typeof COLOR_SWATCH] : undefined;

  return (
    <details ref={ref} id={id} className="relative">
      <summary className="flex h-11 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3.5 text-[15px] text-ink transition-colors hover:border-line-strong [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          {swatch && (
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong" style={{ background: swatch }} aria-hidden />
          )}
          <span className="truncate">{value || 'Keine Angabe'}</span>
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
      </summary>

      <div className="absolute left-0 top-[calc(100%+6px)] z-20 max-h-72 w-full overflow-y-auto rounded-lg border border-line-strong bg-paper p-1 shadow-sm">
        <button
          type="button"
          onClick={() => choose('')}
          className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface ${
            value === '' ? 'font-medium text-ink' : 'text-ink-soft'
          }`}
        >
          Keine Angabe
        </button>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => choose(c)}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface ${
              c === value ? 'font-medium text-ink' : 'text-ink-soft'
            }`}
          >
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong"
              style={{ background: COLOR_SWATCH[c] }}
              aria-hidden
            />
            {c}
          </button>
        ))}
      </div>
    </details>
  );
}

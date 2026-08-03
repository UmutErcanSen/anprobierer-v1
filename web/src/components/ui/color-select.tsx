'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { COLORS, COLOR_SWATCH } from '@/lib/generation/constants';
import { MobilePickerSheet, pickerTriggerClasses } from '@/components/ui/select-sheet';

/*
  Einzelauswahl fuer die Farbe eines Kleidungsstuecks. Ein natives <select>
  kann Farbkreise nicht in seinen <option>-Eintraegen darstellen, deshalb
  hier zwei eigens gestaltete Varianten statt des generischen Select aus
  field.tsx -- analog zum Aufbau von SelectSheet (ui/select-sheet.tsx):

    Desktop (ab sm): details/summary-Dropdown wie bisher, samt Musterkreis
    Mobil:           dasselbe Bottom-Sheet wie bei Kleidungstyp/Groesse
                      (MobilePickerSheet), hier mit Farbkreis je Zeile

  Der details/summary-Dropdown blieb auf Mobil bisher bestehen, wirkte dort
  aber inkonsistent zu den neuen Bottom-Sheets der Nachbarfelder -- gleiches
  Problem wie vorher bei den nativen <select>-Feldern.
*/
export function ColorSelect({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    setMobileOpen(false);
  }

  const swatch = value ? COLOR_SWATCH[value as keyof typeof COLOR_SWATCH] : undefined;

  return (
    <>
      {/* Desktop: details/summary-Dropdown wie bisher, jetzt auf sm+ begrenzt. */}
      <details ref={ref} id={id} className="relative hidden sm:block">
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

      {/* Mobil: Button oeffnet dasselbe Sheet wie Kleidungstyp/Groesse. */}
      <button
        type="button"
        id={`${id}-mobil`}
        aria-label="Farbe"
        onClick={() => setMobileOpen(true)}
        className={`${pickerTriggerClasses} sm:hidden`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {swatch && (
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong" style={{ background: swatch }} aria-hidden />
          )}
          <span className="truncate">{value || 'Keine Angabe'}</span>
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
      </button>

      {/* Zweiter Anlauf nach Nutzer-Feedback ("immer noch zu klein, man
          verklickt sich"): h-16 statt h-14 (deutlich groesseres Tap-Ziel),
          Farbkreis 24px statt 20px. Zusaetzlich harte Trennlinien (border-b)
          STATT Zeilenabstand (listClassName ohne gap) -- reiner Abstand
          liess sich beim schnellen Scrollen/Tippen offenbar nicht
          zuverlaessig genug erfassen, eine durchgezogene Linie zwischen den
          Zeilen macht die Grenze dagegen eindeutig. */}
      <MobilePickerSheet
        title="Farbe"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        listClassName="flex flex-col overflow-y-auto p-5"
      >
        <button
          type="button"
          onClick={() => choose('')}
          className={`flex h-16 w-full items-center justify-between border-b border-line px-3.5 text-left text-[15px] transition-colors hover:bg-surface ${
            value === '' ? 'font-medium text-ink' : 'text-ink-soft'
          }`}
        >
          Keine Angabe
          {value === '' && <Check size={16} className="text-ink" aria-hidden />}
        </button>
        {COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => choose(c)}
            className={`flex h-16 w-full items-center gap-4 px-3.5 text-left text-[15px] transition-colors hover:bg-surface ${
              i < COLORS.length - 1 ? 'border-b border-line' : ''
            } ${c === value ? 'font-medium text-ink' : 'text-ink-soft'}`}
          >
            <span className="h-6 w-6 shrink-0 rounded-full border border-line-strong" style={{ background: COLOR_SWATCH[c] }} aria-hidden />
            <span className="flex-1">{c}</span>
            {c === value && <Check size={16} className="text-ink" aria-hidden />}
          </button>
        ))}
      </MobilePickerSheet>
    </>
  );
}

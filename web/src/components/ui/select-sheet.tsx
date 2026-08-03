'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { inputClasses } from '@/components/ui/field';

export type SelectOption = { value: string; label: string };

/*
  Optik des Mobil-Ausloesers fuer alle Bottom-Sheet-Felder (SelectSheet
  unten, ColorSelect). BEWUSST NICHT einfach `inputClasses` + ein
  angehaengtes "border-line-strong" -- zwei Utilities fuer dieselbe
  CSS-Eigenschaft (border-color) in einem className-String konkurrieren
  ueber die Reihenfolge im GENERIERTEN Stylesheet, nicht ueber die
  Reihenfolge im String; welche gewinnt, ist damit nicht verlaesslich
  vorhersehbar (siehe genau dieses Problem vorher bei den Button-Hover-
  Klassen). Ein eigener, in sich vollstaendiger Klassenstring umgeht das.

  border-line-strong statt border-line: Mit `inputClasses` (der sehr
  helle Standard-Rahmen aller Textfelder) wirkten diese Ausloeser auf
  Mobil -- wo es keinen Hover-Zustand gibt, der die Flaeche sonst
  "aufweckt" -- kaum vom deaktivierten Zustand zu unterscheiden. Das war
  ausdrueckliches Feedback: "sieht aus, als koenne man nicht draufdruecken".
*/
export const pickerTriggerClasses =
  'flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line-strong bg-paper px-3.5 text-[15px] text-ink transition-colors hover:border-ink';

/*
  Bottom-Sheet-Grundgeruest, geteilt von SelectSheet (unten) und ColorSelect
  -- Kopfzeile mit Titel/Schliessen-Knopf, scrollbarer Listenbereich, per
  Portal an document.body gehaengt (siehe MobileNav/HistoryFilters fuer
  denselben Grund: Header hat backdrop-blur, das macht ihn andernfalls zum
  eigenen Containing Block fuer "position: fixed"-Nachkommen). Der Inhalt
  der Liste bleibt Sache des Aufrufers (children) -- SelectSheet und
  ColorSelect brauchen unterschiedliche Zeilen (mit/ohne Farbkreis).
*/
export function MobilePickerSheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    // `inert` auf dem AEUSSEREN Wrapper: der bleibt nach dem ersten Oeffnen
    // dauerhaft im DOM (ermoeglicht die Slide-Animation), muss also im
    // geschlossenen Zustand explizit Fokus und Zeigerereignisse verlieren --
    // sonst legt sich eine unsichtbare Vollbild-Ebene ueber die Seite,
    // sobald das Sheet einmal gemountet wurde.
    <div className="fixed inset-0 z-[100] sm:hidden" inert={!open}>
      <div
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 flex max-h-[75vh] flex-col rounded-t-2xl border-t border-line bg-paper shadow-lg transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="text-sm font-medium text-ink">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`${title} schließen`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/*
  Ersetzt ein natives <select> auf Mobil durch ein Bottom-Sheet im selben
  Stil wie die Verlaufs-Filter (history-filters.tsx: FilterRow ->
  MobileOptionList) -- deren Erscheinungsbild schwankt je nach Betriebssystem
  stark und wirkt neben dem Rest der Seite altbacken. Ab sm bleibt es ein
  ganz normales <select>: Auf dem Desktop gibt es keinen Grund, vom
  gewohnten Bedienmuster (Tastatur, native Screenreader-Unterstuetzung)
  abzuweichen -- das Problem betrifft nur den Touch-Picker auf dem Handy.

  Zwei Elemente bleiben gleichzeitig im DOM (nur je eins per CSS sichtbar),
  statt per JS auf die Bildschirmbreite zu reagieren -- dasselbe Prinzip wie
  bei den Filtern (Desktop-Zeile/Mobil-Sheet). Sie tragen deshalb bewusst
  UNTERSCHIEDLICHE IDs (sonst waeren zwei Elemente mit derselben ID
  gleichzeitig im DOM, ungueltiges HTML und mehrdeutig fuer
  `label[for]`/`getElementById`) -- das <select> traegt die per `id`
  uebergebene, vom aussenliegenden <Field>/<Label> referenzierte ID, der
  Mobil-Button bekommt eine eigene und labelt sich stattdessen selbst per
  `aria-label`.
*/
export function SelectSheet({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <>
      {/* Desktop: unveraendertes natives <select>. */}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} hidden sm:block`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Mobil: Button oeffnet das Sheet statt des nativen Pickers. */}
      <button
        type="button"
        id={`${id}-mobil`}
        aria-label={label}
        onClick={() => setOpen(true)}
        className={`${pickerTriggerClasses} sm:hidden`}
      >
        <span className={current ? 'text-ink' : 'text-muted'}>{current?.label ?? placeholder}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
      </button>

      <MobilePickerSheet title={label} open={open} onClose={() => setOpen(false)}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            className={`flex h-12 w-full items-center justify-between rounded-lg px-3.5 text-left text-[15px] transition-colors hover:bg-surface ${
              opt.value === value ? 'font-medium text-ink' : 'text-ink-soft'
            }`}
          >
            {opt.label}
            {opt.value === value && <Check size={16} className="text-ink" aria-hidden />}
          </button>
        ))}
      </MobilePickerSheet>
    </>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Select } from '@/components/ui/field';
import { CLOTHING_TYPES, SIZES, COLORS } from '@/lib/generation/constants';

/*
  Filter fuer den Anproben-Verlauf. Aendert die URL-Query statt lokalen State
  zu halten -- so bleibt der Filter beim Neuladen, beim Teilen des Links und
  beim Zurueck-Navigieren erhalten, und die Liste selbst bleibt eine Server
  Component (keine Duplizierung der Datenabfrage im Client).

  Status/Modus sind Einzelauswahl (schliessen sich gegenseitig aus). Kategorie/
  Groesse/Farbe sind Mehrfachauswahl -- ein Nutzer will z.B. "Jeans ODER Kleid"
  gleichzeitig sehen, deshalb Checkboxen statt eines <select>.
*/

const CATEGORY_OPTIONS = Object.entries(CLOTHING_TYPES).map(([value, { de }]) => ({ value, label: de }));
const SIZE_OPTIONS = SIZES.map((s) => ({ value: s, label: s }));
const COLOR_OPTIONS = COLORS.map((c) => ({ value: c, label: c }));

type Option = { value: string; label: string };

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  className = '',
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <details ref={ref} className={`relative w-full sm:w-auto ${className}`}>
      <summary
        className={`flex h-11 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-lg border px-3.5 text-[15px] transition-colors [&::-webkit-details-marker]:hidden sm:w-auto sm:justify-start ${
          selected.length ? 'border-ink text-ink' : 'border-line text-ink hover:border-line-strong'
        }`}
      >
        <span className="flex items-center gap-2">
          {label}
          {selected.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-xs font-medium text-on-ink">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronDown size={14} className="text-muted" aria-hidden />
      </summary>

      <div className="absolute left-0 top-[calc(100%+6px)] z-20 max-h-72 w-full min-w-60 overflow-y-auto rounded-lg border border-line-strong bg-paper p-2 shadow-sm sm:w-60">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="h-4 w-4 shrink-0 rounded border-line-strong accent-ink"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export function HistoryFilters({
  status,
  mode,
  kategorie,
  groesse,
  farbe,
}: {
  status: string;
  mode: string;
  kategorie: string[];
  groesse: string[];
  farbe: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateSingle(key: 'status' | 'mode', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete(key);
    else params.set(key, value);
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function updateMulti(key: 'kategorie' | 'groesse' | 'farbe', values: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length === 0) params.delete(key);
    else params.set(key, values.join(','));
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasAnyFilter = status !== 'all' || mode !== 'all' || kategorie.length > 0 || groesse.length > 0 || farbe.length > 0;

  return (
    // Auf Mobil ein sauberes 2-Spalten-Raster statt frei umbrechendem
    // Flex-Wrap: vorher rissen die 5 unterschiedlich breiten Filter die Zeilen
    // uneinheitlich um (2/2/1 mit Luecken) -- wirkte konfus statt geordnet.
    // Ab sm wieder die kompakte, an den Inhalt angepasste Zeile wie zuvor.
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
      <div className="w-full sm:w-40">
        <Select aria-label="Nach Status filtern" value={status} onChange={(e) => updateSingle('status', e.target.value)}>
          <option value="all">Alle Status</option>
          <option value="succeeded">Fertig</option>
          <option value="failed">Fehlgeschlagen</option>
          <option value="in_progress">In Bearbeitung</option>
        </Select>
      </div>
      <div className="w-full sm:w-40">
        <Select aria-label="Nach Modus filtern" value={mode} onChange={(e) => updateSingle('mode', e.target.value)}>
          <option value="all">Alle Modi</option>
          <option value="single">Einzeln</option>
          <option value="combined">Kombiniert</option>
        </Select>
      </div>

      <MultiSelect label="Kategorie" options={CATEGORY_OPTIONS} selected={kategorie} onChange={(v) => updateMulti('kategorie', v)} />
      <MultiSelect label="Größe" options={SIZE_OPTIONS} selected={groesse} onChange={(v) => updateMulti('groesse', v)} />
      {/* col-span-2 auf Mobil: bei 5 Filtern (ungerade Zahl) bliebe sonst
          neben "Farbe" eine halbe Zeile leer -- so nutzt das letzte Element
          die volle Breite. */}
      <MultiSelect
        label="Farbe"
        options={COLOR_OPTIONS}
        selected={farbe}
        onChange={(v) => updateMulti('farbe', v)}
        className="col-span-2 sm:col-span-1"
      />

      {hasAnyFilter && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="col-span-2 text-center text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink sm:col-span-1 sm:text-left"
        >
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}

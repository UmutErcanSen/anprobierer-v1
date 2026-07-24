'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Loader2, Star } from 'lucide-react';
import { CLOTHING_TYPES, SIZES, COLORS, COLOR_SWATCH } from '@/lib/generation/constants';

/*
  Filter fuer den Anproben-Verlauf. Aendert die URL-Query statt lokalen State
  zu halten -- so bleibt der Filter beim Neuladen, beim Teilen des Links und
  beim Zurueck-Navigieren erhalten, und die Liste selbst bleibt eine Server
  Component (keine Duplizierung der Datenabfrage im Client).

  Status/Modus sind Einzelauswahl (schliessen sich gegenseitig aus). Kategorie/
  Groesse/Farbe sind Mehrfachauswahl -- ein Nutzer will z.B. "Jeans ODER Kleid"
  gleichzeitig sehen, deshalb Checkboxen statt eines <select>.

  Status/Modus nutzen bewusst KEIN natives <select> mehr: das native
  Browser-Erscheinungsbild (Pfeil, Rahmen) passte optisch nicht zu den
  eigens gestalteten Kategorie/Groesse/Farbe-Dropdowns daneben. Ein
  details/summary-Menue mit denselben Klassen wie MultiSelect sorgt fuer ein
  einheitliches Bild ueber alle fuenf Filter hinweg.

  WICHTIG fuer die gefuehlte Reaktionsgeschwindigkeit: Ohne lokalen State
  haengt jede Checkbox/jeder Klick direkt am `selected`/`value`-Prop, das aus
  der URL kommt -- sichtbar wird eine Auswahl also erst, NACHDEM die
  Server-Navigation abgeschlossen ist (spuerbare Verzoegerung, "ruckelig").
  Jede Kontrolle fuehrt deshalb einen eigenen optimistischen State, der sich
  sofort beim Klick aendert; die eigentliche Navigation folgt debounced
  (Mehrfachauswahl) bzw. per useTransition (alles andere) im Hintergrund.
*/

const CATEGORY_OPTIONS = Object.entries(CLOTHING_TYPES).map(([value, { de }]) => ({ value, label: de }));
const SIZE_OPTIONS = SIZES.map((s) => ({ value: s, label: s }));
const COLOR_OPTIONS = COLORS.map((c) => ({ value: c, label: c, swatch: COLOR_SWATCH[c] }));

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle Status' },
  { value: 'succeeded', label: 'Fertig' },
  { value: 'failed', label: 'Fehlgeschlagen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
];
const MODE_OPTIONS = [
  { value: 'all', label: 'Alle Modi' },
  { value: 'single', label: 'Einzeln' },
  { value: 'combined', label: 'Kombiniert' },
];

type Option = { value: string; label: string; swatch?: string };

/** Gemeinsame useOutsideClick-Logik fuer beide Dropdown-Varianten unten. */
function useCloseOnOutsideClick(ref: React.RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [ref]);
}

/** Einzelauswahl im selben optischen Gewand wie MultiSelect -- ersetzt die
 * beiden nativen <select>-Elemente fuer Status und Modus. Eigener,
 * optimistischer State: die Markierung wechselt beim Klick sofort, nicht
 * erst wenn die Server-Navigation durch ist. */
function SingleSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useCloseOnOutsideClick(ref);

  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  const current = options.find((o) => o.value === local);
  const isDefault = local === 'all';

  function choose(v: string) {
    setLocal(v);
    onChange(v);
    if (ref.current) ref.current.open = false;
  }

  return (
    <details ref={ref} className="relative w-full sm:w-auto">
      <summary
        className={`flex h-11 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-lg border px-3.5 text-[15px] transition-colors [&::-webkit-details-marker]:hidden sm:w-40 ${
          isDefault ? 'border-line text-ink hover:border-line-strong' : 'border-ink text-ink'
        }`}
      >
        {current?.label ?? label}
        <ChevronDown size={14} className="text-muted" aria-hidden />
      </summary>

      <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-full min-w-48 overflow-hidden rounded-lg border border-line-strong bg-paper p-1 shadow-sm sm:w-48">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface ${
              opt.value === local ? 'font-medium text-ink' : 'text-ink-soft'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </details>
  );
}

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
  useCloseOnOutsideClick(ref);

  // Optimistischer lokaler State: eine Checkbox schaltet sofort um, auch
  // waehrend die (debouncte) Navigation noch unterwegs ist. Synct sich mit
  // der URL, sobald diese sich aendert (Filter zuruecksetzen, Browser-Zurueck).
  const [local, setLocal] = useState(selected);
  useEffect(() => setLocal(selected), [selected]);

  function toggle(value: string) {
    const next = local.includes(value) ? local.filter((v) => v !== value) : [...local, value];
    setLocal(next);
    onChange(next);
  }

  return (
    <details ref={ref} className={`relative w-full sm:w-auto ${className}`}>
      <summary
        className={`flex h-11 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-lg border px-3.5 text-[15px] transition-colors [&::-webkit-details-marker]:hidden sm:w-auto sm:justify-start ${
          local.length ? 'border-ink text-ink' : 'border-line text-ink hover:border-line-strong'
        }`}
      >
        <span className="flex items-center gap-2">
          {label}
          {local.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-xs font-medium text-on-ink">
              {local.length}
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
              checked={local.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="h-4 w-4 shrink-0 rounded border-line-strong accent-ink"
            />
            {/* Musterkreis in der jeweiligen Farbe -- macht die Liste auf
                einen Blick lesbar, statt nur Farbnamen aufzuzaehlen. Weiß
                bekommt durch den Rahmen trotzdem Kontur auf weissem Grund. */}
            {opt.swatch && (
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong"
                style={{ background: opt.swatch }}
                aria-hidden
              />
            )}
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
  favorit,
}: {
  status: string;
  mode: string;
  kategorie: string[];
  groesse: string[];
  farbe: string[];
  favorit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Mehrfachauswahl-Navigation wird debounced: bei einer Checkbox-Liste
  // klickt man oft mehrere Optionen kurz hintereinander an. Ohne Debounce
  // loest jeder einzelne Klick sofort eine eigene Server-Navigation aus, die
  // die vorherige noch laufende ueberholt -- das erzeugt genau das
  // "ruckelige" Gefuehl. Mit Debounce navigiert nur die LETZTE Auswahl.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(params: URLSearchParams) {
    params.delete('page');
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function updateSingle(key: 'status' | 'mode', value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete(key);
    else params.set(key, value);
    navigate(params);
  }

  function updateMulti(key: 'kategorie' | 'groesse' | 'farbe', values: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.length === 0) params.delete(key);
      else params.set(key, values.join(','));
      navigate(params);
    }, 350);
  }

  function toggleFavorit(next: boolean) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('favorit', '1');
    else params.delete('favorit');
    navigate(params);
  }

  const hasAnyFilter =
    status !== 'all' || mode !== 'all' || kategorie.length > 0 || groesse.length > 0 || farbe.length > 0 || favorit;

  return (
    // 6 Filter passen auf Mobil glatt in ein 2-Spalten-Raster (3 volle
    // Zeilen) -- vorher rissen unterschiedlich breite Elemente per
    // Flex-Wrap die Zeilen uneinheitlich um. Ab sm wieder die kompakte,
    // an den Inhalt angepasste Zeile.
    <div className="flex flex-wrap items-center gap-3">
      <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        <SingleSelect label="Alle Status" options={STATUS_OPTIONS} value={status} onChange={(v) => updateSingle('status', v)} />
        <SingleSelect label="Alle Modi" options={MODE_OPTIONS} value={mode} onChange={(v) => updateSingle('mode', v)} />

        <MultiSelect label="Kategorie" options={CATEGORY_OPTIONS} selected={kategorie} onChange={(v) => updateMulti('kategorie', v)} />
        <MultiSelect label="Größe" options={SIZE_OPTIONS} selected={groesse} onChange={(v) => updateMulti('groesse', v)} />
        <MultiSelect label="Farbe" options={COLOR_OPTIONS} selected={farbe} onChange={(v) => updateMulti('farbe', v)} />

        <button
          type="button"
          onClick={() => toggleFavorit(!favorit)}
          aria-pressed={favorit}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg border px-3.5 text-[15px] transition-colors sm:w-auto ${
            favorit ? 'border-ink text-ink' : 'border-line text-ink hover:border-line-strong'
          }`}
        >
          <Star size={15} fill={favorit ? 'currentColor' : 'none'} aria-hidden />
          Favoriten
        </button>

        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
            className="col-span-2 text-center text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink sm:col-span-1 sm:text-left"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Reserviert von Anfang an Platz (statt erst beim Erscheinen Layout zu
          verschieben) -- zeigt an, dass im Hintergrund noch eine Anfrage
          laeuft, waehrend die Bedienelemente selbst schon reagiert haben. */}
      <Loader2
        size={16}
        className={`shrink-0 animate-spin text-muted transition-opacity ${isPending ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden
      />
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, Star, X } from 'lucide-react';
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

      {/* static auf Mobil statt absolute: im Filter-Sheet ueberlappte das
          Panel sonst als Overlay die Buttons darunter (Favoriten, "Ergebnisse
          anzeigen") -- verrutscht und schwer bedienbar. Static reserviert
          echten Platz im ohnehin scrollbaren Sheet (Akkordeon-Verhalten).
          Ab sm (Desktop-Zeile mit viel Leerraum drumherum) bleibt es ein
          echtes Overlay wie zuvor. */}
      <div className="static mt-1.5 w-full min-w-48 overflow-hidden rounded-lg border border-line-strong bg-paper p-1 shadow-sm sm:absolute sm:left-0 sm:top-[calc(100%+6px)] sm:z-20 sm:mt-0 sm:w-48">
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

      {/* static auf Mobil, siehe SingleSelect oben fuer die Begruendung. */}
      <div className="static mt-1.5 max-h-60 w-full min-w-60 overflow-y-auto rounded-lg border border-line-strong bg-paper p-2 shadow-sm sm:absolute sm:left-0 sm:top-[calc(100%+6px)] sm:z-20 sm:mt-0 sm:max-h-72 sm:w-60">
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

/** Optimistischer lokaler State, synct sich mit einem von aussen kommenden
 * Wert (URL-Prop) -- dasselbe Prinzip wie in SingleSelect/MultiSelect oben,
 * hier als Hook, weil das Mobil-Drilldown unten GLEICH FUENF davon braucht
 * (Zeilen-Zusammenfassung UND Unterseite muessen beide sofort reagieren). */
function useOptimistic<T>(value: T) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return [local, setLocal] as const;
}

/** Eine Zeile in der obersten Mobil-Filter-Ebene: Name links, aktueller Wert
 * + Pfeil rechts -- tippen fuehrt zur Unterseite mit den eigentlichen
 * Optionen (siehe MobileOptionList/MobileCheckList). */
function FilterRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-between rounded-lg border border-line px-3.5 text-left text-[15px] text-ink transition-colors hover:border-line-strong"
    >
      {label}
      <span className="flex items-center gap-1.5 text-muted">
        <span className="max-w-[9.5rem] truncate text-sm">{value}</span>
        <ChevronRight size={15} aria-hidden />
      </span>
    </button>
  );
}

/** Unterseite fuer Einzelauswahl (Status/Modus) -- eine Wahl reicht, die
 * Auswahlfunktion selbst kehrt danach zur obersten Ebene zurueck (siehe
 * chooseSingle unten), hier nur die Liste. */
function MobileOptionList({ options, value, onSelect }: { options: Option[]; value: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`flex h-12 w-full items-center justify-between rounded-lg px-3.5 text-left text-[15px] transition-colors hover:bg-surface ${
            opt.value === value ? 'font-medium text-ink' : 'text-ink-soft'
          }`}
        >
          {opt.label}
          {opt.value === value && <Check size={16} className="text-ink" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

/** Unterseite fuer Mehrfachauswahl (Kategorie/Groesse/Farbe) -- bleibt offen,
 * bis der Nutzer selbst per Zurueck-Pfeil in der Kopfzeile zurueckgeht. */
function MobileCheckList({
  options,
  selected,
  onToggle,
}: {
  options: Option[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] text-ink hover:bg-surface"
        >
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => onToggle(opt.value)}
            className="h-4 w-4 shrink-0 rounded border-line-strong accent-ink"
          />
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
  );
}

type MobilePanel = 'status' | 'mode' | 'kategorie' | 'groesse' | 'farbe';
const PANEL_TITLE: Record<MobilePanel, string> = {
  status: 'Status',
  mode: 'Modus',
  kategorie: 'Kategorie',
  groesse: 'Größe',
  farbe: 'Farbe',
};

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

  const [sheetOpen, setSheetOpen] = useState(false);
  // Portal braucht `document` -- erst nach dem Client-Mount verfuegbar,
  // sonst wuerde createPortal(..., document.body) beim Server-Render
  // abstuerzen (siehe MobileNav fuer dasselbe Muster).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  // Welche Unterseite das Mobil-Sheet gerade zeigt (null = oberste Ebene mit
  // den sechs Filterzeilen). Eigener, von den Desktop-<details>-Instanzen
  // unabhaengiger optimistischer State (siehe useOptimistic oben) -- die
  // Zeilen-Zusammenfassung ("2 ausgewaehlt") muss genauso sofort reagieren
  // wie die Haekchen auf der Unterseite selbst.
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);
  const [mStatus, setMStatus] = useOptimistic(status);
  const [mMode, setMMode] = useOptimistic(mode);
  const [mKategorie, setMKategorie] = useOptimistic(kategorie);
  const [mGroesse, setMGroesse] = useOptimistic(groesse);
  const [mFarbe, setMFarbe] = useOptimistic(farbe);
  const [mFavorit, setMFavorit] = useOptimistic(favorit);

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

  // Mobil-Drilldown aendert NUR den Entwurf (m*-State) -- anders als die
  // Desktop-Dropdowns (updateSingle/updateMulti, wenden sofort an) greift
  // die Auswahl hier erst, wenn "Ergebnisse anzeigen"/"Neue Filter anwenden"
  // gedrueckt wird (siehe applyMobileFilters unten). Bei Status/Modus
  // (Einzelauswahl) kehrt eine Wahl trotzdem sofort zur obersten Ebene
  // zurueck -- das ist reine Navigation innerhalb des Sheets, keine
  // Anwendung der Filter.
  function chooseSingleMobile(key: 'status' | 'mode', value: string) {
    if (key === 'status') setMStatus(value);
    else setMMode(value);
    setMobilePanel(null);
  }

  function toggleKategorieMobile(value: string) {
    setMKategorie((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }
  function toggleGroesseMobile(value: string) {
    setMGroesse((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }
  function toggleFarbeMobile(value: string) {
    setMFarbe((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  /** Ob sich der Entwurf von den tatsaechlich aktiven Filtern unterscheidet --
   * steuert den Button-Text ("Ergebnisse anzeigen" vs. "Neue Filter
   * anwenden") ganz unten im Sheet. */
  function sameValues(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((v) => setB.has(v));
  }
  const hasPendingChanges =
    mStatus !== status ||
    mMode !== mode ||
    mFavorit !== favorit ||
    !sameValues(mKategorie, kategorie) ||
    !sameValues(mGroesse, groesse) ||
    !sameValues(mFarbe, farbe);

  /** Wendet den gesamten Entwurf in einem Schritt an -- kein Debounce noetig,
   * das ist bereits die explizite, einmalige Bestaetigung. */
  function applyMobileFilters() {
    if (hasPendingChanges) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      if (mStatus === 'all') params.delete('status');
      else params.set('status', mStatus);
      if (mMode === 'all') params.delete('mode');
      else params.set('mode', mMode);
      if (mKategorie.length === 0) params.delete('kategorie');
      else params.set('kategorie', mKategorie.join(','));
      if (mGroesse.length === 0) params.delete('groesse');
      else params.set('groesse', mGroesse.join(','));
      if (mFarbe.length === 0) params.delete('farbe');
      else params.set('farbe', mFarbe.join(','));
      if (mFavorit) params.set('favorit', '1');
      else params.delete('favorit');

      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }
    setSheetOpen(false);
    setMobilePanel(null);
  }

  /** Schliessen OHNE anzuwenden (X, Hintergrund-Tap) verwirft den Entwurf --
   * die tatsaechlich aktiven Filter aendern sich dabei nicht. */
  function closeSheet() {
    setSheetOpen(false);
    setMobilePanel(null);
    setMStatus(status);
    setMMode(mode);
    setMKategorie(kategorie);
    setMGroesse(groesse);
    setMFarbe(farbe);
    setMFavorit(favorit);
  }

  const hasAnyFilter =
    status !== 'all' || mode !== 'all' || kategorie.length > 0 || groesse.length > 0 || farbe.length > 0 || favorit;
  const activeCount =
    (status !== 'all' ? 1 : 0) +
    (mode !== 'all' ? 1 : 0) +
    kategorie.length +
    groesse.length +
    farbe.length +
    (favorit ? 1 : 0);

  const resetButton = hasAnyFilter && (
    <button
      type="button"
      onClick={() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        // Setzt auch den Mobil-Entwurf zurueck -- sonst wuerde "Ergebnisse
        // anzeigen" direkt danach die alten (noch nicht verworfenen)
        // Entwurfswerte wieder anwenden.
        setMStatus('all');
        setMMode('all');
        setMKategorie([]);
        setMGroesse([]);
        setMFarbe([]);
        setMFavorit(false);
        startTransition(() => router.replace(pathname, { scroll: false }));
      }}
      className="text-center text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
    >
      Filter zurücksetzen
    </button>
  );

  // Nur noch fuer die Desktop-Zeile (`hidden sm:flex`) -- das Mobil-Sheet
  // nutzt seit dem Drilldown-Umbau eigene, flach gerenderte Listen
  // (FilterRow/MobileOptionList/MobileCheckList), keine <details>-Dropdowns
  // mehr (die brauchten auf Mobil sonst eine eigene, verschachtelte
  // Scrollbar innerhalb des ohnehin scrollenden Sheets).
  const filterControls = (
    <>
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
    </>
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Desktop: Zeile wie bisher. */}
      <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        {filterControls}
        {resetButton}
      </div>

      {/* Mobil: ein einzelner Button oeffnet ein Sheet mit allen Filtern,
          statt sechs Dropdowns nebeneinander/uebereinander zu zeigen. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-[15px] text-ink transition-colors hover:border-line-strong sm:hidden"
      >
        <SlidersHorizontal size={16} aria-hidden />
        Filter
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-xs font-medium text-on-ink">
            {activeCount}
          </span>
        )}
      </button>

      {/* Reserviert von Anfang an Platz (statt erst beim Erscheinen Layout zu
          verschieben) -- zeigt an, dass im Hintergrund noch eine Anfrage
          laeuft, waehrend die Bedienelemente selbst schon reagiert haben. */}
      <Loader2
        size={16}
        className={`shrink-0 animate-spin text-muted transition-opacity ${isPending ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden
      />

      {/* Sheet bleibt nach dem ersten Oeffnen dauerhaft im DOM (nur per
          Transform ausserhalb des Bildschirms) -- das ermoeglicht die
          Slide-Animation, genau wie beim Burger-Menue (MobileNav). */}
      {/* `inert` auf dem AEUSSEREN Wrapper, nicht nur auf dem Panel: dieser
          Wrapper ist "fixed inset-0" (deckt den ganzen Bildschirm ab) und
          blieb bisher auch geschlossen im DOM stehen, OHNE pointer-events
          zu verlieren -- eine unsichtbare Ebene ueber der kompletten Seite
          machte dadurch jeden Klick/Tap wirkungslos, sobald das Sheet
          einmal gemountet war (praktisch immer, sofort nach dem Laden).
          `inert` nimmt dem ganzen Wrapper Fokus UND Zeigerereignisse ab,
          wenn geschlossen. */}
      {mounted &&
        createPortal(
          <div className="fixed inset-0 z-[100] sm:hidden" inert={!sheetOpen}>
            <div
              className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
                sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              onClick={closeSheet}
            />
            {/* Feste Hoehe statt mitwachsendem Inhalt: vorher wurde das Sheet
                beim Aufklappen einer Options-Liste selbst groesser und rutschte
                sichtbar nach oben -- wenig elegant, und die Liste bekam
                zusaetzlich ihre eigene verschachtelte Scrollbar. Jetzt ist die
                Hoehe fix, Ober- und Unterebene teilen sich EINEN Scrollbereich
                (siehe "relative flex-1 overflow-hidden" unten) und schieben
                sich nur noch seitlich uebereinander (Drilldown-Muster:
                Filterliste -> Optionsseite -> per Pfeil zurueck). */}
            <div
              className={`absolute inset-x-0 bottom-0 flex h-[min(75vh,34rem)] flex-col rounded-t-2xl border-t border-line bg-paper shadow-lg transition-transform duration-300 ease-out ${
                sheetOpen ? 'translate-y-0' : 'translate-y-full'
              }`}
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                {mobilePanel ? (
                  <button
                    type="button"
                    onClick={() => setMobilePanel(null)}
                    className="-ml-1.5 flex items-center gap-1 rounded-full py-1 pl-1.5 pr-3 text-sm font-medium text-ink transition-colors hover:bg-surface"
                  >
                    <ChevronLeft size={17} aria-hidden />
                    {PANEL_TITLE[mobilePanel]}
                  </button>
                ) : (
                  <span className="text-sm font-medium text-ink">Filter</span>
                )}
                <button
                  type="button"
                  onClick={closeSheet}
                  aria-label="Filter schließen"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>

              <div className="relative flex-1 overflow-hidden">
                {/* Oberste Ebene: die sechs Filterzeilen. */}
                <div
                  inert={mobilePanel !== null}
                  className={`absolute inset-0 overflow-y-auto p-5 transition-transform duration-300 ease-out ${
                    mobilePanel ? '-translate-x-full' : 'translate-x-0'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <FilterRow
                      label="Status"
                      value={STATUS_OPTIONS.find((o) => o.value === mStatus)?.label ?? 'Alle Status'}
                      onClick={() => setMobilePanel('status')}
                    />
                    <FilterRow
                      label="Modus"
                      value={MODE_OPTIONS.find((o) => o.value === mMode)?.label ?? 'Alle Modi'}
                      onClick={() => setMobilePanel('mode')}
                    />
                    <FilterRow
                      label="Kategorie"
                      value={mKategorie.length ? `${mKategorie.length} ausgewählt` : 'Alle'}
                      onClick={() => setMobilePanel('kategorie')}
                    />
                    <FilterRow
                      label="Größe"
                      value={mGroesse.length ? `${mGroesse.length} ausgewählt` : 'Alle'}
                      onClick={() => setMobilePanel('groesse')}
                    />
                    <FilterRow
                      label="Farbe"
                      value={mFarbe.length ? `${mFarbe.length} ausgewählt` : 'Alle'}
                      onClick={() => setMobilePanel('farbe')}
                    />
                    <button
                      type="button"
                      onClick={() => setMFavorit((v) => !v)}
                      aria-pressed={mFavorit}
                      className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg border px-3.5 text-[15px] transition-colors ${
                        mFavorit ? 'border-ink text-ink' : 'border-line text-ink hover:border-line-strong'
                      }`}
                    >
                      <Star size={15} fill={mFavorit ? 'currentColor' : 'none'} aria-hidden />
                      Favoriten
                    </button>
                    {resetButton && <div className="mt-1 text-center">{resetButton}</div>}
                  </div>
                </div>

                {/* Unterebene: die Optionen des gerade gewaehlten Filters. */}
                <div
                  inert={mobilePanel === null}
                  className={`absolute inset-0 overflow-y-auto p-5 transition-transform duration-300 ease-out ${
                    mobilePanel ? 'translate-x-0' : 'translate-x-full'
                  }`}
                >
                  {mobilePanel === 'status' && (
                    <MobileOptionList options={STATUS_OPTIONS} value={mStatus} onSelect={(v) => chooseSingleMobile('status', v)} />
                  )}
                  {mobilePanel === 'mode' && (
                    <MobileOptionList options={MODE_OPTIONS} value={mMode} onSelect={(v) => chooseSingleMobile('mode', v)} />
                  )}
                  {mobilePanel === 'kategorie' && (
                    <MobileCheckList options={CATEGORY_OPTIONS} selected={mKategorie} onToggle={toggleKategorieMobile} />
                  )}
                  {mobilePanel === 'groesse' && (
                    <MobileCheckList options={SIZE_OPTIONS} selected={mGroesse} onToggle={toggleGroesseMobile} />
                  )}
                  {mobilePanel === 'farbe' && (
                    <MobileCheckList options={COLOR_OPTIONS} selected={mFarbe} onToggle={toggleFarbeMobile} />
                  )}
                </div>
              </div>

              <div className="border-t border-line p-5">
                {/* Bewusst applyMobileFilters statt closeSheet: nur dieser
                    Knopf wendet den Entwurf tatsaechlich an. X/Hintergrund
                    schliessen ohne Anwenden (siehe closeSheet). Der Text
                    macht sichtbar, ob es ueberhaupt etwas anzuwenden gibt. */}
                <button
                  type="button"
                  onClick={applyMobileFilters}
                  className="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-ink transition-opacity hover:opacity-90"
                >
                  {hasPendingChanges ? 'Neue Filter anwenden' : 'Ergebnisse anzeigen'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

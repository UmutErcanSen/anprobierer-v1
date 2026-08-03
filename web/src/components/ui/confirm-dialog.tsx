'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/*
  Generisches Bestaetigungs-Modal fuer destruktive, nicht umkehrbare
  Aktionen (Anprobe(n) loeschen, Konto loeschen).

  Bewusst ein echtes Overlay ueber der GANZEN Seite statt einer Inline-
  Bestaetigung direkt am Ausloeser: bei einer unwiderruflichen Aktion soll
  die Unterbrechung deutlich spuerbar sein, nicht nebenbei in einer kleinen
  Karten-Ecke passieren.

  Portal an document.body (gleiches Muster wie MobileNav/HistoryFilters):
  Header und Karten haben teils `backdrop-blur`/`relative`, was fuer
  `position: fixed`-Nachkommen zum eigenen Containing Block wuerde --
  ohne Portal waere das Overlay nicht am Bildschirm, sondern nur an einem
  Vorfahren-Element fixiert. `inert` auf dem AEUSSEREN Wrapper (nicht nur
  dem sichtbaren Dialog) verhindert, dass das unsichtbare, aber weiterhin
  im DOM stehende Overlay Klicks auf der restlichen Seite blockiert, wenn
  es geschlossen ist -- genau der Fehler, der im Filter-Sheet schon einmal
  auftrat.

  `confirmWord`: optionale zusaetzliche Huerde fuer die schwerwiegendsten
  Aktionen (aktuell nur Konto loeschen) -- der Bestaetigen-Knopf bleibt
  deaktiviert, bis das exakte Wort eingetippt wurde. Bewusst NICHT fuer
  jede Loeschung (z.B. eine einzelne Anprobe): dort waere es reine
  Reibung ohne echten Zusatznutzen, bei einer Kontoloeschung dagegen eine
  angemessene zweite Huerde.
*/
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  onConfirm,
  onCancel,
  variant = 'accent',
  confirmWord,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** 'danger' fuer die eine wirklich unwiderrufliche Aktion (Konto loeschen) -- siehe --danger in globals.css. */
  variant?: 'accent' | 'danger';
  confirmWord?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [eingabe, setEingabe] = useState('');
  // Eingabe zuruecksetzen, wenn der Dialog erneut geoeffnet wird -- sonst
  // bliebe ein zweiter Aufruf (z.B. nach einem fehlgeschlagenen ersten
  // Versuch) faelschlich schon bestaetigt.
  useEffect(() => {
    if (open) setEingabe('');
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!mounted) return null;

  const gesperrt = Boolean(confirmWord) && eingabe.trim().toUpperCase() !== confirmWord!.toUpperCase();

  // WICHTIG: stopPropagation auf jedem Klick hier drin. React portalt das
  // DOM-Element zwar an document.body, bubbelt synthetische Events aber
  // ueber den REACT-Baum (nicht den DOM-Baum) -- der liegt hier weiterhin
  // innerhalb eines <Link> (Karten-Raster), da ConfirmDialog dort als Kind
  // von DeleteCardButton gerendert wird. Ohne stopPropagation loeste ein
  // Klick auf "Abbrechen"/"Ja, loeschen" trotz Portal die Link-Navigation
  // aus (per Next.js' internem Klick-Handler auf dem <a>).
  return createPortal(
    <div
      inert={!open}
      className={`fixed inset-0 z-[200] flex items-center justify-center p-6 transition-opacity duration-200 ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-xl border border-line bg-paper p-6 shadow-lg"
      >
        <h2 className="text-lg font-medium text-ink">{title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{description}</p>

        {confirmWord && (
          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor="confirm-word" className="text-xs text-muted">
              Gib <span className="font-medium text-ink">{confirmWord}</span> ein, um zu bestätigen
            </label>
            <input
              id="confirm-word"
              type="text"
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="h-10 rounded-lg border border-line-strong bg-paper px-3 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-accent">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={pending}
            className="rounded-full border border-line-strong px-4 py-2.5 text-sm text-ink transition-colors hover:bg-surface disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            disabled={pending || gesperrt}
            className={`rounded-full px-4 py-2.5 text-sm font-medium text-on-ink transition-opacity hover:opacity-90 disabled:opacity-50 ${
              variant === 'danger' ? 'bg-danger' : 'bg-accent'
            }`}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

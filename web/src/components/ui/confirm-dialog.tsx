'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/*
  Generisches Bestaetigungs-Modal fuer destruktive, nicht umkehrbare
  Aktionen (aktuell: Anprobe loeschen, sowohl aus dem Karten-Raster als auch
  von der Detailseite -- siehe DeleteCardButton/DeleteGenerationButton).

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
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
            disabled={pending}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

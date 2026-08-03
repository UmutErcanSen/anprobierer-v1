'use client';

import { useRef, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';

/*
  Kleines Erklaer-Modal fuer reinen Text-/Listeninhalt -- dasselbe
  <dialog>-Geruest wie TipModal (Fokus-Trapping, Escape, Backdrop kommen vom
  Browser), aber ohne dessen Bild-Gegenueberstellung. Fuer Faelle wie "wie
  genau werden meine Daten gespeichert", wo eine Erklaerung noetig ist, aber
  kein Vorher/Nachher-Vergleich.
*/
export function InfoModal({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => ref.current?.showModal()}
        className="inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
      >
        <Info size={14} aria-hidden />
      </button>

      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        // fixed inset-0 m-auto zentriert das Dialogfeld explizit -- Tailwinds
        // globaler margin:0-Reset hebelt sonst die native <dialog>-Zentrierung
        // aus (siehe TipModal fuer denselben Kommentar).
        className="fixed inset-0 m-auto h-fit w-[min(480px,92vw)] max-h-[85vh] overflow-y-auto rounded-2xl border border-line bg-paper p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-medium tracking-tight text-ink">{title}</h3>
            <button
              type="button"
              aria-label="Schließen"
              onClick={() => ref.current?.close()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-soft">{children}</div>
        </div>
      </dialog>
    </>
  );
}

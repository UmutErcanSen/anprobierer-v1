'use client';

import { useRef } from 'react';
import { Check, Info, X } from 'lucide-react';

/*
  Bild-gestuetztes Tipp-Modal: ein gutes und ein schlechtes Beispielfoto samt
  Stichpunkten, damit Nutzer vorab wissen, was ein brauchbares Foto ausmacht --
  statt sich hinterher ueber ein enttaeuschendes Ergebnis zu wundern.

  Auf dem nativen <dialog>-Element aufgebaut: Fokus-Trapping, Escape-zum-
  Schliessen und das Backdrop kommen vom Browser, kein eigenes JS dafuer noetig.
*/

type Example = { src: string; alt: string; points: string[] };

export function TipModal({
  label,
  title,
  intro,
  good,
  bad,
}: {
  label: string;
  title: string;
  intro: string;
  good: Example;
  bad: Example;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => ref.current?.showModal()}
        className="inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border border-line-strong text-muted transition-colors hover:border-ink hover:text-ink"
      >
        <Info size={11} aria-hidden />
      </button>

      <dialog
        ref={ref}
        // Klick auf das Backdrop (also direkt auf <dialog>, nicht auf den
        // inneren Inhalt) schliesst das Modal.
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        // fixed inset-0 m-auto zentriert das Dialogfeld explizit: Tailwinds
        // globaler margin:0-Reset (Preflight) hebelt sonst die native
        // Zentrierung von <dialog> aus, die im Browser eigentlich auf
        // margin:auto beruht -- ohne das haengt das Modal oben links.
        className="fixed inset-0 m-auto h-fit w-[min(640px,92vw)] max-h-[85vh] overflow-y-auto rounded-2xl border border-line bg-paper p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-5 p-6">
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

          <p className="text-sm text-muted">{intro}</p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { ...good, ok: true },
              { ...bad, ok: false },
            ].map((ex) => (
              <figure key={ex.alt} className="flex flex-col gap-2">
                <div className="overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ex.src} alt={ex.alt} className="aspect-[3/4] w-full object-cover" />
                </div>
                <figcaption
                  className={`flex items-center gap-1.5 text-xs font-medium ${ex.ok ? 'text-success' : 'text-accent'}`}
                >
                  {ex.ok ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
                  {ex.ok ? 'Gutes Beispiel' : 'Schlechtes Beispiel'}
                </figcaption>
                <ul className="flex flex-col gap-1 text-xs text-ink-soft">
                  {ex.points.map((p) => (
                    <li key={p}>· {p}</li>
                  ))}
                </ul>
              </figure>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}

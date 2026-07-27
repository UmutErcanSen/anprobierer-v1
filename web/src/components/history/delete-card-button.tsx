'use client';

import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

/*
  Kompakte Lösch-Variante fürs Karten-Raster (Verlauf/Konto) -- die Karte
  selbst ist ein <Link>, deshalb stoppt jeder Klick hier die Weiterleitung
  per preventDefault/stopPropagation (gleiches Muster wie FavoriteToggle).
  Die Bestätigung erscheint als Overlay ÜBER dem Thumbnail (dessen Eltern-Div
  bereits `relative` ist), statt einer eigenen Detailseiten-Bestätigung --
  auf der Karte ist dafür kein Platz.
*/
export function DeleteCardButton({ generationId }: { generationId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  function stop(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDelete(e: MouseEvent) {
    stop(e);
    setDeleting(true);
    try {
      const res = await fetch(`/api/generate/${generationId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
        return;
      }
    } catch {
      // Netzwerkfehler -- unten einfach zurueck in den unbestaetigten Zustand.
    }
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setConfirming(true);
        }}
        aria-label="Anprobe löschen"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-ink transition-colors hover:bg-paper hover:text-accent"
      >
        <Trash2 size={13} aria-hidden />
      </button>

      {confirming && (
        <div
          role="alertdialog"
          aria-label="Löschen bestätigen"
          onClick={stop}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-paper/97 p-4 text-center"
        >
          <p className="text-xs text-ink-soft">Unwiderruflich löschen — Bild(er) und Text sind danach weg.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? 'Löscht …' : 'Löschen'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setConfirming(false);
              }}
              disabled={deleting}
              className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink transition-colors hover:bg-surface disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  );
}

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
      {/* Selbst positioniert (nicht ueber einen externen Wrapper) -- direkt
          unter dem Favoriten-Stern, im selben "relative"-Bildcontainer wie
          dieser. Bewusst KEIN eigener positionierter Wrapper drumherum: der
          waere sonst selbst der "containing block" fuer das Bestaetigungs-
          Overlay unten (siehe Kommentar in history-card.tsx). */}
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setConfirming(true);
        }}
        aria-label="Anprobe löschen"
        className="absolute right-2 top-11 flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-ink transition-colors hover:bg-paper hover:text-accent"
      >
        <Trash2 size={13} aria-hidden />
      </button>

      {confirming && (
        // Kompakt statt der ausfuehrlichen Detailseiten-Formulierung: Karten
        // im Raster sind auf Mobil oft nur ~150px breit (2-Spalten-Grid) --
        // der lange Erklaerungssatz plus zwei nebeneinander liegende Buttons
        // passten dort nicht und wurden vom `overflow-hidden` der Karte
        // abgeschnitten. Kurzer Text + gestapelte, volle Breite nutzende
        // Buttons statt einer Nebeneinander-Reihe.
        <div
          role="alertdialog"
          aria-label="Löschen bestätigen"
          onClick={stop}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-paper/97 p-3 text-center"
        >
          <p className="text-[11px] leading-snug text-ink-soft">Anprobe unwiderruflich löschen?</p>
          <div className="flex w-full flex-col gap-1.5 px-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full rounded-full bg-accent px-2 py-1.5 text-[11px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
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
              className="w-full rounded-full border border-line-strong px-2 py-1.5 text-[11px] text-ink transition-colors hover:bg-surface disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  );
}

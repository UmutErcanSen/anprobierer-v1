'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/*
  Anprobe endgueltig loeschen -- ein destruktiver, nicht umkehrbarer Vorgang
  (Bilder werden aus Storage entfernt, siehe DELETE /api/generate/[id])
  braucht eine bewusste Bestaetigung als eigenes Modal (ConfirmDialog),
  kein window.confirm() (auf Mobil haeufig unauffaellig/uebersehen) und
  keine Inline-Bestaetigung an Ort und Stelle -- ein echtes Overlay macht
  die Unwiderruflichkeit deutlicher spuerbar.
*/
export function DeleteGenerationButton({ generationId }: { generationId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/generate/${generationId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Löschen fehlgeschlagen.');
        setDeleting(false);
        return;
      }
      // Hier besonders wichtig: Diese Aktion wechselt zusaetzlich die Seite.
      // Ohne Meldung landet man unvermittelt in der Liste und muss selbst
      // pruefen, ob das Loeschen ueberhaupt geklappt hat.
      toast.success('Anprobe gelöscht.');
      router.push('/konto/verlauf');
      router.refresh();
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        /*
          Umrandet in --danger statt grau mit Terrakotta-Hover.

          Zwei Fehler steckten darin: Die Aktion sah unwichtiger aus als
          "Alle Anproben loeschen" (das laengst --danger nutzt), und der
          Hover faerbte sie in die MARKENfarbe -- ausgerechnet fuer etwas
          Unwiderrufliches.

          Umrandet und nicht gefuellt, obwohl das Designsystem fuer --danger
          eigentlich eine Vollflaeche vorsieht: Dieser Knopf loest die
          Loeschung nicht aus, er oeffnet nur die Rueckfrage. Erst deren
          Bestaetigung ist gefuellt. Aus Umriss wird beim Hover Flaeche, und
          im Dialog bleibt sie es -- eine Steigerung statt zweier gleich
          lauter Knoepfe hintereinander.
        */
        className="inline-flex items-center gap-2 rounded-full border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition-colors hover:border-danger hover:bg-danger hover:text-on-ink"
      >
        <Trash2 size={14} aria-hidden /> Anprobe löschen
      </button>

      <ConfirmDialog
        open={confirming}
        title="Anprobe löschen?"
        description="Diese Anprobe wird unwiderruflich gelöscht — Bild(er) und Verkaufstext lassen sich danach nicht wiederherstellen."
        confirmLabel="Ja, endgültig löschen"
        pendingLabel="Wird gelöscht …"
        pending={deleting}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

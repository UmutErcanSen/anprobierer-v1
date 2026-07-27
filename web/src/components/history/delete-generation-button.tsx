'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
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
        className="flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 transition-colors hover:text-accent"
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

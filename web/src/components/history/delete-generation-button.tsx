'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

/*
  Anprobe endgueltig loeschen -- zweistufig statt eines einzelnen Klicks:
  ein destruktiver, nicht umkehrbarer Vorgang (Bilder werden aus Storage
  entfernt, siehe DELETE /api/generate/[id]) braucht eine bewusste
  Bestaetigung, kein window.confirm() (auf Mobil haeufig unauffaellig/
  uebersehen, und passt optisch nicht ins restliche Design).
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

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
        <p className="text-ink-soft">
          Diese Anprobe wird <strong className="font-medium text-ink">unwiderruflich</strong> gelöscht — Bild(er)
          und Verkaufstext lassen sich danach nicht wiederherstellen.
        </p>
        {error && (
          <p role="alert" className="text-accent">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? 'Wird gelöscht …' : 'Ja, endgültig löschen'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink transition-colors hover:bg-surface disabled:opacity-50"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 transition-colors hover:text-accent"
    >
      <Trash2 size={14} aria-hidden /> Anprobe löschen
    </button>
  );
}

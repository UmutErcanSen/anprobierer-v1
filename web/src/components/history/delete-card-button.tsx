'use client';

import { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSelection } from '@/components/history/selection';

/*
  Kompakte Lösch-Variante fürs Karten-Raster (Verlauf/Konto) -- die Karte ist
  ausserhalb des Auswahlmodus ein <Link>, deshalb stoppt der Klick auf den
  Papierkorb per preventDefault/stopPropagation die Weiterleitung (gleiches
  Muster wie FavoriteToggle). Die eigentliche Bestätigung läuft über das
  gemeinsame ConfirmDialog-Modal (siehe dort) statt einer Inline-Bestätigung
  in der Karte -- bei einer unwiderruflichen Aktion soll die Unterbrechung
  deutlich spürbar sein, nicht nebenbei in einer Karten-Ecke passieren.
*/
export function DeleteCardButton({ generationId }: { generationId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const auswahl = useSelection();

  // Im Auswahlmodus ist die ganze Karte selbst ein <button> (SelectableCard)
  // -- siehe FavoriteToggle fuer denselben Grund (ungueltiges verschachteltes
  // <button>, zweites konkurrierendes Klickziel). Das Loeschen mehrerer
  // Anproben laeuft in diesem Modus ohnehin gebuendelt ueber die Aktionsleiste.
  if (auswahl?.aktiv) return null;

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
      router.refresh();
      setConfirming(false);
      setDeleting(false);
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
        aria-label="Anprobe löschen"
        className="absolute right-2 top-11 flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-ink transition-colors hover:bg-paper hover:text-accent"
      >
        <Trash2 size={13} aria-hidden />
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/*
  Loescht WIRKLICH ALLE Anproben -- nicht nur die auf der aktuellen Seite.
  Der Verlauf ist paginiert (12 pro Seite, siehe verlauf/page.tsx); die
  normale Mehrfachauswahl (history/selection.tsx) kann deshalb immer nur
  markieren, was gerade sichtbar ist. Diese Aktion ruft stattdessen DELETE
  /api/generate auf, das serverseitig ALLE eigenen Generierungen loescht,
  unabhaengig von Seite oder aktivem Filter.

  Bewusst eine eigene, kleine Komponente statt Teil von HistorySelection:
  Diese Aktion braucht KEINEN Auswahlmodus -- "alles" ist bereits die
  vollstaendige Auswahl, ein Umweg ueber "erst auswaehlen" waere hier nur
  Reibung. confirmWord wie bei der Kontoloeschung: die groesste denkbare
  Blast-Radius-Aktion im Verlauf verdient dieselbe zweite Huerde.
*/
export function DeleteAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/generate', { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Die Anproben konnten nicht gelöscht werden.');
        setDeleting(false);
        return;
      }
      setConfirming(false);
      setDeleting(false);
      toast.success('Alle Anproben wurden gelöscht.');
      router.push('/konto/verlauf');
      router.refresh();
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Bewusst zurueckhaltend (Textlink, kein gefuellter Button) -- anders
          als "Konto endgueltig loeschen" ist das hier keine primaere
          Kontoeinstellung, sondern eine seltene Aufraeum-Aktion, die neben
          den Filtern/der Primaeraktion nicht um Aufmerksamkeit konkurrieren
          soll. text-danger statt text-accent: dieselbe eigene Rotfarbe wie
          die Kontoloeschung, damit "unwiderruflich und folgenschwer" auf den
          ersten Blick erkennbar ist. */}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 whitespace-nowrap text-sm text-danger underline underline-offset-4 transition-colors hover:opacity-80"
      >
        <Trash2 size={14} aria-hidden />
        Alle Anproben löschen
      </button>

      <ConfirmDialog
        open={confirming}
        variant="danger"
        title="Wirklich alle Anproben löschen?"
        description={`Das betrifft ALLE ${count} deiner Anproben -- auch die, die hinter der Seitennavigation oder einem aktiven Filter nicht sichtbar sind. Bilder und Verkaufstexte lassen sich danach nicht wiederherstellen. Laufende Generierungen werden nicht angetastet.`}
        confirmWord="LÖSCHEN"
        confirmLabel="Ja, alle endgültig löschen"
        pendingLabel="Wird gelöscht …"
        pending={deleting}
        error={error}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/*
  Konto endgueltig loeschen (DSGVO Art. 17). Der erklaerende Warntext dazu
  steht bewusst NICHT hier, sondern immer sichtbar auf der Seite selbst
  (konto/page.tsx) -- diese Komponente uebernimmt nur Klick/Bestaetigung/
  API-Aufruf. Die Bestaetigung im Dialog wiederholt die Konsequenzen trotzdem
  in Kurzform, als letzte Huerde vor dem unwiderruflichen Schritt.

  window.location.href statt router.push: nach der Loeschung existiert die
  Sitzung nicht mehr, ein voller Seiten-Neuladen stellt sicher, dass wirklich
  ueberall (Header, gecachte Server-Komponenten) der ausgeloggte Zustand
  ankommt statt eines potenziell noch "eingeloggt" wirkenden Router-Caches.
*/
export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Das Konto konnte nicht gelöscht werden.');
        setDeleting(false);
        return;
      }
      window.location.href = '/?konto=geloescht';
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setDeleting(false);
    }
  }

  return (
    <>
      {/* border-danger statt border-accent: eine eigene, gedaempfte Rotfarbe
          nur fuer diese eine wirklich unwiderrufliche Aktion -- sonst liesse
          sich der normale Terrakotta-Markenakzent nicht mehr von "hier droht
          Datenverlust" unterscheiden (siehe --danger in globals.css). */}
      <Button
        variant="outline"
        size="md"
        onClick={() => setConfirming(true)}
        className="border-danger/40 text-danger hover:bg-danger/5"
      >
        <Trash2 size={15} aria-hidden />
        Konto endgültig löschen
      </Button>

      <ConfirmDialog
        open={confirming}
        title="Konto wirklich endgültig löschen?"
        description="Das lässt sich nicht rückgängig machen: Ein laufendes Abo wird sofort gekündigt, alle Anprobebilder, Verkaufstexte und dein Guthaben-Verlauf werden unwiderruflich gelöscht. Es gibt danach keine Wiederherstellung."
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

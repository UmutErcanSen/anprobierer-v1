'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useSelection } from '@/components/history/selection';

/*
  Favorit-Umschalter direkt vom Client aus -- keine eigene API-Route noetig:
  is_favorite ist rein kosmetisch (kein Geldwert), die Migration erlaubt dem
  Client per Spaltenrecht ausschliesslich diese eine Spalte zu aendern (siehe
  20260725090000_favorites.sql), RLS stellt sicher, dass nur die eigene Zeile
  betroffen ist.

  Liegt auf der Bild-Karte, die ausserhalb des Auswahlmodus ein <Link> ist
  (siehe HistoryCard) -- deshalb stopPropagation/preventDefault, sonst wuerde
  ein Klick auf den Stern zusaetzlich zur Detailseite navigieren.
*/
export function FavoriteToggle({ generationId, initialFavorite }: { generationId: string; initialFavorite: boolean }) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, setPending] = useState(false);
  const auswahl = useSelection();

  // Im Auswahlmodus ist die ganze Karte selbst ein <button> (SelectableCard)
  // -- ein verschachtelter <button> hier waere ungueltiges HTML UND ein
  // zweites, mit der Kartenflaeche konkurrierendes Klickziel (genau das
  // Problem, das die Auswahl ueberhaupt erst umgebaut hat).
  if (auswahl?.aktiv) return null;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    const next = !favorite;
    setFavorite(next); // optimistisch -- fuehlt sich sofort reaktionsfaehig an
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.from('generations').update({ is_favorite: next }).eq('id', generationId);
    if (error) {
      // Zuruecksetzen allein reichte nicht: Der Stern sprang wortlos in den
      // alten Zustand zurueck: aus Nutzersicht nicht von einem verschluckten
      // Klick zu unterscheiden. Ein Fehlversuch braucht eine Erklaerung,
      // gerade weil die Anzeige vorher optimistisch schon umgesprungen war.
      setFavorite(!next);
      toast.error('Der Favorit konnte nicht gespeichert werden.');
    }
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={favorite ? 'Von Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      aria-pressed={favorite}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-ink transition-colors hover:bg-paper"
    >
      <Star size={14} fill={favorite ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}

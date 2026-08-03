'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Download, ListChecks, Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { downloadZip, type ResultCard } from '@/components/generation/result-view';

/*
  Mehrfachauswahl im Verlauf — eine Auswahl, zwei Aktionen: löschen und als
  ZIP herunterladen.

  Aufbau: Die Karten bleiben Server-Komponenten (sie rendern serverseitig
  signierte Thumbnail-URLs). Nur die Auswahl selbst ist Client-Zustand, den
  eine kleine Kontext-Insel bereitstellt. Deshalb Kontext statt Props: Die
  Karten liegen als `children` in diesem Provider, durchgereichte Props wären
  über die Server/Client-Grenze hinweg nicht möglich.

  Frueher navigierten die Karten im Auswahlmodus weiter wie sonst auch (ein
  <Link>), und ein kleines Kaestchen in der Ecke fing seinen eigenen Klick per
  stopPropagation ab -- zwei UEBERLAPPENDE Klickziele auf derselben Flaeche.
  Genau das fuehrte zu Fehlklicks (ausversehen in die Anprobe statt in die
  Auswahl). Jetzt gibt es im Auswahlmodus nur noch EIN Klickziel: die ganze
  Karte wird zum Auswahl-Knopf (SelectableCard unten), das Kaestchen ist nur
  noch eine rein visuelle Anzeige des Zustands, kein zweites Ziel mehr.
*/

type SelectionContext = {
  aktiv: boolean;
  ausgewaehlt: Set<string>;
  umschalten: (id: string) => void;
};

const Ctx = createContext<SelectionContext | null>(null);

export function useSelection() {
  return useContext(Ctx);
}

/**
 * Ersetzt im Auswahlmodus das <Link> der Karte durch einen Auswahl-Knopf,
 * der die komplette Karte einnimmt -- ausserhalb des Auswahlmodus (oder ohne
 * umgebenden HistorySelection-Provider, z.B. auf /konto) unveraendert ein
 * ganz normales <Link>. `children` ist der bestehende Karteninhalt
 * (Bild + Metadaten), unveraendert von HistoryCard uebernommen.
 */
export function SelectableCard({ id, href, children }: { id: string; href: string; children: ReactNode }) {
  const auswahl = useSelection();
  const aktiv = auswahl?.aktiv ?? false;
  const gewaehlt = auswahl?.ausgewaehlt.has(id) ?? false;

  const rahmen = gewaehlt ? 'border-accent' : 'border-line hover:border-line-strong';

  if (aktiv) {
    return (
      <button
        type="button"
        onClick={() => auswahl!.umschalten(id)}
        aria-pressed={gewaehlt}
        aria-label={gewaehlt ? 'Auswahl aufheben' : 'Auswählen'}
        className={`group flex w-full flex-col overflow-hidden rounded-xl border text-left transition-colors ${rahmen}`}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={`group flex flex-col overflow-hidden rounded-xl border transition-colors ${rahmen}`}>
      {children}
    </Link>
  );
}

/**
 * Rein visuelle Markierung im Bildbereich der Karte -- rendert nichts,
 * solange der Auswahlmodus aus ist, und hat selbst KEINEN eigenen
 * Klick-Handler mehr (siehe SelectableCard oben: die ganze Karte ist jetzt
 * das Klickziel, dieses Element zeigt nur noch den Zustand an).
 */
export function SelectionMark({ generationId }: { generationId: string }) {
  const auswahl = useSelection();
  if (!auswahl?.aktiv) return null;

  const gewaehlt = auswahl.ausgewaehlt.has(generationId);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 flex items-start justify-end p-2.5 transition-colors ${
        gewaehlt ? 'bg-ink/30' : 'bg-ink/0 group-hover:bg-ink/10'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
          gewaehlt ? 'border-accent bg-accent text-on-ink' : 'border-line-strong bg-paper/90 text-muted'
        }`}
      >
        {gewaehlt && <Check size={15} strokeWidth={3} aria-hidden />}
      </span>
    </div>
  );
}

export function HistorySelection({ ids, children }: { ids: string[]; children: ReactNode }) {
  const router = useRouter();
  const [aktiv, setAktiv] = useState(false);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set());
  const [loeschDialog, setLoeschDialog] = useState(false);
  const [laeuft, setLaeuft] = useState<null | 'loeschen' | 'zip'>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const umschalten = useCallback((id: string) => {
    setAusgewaehlt((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const ctx = useMemo(() => ({ aktiv, ausgewaehlt, umschalten }), [aktiv, ausgewaehlt, umschalten]);

  function beenden() {
    setAktiv(false);
    setAusgewaehlt(new Set());
    setFehler(null);
  }

  const anzahl = ausgewaehlt.size;
  const alleGewaehlt = anzahl > 0 && anzahl === ids.length;

  async function loeschen() {
    setLaeuft('loeschen');
    setFehler(null);

    // Nacheinander statt parallel: Jede Löschung räumt auch Storage-Dateien
    // weg. Zwanzig gleichzeitige Anfragen brächten nichts außer Last.
    const gescheitert: string[] = [];
    for (const id of ausgewaehlt) {
      try {
        const res = await fetch(`/api/generate/${id}`, { method: 'DELETE' });
        if (!res.ok) gescheitert.push(id);
      } catch {
        gescheitert.push(id);
      }
    }

    setLaeuft(null);
    setLoeschDialog(false);

    if (gescheitert.length > 0) {
      setFehler(
        gescheitert.length === anzahl
          ? 'Löschen fehlgeschlagen. Bitte versuch es erneut.'
          : `${anzahl - gescheitert.length} von ${anzahl} gelöscht — der Rest ist fehlgeschlagen.`,
      );
      // Nur die übrig gebliebenen weiter markiert lassen, damit ein zweiter
      // Versuch nicht erneut bereits Gelöschtes anfasst.
      setAusgewaehlt(new Set(gescheitert));
      router.refresh();
      return;
    }

    toast.success(anzahl === 1 ? 'Anprobe gelöscht.' : `${anzahl} Anproben gelöscht.`);
    beenden();
    router.refresh();
  }

  async function alsZip() {
    setLaeuft('zip');
    setFehler(null);

    try {
      /*
        Die Übersicht kennt nur Vorschaubilder — für ein brauchbares Archiv
        brauchen wir die vollen Ergebnisse. Die holt der Status-Endpunkt, der
        auch frisch signierte URLs ausstellt (die in der Liste laufen ab).
      */
      const alle: ResultCard[] = [];
      let nummer = 0;

      for (const id of ausgewaehlt) {
        nummer++;
        const res = await fetch(`/api/generate/${id}`);
        if (!res.ok) continue;
        const data = (await res.json()) as { cards?: ResultCard[] };

        for (const card of data.cards ?? []) {
          // Ordnername pro Generierung, damit gleiche Titel aus verschiedenen
          // Anproben sich im Archiv nicht gegenseitig überschreiben.
          alle.push({ ...card, title: `anprobe-${String(nummer).padStart(2, '0')}/${card.title}` });
        }
      }

      if (alle.length === 0) {
        setFehler('Keine herunterladbaren Ergebnisse in der Auswahl.');
        setLaeuft(null);
        return;
      }

      await downloadZip(alle, `anproben-${alle.length}.zip`);
      setLaeuft(null);
      beenden();
    } catch {
      setFehler('Der Download ist fehlgeschlagen. Bitte versuch es erneut.');
      setLaeuft(null);
    }
  }

  return (
    <Ctx.Provider value={ctx}>
      {/* Ausserhalb des Auswahlmodus ein richtiger Button statt eines
          unterstrichenen Textlinks -- die Aktion "einen ganzen Bedienmodus
          umschalten" verdient mehr Gewicht als ein beilaeufiger Link, sonst
          wirkt sie leicht uebersehbar. Innerhalb bleibt der Ton bewusst
          zurueckhaltender (Text statt Buttons): dort ist die Aufmerksamkeit
          schon auf die Auswahl selbst gerichtet. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {!aktiv ? (
          <Button variant="outline" size="md" onClick={() => setAktiv(true)}>
            <ListChecks size={15} aria-hidden />
            Mehrere auswählen
          </Button>
        ) : (
          /* Eigene, in sich begrenzte Leiste statt loser Elemente auf voller
             Containerbreite -- vorher schob "ml-auto" den Fertig-Knopf bis
             zum rechten Rand des GESAMTEN (breiten) Verlauf-Layouts, auf
             Desktop wirkte er dadurch weit vom Rest der Zeile abgerissen.
             Jetzt ist "ganz rechts" nur noch der rechte Rand dieser Leiste. */
          <div className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 sm:w-auto">
            <span className="text-sm text-ink">
              {anzahl === 0 ? 'Nichts ausgewählt' : `${anzahl} ausgewählt`}
            </span>
            <button
              type="button"
              onClick={() => setAusgewaehlt(alleGewaehlt ? new Set() : new Set(ids))}
              className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
            >
              {alleGewaehlt ? 'Auswahl aufheben' : 'Alle auswählen'}
            </button>
            {/* Echter Button statt blossem Text -- war zuvor kaum als
                eigenstaendige Aktion erkennbar. */}
            <Button variant="outline" size="md" onClick={beenden} className="ml-auto">
              <X size={15} aria-hidden />
              Fertig
            </Button>
          </div>
        )}
      </div>

      {fehler && (
        <p role="alert" className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">
          {fehler}
        </p>
      )}

      {children}

      {/*
        Aktionsleiste. Auf Mobil bewusst fest am unteren Rand: Das Raster kann
        sehr lang werden, und eine Leiste oben wäre nach dem Scrollen nicht
        mehr erreichbar -- man müsste zum Auswählen und zum Ausführen jedes Mal
        hin- und herspringen. Unten liegt sie außerdem im Daumenbereich.
        Ab sm reicht der Fluss im Layout.
      */}
      {aktiv && anzahl > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-md sm:static sm:mt-6 sm:rounded-xl sm:border sm:bg-surface sm:px-4 sm:backdrop-blur-none">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:block">
              {anzahl} {anzahl === 1 ? 'Anprobe' : 'Anproben'} ausgewählt
            </span>

            <div className="ml-auto flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="md"
                onClick={alsZip}
                disabled={laeuft !== null}
                className="flex-1 sm:flex-none"
              >
                {laeuft === 'zip' ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                ) : (
                  <Download size={15} aria-hidden />
                )}
                Als ZIP
              </Button>

              <Button
                variant="danger"
                size="md"
                onClick={() => setLoeschDialog(true)}
                disabled={laeuft !== null}
                className="flex-1 sm:flex-none"
              >
                <Trash2 size={15} aria-hidden />
                Löschen
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={loeschDialog}
        variant="danger"
        title="Sind Sie sicher?"
        description={`${anzahl} ${anzahl === 1 ? 'Anprobe wird' : 'Anproben werden'} endgültig entfernt — Bilder und Verkaufstexte lassen sich danach nicht wiederherstellen.`}
        confirmLabel="Ja, endgültig löschen"
        pendingLabel="Wird gelöscht …"
        pending={laeuft === 'loeschen'}
        onConfirm={loeschen}
        onCancel={() => setLoeschDialog(false)}
      />
    </Ctx.Provider>
  );
}

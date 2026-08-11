'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/*
  Datenexport nach DSGVO Art. 15/20 -- vollstaendiges ZIP mit allen
  Ergebnisbildern, Verkaufstexten und Kontodaten (JSON). Serverseitig liefert
  /api/account/export nur Daten (inkl. frisch signierter Bild-URLs); das
  eigentliche Zippen passiert hier im Browser, gleiches Muster wie beim
  bestehenden Mehrfach-ZIP-Download im Verlauf (history/selection.tsx).
*/

type ExportBild = { titel: string; url: string | null; verkaufstext: string | null };
type ExportGenerierung = {
  id: string;
  erstelltAm: string;
  status: string;
  modus: string;
  qualitaet: string;
  verbrauchteCredits: number;
  kategorien: string[];
  groessen: string[];
  farben: string[];
  bilder: ExportBild[];
};
type ExportPayload = {
  konto: { email: string; name: string | null; tarif: string; registriertAm: string };
  abo: { tarif: string; status: string; naechsteAbrechnung: string | null } | null;
  creditVerlauf: { aenderung: number; grund: string; am: string }[];
  generierungen: ExportGenerierung[];
};

export function ExportDataButton() {
  const [loading, setLoading] = useState(false);

  async function exportieren() {
    setLoading(true);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) {
        // Die Meldung des Servers durchreichen statt sie durch ein pauschales
        // "fehlgeschlagen" zu ersetzen: Beim Rate-Limit (429) erklaert sie,
        // dass es an der Haeufigkeit liegt und wann es wieder geht -- sonst
        // haelt der Nutzer den Export fuer kaputt und versucht es sofort
        // wieder, was die Sperre nur verlaengert.
        const fehler = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(fehler?.error ?? 'Der Export ist fehlgeschlagen. Bitte versuch es erneut.');
        return;
      }
      const data = (await res.json()) as ExportPayload;

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Zusammenfassung OHNE die Bild-URLs (nur 10 Minuten gueltig, im
      // gespeicherten Archiv waeren sie toter Text) -- die Bilder liegen
      // stattdessen als echte Dateien im Archiv.
      zip.file(
        'konto.json',
        JSON.stringify(
          {
            ...data,
            generierungen: data.generierungen.map(({ bilder, ...rest }) => ({
              ...rest,
              bilder: bilder.map(({ titel, verkaufstext }) => ({ titel, verkaufstext })),
            })),
          },
          null,
          2,
        ),
      );

      for (let i = 0; i < data.generierungen.length; i++) {
        const g = data.generierungen[i];
        const ordner = `anproben/${String(i + 1).padStart(2, '0')}-${g.id.slice(0, 8)}`;
        for (const bild of g.bilder) {
          const base = bild.titel.replace(/[^\w\d]+/g, '-').toLowerCase();
          if (bild.url) {
            const blob = await fetch(bild.url).then((r) => r.blob());
            zip.file(`${ordner}/${base}.png`, blob);
          }
          if (bild.verkaufstext) zip.file(`${ordner}/${base}.txt`, bild.verkaufstext);
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meine-daten-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      // Von allen Aktionen der App dauert diese am laengsten (jedes
      // Ergebnisbild wird einzeln geladen und ins Archiv gepackt). Der
      // Browser legt die Datei still im Download-Ordner ab -- ohne Meldung
      // sieht man nur, wie der Knopf wieder normal aussieht, und weiss nicht,
      // ob etwas passiert ist.
      // Anzahl bewusst nach Fall unterschieden: "0 Anproben als ZIP" las sich
      // wie ein Fehlschlag, obwohl der Export korrekt war -- er enthaelt dann
      // eben nur die Kontodaten. Genau dieser Fall tritt bei einem frisch
      // angelegten Konto auf, also ausgerechnet beim ersten Ausprobieren.
      const anzahl = data.generierungen.length;
      toast.success(
        anzahl === 0
          ? 'Export fertig: deine Kontodaten als ZIP.'
          : anzahl === 1
            ? 'Export fertig: 1 Anprobe als ZIP.'
            : `Export fertig: ${anzahl} Anproben als ZIP.`,
      );
    } catch {
      // Als Toast statt als Zeile unter dem Knopf: Der Export dauert lange,
      // in der Zeit ist der Knopf oft aus dem sichtbaren Bereich gescrollt --
      // eine Meldung genau dort haette man dann gar nicht gesehen. Erfolg und
      // Fehlschlag melden sich jetzt zudem auf demselben Weg.
      toast.error('Der Export ist fehlgeschlagen. Bitte versuch es erneut.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
      {/* variant="outline" statt Textlink -- in der neuen Einstellungs-Zeile
          (konto/page.tsx) steht daneben mit DeleteAccountButton ein
          gleichwertiger, echter Button; ein blosser Link wirkte dagegen
          zu leicht. */}
      <Button variant="outline" size="md" onClick={exportieren} disabled={loading}>
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Download size={15} aria-hidden />}
        {loading ? 'Wird erstellt …' : 'Exportieren'}
      </Button>
    </div>
  );
}

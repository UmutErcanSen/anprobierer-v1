'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);

  async function exportieren() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) throw new Error('export fehlgeschlagen');
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
    } catch {
      setError('Der Export ist fehlgeschlagen. Bitte versuch es erneut.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={exportieren}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Download size={14} aria-hidden />}
        {loading ? 'Wird erstellt …' : 'Meine Daten exportieren'}
      </button>
      {error && <span className="text-xs text-accent">{error}</span>}
    </span>
  );
}

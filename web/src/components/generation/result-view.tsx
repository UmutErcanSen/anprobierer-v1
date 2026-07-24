'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlatformExport } from '@/components/generation/platform-export';

/*
  Ergebnisansicht — bewusst als eigene Komponente, damit die Testseite
  (/test-ergebnis) exakt dieselbe Darstellung zeigt wie der echte Ablauf.
  Eine Kopie wuerde mit der Zeit auseinanderlaufen.
*/

/** Bild und Verkaufstext gehoeren zusammen — so kommt es vom Server.
 * `itemIndex` (falls vorhanden) verweist auf die Karte in generations.cards
 * -- der PlatformExport braucht ihn, um plattformspezifische Texte serverseitig
 * zwischenzuspeichern (fehlt er, z.B. auf der Demo-Testseite, faellt der
 * Export auf reine Client-Kuerzung ohne KI-Anfrage zurueck). */
export type ResultCard = { itemIndex?: number; title: string; imageUrl: string | null; saleText: string | null };

/** Laedt Bild und Text gemeinsam als ZIP — beides braucht man fuer eine Anzeige. */
export async function downloadZip(cards: ResultCard[], filename: string) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const base = `${String(i + 1).padStart(2, '0')}-${card.title.replace(/[^\w\d]+/g, '-').toLowerCase()}`;
    if (card.imageUrl) {
      const blob = await fetch(card.imageUrl).then((r) => r.blob());
      zip.file(`${base}.png`, blob);
    }
    if (card.saleText) zip.file(`${base}.txt`, card.saleText);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Zwischenablage nicht verfuegbar — Text kann manuell markiert werden.
    }
  }
  return (
    <button type="button" onClick={copy} className="text-xs text-muted underline underline-offset-4 transition-colors hover:text-ink">
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  );
}

export function ResultView({
  cards,
  failures,
  remaining,
  onReset,
  title = 'Fertig',
  footer,
  generationId,
}: {
  cards: ResultCard[];
  failures: number;
  remaining: number;
  /** Bei einer frischen Generierung: setzt das Formular zurueck. Fuer die
   * (read-only) Verlaufsansicht stattdessen `footer` verwenden. */
  onReset?: () => void;
  title?: string;
  /** Ersetzt den Standard-"Neue Anprobe erstellen"-Button, z.B. durch einen
   * Link zurueck zum Verlauf. */
  footer?: ReactNode;
  /** Fuer PlatformExport: ohne generationId (z.B. Demo-Testseite) bleibt der
   * Export rein clientseitig ohne KI-Textanpassung. */
  generationId?: string;
}) {
  const imageCards = cards.filter((c) => c.imageUrl).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            {imageCards} {imageCards === 1 ? 'Bild' : 'Bilder'} · Guthaben {remaining} Credits
          </p>
        </div>
        {cards.length > 0 && (
          <Button variant="outline" onClick={() => downloadZip(cards, 'anprobe.zip')}>
            <Download size={15} aria-hidden /> Alles als ZIP
          </Button>
        )}
      </div>

      {failures > 0 && (
        <p role="status" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          {failures} {failures === 1 ? 'Bild konnte' : 'Bilder konnten'} nicht erstellt werden — die Credits
          dafür wurden zurückgebucht.
        </p>
      )}

      {/* Aufklappbare Karten: nur die erste offen, damit man auf dem Handy
          bei mehreren Ergebnissen nicht endlos scrollen muss. */}
      <div className="flex flex-col gap-3">
        {cards.map((card, i) => (
          <details key={`${card.title}-${i}`} open={i === 0} className="group rounded-xl border border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
              <span className="flex items-center gap-2.5">
                <ChevronRight size={16} className="text-muted transition-transform group-open:rotate-90" aria-hidden />
                <span className="text-sm font-medium text-ink">{card.title}</span>
              </span>
              <span className="text-xs text-muted">
                {card.imageUrl && card.saleText ? 'Bild + Text' : card.imageUrl ? 'Bild' : 'Text'}
              </span>
            </summary>

            <div className="flex flex-col gap-4 border-t border-line p-4">
              {card.imageUrl && (
                <div className="overflow-hidden rounded-lg border border-line">
                  <Image src={card.imageUrl} alt={card.title} width={512} height={768} className="h-auto w-full" unoptimized />
                </div>
              )}

              {card.saleText && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted">Verkaufstext</span>
                    <CopyButton text={card.saleText} />
                  </div>
                  <p className="whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm text-ink-soft">{card.saleText}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-sm">
                {card.imageUrl && (
                  <a href={card.imageUrl} download={`${card.title}.png`} className="text-ink underline underline-offset-4">
                    Bild herunterladen
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => downloadZip([card], `${card.title.replace(/[^\w\d]+/g, '-').toLowerCase()}.zip`)}
                  className="text-ink underline underline-offset-4"
                >
                  Bild + Text als ZIP
                </button>
              </div>

              <div className="border-t border-line pt-4">
                <PlatformExport card={card} generationId={generationId} />
              </div>
            </div>
          </details>
        ))}
      </div>

      <div>{footer ?? (onReset && <Button onClick={onReset}>Neue Anprobe erstellen</Button>)}</div>
    </div>
  );
}

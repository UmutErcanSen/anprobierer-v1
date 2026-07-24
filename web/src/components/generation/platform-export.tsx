'use client';

import { useState } from 'react';
import { PLATFORMS, formatSaleTextForPlatform, type Platform } from '@/lib/generation/platforms';
import type { ResultCard } from '@/components/generation/result-view';

/*
  Bereitet Bild + Verkaufstext fuer eine Ziel-Plattform vor und oeffnet deren
  Inserat-Seite -- OHNE echten Auto-Upload (siehe Begruendung in
  lib/generation/platforms.ts: Vinted/Kleinanzeigen haben keine oeffentliche
  Listing-API, eine inoffizielle Anbindung wuerde Nutzerkonten gefaehrden).
  Diese Variante ist der sichere Zwischenschritt: Text passend gekuerzt
  kopieren, Bild herunterladen, Zielseite oeffnen -- Einfuegen bleibt beim
  Nutzer.
*/

/** Laedt das Bild als Blob statt per <a download> direkt auf die (fremde,
 * signierte) Bild-URL zu zeigen -- Browser ignorieren das download-Attribut
 * bei Cross-Origin-Links oft und oeffnen das Bild nur, statt es zu speichern. */
function downloadImage(url: string, filename: string) {
  fetch(url)
    .then((r) => r.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
    })
    .catch(() => {
      // Bild konnte nicht geladen werden (z.B. abgelaufener signierter Link) --
      // der Text wurde trotzdem kopiert und das Fenster ist bereits offen.
    });
}

type Status = { platformLabel: string; title: string; description: string; copied: boolean };

export function PlatformExport({ card }: { card: ResultCard }) {
  const [status, setStatus] = useState<Status | null>(null);

  if (!card.saleText && !card.imageUrl) return null;

  async function prepare(platform: Platform) {
    // Das Fenster SOFORT oeffnen, noch synchron im Klick-Handler -- nach
    // einem await zaehlt der Klick fuer Popup-Blocker oft nicht mehr als
    // Nutzeraktion, das Fenster wuerde sonst stumm blockiert.
    window.open(platform.newListingUrl, '_blank', 'noopener,noreferrer');

    let title = '';
    let description = '';
    let copied = false;
    if (card.saleText) {
      ({ title, description } = formatSaleTextForPlatform(card.saleText, platform));
      try {
        await navigator.clipboard.writeText(`${title}\n\n${description}`);
        copied = true;
      } catch {
        // Zwischenablage kann blockiert sein -- die Meldung unten faellt dann
        // ehrlich anders aus (siehe `copied`), der Text steht trotzdem in der
        // Vorschau zum manuellen Markieren.
      }
    }

    if (card.imageUrl) {
      downloadImage(card.imageUrl, `${card.title.replace(/[^\w\d]+/g, '-').toLowerCase()}.png`);
    }

    setStatus({ platformLabel: platform.label, title, description, copied });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.14em] text-muted">Für andere Plattformen vorbereiten</span>
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((platform) => (
          <button
            key={platform.key}
            type="button"
            onClick={() => prepare(platform)}
            className="rounded-full border border-line-strong px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink"
          >
            Für {platform.label} vorbereiten
          </button>
        ))}
      </div>

      {status && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-3 text-xs">
          <p className="text-ink-soft">
            {status.platformLabel} geöffnet
            {card.imageUrl && ' · Bild heruntergeladen'}
            {card.saleText && (status.copied ? ' · Text kopiert' : ' · Text unten zum Markieren')} — jetzt einfügen.
          </p>
          {card.saleText && (
            <div className="rounded-md border border-line bg-paper p-2.5 text-ink-soft">
              <p className="font-medium text-ink">{status.title}</p>
              <p className="mt-1 whitespace-pre-wrap">{status.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

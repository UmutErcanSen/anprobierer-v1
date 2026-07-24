'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PLATFORMS, formatSaleTextForPlatform, type Platform, type PlatformKey } from '@/lib/generation/platforms';
import { PLATFORM_ICONS, PlatformIcon } from '@/components/generation/platform-icon';
import type { ResultCard } from '@/components/generation/result-view';

/*
  Bereitet Bild + Verkaufstext fuer eine Ziel-Plattform vor und oeffnet deren
  Inserat-Seite -- OHNE echten Auto-Upload (siehe Begruendung in
  lib/generation/platforms.ts: Vinted/Kleinanzeigen haben keine oeffentliche
  Listing-API, eine inoffizielle Anbindung wuerde Nutzerkonten gefaehrden).
  Diese Variante ist der sichere Zwischenschritt: Text passend umgeschrieben
  und gekuerzt kopieren, Bild herunterladen, Zielseite oeffnen -- Einfuegen
  bleibt beim Nutzer.

  Tabs waehlen nur die Vorschau aus (keine Seiteneffekte) -- der Nutzer soll
  den Text pruefen koennen, BEVOR er weitergeleitet wird. Erst der Button
  darunter loest Oeffnen/Kopieren/Herunterladen aus.

  Vinted braucht keinen zusaetzlichen KI-Aufruf (der Basistext ist bereits im
  Vinted-Ton verfasst, siehe buildSalePrompt in prompts.ts) -- die Vinted-Vor-
  schau ist also immer sofort da und kostenlos. Kleinanzeigen/eBay fragen bei
  der ERSTEN Auswahl einmalig eine Umschreibung beim Server an (siehe
  /api/generate/[id]/platform-text), die dort dauerhaft zwischengespeichert
  wird -- wiederholtes Ansehen desselben Tabs kostet kein zweites Mal.
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

export function PlatformExport({ card, generationId }: { card: ResultCard; generationId?: string }) {
  const [active, setActive] = useState<Platform>(PLATFORMS[0]);
  const [texts, setTexts] = useState<Partial<Record<PlatformKey, string>>>({});
  const [loading, setLoading] = useState<PlatformKey | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

  if (!card.saleText && !card.imageUrl) return null;

  // Vinted nutzt immer den Basistext (schon im richtigen Ton). Fuer die
  // anderen wird die serverseitig umgeschriebene Version genutzt, sobald sie
  // geladen ist -- bis dahin (oder falls das fehlschlaegt) faellt die Vorschau
  // auf den Basistext zurueck, statt leer zu bleiben.
  const sourceText = active.key === 'vinted' ? card.saleText : (texts[active.key] ?? card.saleText);
  const preview = sourceText ? formatSaleTextForPlatform(sourceText, active) : null;

  function selectPlatform(platform: Platform) {
    setActive(platform);
    setCopied(null);
    if (platform.key === 'vinted' || texts[platform.key] || !card.saleText || !generationId || card.itemIndex === undefined) {
      return;
    }
    setLoading(platform.key);
    fetch(`/api/generate/${generationId}/platform-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIndex: card.itemIndex, platform: platform.key, baseText: card.saleText }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.text) setTexts((prev) => ({ ...prev, [platform.key]: data.text }));
      })
      .catch(() => {
        // Netzwerkfehler -- Vorschau bleibt beim Vinted-Basistext.
      })
      .finally(() => setLoading((current) => (current === platform.key ? null : current)));
  }

  async function run() {
    // Fenster SOFORT oeffnen, noch synchron im Klick-Handler -- nach einem
    // await zaehlt der Klick fuer Popup-Blocker oft nicht mehr als
    // Nutzeraktion, das Fenster wuerde sonst stumm blockiert.
    window.open(active.newListingUrl, '_blank', 'noopener,noreferrer');

    let didCopy = false;
    if (preview) {
      try {
        await navigator.clipboard.writeText(`${preview.title}\n\n${preview.description}`);
        didCopy = true;
      } catch {
        // Zwischenablage kann blockiert sein -- der Text steht in der
        // Vorschau oben trotzdem zum manuellen Markieren bereit.
      }
    }

    if (card.imageUrl) {
      downloadImage(card.imageUrl, `${card.title.replace(/[^\w\d]+/g, '-').toLowerCase()}.png`);
    }

    setCopied(didCopy);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs uppercase tracking-[0.14em] text-muted">Für andere Plattformen vorbereiten</span>

      {/* overflow-x-auto statt flex-wrap: bei drei Tabs (Vinted, Kleinanzeigen,
          eBay) samt Logo reisst ein Umbruch auf Mobil die Reihe unschoen
          auseinander -- eine horizontal scrollbare Zeile bleibt kompakt und
          bleibt trotzdem vollstaendig erreichbar. */}
      <div className="-mx-0.5 overflow-x-auto px-0.5">
        <div
          role="tablist"
          className="inline-flex gap-1 rounded-full border border-line p-1 text-sm"
        >
          {PLATFORMS.map((platform) => (
            <button
              key={platform.key}
              type="button"
              role="tab"
              aria-selected={platform.key === active.key}
              onClick={() => selectPlatform(platform)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                platform.key === active.key
                  ? 'border border-ink text-ink'
                  : 'border border-transparent text-muted hover:text-ink'
              }`}
            >
              <PlatformIcon icon={PLATFORM_ICONS[platform.key]} />
              {platform.label}
              {loading === platform.key && <Loader2 size={11} className="animate-spin" aria-hidden />}
            </button>
          ))}
        </div>
      </div>

      {preview && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-xs">
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Titel</span>
              <span className={preview.title.length >= active.titleMaxLength ? 'text-accent' : ''}>
                {preview.title.length}/{active.titleMaxLength}
              </span>
            </div>
            <p className="mt-0.5 font-medium text-ink">{preview.title}</p>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Beschreibung</span>
              <span className={preview.description.length >= active.descriptionMaxLength ? 'text-accent' : ''}>
                {preview.description.length}/{active.descriptionMaxLength}
              </span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-ink-soft">{preview.description}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={run}
        className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-on-ink transition-opacity hover:opacity-90"
      >
        <PlatformIcon icon={PLATFORM_ICONS[active.key]} size={13} />
        Bei {active.label} öffnen
      </button>

      {copied !== null && (
        <p className="text-center text-xs text-ink-soft">
          {active.label} geöffnet
          {card.imageUrl && ' · Bild heruntergeladen'}
          {preview && (copied ? ' · Text kopiert' : ' · Text oben zum Markieren')} — jetzt einfügen.
        </p>
      )}
    </div>
  );
}

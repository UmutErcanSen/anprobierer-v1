'use client';

import { useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
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

/**
 * Kopiert EIN Feld -- Titel oder Beschreibung -- und quittiert das kurz.
 *
 * Warum getrennt: Vinted, Kleinanzeigen und eBay haben allesamt zwei
 * getrennte Eingabefelder. Bisher landeten Titel und Beschreibung als EIN
 * Block in der Zwischenablage; wer ihn einfuegte, hatte den kompletten Text
 * im Titelfeld stehen und musste ihn dort von Hand auseinandernehmen. Damit
 * war der halbe Nutzen des Exports wieder dahin -- genau an der Stelle, die
 * jeder Nutzer bei jedem Verkauf durchlaeuft.
 */
function FeldKopierButton({ text, label }: { text: string; label: string }) {
  const [kopiert, setKopiert] = useState(false);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1800);
    } catch {
      // Zwischenablage kann gesperrt sein (unsicherer Kontext, Berechtigung
      // verweigert). Der Text steht in der Vorschau weiterhin zum manuellen
      // Markieren -- deshalb hier bewusst keine Fehlermeldung, die nur
      // beunruhigen wuerde.
    }
  }

  return (
    <button
      type="button"
      onClick={kopieren}
      aria-label={`${label} kopieren`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        kopiert ? 'border-success/40 text-success' : 'border-line-strong text-ink-soft hover:text-ink'
      }`}
    >
      {kopiert ? <Check size={11} strokeWidth={3} aria-hidden /> : <Copy size={11} aria-hidden />}
      {kopiert ? 'Kopiert' : 'Kopieren'}
    </button>
  );
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
      // Kein baseText mehr: der Server leitet den Ausgangstext selbst aus der
      // Datenbank ab (siehe Kopfkommentar der Route) -- ein vom Client
      // geschickter Text machte den Endpunkt zu einem kostenlosen
      // LLM-Umschreibedienst fuer beliebige Inhalte.
      body: JSON.stringify({ itemIndex: card.itemIndex, platform: platform.key }),
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

    // NUR der Titel: Er ist das erste Feld jedes Inseratsformulars, also das,
    // was unmittelbar nach dem Wechsel gebraucht wird. Frueher wanderten
    // Titel UND Beschreibung als ein Block in die Zwischenablage -- eingefuegt
    // ergab das einen Titel, der die ganze Beschreibung enthielt. Die
    // Beschreibung holt man sich anschliessend ueber ihren eigenen Knopf.
    let didCopy = false;
    if (preview) {
      try {
        await navigator.clipboard.writeText(preview.title);
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
          bleibt trotzdem vollstaendig erreichbar. no-scrollbar (globals.css):
          bei drei Tabs ist auf den meisten Bildschirmen gar kein Scrollen
          noetig, Windows/Chrome zeigt den (dann rein kosmetischen) Scrollbalken
          aber trotzdem dauerhaft an, sobald overflow-x:auto gesetzt ist -- das
          war der gemeldete sichtbare Balken auf Mobil. Scroll-FUNKTION bleibt
          erhalten, nur die sichtbare Leiste wird ausgeblendet. */}
      <div className="no-scrollbar -mx-0.5 overflow-x-auto px-0.5">
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
              /* Ausgewaehlter Tab jetzt gefuellt (bg-ink) statt nur mit einem
                 duennen Rand -- die reine Umrandung war neben den unmarkierten
                 Tabs kaum zu unterscheiden. Gleiches Prinzip wie beim
                 Modus-Umschalter (Einzeln/Kombiniert) weiter oben im Formular. */
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                platform.key === active.key ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink'
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
        /* min-h + overflow-y-auto auf der Beschreibung: Vinted nutzt den
           Basistext, Kleinanzeigen/eBay bekommen einen eigens umgeschriebenen
           (unterschiedlich langen) Text -- ohne feste Hoehe sprang die ganze
           Box beim Tab-Wechsel sichtbar in der Groesse, und mit ihr alles
           darunter (Button, Meta-Zeile). Lange Beschreibungen bleiben trotzdem
           vollstaendig erreichbar, nur eben ueber einen kurzen internen Scroll
           statt einer wachsenden Box. */
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-xs">
          {/* Je Feld ein eigener Kopier-Knopf, weil die Zielformulare zwei
              getrennte Eingabefelder haben (siehe FeldKopierButton oben). Die
              Reihenfolge im Kasten entspricht der Reihenfolge im Formular:
              erst Titel, dann Beschreibung. */}
          <div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
              <span>Titel</span>
              <span className="flex items-center gap-2">
                <span className={preview.title.length >= active.titleMaxLength ? 'text-accent' : ''}>
                  {preview.title.length}/{active.titleMaxLength}
                </span>
                <FeldKopierButton text={preview.title} label="Titel" />
              </span>
            </div>
            <p className="mt-0.5 min-h-[2.5em] font-medium text-ink">{preview.title}</p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
              <span>Beschreibung</span>
              <span className="flex items-center gap-2">
                <span className={preview.description.length >= active.descriptionMaxLength ? 'text-accent' : ''}>
                  {preview.description.length}/{active.descriptionMaxLength}
                </span>
                <FeldKopierButton text={preview.description} label="Beschreibung" />
              </span>
            </div>
            <p className="mt-0.5 max-h-40 min-h-[6em] overflow-y-auto whitespace-pre-wrap text-ink-soft">
              {preview.description}
            </p>
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

      {/* Nach dem Klick steht der Nutzer im fremden Formular und muss wissen,
          was als Naechstes kommt. Vorher endete die Meldung bei "jetzt
          einfuegen" -- was einfuegen, und was danach, blieb offen. */}
      {copied !== null && (
        <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs text-ink-soft">
          <p>
            {active.label} geöffnet
            {card.imageUrl && ' · Bild heruntergeladen'}
            {preview && (copied ? ' · Titel kopiert' : '')}.
          </p>
          {preview && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {copied ? 'Titel einfügen, dann hier weiter:' : 'Text oben markieren und einfügen — oder:'}
              <FeldKopierButton text={preview.description} label="Beschreibung" />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

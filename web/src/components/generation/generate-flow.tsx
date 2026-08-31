'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ImagePlus, Loader2, MinusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { SelectSheet } from '@/components/ui/select-sheet';
import { ColorSelect } from '@/components/ui/color-select';
import { InfoTip } from '@/components/ui/info-tip';
import { TipModal } from '@/components/ui/tip-modal';
import { ResultView, type ResultCard } from '@/components/generation/result-view';
import { GenerationIconPanel } from '@/components/generation/generation-icon-panel';
import { alsGemeldetMerken } from '@/lib/generation/gemeldet';
import {
  CLOTHING_TYPES,
  SIZES,
  CREDITS_PER_QUALITY,
  UPLOAD_ACCEPT,
  maxItemsForPlan,
  qualityForPlan,
  validateImageFiles,
  type PlanKey,
} from '@/lib/generation/constants';

/*
  Einseitiger Ablauf. Zwei Modi:
    Einzeln     — je Kleidungsstueck ein eigenes Bild (kostet pro Bild)
    Kombiniert  — alle Stuecke in einem Bild (kostet 1×)

  Typ, Groesse und Farbe werden in BEIDEN Modi erfasst: Sie speisen den
  Verkaufstext, den es pro Kleidungsstueck gibt — unabhaengig davon, ob die
  Stuecke in einem oder mehreren Bildern landen. Nebeneffekt: Die Karten sind
  in beiden Modi gleich hoch.
*/

type Status = 'idle' | 'generating' | 'done' | 'error';
type ClothingItem = { id: number; file: File | null; type: string; size: string; color: string };

/** Antwort von GET /api/generate/[id] -- siehe dort. */
type PollAntwort = {
  status?: string;
  cards?: ResultCard[];
  failures?: number;
  creditsCharged?: number;
  locked?: boolean;
  error?: string;
};

/**
 * Abstand bis zur naechsten Statusabfrage, gestaffelt statt fest.
 *
 * Vorher wurde stur alle 3 Sekunden gefragt, ohne Obergrenze. Ein Job, den
 * erst die serverseitige Aufraeumung nach 10 Minuten beendet, erzeugte so
 * 200 Anfragen -- jede mit Token-Pruefung, Datenbankabfrage und einer frisch
 * signierten URL je Karte. Das Ergebnis kommt aber fast immer in der ersten
 * Minute; danach lohnt sich schnelles Nachfragen nicht mehr.
 *
 * Erste ~30 s alle 2 s (da faellt die Entscheidung), dann 5 s, ab etwa zwei
 * Minuten 10 s. Ueber zehn Minuten sind das rund 90 statt 200 Anfragen, bei
 * spuerbar schnellerer Reaktion am Anfang.
 */
function wartezeit(versuch: number): number {
  if (versuch < 15) return 2000;
  if (versuch < 40) return 5000;
  return 10000;
}

const PROGRESS = [
  'Personenfoto analysieren',
  'Kleidung erkennen',
  'Größenverhältnis berechnen',
  'Stoffstruktur übertragen',
  'Perspektive anpassen',
  'Licht berechnen',
  'Qualitätsprüfung',
];

// Fuer SelectSheet (siehe ui/select-sheet.tsx) als {value,label}-Paare statt
// als <option>-JSX -- dieselbe Umwandlung wie CATEGORY_OPTIONS/SIZE_OPTIONS
// in history-filters.tsx.
const CLOTHING_TYPE_OPTIONS = Object.entries(CLOTHING_TYPES).map(([value, { de }]) => ({ value, label: de }));
const SIZE_OPTIONS = SIZES.map((s) => ({ value: s, label: s }));

const emptyItem = (id: number): ClothingItem => ({ id, file: null, type: '', size: '', color: '' });

function usePreview(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

/**
 * Foto-Feld mit Drag & Drop. Der gestrichelte Rahmen bleibt immer sichtbar —
 * auch mit Bild — damit erkennbar ist, dass man hier jederzeit ein neues Foto
 * hineinziehen kann. Mehrere gleichzeitig fallengelassene Dateien reicht das
 * Feld nach oben durch (der Aufrufer verteilt sie auf weitere Stuecke).
 *
 * `panelOverlay`: für das Personenfoto, das auf md+ zu einer bildfüllenden
 * Spalte wird (Editorial-Layout) — zeigt dann ein Kicker-Label und einen
 * "Foto ändern"-Hinweis über dem Bild. Bewusst über CSS-Breakpoints gelöst
 * (keine JS-Breakpoint-Erkennung): dasselbe <label>-Element mit denselben
 * Handlern wechselt per `md:`-Klassen die Optik, statt zwei Instanzen mit
 * potenziell abweichendem Tab-Verhalten zu rendern.
 */
function PhotoField({
  id,
  label,
  file,
  onFiles,
  className = 'h-full min-h-44',
  panelOverlay = false,
}: {
  id: string;
  label: string;
  file: File | null;
  onFiles: (files: File[]) => void;
  className?: string;
  panelOverlay?: boolean;
}) {
  const preview = usePreview(file);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validiert VOR dem Weiterreichen an den Aufrufer -- ungueltige Dateien
  // (falsches Format, zu gross, leer) werden hier abgefangen, statt sie erst
  // beim Server-Request scheitern zu lassen (siehe validateImageFiles).
  function handleFiles(raw: File[]) {
    const { valid, error: validationError } = validateImageFiles(raw);
    setError(validationError);
    if (valid.length) onFiles(valid);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    // Leerer file.type NICHT hier aussortieren -- manche Browser liefern bei
    // HEIC-Fotos (iPhone-Standardformat) gar keinen MIME-Typ. Die eigentliche
    // Format-Pruefung (inkl. HEIC-Erkennung per Dateiendung) uebernimmt
    // validateImageFiles() in handleFiles.
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type === '' || f.type.startsWith('image/'));
    handleFiles(dropped);
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={`relative flex ${className} w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed p-1.5 text-center transition-colors ${
        over ? 'border-ink bg-surface' : 'border-line-strong bg-surface hover:border-ink'
      } ${panelOverlay ? 'md:rounded-none md:border-0 md:p-0' : ''}`}
    >
      {panelOverlay && (
        <span className="pointer-events-none absolute left-6 top-6 hidden rounded-full bg-paper/90 px-3.5 py-1.5 text-xs uppercase tracking-[0.14em] text-ink md:inline-block">
          {label}
        </span>
      )}

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={label}
          className={`h-full w-full object-cover ${panelOverlay ? 'rounded-lg md:rounded-none' : 'rounded-lg'}`}
        />
      ) : (
        <>
          <ImagePlus size={18} className="text-muted" aria-hidden />
          <span className="px-2 text-xs text-muted">
            {label}
            <br />
            <span className="text-[11px]">Klicken oder hineinziehen</span>
          </span>
        </>
      )}

      {panelOverlay && preview && (
        <span className="pointer-events-none absolute bottom-6 left-6 hidden rounded-full bg-ink px-4 py-2 text-xs font-medium text-on-ink md:inline-block">
          Foto ändern
        </span>
      )}

      {error && (
        <span
          role="alert"
          className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-paper/95 px-2 py-1 text-[11px] text-accent"
        >
          {error}
        </span>
      )}

      {/* Genau die unterstuetzten Formate statt "image/*": Vorher liessen sich
          am Rechner auch .gif oder .bmp auswaehlen -- die Absage kam dann erst
          NACH dem Aussuchen. Die HEIC-Endungen stehen zusaetzlich zu den
          MIME-Typen in der Liste, sonst waeren iPhone-Fotos in Browsern, die
          den HEIC-Typ nicht kennen, im Auswahldialog ausgegraut. */}
      <input
        id={id}
        type="file"
        accept={UPLOAD_ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
      />
    </label>
  );
}

export function GenerateFlow({ credits, plan }: { credits: number; plan: PlanKey }) {
  const router = useRouter();
  const maxItems = maxItemsForPlan(plan);
  const unitCost = CREDITS_PER_QUALITY[qualityForPlan(plan)];

  // Zaehler pro Komponenten-Instanz (useRef), NICHT modulweit: Ein modulweiter
  // Zaehler zaehlt im Next.js-Dev-Server ueber mehrere Anfragen/Neuladungen
  // hinweg weiter, waehrend der Browser bei jedem Laden neu bei 1 anfaengt --
  // das fuehrte zu server/client-inkonsistenten IDs (Hydration-Fehler bei
  // htmlFor/id-Paaren, siehe Konsole).
  //
  // Ein useRef allein reicht dafuer NICHT: Next.js aktiviert standardmaessig
  // React Strict Mode, und React ruft eine an useState uebergebene Lazy-
  // Initializer-Funktion im Dev-Modus zweimal auf, um unreine Effekte zu
  // erkennen (ein Ergebnis wird verworfen). Mutiert diese Funktion einen Ref
  // als Seiteneffekt, zaehlt der verworfene Aufruf trotzdem mit -- der Server
  // (der nur einmal rendert) landet dadurch bei einer anderen ID als der
  // Client. Deshalb bekommt das anfaengliche Element eine FESTE ID (kein
  // Seiteneffekt beim Rendern); der Ref-Zaehler existiert nur noch fuer
  // Elemente, die ueber Event-Handler hinzukommen -- die ruft React nie
  // doppelt auf.
  const nextIdRef = useRef(1);
  const newItem = () => emptyItem(nextIdRef.current++);

  const [mode, setMode] = useState<'single' | 'combined'>('single');
  const [person, setPerson] = useState<File | null>(null);
  const [items, setItems] = useState<ClothingItem[]>(() => [emptyItem(0)]);
  const [notes, setNotes] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<ResultCard[]>([]);
  const [liveCards, setLiveCards] = useState<ResultCard[]>([]); // Zwischenstand waehrend des Pollens
  const [failures, setFailures] = useState(0);
  const [remaining, setRemaining] = useState(0);
  // Fuer PlatformExport (plattformspezifische Texte serverseitig anfragen).
  const [generationId, setGenerationId] = useState<string | null>(null);
  // Free-Tarif: ab dem zweiten Ergebnis serverseitig verdeckt (siehe lock.ts) --
  // der Wert kommt direkt vom Poll-Endpunkt, nicht aus einer eigenen Berechnung.
  const [locked, setLocked] = useState(false);
  // Ausdrueckliche Einwilligung zur Verarbeitung personenbezogener Daten
  // (Art. 6 Abs. 1 lit. a DSGVO) -- bewusst NICHT vorausgewaehlt und bewusst
  // bei jedem neuen Durchlauf wieder zurueckgesetzt (siehe resetErgebnis()):
  // eine einmal erteilte Zustimmung fuer EIN Foto deckt nicht automatisch
  // jeden folgenden Upload ab.
  const [consent, setConsent] = useState(false);

  // Verhindert, dass ein noch laufender Poll nach reset()/Unmount weiterlaeuft
  // und veraltete Daten in einen neuen Durchlauf schreibt.
  const pollToken = useRef(0);

  const filledItems = items.filter((i) => i.file);
  const imageCount = mode === 'combined' ? (filledItems.length ? 1 : 0) : filledItems.length;
  const cost = imageCount * unitCost;

  // Typ und Groesse sind in beiden Modi Pflicht (sie speisen den Verkaufstext).
  const ready =
    Boolean(person) && filledItems.length > 0 && filledItems.every((i) => i.type && i.size);
  const notEnough = cost > credits;
  const readyToGenerate = ready && !notEnough && cost > 0 && consent;

  // Tipp-Inhalte aus der Altanwendung uebernommen (dort als "photoGuide"/
  // "clothingGuide"-Modal bereits vorhanden) -- als Daten statt JSX, weil
  // TipModal Bild + Stichpunkte selbst zusammensetzt.
  const personGood = {
    src: '/tips/person-gut.png',
    alt: 'Gutes Beispiel für ein Personenfoto',
    points: ['Ganzkörperaufnahme', 'Neutraler Hintergrund', 'Gut beleuchtet', 'Arme leicht vom Körper'],
  };
  const personBad = {
    src: '/tips/person-schlecht.jpg',
    alt: 'Schlechtes Beispiel für ein Personenfoto',
    points: ['Angeschnitten (Knie fehlen)', 'Unruhiger Hintergrund', 'Zu dunkel', 'Arme am Körper verdeckt'],
  };
  const clothingGood = {
    src: '/tips/clothing-gut.png',
    alt: 'Gutes Beispiel für ein Kleidungsfoto',
    points: ['Einzelnes Kleidungsstück', 'Flach ausgebreitet, glatt', 'Neutraler Hintergrund', 'Gut beleuchtet, nah herangezoomt'],
  };
  const clothingBad = {
    src: '/tips/clothing-schlecht.jpg',
    alt: 'Schlechtes Beispiel für ein Kleidungsfoto',
    points: ['Mehrere Teile durcheinander', 'Gefaltet oder zerknittert', 'Unruhiger Hintergrund', 'Zu weit weg oder schlecht beleuchtet'],
  };
  const modeTips = (
    <div className="flex flex-col gap-2.5">
      <p>
        <span className="font-medium text-ink">Einzeln:</span> Für jedes Kleidungsstück
        entsteht ein eigenes Anprobebild. Kosten: {unitCost} {unitCost === 1 ? 'Credit' : 'Credits'} pro
        Bild.
      </p>
      <p>
        <span className="font-medium text-ink">Kombiniert:</span> Alle ausgewählten Stücke
        werden in einem gemeinsamen Bild kombiniert. Kosten: {unitCost}{' '}
        {unitCost === 1 ? 'Credit' : 'Credits'} insgesamt, unabhängig von der Anzahl der Stücke.
      </p>
    </div>
  );

  useEffect(() => {
    if (status !== 'generating') return;
    setProgressIdx(0);
    const t = setInterval(() => setProgressIdx((i) => Math.min(i + 1, PROGRESS.length - 1)), 7000);
    return () => clearInterval(t);
  }, [status]);

  function updateItem(id: number, patch: Partial<ClothingItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  /**
   * Verteilt fallengelassene Dateien ab einer Position auf die Stuecke und
   * legt bei Bedarf neue an — begrenzt durch das Tariflimit.
   */
  function assignFiles(startIndex: number, files: File[]) {
    setItems((prev) => {
      const next = [...prev];
      for (let k = 0; k < files.length; k++) {
        const target = startIndex + k;
        if (target >= maxItems) break; // Tariflimit
        if (target < next.length) next[target] = { ...next[target], file: files[k] };
        else next.push({ ...newItem(), file: files[k] });
      }
      return next;
    });
  }

  function addItem() {
    if (items.length < maxItems) setItems((prev) => [...prev, newItem()]);
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }
  /** Setzt nur den Ergebniszustand zurueck, nicht die Eingaben. */
  function resetErgebnis() {
    pollToken.current++; // laufenden Poll stilllegen
    setStatus('idle');
    setCards([]);
    setLiveCards([]);
    setFailures(0);
    setError(null);
    setGenerationId(null);
    setLocked(false);
    // Zustimmung gilt nur fuer den EINEN, gerade abgeschickten Durchlauf --
    // sowohl "Neue Anprobe" als auch "Nochmal versuchen" senden Fotos erneut
    // an den KI-Dienstleister und verlangen deshalb erneut ein bewusstes Haekchen.
    setConsent(false);
  }

  function reset() {
    resetErgebnis();
    setPerson(null);
    setItems([newItem()]);
    setNotes('');
  }

  /*
    Erneuter Versuch nach einem TEILAUSFALL — die eigentliche Luecke.

    Bei einem vollstaendigen Fehlschlag gibt es hier nichts zu tun: Dort wird
    nur setStatus('error') gesetzt, das Formular faellt durch und behaelt
    Fotos, Typ, Groesse und Notizen. Ein Klick auf "Generieren" genuegt.

    Anders beim Teilausfall (ein Bild scheitert, der Verkaufstext entsteht):
    Der Nutzer landet in der Ergebnisansicht, und der einzige Weg zurueck war
    "Neue Anprobe erstellen" -- das verwirft ueber reset() ALLES, auch die
    bereits gewaehlten Fotos. Fuer einen zweiten Versuch musste man saemtliche
    Angaben neu machen, obwohl im Browser noch alles vorliegt.

    Deshalb hier NUR der Ergebniszustand zurueck. person, items samt Dateien
    und notes bleiben unangetastet, der naechste Versuch ist ein einziger
    Klick.

    Warum kein serverseitiges Wiederholen der bestehenden Generierung? Die
    Uploads sind da bereits geloescht (process.ts raeumt sie in beiden Pfaden
    weg), und wo sie lagen, haelt die Datenbank nicht fest -- die Spalte
    person_image_path existiert, wird aber nie befuellt. Das liesse sich
    aendern, hiesse aber, PERSONENFOTOS laenger aufzubewahren. Genau das sagt
    unsere Datenschutzerklaerung zu, nicht zu tun; Bequemlichkeit rechtfertigt
    das nicht. Der Umweg ueber den Browser erreicht dasselbe Ziel, ohne ein
    einziges Foto laenger zu speichern.
  */
  function nochmalVersuchen() {
    resetErgebnis();
  }

  useEffect(() => () => { pollToken.current++; }, []); // Poll stoppen beim Verlassen der Seite

  /**
   * Fragt den Status einer laufenden Generierung ab, bis sie fertig ist oder
   * fehlschlägt. Läuft unabhängig vom ursprünglichen POST — genau das macht
   * die Generierung serverseitig nicht mehr blockierend: der POST kehrt
   * sofort zurück, hier wird nur der Fortschritt beobachtet.
   */
  async function poll(generationId: string, myToken: number) {
    let versuch = 0;

    while (pollToken.current === myToken) {
      versuch++;
      let res: Response;
      try {
        res = await fetch(`/api/generate/${generationId}`);
      } catch {
        await new Promise((r) => setTimeout(r, wartezeit(versuch)));
        continue; // kurzer Netzwerkfehler — einfach erneut versuchen
      }
      if (pollToken.current !== myToken) return; // inzwischen verworfen

      // Antwort-Body ebenso absichern wie den Request selbst: Kommt statt
      // JSON eine HTML-Fehlerseite zurueck (Proxy-Timeout, 502, abgebrochene
      // Antwort), warf res.json() bisher eine Ausnahme, die niemand auffing --
      // die Schleife endete still und die Wartephase blieb FUER IMMER stehen,
      // bei bereits abgebuchten Credits. Ein solcher Ausfall ist voruebergehend,
      // also wird er wie ein Netzwerkfehler behandelt: erneut versuchen.
      let data: PollAntwort;
      try {
        data = (await res.json()) as PollAntwort;
      } catch {
        await new Promise((r) => setTimeout(r, wartezeit(versuch)));
        continue;
      }

      if (!res.ok) {
        setError(data.error ?? 'Die Generierung wurde nicht gefunden.');
        setStatus('error');
        return;
      }

      if (data.status === 'succeeded' || data.status === 'failed') {
        // Das Ergebnis steht gleich in voller Groesse auf DIESER Seite. Ohne
        // diesen Vermerk meldete die globale Leiste es beim naechsten
        // Seitenwechsel als frische Neuigkeit -- eine Information, die der
        // Nutzer eine Sekunde vorher vor sich hatte.
        alsGemeldetMerken(generationId);
        setCards(data.cards ?? []);
        setFailures(data.failures ?? 0);
        setRemaining(credits - (data.creditsCharged ?? 0));
        setLocked(Boolean(data.locked));
        setStatus(data.cards?.length ? 'done' : 'error');
        if (!data.cards?.length) setError('Die Generierung ist fehlgeschlagen. Deine Credits wurden zurückgebucht.');
        router.refresh(); // Guthaben im Header sofort aktualisieren
        return;
      }

      // Noch in Arbeit: Zwischenstand zeigen, dann erneut abfragen.
      setLiveCards(data.cards ?? []);
      await new Promise((r) => setTimeout(r, wartezeit(versuch)));
    }
  }

  async function generate() {
    if (!person) return;
    setStatus('generating');
    setError(null);
    setLiveCards([]);
    const myToken = ++pollToken.current;

    try {
      const form = new FormData();
      form.set('mode', mode);
      form.set('person', person);
      if (notes) form.set('notes', notes);
      for (const item of filledItems) {
        form.append('clothing', item.file!);
        form.append('clothingType', item.type);
        form.append('size', item.size);
        form.append('color', item.color);
      }
      // Kehrt sofort zurueck (202) — die eigentliche Generierung laeuft
      // serverseitig im Hintergrund weiter, siehe POST /api/generate.
      const res = await fetch('/api/generate', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Etwas ist schiefgelaufen.');
        setStatus('error');
        return;
      }
      setGenerationId(data.generationId);
      // Der globalen Leiste Bescheid geben (siehe laufende-anprobe.tsx).
      // Ohne dieses Signal wuerde sie die neue Anprobe erst beim naechsten
      // Poll bemerken -- wer sofort wegnavigiert, saehe bis zu drei Sekunden
      // lang keinerlei Hinweis darauf, dass etwas laeuft.
      window.dispatchEvent(new Event('anprobe:gestartet'));
      // .catch() ist hier Pflicht, nicht Kosmetik: Ohne ihn verschwaende eine
      // Ausnahme aus poll() als unbehandelte Promise-Rejection, und die
      // Wartephase bliebe stehen, ohne dass jemals etwas passiert. Lieber ein
      // ehrlicher Fehler mit dem Hinweis, wo das Ergebnis trotzdem landet --
      // die Generierung laeuft serverseitig ja weiter.
      void poll(data.generationId, myToken).catch((err) => {
        console.error('[generate] Statusabfrage abgebrochen', err);
        if (pollToken.current !== myToken) return; // Nutzer hat die Ansicht verlassen
        setError(
          'Die Verbindung zur Statusanzeige ist abgerissen. Deine Anprobe wird im Hintergrund fertiggestellt und erscheint unter „Mein Konto".',
        );
        setStatus('error');
      });
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setStatus('error');
    }
  }

  // ---------------------------------------------------------------- Ergebnis
  //
  // md:mx-auto + md:max-w-2xl: Das Eingabeformular hat sein eigenes
  // Zweispalten-Layout (Fotospalte randbuendig, siehe unten), das <main> der
  // Seite laesst dafuer bewusst jede Breitenbegrenzung weg. Wartephase und
  // Ergebnis haben aber KEIN eigenes Layout und erben sonst dieselbe volle
  // Breite -- auf Desktop zog sich die Karte dadurch randlos ueber den ganzen
  // Bildschirm. Dieselbe max-w-2xl/px-12/py-10-Kombination wie die
  // Einstellungsspalte im Formular sorgt fuer eine konsistente, lesbare
  // Breite in allen drei Phasen.
  if (status === 'done') {
    return (
      <div className="md:mx-auto md:max-w-2xl md:px-12 md:py-10">
        <ResultView
          cards={cards}
          failures={failures}
          remaining={remaining}
          onReset={reset}
          generationId={generationId ?? undefined}
          locked={locked}
          /* Nur wenn wirklich etwas fehlgeschlagen ist: Angebot, es sofort
             erneut zu versuchen. Die Eingaben liegen im Browser noch
             vollstaendig vor, der Versuch kostet also keinen neuen Aufwand --
             nur neue Credits, weshalb der Knopf zurueckhaltend gestaltet ist
             und der Standardweg "Neue Anprobe" daneben bestehen bleibt. */
          footer={
            failures > 0 ? (
              <div className="flex flex-wrap gap-3">
                <Button onClick={nochmalVersuchen}>
                  {failures === 1 ? 'Fehlendes Bild erneut erstellen' : 'Fehlende Bilder erneut erstellen'}
                </Button>
                <Button variant="outline" onClick={reset}>
                  Neue Anprobe erstellen
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>
    );
  }

  // -------------------------------------------------------------- Wartephase
  //
  // md:max-w-3xl statt max-w-2xl (siehe "Ergebnis"-Zweig oben): das
  // Icon-Panel kommt als feste 220px-Spalte dazu, ohne die Textspalte zu
  // stauchen.
  if (status === 'generating') {
    /*
      Fortschritt aus ECHTEN Daten statt aus einem Timer: process.ts erweitert
      generations.cards nach jedem fertigen Stueck, und der Poll liefert diesen
      Zwischenstand bereits (liveCards). Vorher lief nur eine 7-Sekunden-
      Animation ueber eine feste Schrittliste -- bei fuenf Stuecken sah der
      Nutzer minutenlang "Qualitaetspruefung", ohne zu wissen, ob ueberhaupt
      etwas vorangeht.

      Die Schrittliste bleibt trotzdem: Sie beschreibt jetzt das GERADE
      laufende Stueck und gibt dem Balken zwischen zwei fertigen Bildern
      sichtbare Bewegung. Auf 95 % gedeckelt, damit ein Stueck nie "fertig"
      aussieht, bevor sein Bild wirklich da ist.
    */
    const fertig = liveCards.filter((c) => c.imageUrl).length;
    const mehrere = imageCount > 1;
    const teilFortschritt = Math.min((progressIdx + 1) / PROGRESS.length, 0.95);
    const pct = mehrere
      ? Math.min(100, Math.round(((fertig + teilFortschritt) / imageCount) * 100))
      : Math.round(teilFortschritt * 100);
    return (
      <div className="md:mx-auto md:max-w-3xl md:px-12 md:py-10">
        <div className="flex flex-col overflow-hidden rounded-xl border border-line md:flex-row">
          <GenerationIconPanel progressIdx={progressIdx} pct={pct} />

          <div className="flex flex-1 flex-col gap-5 p-6">
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-ink" aria-hidden />
              <h1 className="text-lg font-medium text-ink">
                {mehrere ? `Stück ${Math.min(fertig + 1, imageCount)} von ${imageCount}` : 'Deine Anprobe entsteht …'}
              </h1>
            </div>

            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Fortschritt der Generierung"
            >
              {/* progress-shimmer: dezente wandernde Textur auf der Fuellung
                  statt einer toten Flaechenfarbe -- signalisiert "arbeitet
                  gerade", nicht nur "X Prozent erreicht". */}
              <div
                className="progress-shimmer h-full rounded-full bg-success transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Liste der einzelnen Stuecke -- nur im Einzeln-Modus sinnvoll:
                im Kombiniert-Modus entsteht EIN Bild aus allen Stuecken, eine
                Aufschluesselung waere dort irrefuehrend. */}
            {mehrere && (
              <ul className="flex flex-col gap-2">
                {filledItems.map((item, i) => {
                  const istFertig = i < fertig;
                  const istAktiv = i === fertig;
                  // CLOTHING_TYPES liefert { de, en } -- fuer die Anzeige die
                  // deutsche Bezeichnung, der englische Wert geht in den Prompt.
                  const bezeichnung =
                    CLOTHING_TYPES[item.type as keyof typeof CLOTHING_TYPES]?.de ?? `Stück ${i + 1}`;

                  return (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        istAktiv ? 'bg-surface text-ink' : istFertig ? 'text-ink' : 'text-muted/70'
                      }`}
                    >
                      {/* key wechselt genau dann, wenn ein Stueck fertig
                          wird -- der dadurch ausgeloeste Remount spielt
                          "icon-pop" (siehe globals.css) einmalig ab, statt
                          dass der Haken einfach kommentarlos erscheint. */}
                      <span key={istFertig ? 'done' : 'pending'} className="icon-pop shrink-0">
                        {istFertig ? (
                          <Check size={15} strokeWidth={3} className="text-success" aria-hidden />
                        ) : istAktiv ? (
                          <Loader2 size={15} className="animate-spin text-ink" aria-hidden />
                        ) : (
                          <MinusCircle size={15} className="text-muted/50" aria-hidden />
                        )}
                      </span>

                      <span className={istAktiv ? 'font-medium' : undefined}>
                        {bezeichnung}
                        {item.size && <span className="text-muted"> · {item.size}</span>}
                      </span>

                      {/* Nur beim laufenden Stueck: der aktuelle Zwischenschritt.
                          Auf Mobil ausgeblendet, sonst bricht die Zeile um. */}
                      {istAktiv && (
                        <span className="ml-auto hidden truncate text-xs text-muted sm:block">
                          {PROGRESS[progressIdx]}
                        </span>
                      )}
                      {istFertig && <span className="ml-auto text-xs text-success">fertig</span>}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Nur bei EINEM Bild: Dort gibt es keine Stueckliste, die
                Bewegung zeigen koennte -- hier tragen die Zwischenschritte
                das Warten. Bei mehreren Stuecken stuende beides untereinander
                und man wuesste nicht, worauf sich die Schritte beziehen. */}
            {!mehrere && (
            <ul className="flex flex-col gap-2.5">
              {PROGRESS.map((label, i) => {
                const done = i < progressIdx;
                const active = i === progressIdx;
                return (
                  <li
                    key={label}
                    className={`flex items-center gap-3 text-sm transition-colors ${
                      done ? 'text-ink' : active ? 'font-medium text-ink' : 'text-muted/60'
                    }`}
                  >
                    <span
                      key={done ? 'done' : active ? 'active' : 'pending'}
                      className={`icon-pop flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                        done
                          ? 'bg-success text-paper'
                          : active
                            ? 'border-2 border-ink'
                            : 'border border-line'
                      }`}
                    >
                      {done ? <Check size={12} strokeWidth={3} aria-hidden /> : active ? <Loader2 size={11} className="animate-spin" aria-hidden /> : null}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ul>
            )}

            {/* Bewusst KEINE Zeitangabe (weder fest noch "noch etwa X Minuten"):
                die tatsaechliche Dauer ist unvalidiert und haengt stark von
                der Anzahl der Stuecke ab (Pro bis zu 9 auf einmal) -- eine
                falsche Erwartung waere schlimmer als gar keine Angabe. Bei
                mehreren Stuecken bleibt der reine Fortschritt (X von Y
                fertig) stehen, weil das ein FAKT ist, kein Versprechen. */}
            {mehrere && (
              <p className="text-xs text-muted">
                {fertig > 0 ? `${fertig} von ${imageCount} Bildern fertig.` : `${imageCount} Bilder werden erstellt.`}
              </p>
            )}

            {/* Der Hinweis, der die gefuehlte Wartezeit am staerksten senkt:
                Die Generierung laeuft serverseitig in after() weiter, voellig
                unabhaengig davon, ob dieser Tab offen bleibt. Ohne diesen
                Satz sitzt der Nutzer minutenlang vor dem Bildschirm, weil er
                annimmt, Schliessen wuerde abbrechen -- und verliert im
                Zweifel sogar Credits, wenn er es doch tut und neu startet. */}
            <div className="mt-1 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3">
              <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
                <Check size={15} strokeWidth={3} />
              </span>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                <span className="font-medium text-ink">Du kannst diese Seite schließen.</span>{' '}
                Wir arbeiten im Hintergrund weiter — dein Ergebnis findest du danach unter{' '}
                <Link href="/konto" className="text-accent underline underline-offset-4 hover:opacity-80">
                  Mein Konto
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /*
    Modus-Wahl, EINMAL beschrieben und an zwei Stellen eingesetzt.

    Auf Mobil steht sie ganz oben, noch vor dem Personenfoto: Sie entscheidet,
    ob je Kleidungsstueck ein eigenes Bild entsteht oder alle zusammen in
    eines kommen -- also ueber die Form des Ergebnisses. Diese Entscheidung
    zuerst zu treffen und danach die Fotos zu waehlen, entspricht der
    natuerlichen Reihenfolge; umgekehrt laedt man erst hoch und stolpert
    danach ueber eine Grundsatzfrage.

    Ab md bleibt sie dagegen in der rechten Einstellungsspalte -- dort steht
    sie ohnehin ganz oben, und das Foto hat als eigene Spalte links seinen
    festen Platz.

    Zwei Einsatzstellen statt Umsortierung per CSS-order: Die beiden Spalten
    sind auf Mobil EIN Fluss, auf Desktop zwei nebeneinander -- ein einzelnes
    Element kann nicht gleichzeitig vor der Fotospalte und in der zweiten
    Spalte stehen. Da immer nur eine der beiden Fassungen angezeigt wird
    (display:none blendet die andere auch fuer Screenreader aus), entstehen
    weder doppelte Bedienelemente noch doppelte Ansagen. InfoTip vergibt
    keine IDs, es kann also auch nichts kollidieren.
  */
  const modusAuswahl = (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
        Modus
        <InfoTip label="Was bedeuten die beiden Modi?">{modeTips}</InfoTip>
      </h2>
      {/* Auf Mobil volle Breite statt einer schmalen, mittig schwebenden
          Pille -- groessere Tastflaeche und einheitlicher mit den anderen
          vollbreiten Formularfeldern (Foto-Upload, Kleidung). flex-1 auf den
          Buttons teilt die Breite gleichmaessig auf. Ab md wieder eine
          kompakte, linksbuendige Pille (self-start) wie der Rest der
          Einstellungsspalte -- dort stuende eine vollbreite Pille neben viel
          freiem Platz unnatuerlich gestreckt da. */}
      <div className="flex w-full rounded-full border border-line p-1 text-sm md:inline-flex md:w-auto md:self-start">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`flex-1 rounded-full px-4 py-1.5 text-center transition-colors md:flex-none ${mode === 'single' ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink'}`}
        >
          Einzeln
        </button>
        <button
          type="button"
          onClick={() => setMode('combined')}
          className={`flex-1 rounded-full px-4 py-1.5 text-center transition-colors md:flex-none ${mode === 'combined' ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink'}`}
        >
          Kombiniert
        </button>
      </div>
      <p className="text-xs text-muted">
        {mode === 'single'
          ? 'Je Kleidungsstück ein eigenes Anprobebild.'
          : 'Alle Stücke zusammen in einem Bild.'}
      </p>
    </section>
  );

  // ----------------------------------------------------------------- Eingabe
  //
  // Layout: auf Mobil ein einziger vertikaler Fluss (Standardverhalten von
  // flex-col — unverändert zum bisherigen Aufbau). Ab md wird daraus ein
  // Zweispalter: links das Personenfoto als bildfüllende Spalte (Editorial-
  // Stil, wie auf der Landingpage), rechts die Einstellungen.
  //
  // Bewusst FLEXBOX statt CSS-Grid für den Zweispalter: Grid-Zeilen (auch mit
  // nur zwei "Spalten"-Kindern) werden implizit auf gleiche Höhe gebracht,
  // sodass die Foto-Spalte mit jedem zusätzlichen Kleidungsstück oder jeder
  // längeren Notiz in der Einstellungsspalte mitwuchs — genau der gemeldete
  // Fehler. Mit Flexbox + `items-start` behält jede Spalte ihre eigene,
  // unabhängige Höhe; die Foto-Spalte bekommt zusätzlich eine feste,
  // vom Sichtfenster abhängige Höhe (`clamp(...)`) statt `h-full`, und
  // bleibt dank `sticky` beim Scrollen durch die Einstellungen sichtbar.
  return (
    // md:max-w + md:mx-auto: beide Spalten sind bereits einzeln gedeckelt
    // (Foto 38rem, Formular 2xl=42rem -- zusammen 80rem), wachsen per
    // flex-grow aber nicht darueber hinaus. Ohne eine Grenze auf DIESER
    // Ebene blieb der Rest sehr breiter Bildschirme ungenutzt und sammelte
    // sich als einseitige Luecke rechts (die Fotospalte klebte links, die
    // Zeile selbst wurde nie zentriert). Eine feste Summen-Breite statt
    // `w-fit` -- Flexbox berechnet `fit-content` bei aktivem flex-grow nicht
    // zuverlaessig ueber Browser hinweg (erste Version schrumpfte dadurch
    // die Zeile bereits bei normaler Desktop-Breite unbeabsichtigt). Unter
    // 80rem Fensterbreite greift ganz normal flex-shrink, dort bleibt der
    // Rand-zu-Rand-Look wie zuvor erhalten; erst darueber zentriert sich die
    // Zeile mit gleichmaessigen Raendern.
    <div className="flex flex-col gap-8 md:mx-auto md:max-w-[80rem] md:flex-row md:items-start md:gap-0">
      {/* md:max-w begrenzt, wie breit die Foto-Spalte auf sehr großen
          Bildschirmen werden kann: ohne das wuchs sie mit flex-[0.9] nahezu
          unbegrenzt, waehrend die Hoehe durch den clamp(...) unten bei 900px
          gedeckelt blieb -- das Seitenverhaeltnis wurde dadurch immer breiter
          und object-cover schnitt zunehmend mehr vom Foto ab (untere Haelfte
          verschwand). Bleibt trotzdem randbuendig zum linken Bildschirmrand. */}
      {/* Ueberschrift "Anprobe erstellen" auf Mobil VOR dem Personenfoto --
          nur hier fuer Mobil sichtbar (md:hidden), das identische <h1> weiter
          unten im Formular-Block ist dort per "hidden md:block" ausgeblendet.
          Kein order-Trick auf den beiden grossen Spalten: der haette nicht
          nur die Ueberschrift, sondern den GESAMTEN Formular-Block (inkl.
          Kleidung, Generieren-Button) hinter das Foto geschoben -- genau der
          gemeldete Folgefehler. Zwei kleine <h1>-Vorkommen statt einem sind
          hier der sauberere Weg, gleiches Muster wie beim TipModal direkt
          darunter (separates Mobil-/Desktop-Rendering statt Reihenfolge-
          Verrenkung). */}
      <div className="flex flex-col gap-8 md:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Anprobe erstellen</h1>
          <p className="mt-1 text-sm text-muted">Guthaben: {credits} Credits</p>
        </div>
        {/* Modus VOR dem Personenfoto -- siehe Begruendung bei modusAuswahl. */}
        {modusAuswahl}
      </div>

      <section className="relative flex flex-col gap-3 md:sticky md:top-[calc(var(--chrome-oben)+4rem)] md:max-w-[38rem] md:flex-[0.9] md:border-r md:border-line">
        {/* Ueberschrift und TipModal als Geschwister statt TipModal INNERHALB
            des <h2> -- <h2> erlaubt laut HTML-Spezifikation nur "Phrasing
            Content", TipModal rendert aber ein <dialog> (Flow Content). Das
            fuehrte zu einem Hydration-Fehler ("<dialog> cannot be a
            descendant of <h2>" bzw. hier <p>), den React im Dev-Modus als
            Konsolenfehler meldet. Der umschliessende Flex-Container haelt
            die bisherige Optik (Text + Icon nebeneinander) unveraendert. */}
        <div className="flex items-center gap-1.5 md:hidden">
          <h2 className="text-sm font-medium text-ink">Dein Foto</h2>
          <TipModal
            label="Tipps für ein gutes Personenfoto"
            title="So sollte dein Personenfoto aussehen"
            intro="Für beste Ergebnisse mit der KI-Anprobe beachte diese Tipps:"
            good={personGood}
            bad={personBad}
          />
        </div>
        {/* mx-auto: auf Mobil blieb das Foto sonst links ausgerichtet und
            liess rechts sichtbar ungenutzten Platz -- die Karte selbst ist
            durch flex-col volle Breite, aber der Block darin nicht. w-56 war
            dabei zu knapp bemessen (deutlich schmaler als noetig); max-w statt
            einer festen Breite nutzt den verfuegbaren Platz auf schmalen
            Handys besser aus, ohne auf breiteren Mobilgeraeten zu ausufernd
            zu werden. */}
        <div className="mx-auto w-full max-w-[22rem] sm:w-64 sm:max-w-none md:mx-0 md:w-full">
          <PhotoField
            id="person"
            label="Personenfoto"
            file={person}
            onFiles={(files) => setPerson(files[0] ?? null)}
            /*
              Die Hoehe muss VON DEMSELBEN Anker ausgehen wie das `sticky`
              der Spalte, sonst wird die Spalte hoeher als der Platz, der ihr
              bleibt -- und eine Sticky-Spalte, die nicht in den Bildausschnitt
              passt, scrollt zwangslaeufig mit, statt stehenzubleiben. Genau
              das passierte, als der Beta-Hinweis dazukam: Der Anker wanderte
              von 64px auf 127px, die 5rem hier blieben stehen, und die Spalte
              stand ploetzlich 41px ueber.

              --chrome-oben deckt die klebenden Leisten ab, 4rem den Header;
              das zusaetzliche 1rem ist der Luftspalt nach unten.
            */
            className="aspect-[3/4] md:aspect-auto md:h-[clamp(420px,calc(100vh-var(--chrome-oben)-5rem),900px)]"
            panelOverlay
          />
        </div>
        {/* Auf Desktop ersetzt die Kicker-Pille im Bild den <h2> — der
            Info-Knopf braucht deshalb hier eine eigene, sichtbare Stelle. */}
        <div className="absolute right-6 top-6 z-10 hidden md:block">
          <TipModal
            label="Tipps für ein gutes Personenfoto"
            title="So sollte dein Personenfoto aussehen"
            intro="Für beste Ergebnisse mit der KI-Anprobe beachte diese Tipps:"
            good={personGood}
            bad={personBad}
            pill
          />
        </div>
      </section>

      <div className="flex flex-col gap-8 md:flex-[1.4] md:max-w-2xl md:px-12 md:py-10">
      {/* Mobil-Variante der Ueberschrift steht bereits vor der Foto-Sektion
          oben -- hier nur ab Desktop sichtbar, sonst stuende der Titel
          doppelt auf der Seite. */}
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Anprobe erstellen</h1>
        <p className="mt-1 text-sm text-muted">Guthaben: {credits} Credits</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">{error}</p>
      )}

      {/* Auf Mobil steht die Modus-Wahl bereits GANZ OBEN, noch vor dem
          Personenfoto -- hier deshalb erst ab md. Siehe die Begruendung bei
          der Definition von modusAuswahl. */}
      <div className="hidden md:block">{modusAuswahl}</div>

      <section className="flex flex-col gap-3">
        {/* Siehe Kommentar bei "Dein Foto" oben -- gleicher Grund. */}
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium text-ink">Kleidungsstücke</h2>
          <TipModal
            label="Tipps für ein gutes Kleidungsfoto"
            title="So sollten deine Kleidungsfotos aussehen"
            intro="Für beste Ergebnisse mit der KI-Anprobe beachte diese Tipps:"
            good={clothingGood}
            bad={clothingBad}
          />
        </div>

        <div className="flex flex-col gap-4">
          {items.map((item, idx) => (
            <div key={item.id} className="relative flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Stück ${idx + 1} entfernen`}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-accent"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              )}

              {/* Auf Mobil Foto ueber den Feldern statt daneben -- die
                  Dropdowns bekommen dadurch die volle Breite statt sich neben
                  einer 112px breiten Fotospalte zu quetschen. Ab sm wieder
                  nebeneinander wie gehabt. w-full statt einer festen Breite:
                  vorher blieb der Rahmen auch auf Mobil bei 112px (w-28) und
                  liess links/rechts viel ungenutzten Platz -- erst ab sm
                  greift wieder die schmale Spaltenbreite. */}
              <div className="w-full shrink-0 sm:w-28">
                <PhotoField
                  id={`item-${item.id}`}
                  label={`Stück ${idx + 1}`}
                  file={item.file}
                  onFiles={(files) => assignFiles(idx, files)}
                  className="aspect-square sm:aspect-auto sm:h-full sm:min-h-44"
                />
              </div>

              <div className="flex flex-1 flex-col gap-3 sm:pr-8">
                <Field label="Kleidungstyp" htmlFor={`type-${item.id}`}>
                  <SelectSheet
                    id={`type-${item.id}`}
                    label="Kleidungstyp"
                    placeholder="Bitte wählen …"
                    value={item.type}
                    onChange={(v) => updateItem(item.id, { type: v })}
                    options={CLOTHING_TYPE_OPTIONS}
                  />
                </Field>
                <Field label="Größe" htmlFor={`size-${item.id}`}>
                  <SelectSheet
                    id={`size-${item.id}`}
                    label="Größe"
                    placeholder="Bitte wählen …"
                    value={item.size}
                    onChange={(v) => updateItem(item.id, { size: v })}
                    options={SIZE_OPTIONS}
                  />
                </Field>
                <Field label="Farbe (optional, für den Verkaufstext)" htmlFor={`color-${item.id}`}>
                  <ColorSelect id={`color-${item.id}`} value={item.color} onChange={(v) => updateItem(item.id, { color: v })} />
                </Field>
              </div>
            </div>
          ))}
        </div>

        {items.length < maxItems ? (
          <button type="button" onClick={addItem} className="self-start text-sm text-ink underline underline-offset-4">
            + Kleidungsstück hinzufügen
          </button>
        ) : (
          <p className="text-xs text-muted">
            Dein Tarif erlaubt bis zu {maxItems} Stück{maxItems > 1 ? 'e' : ''} pro Anprobe.
          </p>
        )}
      </section>

      <section>
        <Field label="Zusätzliche Hinweise (optional)" htmlFor="notes">
          <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </section>

      <div className="flex flex-col items-center gap-3 border-t border-line pt-6 md:items-start">
        {/* Ausdrueckliche Einwilligung zur Datenverarbeitung -- bewusst als
            eigener, nicht vorausgewaehlter Schritt direkt vor dem Auslösen
            der Verarbeitung, statt beilaeufig beim Registrieren erledigt.
            items-start statt items-center: der Text ist zweizeilig, das
            Kaestchen soll oben an der ersten Zeile ausgerichtet bleiben. */}
        <label className="flex max-w-md cursor-pointer items-start gap-2.5 text-left text-xs leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-ink"
          />
          <span>
            Ich bin ausdrücklich damit einverstanden, dass mein Personenfoto
            und die Kleidungsfotos — personenbezogene Daten — zur Erstellung
            des Anprobebilds an unseren KI-Dienstleister übermittelt und dort
            verarbeitet werden.{' '}
            <Link
              href="/datenschutz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4 hover:opacity-80"
            >
              Mehr dazu in der Datenschutzerklärung
            </Link>
            .
          </span>
        </label>

        {/* key erzwingt ein Neu-Mounten, sobald der Button klickbar wird —
            dadurch startet die pop-ready-Animation garantiert frisch, statt
            nur einmal beim ersten Laden zu greifen. */}
        <Button
          key={readyToGenerate ? 'ready' : 'not-ready'}
          size="lg"
          onClick={generate}
          disabled={!readyToGenerate}
          className={readyToGenerate ? 'pop-ready' : ''}
        >
          {cost > 0 ? `Generieren (${cost} ${cost === 1 ? 'Credit' : 'Credits'})` : 'Generieren'}
        </Button>
        {notEnough && <span className="text-xs text-accent">Guthaben reicht nicht — {cost} Credits nötig.</span>}
        {ready && !notEnough && cost > 0 && !consent && (
          <span className="text-xs text-muted">Bitte bestätige die Datenverarbeitung, um fortzufahren.</span>
        )}
        {mode === 'single' && filledItems.length > 1 && (
          <span className="text-xs text-muted">{filledItems.length} Stücke = {filledItems.length} Bilder</span>
        )}
      </div>
      </div>
    </div>
  );
}

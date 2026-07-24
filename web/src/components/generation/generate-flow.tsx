'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/field';
import { InfoTip } from '@/components/ui/info-tip';
import { TipModal } from '@/components/ui/tip-modal';
import { ResultView, type ResultCard } from '@/components/generation/result-view';
import {
  CLOTHING_TYPES,
  SIZES,
  COLORS,
  CREDITS_PER_QUALITY,
  maxItemsForPlan,
  qualityForPlan,
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

const PROGRESS = [
  'Personenfoto analysieren',
  'Kleidung erkennen',
  'Größenverhältnis berechnen',
  'Stoffstruktur übertragen',
  'Perspektive anpassen',
  'Licht berechnen',
  'Qualitätsprüfung',
];

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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (dropped.length) onFiles(dropped);
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

      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
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
  const readyToGenerate = ready && !notEnough && cost > 0;

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
  function reset() {
    pollToken.current++; // laufenden Poll stilllegen
    setStatus('idle');
    setCards([]);
    setLiveCards([]);
    setFailures(0);
    setError(null);
    setPerson(null);
    setItems([newItem()]);
    setNotes('');
  }

  useEffect(() => () => { pollToken.current++; }, []); // Poll stoppen beim Verlassen der Seite

  /**
   * Fragt den Status einer laufenden Generierung ab, bis sie fertig ist oder
   * fehlschlägt. Läuft unabhängig vom ursprünglichen POST — genau das macht
   * die Generierung serverseitig nicht mehr blockierend: der POST kehrt
   * sofort zurück, hier wird nur der Fortschritt beobachtet.
   */
  async function poll(generationId: string, myToken: number) {
    while (pollToken.current === myToken) {
      let res: Response;
      try {
        res = await fetch(`/api/generate/${generationId}`);
      } catch {
        await new Promise((r) => setTimeout(r, 3000));
        continue; // kurzer Netzwerkfehler — einfach erneut versuchen
      }
      if (pollToken.current !== myToken) return; // inzwischen verworfen

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Die Generierung wurde nicht gefunden.');
        setStatus('error');
        return;
      }

      if (data.status === 'succeeded' || data.status === 'failed') {
        setCards(data.cards ?? []);
        setFailures(data.failures ?? 0);
        setRemaining(credits - (data.creditsCharged ?? 0));
        setStatus(data.cards?.length ? 'done' : 'error');
        if (!data.cards?.length) setError('Die Generierung ist fehlgeschlagen. Deine Credits wurden zurückgebucht.');
        router.refresh(); // Guthaben im Header sofort aktualisieren
        return;
      }

      // Noch in Arbeit: Zwischenstand zeigen, dann erneut abfragen.
      setLiveCards(data.cards ?? []);
      await new Promise((r) => setTimeout(r, 3000));
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
      void poll(data.generationId, myToken);
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setStatus('error');
    }
  }

  // ---------------------------------------------------------------- Ergebnis
  if (status === 'done') {
    return <ResultView cards={cards} failures={failures} remaining={remaining} onReset={reset} />;
  }

  // -------------------------------------------------------------- Wartephase
  if (status === 'generating') {
    const pct = Math.round(((progressIdx + 1) / PROGRESS.length) * 100);
    return (
      <div className="flex flex-col gap-5 rounded-xl border border-line p-6">
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-ink" aria-hidden />
          <h1 className="text-lg font-medium text-ink">Deine Anprobe entsteht …</h1>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-success transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>

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
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
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

        <p className="text-xs text-muted">
          {imageCount > 1
            ? liveCards.filter((c) => c.imageUrl).length > 0
              ? `${liveCards.filter((c) => c.imageUrl).length} von ${imageCount} Bildern fertig …`
              : `${imageCount} Bilder — das dauert ein paar Minuten.`
            : 'Das dauert in der Regel unter einer Minute.'}
        </p>
      </div>
    );
  }

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
      <section className="relative flex flex-col gap-3 md:sticky md:top-16 md:max-w-[38rem] md:flex-[0.9] md:border-r md:border-line">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink md:hidden">
          Dein Foto
          <TipModal
            label="Tipps für ein gutes Personenfoto"
            title="So sollte dein Personenfoto aussehen"
            intro="Für beste Ergebnisse mit der KI-Anprobe beachte diese Tipps:"
            good={personGood}
            bad={personBad}
          />
        </h2>
        {/* mx-auto: auf Mobil blieb das Foto sonst links ausgerichtet und
            liess rechts sichtbar ungenutzten Platz -- die Karte selbst ist
            durch flex-col volle Breite, aber der Block darin (w-56) nicht. */}
        <div className="mx-auto w-56 sm:w-64 md:mx-0 md:w-full">
          <PhotoField
            id="person"
            label="Personenfoto"
            file={person}
            onFiles={(files) => setPerson(files[0] ?? null)}
            className="aspect-[3/4] md:aspect-auto md:h-[clamp(420px,calc(100vh-5rem),900px)]"
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Anprobe erstellen</h1>
        <p className="mt-1 text-sm text-muted">Guthaben: {credits} Credits</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          Modus
          <InfoTip label="Was bedeuten die beiden Modi?">{modeTips}</InfoTip>
        </h2>
        {/* self-start: sonst streckt der flex-col-Container die Pille.
            Auf Mobil dafuer zentriert (self-center), ab md wieder linksbuendig
            wie der Rest der Einstellungsspalte. */}
        <div className="inline-flex self-center rounded-full border border-line p-1 text-sm md:self-start">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`rounded-full px-4 py-1.5 transition-colors ${mode === 'single' ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink'}`}
          >
            Einzeln
          </button>
          <button
            type="button"
            onClick={() => setMode('combined')}
            className={`rounded-full px-4 py-1.5 transition-colors ${mode === 'combined' ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink'}`}
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

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          Kleidungsstücke
          <TipModal
            label="Tipps für ein gutes Kleidungsfoto"
            title="So sollten deine Kleidungsfotos aussehen"
            intro="Für beste Ergebnisse mit der KI-Anprobe beachte diese Tipps:"
            good={clothingGood}
            bad={clothingBad}
          />
        </h2>

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
                  nebeneinander wie gehabt. */}
              <div className="mx-auto w-28 shrink-0 sm:mx-0">
                <PhotoField
                  id={`item-${item.id}`}
                  label={`Stück ${idx + 1}`}
                  file={item.file}
                  onFiles={(files) => assignFiles(idx, files)}
                />
              </div>

              <div className="flex flex-1 flex-col gap-3 sm:pr-8">
                <Field label="Kleidungstyp" htmlFor={`type-${item.id}`}>
                  <Select id={`type-${item.id}`} value={item.type} onChange={(e) => updateItem(item.id, { type: e.target.value })}>
                    <option value="" disabled>Bitte wählen …</option>
                    {Object.entries(CLOTHING_TYPES).map(([key, { de }]) => (
                      <option key={key} value={key}>{de}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Größe" htmlFor={`size-${item.id}`}>
                  <Select id={`size-${item.id}`} value={item.size} onChange={(e) => updateItem(item.id, { size: e.target.value })}>
                    <option value="" disabled>Bitte wählen …</option>
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Farbe (optional, für den Verkaufstext)" htmlFor={`color-${item.id}`}>
                  <Select id={`color-${item.id}`} value={item.color} onChange={(e) => updateItem(item.id, { color: e.target.value })}>
                    <option value="">Keine Angabe</option>
                    {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
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

      <div className="flex flex-col items-center gap-2 border-t border-line pt-6 md:items-start">
        {/* key erzwingt ein Neu-Mounten, sobald der Button klickbar wird —
            dadurch startet die pop-ready-Animation garantiert frisch, statt
            nur einmal beim ersten Laden zu greifen. */}
        <Button
          key={readyToGenerate ? 'ready' : 'not-ready'}
          size="lg"
          onClick={generate}
          disabled={!readyToGenerate}
          className={readyToGenerate ? 'pop-ready hover:-translate-y-0.5' : ''}
        >
          {cost > 0 ? `Generieren (${cost} ${cost === 1 ? 'Credit' : 'Credits'})` : 'Generieren'}
        </Button>
        {notEnough && <span className="text-xs text-accent">Guthaben reicht nicht — {cost} Credits nötig.</span>}
        {mode === 'single' && filledItems.length > 1 && (
          <span className="text-xs text-muted">{filledItems.length} Stücke = {filledItems.length} Bilder</span>
        )}
      </div>
      </div>
    </div>
  );
}

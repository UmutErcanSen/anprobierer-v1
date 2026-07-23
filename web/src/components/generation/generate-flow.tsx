'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, ChevronRight, Download, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/field';
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
/** Bild und Verkaufstext gehoeren zusammen — so kommt es vom Server. */
type ResultCard = { title: string; imageUrl: string | null; saleText: string | null };

const PROGRESS = [
  'Personenfoto analysieren',
  'Kleidung erkennen',
  'Größenverhältnis berechnen',
  'Stoffstruktur übertragen',
  'Perspektive anpassen',
  'Licht berechnen',
  'Qualitätsprüfung',
];

let nextId = 1;
const newItem = (): ClothingItem => ({ id: nextId++, file: null, type: '', size: '', color: '' });

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
 */
function PhotoField({
  id,
  label,
  file,
  onFiles,
  className = 'h-full min-h-44',
}: {
  id: string;
  label: string;
  file: File | null;
  onFiles: (files: File[]) => void;
  className?: string;
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
      className={`flex ${className} w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed p-1.5 text-center transition-colors ${
        over ? 'border-ink bg-surface' : 'border-line-strong bg-surface hover:border-ink'
      }`}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="h-full w-full rounded-lg object-cover" />
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

/** Laedt Bild und Text gemeinsam als ZIP — beides braucht man fuer eine Anzeige. */
async function downloadZip(cards: ResultCard[], filename: string) {
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

function CopyButton({ text }: { text: string }) {
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

export function GenerateFlow({ credits, plan }: { credits: number; plan: PlanKey }) {
  const router = useRouter();
  const maxItems = maxItemsForPlan(plan);
  const unitCost = CREDITS_PER_QUALITY[qualityForPlan(plan)];

  const [mode, setMode] = useState<'single' | 'combined'>('single');
  const [person, setPerson] = useState<File | null>(null);
  const [items, setItems] = useState<ClothingItem[]>([newItem()]);
  const [notes, setNotes] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<ResultCard[]>([]);
  const [failures, setFailures] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const filledItems = items.filter((i) => i.file);
  const imageCount = mode === 'combined' ? (filledItems.length ? 1 : 0) : filledItems.length;
  const cost = imageCount * unitCost;

  // Typ und Groesse sind in beiden Modi Pflicht (sie speisen den Verkaufstext).
  const ready =
    Boolean(person) && filledItems.length > 0 && filledItems.every((i) => i.type && i.size);
  const notEnough = cost > credits;

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
    setStatus('idle');
    setCards([]);
    setFailures(0);
    setError(null);
    setPerson(null);
    setItems([newItem()]);
    setNotes('');
  }

  async function generate() {
    if (!person) return;
    setStatus('generating');
    setError(null);
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
      const res = await fetch('/api/generate', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Etwas ist schiefgelaufen.');
        setStatus('error');
        return;
      }
      const charged = data.creditsCharged ?? cost;
      setCards(data.cards ?? []);
      setFailures(data.failures ?? 0);
      setRemaining(credits - charged);
      setStatus('done');
      router.refresh(); // Guthaben im Header sofort aktualisieren
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setStatus('error');
    }
  }

  // ---------------------------------------------------------------- Ergebnis
  if (status === 'done') {
    const imageCards = cards.filter((c) => c.imageUrl).length;
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Fertig</h1>
            <p className="mt-1 text-sm text-muted">
              {imageCards} {imageCards === 1 ? 'Bild' : 'Bilder'} · Restguthaben {remaining} Credits
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

        {/* Aufklappbare Karten: Bild und Text gehoeren zusammen. Nur die erste
            ist offen, damit man auf dem Handy nicht endlos scrollen muss. */}
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
              </div>
            </details>
          ))}
        </div>

        <div>
          <Button onClick={reset}>Neue Anprobe erstellen</Button>
        </div>
      </div>
    );
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
          {imageCount > 1 ? `${imageCount} Bilder — das dauert ein paar Minuten.` : 'Das dauert in der Regel unter einer Minute.'}
        </p>
      </div>
    );
  }

  // ----------------------------------------------------------------- Eingabe
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Anprobe erstellen</h1>
        <p className="mt-1 text-sm text-muted">Guthaben: {credits} Credits</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Dein Foto</h2>
        <div className="w-40">
          <PhotoField
            id="person"
            label="Personenfoto"
            file={person}
            onFiles={(files) => setPerson(files[0] ?? null)}
            className="aspect-[3/4]"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Modus</h2>
        {/* self-start: sonst streckt der flex-col-Container die Pille. */}
        <div className="inline-flex self-start rounded-full border border-line p-1 text-sm">
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
        <h2 className="text-sm font-medium text-ink">Kleidungsstücke</h2>

        <div className="flex flex-col gap-4">
          {items.map((item, idx) => (
            <div key={item.id} className="relative flex gap-4 rounded-xl border border-line p-4">
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

              <div className="w-28 shrink-0">
                <PhotoField
                  id={`item-${item.id}`}
                  label={`Stück ${idx + 1}`}
                  file={item.file}
                  onFiles={(files) => assignFiles(idx, files)}
                />
              </div>

              <div className="flex flex-1 flex-col gap-3 pr-8">
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

      <div className="flex flex-col items-start gap-2 border-t border-line pt-6">
        <Button size="lg" onClick={generate} disabled={!ready || notEnough || cost === 0}>
          {cost > 0 ? `Generieren (${cost} ${cost === 1 ? 'Credit' : 'Credits'})` : 'Generieren'}
        </Button>
        {notEnough && <span className="text-xs text-accent">Guthaben reicht nicht — {cost} Credits nötig.</span>}
        {mode === 'single' && filledItems.length > 1 && (
          <span className="text-xs text-muted">{filledItems.length} Stücke = {filledItems.length} Bilder</span>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
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
  Einseitiger Ablauf statt Stepper: alles auf einen Blick, Fotos jederzeit
  aenderbar, kein Weiter-Klicken. Zwei Modi:
    Einzeln     — je Kleidungsstueck ein eigenes Bild (kostet pro Bild)
    Kombiniert  — alle Stuecke in einem Bild (kostet 1×)
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

function PhotoField({
  id,
  label,
  file,
  onChange,
  aspect = 'aspect-[3/4]',
}: {
  id: string;
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  aspect?: string;
}) {
  const preview = usePreview(file);
  return (
    <label
      htmlFor={id}
      className={`flex ${aspect} w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface text-center transition-colors hover:border-ink`}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span className="px-4 text-sm text-muted">
          {label}
          <br />
          <span className="text-xs">Tippen zum Auswählen</span>
        </span>
      )}
      <input id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Zwischenablage nicht verfuegbar — Nutzer kann den Text manuell markieren.
    }
  }
  return (
    <button type="button" onClick={copy} className="text-xs text-muted underline underline-offset-4 transition-colors hover:text-ink">
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  );
}

export function GenerateFlow({ credits, plan }: { credits: number; plan: PlanKey }) {
  const maxItems = maxItemsForPlan(plan);
  const unitCost = CREDITS_PER_QUALITY[qualityForPlan(plan)];

  const [mode, setMode] = useState<'single' | 'combined'>('single');
  const [person, setPerson] = useState<File | null>(null);
  const [items, setItems] = useState<ClothingItem[]>([newItem()]);
  const [notes, setNotes] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [saleTexts, setSaleTexts] = useState<(string | null)[]>([]);

  const filledItems = items.filter((i) => i.file);
  const imageCount = mode === 'combined' ? (filledItems.length ? 1 : 0) : filledItems.length;
  const cost = imageCount * unitCost;

  const ready =
    Boolean(person) &&
    filledItems.length > 0 &&
    (mode === 'combined' || items.every((i) => !i.file || (i.type && i.size)));
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
  function addItem() {
    if (items.length < maxItems) setItems((prev) => [...prev, newItem()]);
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }
  function reset() {
    setStatus('idle');
    setResults([]);
    setSaleTexts([]);
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
        if (mode === 'single') {
          form.append('clothingType', item.type);
          form.append('size', item.size);
          form.append('color', item.color); // leer erlaubt, haelt die Indizes ausgerichtet
        }
      }
      const res = await fetch('/api/generate', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Etwas ist schiefgelaufen.');
        setStatus('error');
        return;
      }
      setResults(data.resultUrls ?? []);
      setSaleTexts(data.saleTexts ?? []);
      setStatus('done');
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setStatus('error');
    }
  }

  // Ergebnisansicht
  if (status === 'done') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Fertig</h1>
          <p className="mt-1 text-sm text-muted">
            {results.length} {results.length === 1 ? 'Bild' : 'Bilder'} erstellt · Restguthaben {credits - cost}
          </p>
        </div>
        <div className="flex flex-col gap-8">
          {results.map((url, i) => (
            <div key={url} className="grid gap-4 sm:grid-cols-2">
              <figure className="flex flex-col gap-2">
                <div className="overflow-hidden rounded-xl border border-line">
                  <Image src={url} alt={`Anprobebild ${i + 1}`} width={512} height={768} className="h-auto w-full" unoptimized />
                </div>
                <a href={url} download={`anprobe-${i + 1}.png`} className="text-sm text-ink underline underline-offset-4">
                  Bild herunterladen
                </a>
              </figure>

              {saleTexts[i] && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">Verkaufstext</span>
                    <CopyButton text={saleTexts[i]!} />
                  </div>
                  <p className="whitespace-pre-wrap rounded-xl border border-line bg-surface p-4 text-sm text-ink-soft">
                    {saleTexts[i]}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div>
          <Button onClick={reset}>Neue Anprobe erstellen</Button>
        </div>
      </div>
    );
  }

  // Wartephase
  if (status === 'generating') {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line p-6">
        <h1 className="text-lg font-medium text-ink">Deine Anprobe entsteht …</h1>
        <ul className="flex flex-col gap-2">
          {PROGRESS.map((label, i) => (
            <li key={label} className={`flex items-center gap-2 text-sm ${i <= progressIdx ? 'text-ink' : 'text-muted'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${i < progressIdx ? 'bg-ink text-on-ink' : i === progressIdx ? 'border border-ink' : 'border border-line'}`}>
                {i < progressIdx ? '✓' : ''}
              </span>
              {label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          {imageCount > 1 ? `${imageCount} Bilder — das dauert ein paar Minuten.` : 'Das dauert in der Regel unter einer Minute.'}
        </p>
      </div>
    );
  }

  // Eingabe (idle / error)
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Anprobe erstellen</h1>
        <p className="mt-1 text-sm text-muted">Guthaben: {credits} Credits</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">{error}</p>
      )}

      {/* Personenfoto */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Dein Foto</h2>
        <div className="max-w-xs">
          <PhotoField id="person" label="Personenfoto" file={person} onChange={setPerson} />
        </div>
      </section>

      {/* Modus */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Modus</h2>
        <div className="inline-flex rounded-full border border-line p-1 text-sm">
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

      {/* Kleidungsstuecke */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Kleidungsstücke</h2>
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => (
            <div key={item.id} className="flex gap-4 rounded-xl border border-line p-4">
              <div className="w-28 shrink-0">
                <PhotoField id={`item-${item.id}`} label="Foto" file={item.file} onChange={(f) => updateItem(item.id, { file: f })} />
              </div>
              <div className="flex flex-1 flex-col gap-3">
                {mode === 'single' ? (
                  <>
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
                  </>
                ) : (
                  <p className="text-sm text-muted">Stück {idx + 1}</p>
                )}
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="inline-flex items-center gap-1 self-start text-xs text-muted transition-colors hover:text-accent"
                  >
                    <X size={13} aria-hidden /> Entfernen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {items.length < maxItems ? (
          <button type="button" onClick={addItem} className="self-start text-sm text-ink underline underline-offset-4">
            + Kleidungsstück hinzufügen
          </button>
        ) : (
          <p className="text-xs text-muted">Dein Tarif erlaubt bis zu {maxItems} Stück{maxItems > 1 ? 'e' : ''} pro Anprobe.</p>
        )}
      </section>

      {/* Hinweise */}
      <section>
        <Field label="Zusätzliche Hinweise (optional)" htmlFor="notes">
          <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </section>

      {/* Aktion */}
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

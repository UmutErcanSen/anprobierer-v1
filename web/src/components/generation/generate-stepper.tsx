'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/field';
import { CLOTHING_TYPES, SIZES, CREDITS_PER_QUALITY } from '@/lib/generation/constants';

/*
  Gefuehrter Ablauf statt einer langen Seite: Foto -> Kleidung -> Details ->
  Ergebnis. Jeder Schritt hat genau eine Aufgabe, "Weiter" ist erst aktiv,
  wenn der Schritt vollstaendig ist. Der API-Key-Block der Altanwendung
  entfaellt vollstaendig.
*/

type Status = 'idle' | 'generating' | 'done' | 'error';
type Result = { resultUrl: string | null; creditsCharged: number; costUsd: number | null };

const STEPS = ['Foto', 'Kleidung', 'Details', 'Ergebnis'] as const;
const shownCost = CREDITS_PER_QUALITY.standard;

// Sichtbare Zwischenschritte waehrend der Generierung (CLAUDE.md §6). Sie
// illustrieren den Ablauf, waehrend die Anfrage laeuft — echte Job-Zustaende
// folgen mit dem asynchronen Umbau.
const PROGRESS = [
  'Personenfoto analysieren',
  'Kleidung erkennen',
  'Größenverhältnis berechnen',
  'Stoffstruktur übertragen',
  'Perspektive anpassen',
  'Licht berechnen',
  'Qualitätsprüfung',
];

function FileDrop({
  id,
  label,
  file,
  onChange,
}: {
  id: string;
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const preview = usePreview(file);
  return (
    <label
      htmlFor={id}
      className="flex aspect-[3/4] w-full max-w-xs cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface text-center transition-colors hover:border-ink"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span className="px-6 text-sm text-muted">
          {label}
          <br />
          <span className="text-xs">Tippen zum Auswählen</span>
        </span>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

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

export function GenerateStepper({ credits }: { credits: number }) {
  const [step, setStep] = useState(0);
  const [person, setPerson] = useState<File | null>(null);
  const [clothing, setClothing] = useState<File | null>(null);
  const [clothingType, setClothingType] = useState('');
  const [size, setSize] = useState('');
  const [notes, setNotes] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const personPreview = usePreview(person);

  const canNext = [Boolean(person), Boolean(clothing), Boolean(clothingType && size), true][step];
  const notEnoughCredits = credits < shownCost;

  // Zwischenschritte durchlaufen, solange generiert wird.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (status !== 'generating') return;
    setProgressIdx(0);
    timer.current = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, PROGRESS.length - 1));
    }, 7000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [status]);

  async function generate() {
    if (!person || !clothing) return;
    setStatus('generating');
    setError(null);
    setStep(3);

    try {
      const form = new FormData();
      form.set('mode', 'single');
      form.set('person', person);
      form.append('clothing', clothing);
      form.set('clothingType', clothingType);
      form.set('size', size);
      if (notes) form.set('notes', notes);

      const res = await fetch('/api/generate', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Etwas ist schiefgelaufen.');
        setStatus('error');
        return;
      }
      setResult(data);
      setStatus('done');
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Fortschrittsanzeige */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                i < step
                  ? 'border-ink bg-ink text-on-ink'
                  : i === step
                    ? 'border-ink text-ink'
                    : 'border-line text-muted'
              }`}
            >
              {i + 1}
            </span>
            <span className={`hidden text-sm sm:inline ${i === step ? 'text-ink' : 'text-muted'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      {/* Schritt 0: Personenfoto */}
      {step === 0 && (
        <div className="flex flex-col items-center gap-5 text-center">
          <div>
            <h2 className="text-xl font-medium tracking-tight text-ink">Lade ein Foto von dir hoch</h2>
            <p className="mt-1 text-sm text-muted">Am besten frontal, gut ausgeleuchtet, ganze Person sichtbar.</p>
          </div>
          <FileDrop id="person" label="Personenfoto" file={person} onChange={setPerson} />
        </div>
      )}

      {/* Schritt 1: Kleidungsfoto */}
      {step === 1 && (
        <div className="flex flex-col items-center gap-5 text-center">
          <div>
            <h2 className="text-xl font-medium tracking-tight text-ink">Und das Kleidungsstück</h2>
            <p className="mt-1 text-sm text-muted">Das Stück allein — auf einer Fläche oder am Bügel.</p>
          </div>
          <FileDrop id="clothing" label="Kleidungsstück" file={clothing} onChange={setClothing} />
        </div>
      )}

      {/* Schritt 2: Details */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <h2 className="text-xl font-medium tracking-tight text-ink">Ein paar Angaben</h2>
            <p className="mt-1 text-sm text-muted">Typ und Größe helfen der KI, das Stück richtig zu setzen.</p>
          </div>
          <Field label="Kleidungstyp" htmlFor="clothingType">
            <Select id="clothingType" value={clothingType} onChange={(e) => setClothingType(e.target.value)} required>
              <option value="" disabled>Bitte wählen …</option>
              {Object.entries(CLOTHING_TYPES).map(([key, { de }]) => (
                <option key={key} value={key}>{de}</option>
              ))}
            </Select>
          </Field>
          <Field label="Größe" htmlFor="size">
            <Select id="size" value={size} onChange={(e) => setSize(e.target.value)} required>
              <option value="" disabled>Bitte wählen …</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Zusätzliche Hinweise (optional)" htmlFor="notes">
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      )}

      {/* Schritt 3: Generierung / Ergebnis */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          {status === 'generating' && (
            <div className="flex flex-col gap-3 rounded-xl border border-line p-6">
              <h2 className="text-lg font-medium text-ink">Deine Anprobe entsteht …</h2>
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
              <p className="text-xs text-muted">Das dauert in der Regel unter einer Minute.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-start gap-4">
              <p role="alert" className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">
                {error}
              </p>
              <Button onClick={() => { setStatus('idle'); setStep(2); }} variant="outline">
                Zurück und erneut versuchen
              </Button>
            </div>
          )}

          {status === 'done' && result && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line">
                <figure className="relative">
                  {personPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={personPreview} alt="Vorher" className="h-[420px] w-full object-cover object-top grayscale" />
                  )}
                  <figcaption className="absolute bottom-3 left-3 rounded-full bg-paper/90 px-3 py-1 text-xs uppercase tracking-[0.14em] text-ink">Vorher</figcaption>
                </figure>
                <figure className="relative border-l border-paper">
                  {result.resultUrl && (
                    <Image src={result.resultUrl} alt="Nachher" width={512} height={768} className="h-[420px] w-full object-cover object-top" unoptimized />
                  )}
                  <figcaption className="absolute bottom-3 right-3 rounded-full bg-ink px-3 py-1 text-xs uppercase tracking-[0.14em] text-on-ink">Nachher</figcaption>
                </figure>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {result.resultUrl && (
                  <a href={result.resultUrl} download="anprobe.png" className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-sm font-medium text-on-ink transition-opacity hover:opacity-90">
                    Bild herunterladen
                  </a>
                )}
                <Button variant="outline" onClick={() => { setStatus('idle'); setResult(null); setStep(0); setPerson(null); setClothing(null); setClothingType(''); setSize(''); setNotes(''); }}>
                  Neue Anprobe
                </Button>
              </div>
              <p className="text-xs text-muted">{result.creditsCharged} Credit abgebucht · Restguthaben {credits - result.creditsCharged}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {step < 3 && (
        <div className="flex items-center justify-between border-t border-line pt-6">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Zurück
          </Button>

          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Weiter
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-1.5">
              <Button onClick={generate} disabled={!canNext || notEnoughCredits}>
                Generieren ({shownCost} Credit)
              </Button>
              {notEnoughCredits && <span className="text-xs text-accent">Guthaben reicht nicht.</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

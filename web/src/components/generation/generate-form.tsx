'use client';

import { useState } from 'react';
import { CLOTHING_TYPES, CREDITS_PER_QUALITY } from '@/lib/generation/constants';

/*
 * Funktionale Test-Oberfläche für den Generierungs-Ablauf. Bewusst schlicht —
 * der geführte Stepper und das Design entstehen in Phase 4. Hier geht es nur
 * darum, den End-to-End-Weg (Upload -> Abbuchung -> OpenAI -> Ergebnis) real
 * bedienbar zu machen.
 */

type Result = {
  resultUrl: string | null;
  costUsd: number | null;
  creditsCharged: number;
};

// Standard kostet 1 Credit; die tatsächliche Qualität bestimmt der Server
// anhand des Plans. Diese Anzeige dient nur der Transparenz vor dem Klick.
const shownCost = CREDITS_PER_QUALITY.standard;

export function GenerateForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setPending(true);

    try {
      const form = new FormData(e.currentTarget);
      form.set('mode', 'single');

      const res = await fetch('/api/generate', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Etwas ist schiefgelaufen.');
        return;
      }
      setResult(data);
    } catch {
      setError('Netzwerkfehler. Bitte versuch es erneut.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="person" className="text-sm font-medium">
            Personenfoto
          </label>
          <input id="person" name="person" type="file" accept="image/*" required className="text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="clothing" className="text-sm font-medium">
            Kleidungsstück
          </label>
          <input id="clothing" name="clothing" type="file" accept="image/*" required className="text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="clothingType" className="text-sm font-medium">
            Kleidungstyp
          </label>
          <select
            id="clothingType"
            name="clothingType"
            required
            defaultValue=""
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          >
            <option value="" disabled>
              Bitte wählen …
            </option>
            {Object.entries(CLOTHING_TYPES).map(([key, { de }]) => (
              <option key={key} value={key}>
                {de}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="size" className="text-sm font-medium">
            Größe (optional)
          </label>
          <input
            id="size"
            name="size"
            type="text"
            placeholder="z.B. M, 38, L …"
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-sm font-medium">
            Zusätzliche Hinweise (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Wird generiert … (kann ~30 Sek. dauern)' : `Generieren (${shownCost} Credit)`}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm opacity-70">
            Fertig — {result.creditsCharged} Credit abgebucht
            {result.costUsd != null && ` · reale Kosten: $${result.costUsd.toFixed(4)}`}
          </p>
          {result.resultUrl && (
            <img
              src={result.resultUrl}
              alt="Generiertes Anprobebild"
              className="w-full max-w-md rounded-xl border border-black/10 dark:border-white/15"
            />
          )}
        </div>
      )}
    </div>
  );
}

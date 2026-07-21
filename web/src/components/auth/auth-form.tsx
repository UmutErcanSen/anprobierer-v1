'use client';

import { useActionState } from 'react';
import type { AuthState } from '@/lib/auth/actions';

/*
 * Bewusst schlicht gehalten. Das Design-System entsteht in Phase 4 — hier
 * geht es zuerst darum, dass der Ablauf funktioniert und zugänglich ist.
 * Aufwand in Optik zu stecken, die ohnehin ersetzt wird, wäre verschwendet.
 */

type Field = {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  required?: boolean;
  hint?: string;
};

type Props = {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
};

export function AuthForm({ action, fields, submitLabel, pendingLabel }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {state.error}
        </p>
      )}

      {state.notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {state.notice}
        </p>
      )}

      {fields.map((field) => {
        const errorId = `${field.name}-error`;
        const hintId = `${field.name}-hint`;
        const fieldError = state.fieldErrors?.[field.name];

        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
            </label>

            <input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              required={field.required}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={
                [fieldError ? errorId : null, field.hint ? hintId : null]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-current dark:border-white/20"
            />

            {field.hint && (
              <p id={hintId} className="text-xs opacity-60">
                {field.hint}
              </p>
            )}

            {fieldError && (
              <p id={errorId} className="text-xs text-red-700 dark:text-red-300">
                {fieldError}
              </p>
            )}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

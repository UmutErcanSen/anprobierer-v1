'use client';

import { useActionState, type ReactNode } from 'react';
import type { AuthState } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Field, inputClasses } from '@/components/ui/field';

type FieldDef = {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  required?: boolean;
  hint?: string;
};

type Props = {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  fields: FieldDef[];
  submitLabel: string;
  pendingLabel: string;
  /** Zusaetzliche Zeile zwischen Feldern und Absenden-Knopf -- aktuell die
   *  Einwilligungs-Checkbox bei der Registrierung. Als `children` statt als
   *  weiterer FieldDef-Typ: eine Checkbox mit Fliesstext und eingebettetem
   *  Link passt nicht in das Label/Input-Schema von `fields`. */
  children?: ReactNode;
};

export function AuthForm({ action, fields, submitLabel, pendingLabel, children }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <p role="alert" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">
          {state.error}
        </p>
      )}

      {state.notice && (
        <p role="status" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
          {state.notice}
        </p>
      )}

      {fields.map((field) => {
        const fieldError = state.fieldErrors?.[field.name];
        return (
          <Field
            key={field.name}
            label={field.label}
            htmlFor={field.name}
            hint={field.hint}
            error={fieldError}
          >
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              required={field.required}
              aria-invalid={fieldError ? true : undefined}
              className={inputClasses}
            />
          </Field>
        );
      })}

      {/* Fehler zur Einwilligung erscheint hier, nicht im children-Block --
          so muss die aufrufende Seite den Formularzustand nicht kennen. */}
      {children && (
        <div className="flex flex-col gap-1.5">
          {children}
          {state.fieldErrors?.consent && (
            <p role="alert" className="text-xs text-accent">
              {state.fieldErrors.consent}
            </p>
          )}
        </div>
      )}

      <Button type="submit" disabled={pending} className="mt-1 w-full" size="lg">
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

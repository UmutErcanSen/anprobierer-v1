'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { inputClasses } from '@/components/ui/field';
import { updateDisplayNameAction, type NameState } from '@/lib/konto/actions';

/*
  Anzeigename aendern -- Berichtigungsrecht nach DSGVO Art. 16 (siehe
  lib/konto/actions.ts). Bewusst als eigene, kleine Zeile in der
  Datenschutz-Karte statt als separater "Profil"-Bereich: Es ist derzeit das
  einzige aenderbare Stammdatum, ein eigener Abschnitt mit genau einem Feld
  waere ueberdimensioniert.
*/
export function DisplayNameForm({ initialName }: { initialName: string }) {
  const [state, formAction, pending] = useActionState<NameState, FormData>(updateDisplayNameAction, {});

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="displayName" className="sr-only">
          Anzeigename
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={initialName}
          maxLength={100}
          placeholder="Dein Name"
          autoComplete="name"
          className={`${inputClasses} sm:w-56`}
        />
        <Button type="submit" variant="outline" size="md" disabled={pending} className="shrink-0">
          {pending ? 'Speichert …' : 'Speichern'}
        </Button>
      </div>

      {/* Rueckmeldung direkt unter dem Feld statt als Toast: Die Aenderung ist
          klein und lokal, ein bildschirmweiter Hinweis waere
          unverhaeltnismaessig. */}
      {(state.error || state.notice) && (
        <p
          role={state.error ? 'alert' : 'status'}
          className={`text-xs ${state.error ? 'text-accent' : 'text-success'}`}
        >
          {state.error ?? state.notice}
        </p>
      )}
    </form>
  );
}

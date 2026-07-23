import type { ComponentProps, ReactNode } from "react";

/*
  Gemeinsame Formular-Bausteine im Editorial-Stil. Eine Quelle fuer Look und
  Verhalten von Eingaben — damit jedes Feld auf jeder Seite gleich aussieht
  und der sichtbare Fokus (Tastaturbedienung) ueberall stimmt.
*/

export const controlClasses =
  "w-full rounded-lg border border-line bg-paper px-3.5 text-[15px] text-ink " +
  "placeholder:text-muted transition-colors hover:border-line-strong " +
  "focus:border-ink focus:outline-none focus-visible:outline-none";

export const inputClasses = `${controlClasses} h-11`;

export function Label({ children, ...props }: ComponentProps<"label">) {
  return (
    <label className="text-sm font-medium text-ink" {...props}>
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input className={inputClasses} {...props} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  // resize-none: das native Ziehgriff-Resize eines Textareas veraendert nur
  // dessen eigene Hoehe, kann aber je nach umgebendem Layout (z.B. Flex-
  // Geschwister, deren Hoehe an den Inhalt gekoppelt ist) unerwuenscht auf
  // Nachbarelemente durchschlagen. Feste Zeilenzahl per `rows` reicht hier.
  return <textarea className={`${controlClasses} resize-none py-2.5`} {...props} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select className={inputClasses} {...props} />;
}

/** Feld-Wrapper: Label, Eingabe, optionaler Hinweis und Fehler. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-accent">
          {error}
        </p>
      )}
    </div>
  );
}

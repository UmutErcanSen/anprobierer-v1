import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/*
  Ein Button, drei Varianten — mehr braucht das Editorial-System nicht.
  Pillenform, Haarlinie statt Schatten. "primary" ist die eine gefuellte
  Aktion pro Ansicht; alles andere bleibt zurueckhaltend.
*/

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "md" | "lg";

// Dezenter Lift statt Schatten (bleibt beim "Haarlinie statt Schatten"-
// Prinzip oben): ein Pixel hoch beim Hover, beim Klick leicht angedrueckt --
// spuerbares Feedback, ohne die ruhige Flaeche mit einem Schlagschatten zu
// durchbrechen. disabled:hover:translate-y-0 verhindert den Lift bei
// deaktivierten Buttons, deren Cursor zwar "not-allowed" zeigt, aber ueber
// die pointer-events-none-Regel unten ohnehin keine echten Hover-Events mehr
// bekommt -- die Zeile ist nur ein Sicherheitsnetz gegen kuenftige Aenderungen
// an dieser Regel.
const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-[background-color,color,opacity,transform] duration-150 " +
  "hover:-translate-y-px active:translate-y-0 active:scale-[0.97] " +
  "disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0 whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-on-ink hover:opacity-90",
  outline: "border border-line-strong text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-surface",
  // Gefuellt statt nur umrandet, aus demselben Grund wie --danger selbst
  // (siehe globals.css): fuer die eine wirklich unwiderrufliche Aktion darf
  // die Farbe nicht mit einem zurueckhaltenden Outline-Button verwaessert
  // werden. text-on-ink statt einer fixen Farbe, weil --on-ink pro Theme
  // schon auf ausreichenden Kontrast zur jeweiligen Vollflaeche abgestimmt
  // ist (genau das gleiche Prinzip wie bei "primary" oben, nur mit
  // --danger statt --ink als Flaeche).
  danger: "bg-danger text-on-ink hover:opacity-90",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[15px]",
};

function classes(variant: Variant, size: Size, extra?: string) {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={classes(variant, size, className)} {...props} />;
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

/** Gleiche Optik als Link — fuer Navigation statt Aktionen. */
export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={classes(variant, size, className)} {...props} />;
}

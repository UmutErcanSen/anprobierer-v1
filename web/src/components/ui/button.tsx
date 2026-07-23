import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/*
  Ein Button, drei Varianten — mehr braucht das Editorial-System nicht.
  Pillenform, Haarlinie statt Schatten. "primary" ist die eine gefuellte
  Aktion pro Ansicht; alles andere bleibt zurueckhaltend.
*/

type Variant = "primary" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-[background-color,color,opacity,transform] duration-150 " +
  "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-on-ink hover:opacity-90",
  outline: "border border-line-strong text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-surface",
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

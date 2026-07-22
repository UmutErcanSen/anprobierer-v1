import Link from "next/link";
import type { ReactNode } from "react";

/*
  Zentrierte Huelle fuer Anmelden/Registrieren. Reduziert auf das Noetige —
  Wortmarke oben, Formular in der Mitte. Keine volle Navigation, damit im
  Anmeldeschritt nichts ablenkt.
*/
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="px-6 py-6">
        <Link href="/" className="text-[15px] font-medium uppercase tracking-[0.16em] text-ink">
          Anprobierer
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </main>
  );
}

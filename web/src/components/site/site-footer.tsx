import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <span className="uppercase tracking-[0.16em] text-ink">Anprobierer</span>
        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href="/preise" className="transition-colors hover:text-ink">Preise</Link>
          <Link href="/datenschutz" className="transition-colors hover:text-ink">Datenschutz</Link>
          <Link href="/impressum" className="transition-colors hover:text-ink">Impressum</Link>
        </nav>
        <span>© {new Date().getFullYear()} Anprobierer</span>
      </div>
    </footer>
  );
}

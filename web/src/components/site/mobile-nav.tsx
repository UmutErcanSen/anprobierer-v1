'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

/*
  Mobiles Navigationsmenue. Ohne das war "Anmelden" auf dem Handy nur ueber
  den Start-Button erreichbar — bei einer mobil-lastigen Zielgruppe eine echte
  Luecke. Oeffnet ein Overlay mit allen Links.
*/

type Item = { href: string; label: string };

export function MobileNav({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);

  // Body-Scroll sperren, solange das Overlay offen ist.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menü öffnen"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
      >
        <Menu size={20} aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-paper">
          <div className="flex h-16 items-center justify-between px-6">
            <span className="text-[15px] font-medium uppercase tracking-[0.16em] text-ink">Anprobierer</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Menü schließen"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-6 py-4">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-4 text-lg text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

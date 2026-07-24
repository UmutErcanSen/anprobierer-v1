'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

/*
  Mobiles Navigationsmenue. Ohne das war "Anmelden" auf dem Handy nur ueber
  den Start-Button erreichbar — bei einer mobil-lastigen Zielgruppe eine echte
  Luecke. Oeffnet ein Overlay mit allen Links.

  `children` nimmt zusaetzliche Zeilen auf, die keine einfachen Links sind
  (Theme-Umschalter, Abmelden-Formular) — so bleibt die Komponente fuer
  Marketing- und eingeloggten Header gleichermassen nutzbar.
*/

type Item = { href: string; label: string };

export function MobileNav({ items, children }: { items: Item[]; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Das Overlay wird erst NACH dem ersten Client-Render eingehaengt: waehrend
  // des Server-Renders gibt es kein `document`, createPortal(..., document.body)
  // wuerde dort abstuerzen. Einmal eingehaengt bleibt es dauerhaft im DOM (nur
  // per Transform ausserhalb des Bildschirms) -- erst das ermoeglicht die
  // Slide-in-Animation beim Oeffnen, statt dass das Menue schlagartig
  // erscheint/verschwindet.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

      {/*
        ueber ein Portal direkt an document.body gehaengt: Der Header hat
        `backdrop-blur-md` (backdrop-filter), und ein Element mit aktivem
        filter/backdrop-filter wird fuer seine `position: fixed`-Nachkommen
        zum eigenen Containing Block (CSS-Spezifikation). Ohne das Portal
        waere dieses "fixed inset-0"-Overlay also nicht am Bildschirm fixiert,
        sondern nur an der 64px hohen Header-Leiste — das Menue schien dann
        nicht zu funktionieren, weil es nur einen schmalen Streifen oben
        ausfuellte statt des ganzen Bildschirms.

        `inert` waehrend geschlossen: verhindert Tab-Fokus und Klicks auf das
        ausserhalb des Bildschirms liegende Menue, ohne es aus dem DOM zu
        nehmen (das wuerde die Animation wieder zunichtemachen).
      */}
      {mounted &&
        createPortal(
          <div
            inert={!open}
            className={`fixed inset-0 z-[100] overflow-y-auto bg-paper transition-transform duration-300 ease-out ${
              open ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
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
              {children}
            </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}

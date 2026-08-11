'use client';

import { useEffect, type RefObject } from 'react';

/*
  Fokusverwaltung fuer Overlays (Bestaetigungsdialoge, Modals, mobiles Menue,
  Auswahl-Sheet).

  Warum das noetig ist: Die Overlays der App setzen `aria-modal="true"` bzw.
  `role="dialog"`. Damit sagen sie Hilfstechnik zu, dass ALLES ausserhalb
  gerade nicht existiert. Ohne Fokusverwaltung stimmte das nicht: Der Fokus
  blieb beim ausloesenden Knopf HINTER dem Overlay, mit Tab wanderte man durch
  die verdeckte Seite weiter, und ein Screenreader meldete dabei nichts --
  weil er die Seite ja fuer nicht vorhanden haelt. Das Versprechen wurde also
  gegeben, aber nicht eingeloest. Am schwersten wog das ausgerechnet beim
  Bestaetigungsdialog vor unwiderruflichen Loeschungen.

  Drei Dinge passieren hier:
    1. Beim Oeffnen wandert der Fokus in das Overlay.
    2. Tab und Shift+Tab bleiben darin gefangen.
    3. Beim Schliessen kehrt der Fokus dorthin zurueck, wo er herkam --
       sonst landet er am Seitenanfang und der Nutzer verliert die Stelle.

  Escape wird bewusst NICHT hier behandelt: Die Komponenten tun das bereits
  selbst, und was "Schliessen" bedeutet, weiss nur die jeweilige Komponente.
*/

/** Elemente, die den Fokus ueberhaupt annehmen koennen. */
const FOKUSSIERBAR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(open: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = ref.current;
    if (!open || !container) return;

    // Wohin der Fokus nach dem Schliessen zurueckkehren soll.
    const vorher = document.activeElement as HTMLElement | null;

    /* Jedes Mal frisch abfragen statt einmal zu merken: Der Inhalt aendert
       sich waehrend das Overlay offen ist -- im ConfirmDialog wird der
       Bestaetigen-Knopf erst klickbar, wenn das Sicherheitswort getippt
       wurde, und ein deaktivierter Knopf nimmt keinen Fokus an. */
    const elemente = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOKUSSIERBAR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    /* Erst nach dem Paint fokussieren: Beim Oeffnen laeuft eine
       Einblend-Animation, und ein Fokus auf ein noch unsichtbares Element
       laesst manche Browser die Seite springen. */
    const timer = window.setTimeout(() => {
      const ziele = elemente();
      // Bevorzugt ein Eingabefeld (Sicherheitswort im Loeschdialog), sonst
      // das erste fokussierbare Element. Bewusst NICHT der Bestaetigen-Knopf:
      // Bei einer unwiderruflichen Aktion soll die Leertaste nicht sofort
      // ausloesen.
      const eingabe = ziele.find((el) => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      (eingabe ?? ziele[0])?.focus();
    }, 50);

    /* Bewusst als Pfeilfunktion in einer const, nicht als
       `function`-Deklaration: Letztere wird nach oben gezogen und koennte
       theoretisch vor der Null-Pruefung oben laufen -- TypeScript verwirft
       deshalb die Verengung von `container` und meldet "possibly null". */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const ziele = elemente();
      if (ziele.length === 0) {
        e.preventDefault(); // Nichts zu fokussieren -- trotzdem nicht hinausspringen.
        return;
      }
      const erstes = ziele[0];
      const letztes = ziele[ziele.length - 1];
      const aktiv = document.activeElement;

      // Auch der Fall "Fokus ist gar nicht im Overlay" wird abgefangen --
      // etwa nach einem Klick auf den Hintergrund.
      if (!container.contains(aktiv)) {
        e.preventDefault();
        erstes.focus();
        return;
      }
      if (e.shiftKey && aktiv === erstes) {
        e.preventDefault();
        letztes.focus();
      } else if (!e.shiftKey && aktiv === letztes) {
        e.preventDefault();
        erstes.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      // Nur zuruecksetzen, wenn das Element noch existiert und sichtbar ist --
      // nach einer Loeschung ist der ausloesende Knopf womoeglich weg.
      if (vorher?.isConnected) vorher.focus();
    };
  }, [open, ref]);
}

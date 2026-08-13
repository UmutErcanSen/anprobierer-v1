import { BETA_AKTIV } from '@/lib/beta/config';

/*
  Hinweis auf die geschlossene Beta -- global ueber allen Seiten.

  Bewusst KEIN wegklickbarer Hinweis: Waehrend der Beta ist die Aussage
  dauerhaft gueltig, und ein einmal geschlossener Banner waere genau bei dem
  Testenden weg, der ihn beim naechsten Fehler am noetigsten braucht.

  Bewusst auch KEIN eigenes `sticky`: Der Banner sitzt UEBER dem Header, und
  der Header ist bereits `sticky top-0`. Zwei uebereinander klebende Elemente
  wuerden sich gegenseitig verdecken -- der Banner scrollt deshalb mit weg,
  der Header bleibt. Wer waehrend des Scrollens daran erinnert werden soll,
  bekommt das ohnehin ueber den veraenderten Header-Zustand mit.

  Rendert nichts, wenn die Beta aus ist -- zum Livegang muss hier also
  nichts entfernt werden.
*/
export function BetaBanner() {
  if (!BETA_AKTIV) return null;

  return (
    <div className="border-b border-line bg-ink px-6 py-2.5 text-center text-on-ink">
      <p className="mx-auto max-w-4xl text-xs leading-relaxed sm:text-[13px]">
        <span className="mr-2 rounded-full border border-current px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]">
          Beta
        </span>
        Geschlossener Test — die Anwendung ist noch nicht öffentlich. Es können Fehler auftreten, und Ergebnisse sowie
        Guthaben können zurückgesetzt werden.
      </p>
    </div>
  );
}

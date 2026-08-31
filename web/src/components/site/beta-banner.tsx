import { BETA_AKTIV } from '@/lib/beta/config';

/*
  Hinweis auf die geschlossene Beta -- global ueber allen Seiten.

  Bewusst KEIN wegklickbarer Hinweis: Waehrend der Beta ist die Aussage
  dauerhaft gueltig, und ein einmal geschlossener Banner waere genau bei dem
  Testenden weg, der ihn beim naechsten Fehler am noetigsten braucht.

  Klebt beim Scrollen mit -- das uebernimmt der gemeinsame Container
  ChromeOben, nicht dieser Banner selbst (siehe dort, warum).

  Zwei Textfassungen statt einer umbrechenden: Der volle Satz braucht auf
  einem schmalen Handy drei Zeilen. Dauerhaft sichtbar waeren das rund 70px,
  die zusammen mit dem Header ein Fuenftel des Bildschirms wegnehmen -- der
  Hinweis wuerde die Anwendung verdraengen, um vor ihr zu warnen. Die kurze
  Fassung nennt deshalb nur die Konsequenz, die im Zweifel wirklich zaehlt
  (Daten koennen weg sein), die lange erklaert ab sm zusaetzlich das Warum.

  Rendert nichts, wenn die Beta aus ist -- zum Livegang muss hier also
  nichts entfernt werden.
*/
export function BetaBanner() {
  if (!BETA_AKTIV) return null;

  return (
    <div className="border-b border-line bg-ink px-4 py-2 text-center text-on-ink sm:px-6 sm:py-2.5">
      <p className="mx-auto max-w-4xl text-xs leading-relaxed sm:text-[13px]">
        <span className="mr-2 rounded-full border border-current px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]">
          Beta
        </span>
        <span className="sm:hidden">Geschlossener Test — Ergebnisse und Guthaben können zurückgesetzt werden.</span>
        <span className="hidden sm:inline">
          Geschlossener Test — die Anwendung ist noch nicht öffentlich. Es können Fehler auftreten, und Ergebnisse sowie
          Guthaben können zurückgesetzt werden.
        </span>
      </p>
    </div>
  );
}

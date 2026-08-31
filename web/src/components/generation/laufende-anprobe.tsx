'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/*
  Leiste "Deine Anprobe entsteht" -- auf JEDER Seite, direkt unter dem
  Beta-Hinweis (siehe ChromeOben).

  Warum es das gibt: Die Warteansicht versprach "du kannst die Seite
  schliessen", aber danach gab es keinerlei Rueckmeldung mehr -- wer
  weggeklickt hat, musste raten und im Verlauf nachsehen. Diese Leiste ist
  die Rueckmeldung, ohne dass wir dafuer einen E-Mail-Dienst brauchen: Der
  Status kommt frisch aus der Datenbank, ueberlebt also Neuladen, Tabwechsel
  und sogar einen Geraetewechsel.

  Warum kein Toast: Ein Toast verschwindet nach Sekunden. Eine Generierung
  dauert laenger als der Blick zur Seite, und die Fertig-Meldung soll auch
  dann noch da sein, wenn man gerade nicht hingesehen hat.
*/

type Job = {
  id: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed';
  fertig: number;
  gesamt: number;
};

const POLL_MS = 3000;

/** Merkt sich, welche fertigen Anproben schon gemeldet wurden -- sonst
 *  begruesst uns dieselbe Meldung bei jedem Seitenwechsel neu. */
const GEMELDET_KEY = 'anprobe:gemeldet';

/** Einmal 401 gesehen = nicht angemeldet. Dann fuer den Rest der Sitzung gar
 *  nicht mehr fragen, statt auf jeder Marketing-Seite erneut. */
const ABGEMELDET_KEY = 'anprobe:abgemeldet';

function gemeldeteLesen(): string[] {
  try {
    const roh = localStorage.getItem(GEMELDET_KEY);
    return roh ? (JSON.parse(roh) as string[]) : [];
  } catch {
    // Privater Modus, blockierte Site-Daten, Vorschau-Kontexte: Der Zugriff
    // selbst kann werfen. Ohne Gedaechtnis funktioniert die Leiste weiter,
    // sie meldet dann hoechstens einmal zu viel.
    return [];
  }
}

function merken(id: string) {
  try {
    // Auf 20 Eintraege begrenzt: Es geht nur darum, kurzfristige
    // Doppelmeldungen zu verhindern, nicht um ein Archiv.
    const neu = [id, ...gemeldeteLesen().filter((x) => x !== id)].slice(0, 20);
    localStorage.setItem(GEMELDET_KEY, JSON.stringify(neu));
  } catch {
    /* siehe gemeldeteLesen() */
  }
}

export function LaufendeAnprobe() {
  const pfad = usePathname();
  const [jobs, setJobs] = useState<Job[]>([]);
  /*
    localStorage schon beim Initialisieren lesen statt in einem Effekt. Das
    ist hier gefahrlos, obwohl Server und Client dabei verschiedene Werte
    bekommen: Beim ersten Rendern ist `jobs` noch leer, die Komponente gibt
    also auf beiden Seiten `null` zurueck -- es gibt nichts, das sich
    unterscheiden koennte. Der Umweg ueber einen Effekt haette dagegen eine
    ueberfluessige zweite Renderrunde ausgeloest.
  */
  const [gemeldet, setGemeldet] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : gemeldeteLesen(),
  );
  const abgemeldet = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holen = useCallback(async () => {
    if (abgemeldet.current) return;
    try {
      const res = await fetch('/api/generate/laufend', { cache: 'no-store' });
      if (res.status === 401) {
        abgemeldet.current = true;
        try {
          sessionStorage.setItem(ABGEMELDET_KEY, '1');
        } catch {
          /* siehe gemeldeteLesen() */
        }
        setJobs([]);
        return;
      }
      if (!res.ok) return;
      const daten = (await res.json()) as { jobs?: Job[] };
      setJobs(daten.jobs ?? []);
    } catch {
      // Netz weg: Der naechste Poll versucht es erneut. Eine Fehlermeldung
      // waere hier falsch -- die Generierung laeuft serverseitig ungestoert
      // weiter, nur unser Blick darauf fehlt gerade.
    }
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(ABGEMELDET_KEY)) abgemeldet.current = true;
    } catch {
      /* siehe gemeldeteLesen() */
    }

    let abgebrochen = false;

    async function runde() {
      await holen();
      if (abgebrochen) return;
      timer.current = setTimeout(runde, POLL_MS);
    }

    void runde();

    // Frisch nachsehen, sobald der Tab wieder sichtbar wird: Wer in einem
    // anderen Tab startet oder das Handy weglegt, soll beim Zurueckkommen
    // sofort den echten Stand sehen, nicht erst nach dem naechsten Intervall.
    const nachsehen = () => {
      if (document.visibilityState === 'visible') void holen();
    };
    document.addEventListener('visibilitychange', nachsehen);
    // Eigenes Signal aus dem Erstellen-Formular: ohne das taucht die Leiste
    // erst beim naechsten Poll auf, also bis zu 3 Sekunden nach dem Start.
    window.addEventListener('anprobe:gestartet', nachsehen);

    return () => {
      abgebrochen = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', nachsehen);
      window.removeEventListener('anprobe:gestartet', nachsehen);
    };
  }, [holen]);

  const laufend = jobs.filter((j) => j.status === 'queued' || j.status === 'processing');
  const frischFertig = jobs.filter(
    (j) => j.status !== 'queued' && j.status !== 'processing' && !gemeldet.includes(j.id),
  );

  // Laufendes hat Vorrang: Wer gerade wartet, will den Fortschritt sehen,
  // nicht die Quittung fuer die Anprobe davor.
  const job = laufend[0] ?? frischFertig[0];
  if (!job) return null;

  /*
    Auf dem Erstellen-Formular NICHT anzeigen: Dort laeuft bereits die grosse
    Warteansicht mit denselben Informationen. Zwei Fortschrittsanzeigen
    uebereinander waeren keine doppelte Sicherheit, sondern Laerm.

    Ebenso auf der Ergebnisseite genau dieser Anprobe -- wer schon draufsieht,
    braucht keinen Hinweis, dass es sie gibt.
  */
  if (pfad === '/anzeige-erstellen') return null;
  if (pfad === `/konto/verlauf/${job.id}`) return null;

  const laeuft = job.status === 'queued' || job.status === 'processing';
  const gescheitert = job.status === 'failed';
  const anteil = job.gesamt > 1 ? Math.round((job.fertig / job.gesamt) * 100) : 0;

  function abhaken() {
    merken(job.id);
    setGemeldet((g) => [job.id, ...g]);
  }

  return (
    <div role="status" aria-live="polite" className="relative overflow-hidden border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        {/* Punkt statt Spinner: ruhiger, und er sagt dasselbe. */}
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${
            laeuft
              ? 'animate-pulse bg-accent motion-reduce:animate-none'
              : gescheitert
                ? 'bg-danger'
                : 'bg-success'
          }`}
        />

        <p className="min-w-0 flex-1 truncate text-xs text-ink-soft sm:text-[13px]">
          {laeuft ? (
            <>
              <span className="text-ink">Deine Anprobe entsteht …</span>
              {job.gesamt > 1 && (
                <span className="ml-2 text-muted">
                  {job.fertig} von {job.gesamt} Bildern
                </span>
              )}
            </>
          ) : gescheitert ? (
            <span className="text-ink">Deine Anprobe hat nicht geklappt.</span>
          ) : (
            <span className="text-ink">Deine Anprobe ist fertig.</span>
          )}
        </p>

        <Link
          href={`/konto/verlauf/${job.id}`}
          onClick={() => {
            // Wer hinsieht, braucht die Meldung danach nicht mehr.
            if (!laeuft) abhaken();
          }}
          className="shrink-0 rounded-full border border-line-strong px-3 py-1 text-xs text-ink transition-colors hover:bg-paper"
        >
          {laeuft ? 'Ansehen' : gescheitert ? 'Details' : 'Öffnen'}
        </Link>

        {/* Wegklicken nur im Endzustand: Solange etwas laeuft, ist die Leiste
            die einzige Spur davon -- sie darf nicht verschwindbar sein. */}
        {!laeuft && (
          <button
            type="button"
            onClick={abhaken}
            aria-label="Hinweis schließen"
            className="shrink-0 rounded-full px-1.5 text-lg leading-none text-muted transition-colors hover:text-ink"
          >
            ×
          </button>
        )}
      </div>

      {/* Fortschrittslinie am unteren Rand: bei mehreren Bildern echt
          gemessen, bei einem einzelnen unbestimmt (siehe globals.css). */}
      {laeuft && (
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
          {job.gesamt > 1 ? (
            <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${anteil}%` }} />
          ) : (
            <div className="anprobe-laeuft h-full w-1/5 bg-accent" />
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { alsGemeldetMerken, gemeldeteLesen } from '@/lib/generation/gemeldet';

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
  createdAt: string;
};

/*
  Zwei Takte statt einem festen. Der schnelle gilt nur, solange tatsaechlich
  etwas laeuft; sonst fragt die Leiste selten nach.

  Warum das wichtig ist: Ein fester 3-Sekunden-Takt bedeutet fuer JEDEN
  angemeldeten Nutzer rund 1200 Anfragen pro Stunde -- dauerhaft, auch wenn
  er nur im Verlauf blaettert. Das ist Last und Kosten fuer eine Antwort, die
  fast immer "nichts los" lautet. Im Ruhetakt sind es 60 pro Stunde, und
  Ereignisse (Tab wieder sichtbar, Generierung gestartet) holen den Stand
  ohnehin sofort.
*/
const POLL_AKTIV_MS = 3000;
const POLL_RUHE_MS = 60_000;

/** Einmal 401 gesehen = nicht angemeldet. Dann fuer den Rest der Sitzung gar
 *  nicht mehr fragen, statt auf jeder Marketing-Seite erneut. */
const ABGEMELDET_KEY = 'anprobe:abgemeldet';

/*
  Ab wann eine "laufende" Anprobe als haengengeblieben gilt.

  Die Route selbst gibt nach 300 Sekunden auf (maxDuration). Was danach immer
  noch auf 'processing' steht, wurde hart abgeraeumt -- Serverneustart,
  abgeschossener Prozess -- und wird von allein nie mehr fertig. Ohne diese
  Grenze zeigte die Leiste dafuer bis in alle Ewigkeit "entsteht ..." und
  pollte im Sekundentakt dagegen an.

  Doppelt so lang wie das Serverlimit angesetzt, damit eine echte, nur zaehe
  Generierung nicht faelschlich als tot gemeldet wird.
*/
const HAENGT_AB_MINUTEN = 10;

export function LaufendeAnprobe() {
  const pfad = usePathname();
  const [jobs, setJobs] = useState<Job[]>([]);
  /*
    localStorage schon beim Initialisieren lesen statt in einem Effekt. Das
    ist hier gefahrlos, obwohl Server und Client dabei verschiedene Werte
    bekommen: Beim ersten Rendern ist `jobs` noch leer, es gibt also nichts,
    das sich unterscheiden koennte. Der Umweg ueber einen Effekt haette
    dagegen eine ueberfluessige zweite Renderrunde ausgeloest.
  */
  const [gemeldet, setGemeldet] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : gemeldeteLesen(),
  );
  const abgemeldet = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Steuert den Takt der naechsten Runde. Als ref, damit der Poll-Effekt
   *  nicht bei jeder Statusaenderung neu aufgesetzt werden muss. */
  const eiligRef = useRef(false);
  /** Verhindert zwei gleichzeitige Abfragen -- sonst kann ein Ereignis eine
   *  zweite starten, waehrend die erste noch unterwegs ist. */
  const laeuftAbfrage = useRef(false);
  /** Zeitpunkt der letzten Abfrage -- deckelt ereignisgetriebenes Nachfassen. */
  const zuletztGefragt = useRef(0);

  const holen = useCallback(async () => {
    if (abgemeldet.current || laeuftAbfrage.current) return;
    laeuftAbfrage.current = true;
    try {
      const res = await fetch('/api/generate/laufend', { cache: 'no-store' });
      if (res.status === 401) {
        abgemeldet.current = true;
        try {
          sessionStorage.setItem(ABGEMELDET_KEY, '1');
        } catch {
          /* Zugriff kann in privaten Fenstern werfen -- dann fragen wir eben
             bei jedem Seitenaufruf einmal neu. */
        }
        setJobs([]);
        return;
      }
      if (!res.ok) return;
      const daten = (await res.json()) as { jobs?: Job[] };
      const neu = daten.jobs ?? [];
      // Schneller Takt nur, solange etwas laeuft UND nicht haengt.
      eiligRef.current = neu.some((j) => istAktiv(j));
      setJobs(neu);
      /*
        Den Merkzettel gleich mitlesen: localStorage ist die einzige Wahrheit
        darueber, was schon gezeigt wurde -- dieser Zustand ist nur ein
        Abbild davon. So wirkt auch ein Vermerk, der ohne Klick entstanden
        ist (Ergebnisseite offen gehabt, anderer Tab), ohne dass irgendwo ein
        setState in einem Effekt noetig waere.

        Nur bei echter Aenderung setzen, sonst erzeugte jeder Poll eine neue
        Array-Referenz und damit eine ueberfluessige Renderrunde.
      */
      const merkzettel = gemeldeteLesen();
      setGemeldet((alt) =>
        alt.length === merkzettel.length && alt.every((x, i) => x === merkzettel[i]) ? alt : merkzettel,
      );
    } catch {
      // Netz weg: Die naechste Runde versucht es erneut. Eine Fehlermeldung
      // waere hier falsch -- die Generierung laeuft serverseitig ungestoert
      // weiter, nur unser Blick darauf fehlt gerade.
    } finally {
      laeuftAbfrage.current = false;
      zuletztGefragt.current = Date.now();
    }
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(ABGEMELDET_KEY)) abgemeldet.current = true;
    } catch {
      /* siehe holen() */
    }

    let aktiv = true;
    /*
      Eine einzige Kette, erzwungen ueber ein Token.

      Vorher startete jedes Ereignis (Tab sichtbar, Anprobe gestartet) eine
      ZWEITE Schleife, waehrend die erste noch auf ihre Antwort wartete. Die
      alte Schleife wurde dabei nie abgeraeumt: `clearTimeout` traf nur den
      gerade eingetragenen Timer, und die noch laufende Runde trug danach
      ihren eigenen nach. Bei jedem Ereignis kam so eine Kette dazu -- gemessen
      waren es nach kurzer Zeit Abfragen im 2-Sekunden-Takt, obwohl gar nichts
      lief. Genau das Gegenteil dessen, was der Ruhetakt bewirken soll.

      Jetzt vergibt `plane` bei jedem Aufruf eine neue Nummer und raeumt den
      Vorgaenger ab. Nur der Timer mit der aktuellen Nummer darf feuern, egal
      wie viele Ereignisse sich ueberholen.
    */
    let nummer = 0;

    function plane(ms: number) {
      if (!aktiv) return;
      if (timer.current) clearTimeout(timer.current);
      const meine = ++nummer;
      timer.current = setTimeout(() => {
        if (aktiv && meine === nummer) void runde();
      }, ms);
    }

    async function runde() {
      // Im Hintergrundtab gar nicht erst fragen: Dort sieht ohnehin niemand
      // hin, und beim Zurueckkommen holt visibilitychange den Stand sofort.
      if (document.visibilityState === 'visible') await holen();
      if (!aktiv) return;
      plane(eiligRef.current ? POLL_AKTIV_MS : POLL_RUHE_MS);
    }

    void runde();

    // Sofort nachsehen, statt bis zu eine Minute zu warten: wenn der Tab
    // wieder sichtbar wird (Start in einem anderen Tab, Handy weggelegt) und
    // wenn das Erstellen-Formular eine neue Anprobe meldet. Beides zieht die
    // EINE Kette vor, statt eine weitere zu starten.
    const nachsehen = () => {
      if (document.visibilityState !== 'visible') return;
      eiligRef.current = true;
      /*
        Nie haeufiger fragen als der schnellste regulaere Takt. Wer zwischen
        zwei Tabs hin- und herspringt, loeste sonst mit jedem Wechsel eine
        eigene Abfrage aus -- beliebig oft pro Sekunde. Innerhalb der Sperre
        wird nur die naechste Runde vorgezogen, statt sofort zu fragen.
      */
      const seitLetzter = Date.now() - zuletztGefragt.current;
      plane(seitLetzter >= POLL_AKTIV_MS ? 0 : POLL_AKTIV_MS - seitLetzter);
    };
    document.addEventListener('visibilitychange', nachsehen);
    window.addEventListener('anprobe:gestartet', nachsehen);

    return () => {
      aktiv = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', nachsehen);
      window.removeEventListener('anprobe:gestartet', nachsehen);
    };
  }, [holen]);

  const laufend = jobs.filter(istAktiv);
  const haengt = jobs.filter((j) => istLaufend(j) && !istAktiv(j));
  const frischFertig = jobs.filter((j) => !istLaufend(j) && !gemeldet.includes(j.id));

  // Laufendes hat Vorrang: Wer gerade wartet, will den Fortschritt sehen,
  // nicht die Quittung fuer die Anprobe davor.
  const job = laufend[0] ?? frischFertig[0] ?? haengt.filter((j) => !gemeldet.includes(j.id))[0];

  /*
    Auf dem Erstellen-Formular NICHT anzeigen: Dort laeuft bereits die grosse
    Warteansicht mit denselben Informationen. Zwei Fortschrittsanzeigen
    uebereinander waeren keine doppelte Sicherheit, sondern Laerm.

    Ebenso auf der Ergebnisseite genau dieser Anprobe -- wer schon draufsieht,
    braucht keinen Hinweis, dass es sie gibt.
  */
  const unterdrueckt = pfad === '/anzeige-erstellen' || (job != null && pfad === `/konto/verlauf/${job.id}`);

  /*
    Wer die Ergebnisseite offen hat, hat die Meldung damit gesehen -- sie darf
    beim Weiterklicken nicht erneut als Neuigkeit auftauchen. Als Effekt, weil
    das ein Seiteneffekt ist und im Render nichts zu suchen hat.
  */
  const fertigAufDieserSeite = job && !istLaufend(job) && pfad === `/konto/verlauf/${job.id}` ? job.id : null;
  useEffect(() => {
    if (!fertigAufDieserSeite) return;
    /*
      Nur der Schreibzugriff nach aussen -- genau wofuer Effekte da sind.
      Kein setState: Auf DIESER Seite ist die Leiste ohnehin unterdrueckt,
      und der naechste Poll liest den Merkzettel von selbst wieder ein.
    */
    alsGemeldetMerken(fertigAufDieserSeite);
  }, [fertigAufDieserSeite]);

  /*
    Der Live-Bereich bleibt IMMER im DOM, auch wenn er leer ist. Ein
    role="status", das erst gemeinsam mit seinem Inhalt eingefuegt wird, lesen
    manche Screenreader nicht vor -- ausgerechnet die Meldung, um die es hier
    geht, kaeme dann bei niemandem an, der sie am dringendsten braucht.
  */
  return (
    <div role="status" aria-live="polite">
      {job && !unterdrueckt ? <Leiste job={job} beiAbhaken={abhaken} /> : null}
    </div>
  );

  function abhaken(id: string) {
    alsGemeldetMerken(id);
    setGemeldet((g) => [id, ...g]);
  }
}

/** Laeuft laut Datenbank noch (unabhaengig davon, ob realistisch). */
function istLaufend(j: Job): boolean {
  return j.status === 'queued' || j.status === 'processing';
}

/** Laeuft UND ist jung genug, dass damit noch zu rechnen ist. */
function istAktiv(j: Job): boolean {
  if (!istLaufend(j)) return false;
  const alterMin = (Date.now() - new Date(j.createdAt).getTime()) / 60_000;
  // NaN (unlesbares Datum) gilt als aktiv -- im Zweifel lieber weiter
  // anzeigen als eine echte Generierung faelschlich fuer tot erklaeren.
  return !(alterMin > HAENGT_AB_MINUTEN);
}

function Leiste({ job, beiAbhaken }: { job: Job; beiAbhaken: (id: string) => void }) {
  const laeuft = istAktiv(job);
  const gescheitert = job.status === 'failed';
  const haengt = istLaufend(job) && !laeuft;
  const anteil = job.gesamt > 1 ? Math.round((job.fertig / job.gesamt) * 100) : 0;

  return (
    <div className="relative overflow-hidden border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        {/* Punkt statt Spinner: ruhiger, und er sagt dasselbe. */}
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${
            laeuft
              ? 'animate-pulse bg-accent motion-reduce:animate-none'
              : gescheitert || haengt
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
          ) : haengt ? (
            // Bewusst nicht "fehlgeschlagen": Wir wissen es nicht sicher, und
            // die Credits sind in diesem Fall noch nicht zurueckgebucht.
            <span className="text-ink">Deine Anprobe braucht ungewöhnlich lange.</span>
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
            if (!laeuft) beiAbhaken(job.id);
          }}
          className="shrink-0 rounded-full border border-line-strong px-3 py-1 text-xs text-ink transition-colors hover:bg-paper"
        >
          {laeuft ? 'Ansehen' : gescheitert || haengt ? 'Details' : 'Öffnen'}
        </Link>

        {/* Wegklicken nur im Endzustand: Solange etwas laeuft, ist die Leiste
            die einzige Spur davon -- sie darf nicht verschwindbar sein. */}
        {!laeuft && (
          <button
            type="button"
            onClick={() => beiAbhaken(job.id)}
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

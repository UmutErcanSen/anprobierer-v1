import Link from "next/link";
import type { CSSProperties } from "react";
import type { MonthUsage, UsageTip } from "@/lib/usage/summary";

/*
  Verbrauchsuebersicht auf der Kontoseite: Fortschrittsring (wie viel der
  aktuellen Zuteilung ist weg) + Monatsverlauf + datenbasierter Hinweis.

  Bewusst eine SERVER-Komponente: Beide Animationen laufen ueber CSS-Keyframes
  (siehe globals.css), es braucht also kein Client-JavaScript. Das spart
  Bundle-Groesse auf der meistbesuchten Seite der App.

  Bezugsgroesse des Rings ist bewusst die letzte Gutschrift und NICHT der
  Kontostand: Credits verfallen nicht, ein Nutzer kann also mehr Guthaben
  haben als seine Monatszuteilung. "38 von 60 dieser Zuteilung verbraucht"
  ist eine Aussage, die immer stimmt -- "38 von 60 Credits" waere bei
  angespartem Guthaben schlicht falsch.

  WICHTIG zur Lesbarkeit: Ring und Balken beziehen sich auf UNTERSCHIEDLICHE
  Zeitraeume -- der Ring auf den Abrechnungszeitraum (kann am 12. beginnen),
  die Balken auf Kalendermonate. Das ist kein Fehler, muss aber benannt
  werden, sonst wirken abweichende Zahlen wie ein Widerspruch. Dafuer die
  Fussnote unter dem Diagramm.
*/

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Hoehe des hoechsten Balkens in Pixel. Bewusst px statt Prozent: eine
 *  Prozenthoehe wuerde sich am Flex-Container inklusive Wertelabel messen
 *  und die Verhaeltnisse damit leicht verzerren. */
const MAX_BAR_PX = 88;

type Props = {
  planLabel: string;
  grantAmount: number;
  usedSinceGrant: number;
  monthly: MonthUsage[];
  periodEnd: string | null;
  tip: UsageTip | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long" });
}

export function UsageOverview({ planLabel, grantAmount, usedSinceGrant, monthly, periodEnd, tip }: Props) {
  const pct = grantAmount > 0 ? Math.min(100, Math.round((usedSinceGrant / grantAmount) * 100)) : 0;
  const offset = CIRCUMFERENCE * (1 - pct / 100);

  const peak = Math.max(1, ...monthly.map((m) => m.used));
  // Ein Verlauf braucht mindestens zwei Punkte, um einer zu sein. Bei einem
  // frisch registrierten Konto (nur der laufende Monat) waere ein einzelner
  // Balken bloss Dekoration -- der Ring darueber sagt dann schon alles.
  const hasHistory = monthly.length >= 2 && monthly.some((m) => m.used > 0);

  return (
    <section className="mt-6 border-t border-line pt-8">
      {/* Mobil: Ring gross und mittig als eigener Block, Text darunter
          zentriert. Ab sm nebeneinander und linksbuendig. */}
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-9 sm:text-left">
        <svg
          viewBox="0 0 120 120"
          role="img"
          aria-label={`${usedSinceGrant} von ${grantAmount} Credits dieser Zuteilung verbraucht`}
          className="w-52 shrink-0 sm:w-28"
        >
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            className="ring-draw"
            style={{ "--dash": CIRCUMFERENCE } as CSSProperties}
          />
          {/* Konkrete Zahlen statt eines abstrakten Prozentwerts: "38 von 60"
              sagt unmittelbar, worum es geht -- der Ring selbst zeigt das
              Verhaeltnis ohnehin schon grafisch. */}
          <text x="60" y="57" textAnchor="middle" className="fill-ink text-[27px] font-medium tabular-nums">
            {usedSinceGrant}
          </text>
          <text x="60" y="76" textAnchor="middle" className="fill-muted text-[13px] tabular-nums">
            von {grantAmount}
          </text>
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Aktuelle Zuteilung</p>
          <p className="mt-2 text-lg font-medium leading-snug text-ink">
            {usedSinceGrant} von {grantAmount} Credits verbraucht
          </p>
          <p className="mt-1.5 text-sm text-muted">
            {planLabel}
            {" · "}
            {periodEnd
              ? `neue Credits am ${formatDate(periodEnd)}`
              : "einmalige Gutschrift, wird nicht erneuert"}
          </p>
        </div>
      </div>

      {tip && (
        /* Klar als Empfehlung gekennzeichnet, damit erkennbar ist: das ist aus
           den eigenen Daten abgeleitet, keine beliebige Werbezeile. Der Text
           selbst nennt immer die konkreten Zahlen, auf denen er beruht. */
        <div className="mt-7 rounded-lg border border-line bg-surface px-4 py-3.5">
          <p className="text-xs uppercase tracking-[0.14em] text-accent">Unser Tipp</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {tip.text}{" "}
            {tip.cta && (
              <Link
                href={tip.cta.href}
                className="whitespace-nowrap text-accent underline underline-offset-4 hover:opacity-80"
              >
                {tip.cta.label}
              </Link>
            )}
          </p>
        </div>
      )}

      {hasHistory && (
        <div className="mt-8">
          <p className="text-sm text-muted">Verbrauchte Credits pro Monat</p>

          {/* Werte ueber den Balken statt einer eigenen Y-Achse: bei sechs
              Datenpunkten ist der direkte Wert schneller zu lesen als eine
              Achse mit Hilfslinien -- und braucht keine Skalenbeschriftung,
              die auf Mobil ohnehin gedraengt waere. Die Grundlinie unten
              uebernimmt die Rolle der X-Achse. */}
          <div className="mt-4 flex items-end gap-2 border-b border-line">
            {monthly.map((m, i) => (
              <div key={`${m.label}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={`text-xs tabular-nums ${m.isCurrent ? "font-medium text-ink" : "text-muted"}`}
                >
                  {m.used}
                </span>
                <div
                  className={`bar-rise w-full rounded-t-md ${m.isCurrent ? "bg-accent" : "bg-accent/35"}`}
                  style={{
                    // Mindesthoehe, damit ein Monat ohne Verbrauch als bewusste
                    // Grundlinie lesbar bleibt statt wie ein Darstellungsfehler.
                    height: `${Math.max(6, Math.round((m.used / peak) * MAX_BAR_PX))}px`,
                    animationDelay: `${i * 45}ms`,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2 text-xs text-muted">
            {monthly.map((m, i) => (
              <span key={`${m.label}-label-${i}`} className="flex-1 text-center">
                {m.label}
              </span>
            ))}
          </div>

          {periodEnd && (
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Kalendermonate. Deine Zuteilung oben läuft nach dem Abrechnungszeitraum und beginnt
              deshalb nicht am Monatsersten — die Zahlen können abweichen.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

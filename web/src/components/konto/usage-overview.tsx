import Link from "next/link";
import type { CSSProperties } from "react";
import type { MonthUsage, UsageTip } from "@/lib/usage/summary";

/*
  Verbrauchsuebersicht auf der Kontoseite: Fortschrittsring (wie viel der
  letzten Zuteilung ist weg) + Monatsverlauf + datenbasierter Hinweis.

  Bewusst eine SERVER-Komponente: Beide Animationen laufen ueber CSS-Keyframes
  (siehe globals.css), es braucht also kein Client-JavaScript. Das spart
  Bundle-Groesse auf der meistbesuchten Seite der App.

  Bezugsgroesse des Rings ist bewusst die letzte Gutschrift und NICHT der
  Kontostand: Credits verfallen nicht, ein Nutzer kann also mehr Guthaben
  haben als seine Monatszuteilung. "38 von 60 dieser Zuteilung verbraucht"
  ist eine Aussage, die immer stimmt -- "38 von 60 Credits" waere bei
  angespartem Guthaben schlicht falsch.
*/

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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

  // Skalierung der Balken auf den hoechsten Monatswert. Mindestens 1, damit
  // bei durchgehend niedrigem Verbrauch keine Division durch 0 entsteht.
  const peak = Math.max(1, ...monthly.map((m) => m.used));
  const hasHistory = monthly.some((m) => m.used > 0);

  return (
    <section className="mt-6 border-t border-line pt-8">
      <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:gap-9">
        <svg
          width="112"
          height="112"
          viewBox="0 0 120 120"
          aria-hidden
          // Bewusst NICHT auf Mobil zentriert: die ganze Seite ist linksbuendig
          // aufgebaut, ein mittiger Ring ueber linksbuendigem Text bricht den
          // Rhythmus.
          className="shrink-0"
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
          <text
            x="60"
            y="56"
            textAnchor="middle"
            className="fill-ink text-[26px] font-medium tabular-nums"
          >
            {pct}%
          </text>
          <text x="60" y="76" textAnchor="middle" className="fill-muted text-xs">
            genutzt
          </text>
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{planLabel}</p>
          <p className="mt-1 text-lg font-medium text-ink">
            {usedSinceGrant} von {grantAmount} Credits verbraucht
          </p>
          <p className="mt-1 text-sm text-muted">
            {periodEnd
              ? `Neue Credits am ${formatDate(periodEnd)}`
              : "Einmalige Gutschrift — wird nicht automatisch erneuert"}
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
          <p className="text-sm text-muted">Verbrauch der letzten 6 Monate</p>
          <div className="mt-4 flex h-20 items-end gap-2" aria-hidden>
            {monthly.map((m, i) => (
              <div
                key={m.label + i}
                className={`bar-rise flex-1 rounded-t-md ${m.isCurrent ? "bg-accent" : "bg-accent/35"}`}
                style={{
                  // Mindesthoehe, damit ein Monat ohne Verbrauch als bewusste
                  // Grundlinie lesbar bleibt. Bei nur 4 % wirkte der Balken wie
                  // ein Darstellungsfehler statt wie eine Null.
                  height: `${Math.max(9, (m.used / peak) * 100)}%`,
                  animationDelay: `${i * 45}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-xs text-muted">
            {monthly.map((m, i) => (
              <span key={m.label + i} className="flex-1 text-center tabular-nums">
                {m.label}
              </span>
            ))}
          </div>
          <p className="sr-only">
            {monthly.map((m) => `${m.label}: ${m.used} Credits`).join(", ")}
          </p>
        </div>
      )}
    </section>
  );
}

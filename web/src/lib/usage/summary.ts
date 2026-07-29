import type { PlanKey } from "@/lib/generation/constants";

/*
  Auswertung des credit_ledger fuer die Konto-Uebersicht.

  Bewusst in JS statt als SQL-Funktion: Die Abfrage ist ohnehin auf die
  letzten 6 Monate begrenzt und liefert damit eine ueberschaubare Zeilenzahl.
  Eine eigene Migration nur fuers Gruppieren waere hier Aufwand ohne Gewinn --
  sobald die Datenmenge das rechtfertigt (viele Nutzer, viele Zeilen), gehoert
  die Aggregation in eine Datenbankfunktion oder eine materialisierte View.

  Alle Funktionen sind rein und ohne Seiteneffekte -- damit unabhaengig von
  Supabase testbar.
*/

export type LedgerRow = {
  delta: number;
  reason: string;
  created_at: string;
};

export type MonthUsage = {
  /** Kurzer Monatsname fuer die Achse, z.B. "Jul". */
  label: string;
  /** Netto verbrauchte Credits in diesem Monat (Abbuchungen minus Rueckbuchungen). */
  used: number;
  /** Ob dieser Monat noch laeuft -- der Balken ist dann noch nicht vollstaendig. */
  isCurrent: boolean;
};

/** Gruende, die eine Gutschrift darstellen (Zuteilung neuer Credits). */
const GRANT_REASONS = new Set(["signup_bonus", "subscription_grant", "topup_purchase"]);
/** Gruende, die den tatsaechlichen Verbrauch abbilden. */
const USAGE_REASONS = new Set(["generation_charge", "generation_refund"]);

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/**
 * Netto-Verbrauch je Monat fuer die letzten `count` Monate, aelteste zuerst.
 * Rueckbuchungen (fehlgeschlagene Generierungen) werden gegengerechnet --
 * sonst wuerde der Balken Verbrauch zeigen, der nie stattgefunden hat.
 */
export function monthlyUsage(rows: LedgerRow[], count = 6, now = new Date()): MonthUsage[] {
  const buckets: MonthUsage[] = [];
  const keys: string[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${d.getMonth()}`);
    buckets.push({ label: MONTH_LABELS[d.getMonth()], used: 0, isCurrent: i === 0 });
  }

  for (const row of rows) {
    if (!USAGE_REASONS.has(row.reason)) continue;
    const d = new Date(row.created_at);
    const idx = keys.indexOf(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx === -1) continue;
    // Abbuchungen sind negativ, Rueckbuchungen positiv -- die Negation
    // liefert damit direkt den Netto-Verbrauch.
    buckets[idx].used -= row.delta;
  }

  // Rundungsfehler ausschliessen und negative Summen (mehr Rueckbuchungen als
  // Abbuchungen im selben Monat, z.B. bei Monatsuebergang) auf 0 klemmen.
  for (const b of buckets) b.used = Math.max(0, Math.round(b.used));

  return buckets;
}

/** Die zuletzt erfolgte Gutschrift — Bezugsgroesse fuer den Fortschrittsring. */
export function lastGrant(rows: LedgerRow[]): { amount: number; at: string } | null {
  let latest: { amount: number; at: string } | null = null;
  for (const row of rows) {
    if (!GRANT_REASONS.has(row.reason)) continue;
    if (!latest || row.created_at > latest.at) latest = { amount: row.delta, at: row.created_at };
  }
  return latest;
}

/** Netto verbrauchte Credits seit einem Zeitpunkt. */
export function usedSince(rows: LedgerRow[], since: string): number {
  let sum = 0;
  for (const row of rows) {
    if (!USAGE_REASONS.has(row.reason)) continue;
    if (row.created_at < since) continue;
    sum -= row.delta;
  }
  return Math.max(0, Math.round(sum));
}

export type UsageTip = {
  text: string;
  cta?: { href: string; label: string };
};

/**
 * Datenbasierte Empfehlung. Gibt bewusst `null` zurueck, wenn die Datenlage
 * keine belastbare Aussage hergibt -- ein generischer Satz ohne Substanz
 * ("Nutze deine Credits!") waere schlechter als gar keiner.
 *
 * Der Tipp darf dem Nutzer auch RATEN ZU SPAREN (Downgrade-Hinweis bei
 * dauerhafter Unterauslastung). Das kostet kurzfristig Umsatz, ist aber der
 * ehrlichste Umgang mit den eigenen Daten und zahlt auf Vertrauen ein --
 * ein Nutzer, der sich nicht ueberzahlt fuehlt, kuendigt seltener ganz.
 */
export function buildTip(args: {
  plan: PlanKey;
  balance: number;
  grantAmount: number | null;
  usedSinceGrant: number;
  monthly: MonthUsage[];
}): UsageTip | null {
  const { plan, balance, grantAmount, usedSinceGrant, monthly } = args;

  if (plan === "free") {
    if (balance === 0) {
      return {
        text: "Deine Gratis-Credits sind aufgebraucht. Ab dem Basic-Tarif bekommst du 60 Credits pro Monat — und alle bisherigen Ergebnisse werden rückwirkend freigeschaltet.",
        cta: { href: "/preise", label: "Tarife ansehen" },
      };
    }
    if (grantAmount && usedSinceGrant >= grantAmount - 1) {
      return {
        text: `Noch ${balance} ${balance === 1 ? "Credit" : "Credits"} übrig. Im Free-Tarif siehst du außerdem nur dein erstes Ergebnis in voller Auflösung.`,
        cta: { href: "/preise", label: "Tarife ansehen" },
      };
    }
    return null;
  }

  // Nur abgeschlossene Monate bewerten -- der laufende Monat ist unvollstaendig
  // und wuerde den Schnitt systematisch nach unten ziehen.
  const complete = monthly.filter((m) => !m.isCurrent);
  const withData = complete.filter((m) => m.used > 0);
  if (withData.length < 3 || !grantAmount) return null;

  const avg = Math.round(complete.reduce((s, m) => s + m.used, 0) / complete.length);

  if (avg > grantAmount * 0.9 && plan === "basic") {
    return {
      text: `Du verbrauchst im Schnitt ${avg} von ${grantAmount} Credits pro Monat — das wird regelmäßig knapp. Pro hat 200 Credits und schaltet HD-Qualität frei.`,
      cta: { href: "/preise", label: "Pro ansehen" },
    };
  }

  if (plan === "pro" && avg < 60) {
    return {
      text: `Du verbrauchst im Schnitt nur ${avg} von ${grantAmount} Credits pro Monat. Basic (60 Credits, 9,99 €) würde dir reichen — HD-Qualität entfiele dabei.`,
      cta: { href: "/preise", label: "Tarife vergleichen" },
    };
  }

  return null;
}

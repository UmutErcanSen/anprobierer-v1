/*
  Wann muss der Tarif gegen Stripe abgeglichen werden?

  Hintergrund -- ein echter Vorfall: Ein Konto sollte zum 29.08. von Pro auf
  Basic wechseln. Stripe hat das auch getan. Das Ereignis
  `customer.subscription.updated` erreichte uns aber nie (es war schlicht kein
  Webhook-Endpunkt registriert). Ergebnis: In Stripe lief Basic, in unserer
  Datenbank stand weiterhin Pro -- und zwar dauerhaft, denn nichts hat je
  nachgesehen. Der Nutzer bekam Pro-Leistungen fuer Basic-Geld.

  Die Lehre ist nicht "Webhook reparieren". Webhooks gehen verloren: Endpunkt
  falsch konfiguriert, Anwendung waehrend eines Deployments nicht erreichbar,
  Stripe gibt nach drei Tagen Wiederholungen auf. Ein Zustand, der
  AUSSCHLIESSLICH per Zustellung gepflegt wird, ist irgendwann falsch.

  Deshalb hier eine zweite, ziehende Quelle: Sieht ein Datensatz so aus, als
  haette ein Ereignis kommen MUESSEN, holen wir den Stand aktiv bei Stripe.
  Stripe ist die Wahrheit, unsere Tabelle nur ein Abbild davon.

  Bewusst ohne I/O und ohne 'server-only': Diese Entscheidung ist die Stelle,
  die bei einem Fehler lautlos versagt -- sie soll ohne Netz und ohne
  Schluessel pruefbar sein (siehe unit/tarifabgleich.test.ts).
*/

export type AboAbbild = {
  stripe_subscription_id: string | null;
  /** Ende der bezahlten Periode laut unserem letzten Stand. */
  current_period_end: string | null;
  /** Fuer die Zukunft vorgemerkter Tarifwechsel (Herabstufung). */
  scheduled_change_at: string | null;
  /** Wann wurde dieses Abbild zuletzt geschrieben? */
  updated_at: string | null;
};

/**
 * Mindestabstand zwischen zwei Abgleichen desselben Kontos.
 *
 * Ohne diese Bremse koennte ein Datensatz, den auch Stripe noch nicht
 * aktualisiert hat (Verlaengerung haengt gerade), bei JEDEM Seitenaufruf
 * einen API-Aufruf ausloesen. Fuenf Minuten sind kurz genug, dass niemand
 * einen falschen Tarif bemerkt, und lang genug, dass daraus keine Last wird.
 */
export const ABGLEICH_ABSTAND_MS = 5 * 60 * 1000;

function vergangen(zeitpunkt: string | null, jetzt: Date): boolean {
  if (!zeitpunkt) return false;
  const t = new Date(zeitpunkt).getTime();
  // Unlesbares Datum NICHT als "vergangen" werten: Das loeste bei jedem
  // Aufruf einen Abgleich aus, ohne dass er je etwas reparieren wuerde.
  return Number.isFinite(t) && t <= jetzt.getTime();
}

export function brauchtAbgleich(abbild: AboAbbild | null, jetzt: Date): boolean {
  // Kein Abo bei Stripe -- es gibt nichts abzugleichen. Betrifft alle
  // Free-Konten, also die grosse Mehrheit: Fuer sie entsteht hier nie ein
  // API-Aufruf.
  if (!abbild?.stripe_subscription_id) return false;

  // Gerade erst geschrieben (z.B. vom Webhook, oder vom vorigen Abgleich) --
  // dann ist der Stand frisch genug.
  if (abbild.updated_at) {
    const alter = jetzt.getTime() - new Date(abbild.updated_at).getTime();
    if (Number.isFinite(alter) && alter >= 0 && alter < ABGLEICH_ABSTAND_MS) return false;
  }

  // Ein vorgemerkter Wechsel ist faellig geworden. Genau der Fall vom 29.08.
  if (vergangen(abbild.scheduled_change_at, jetzt)) return true;

  // Die bezahlte Periode ist abgelaufen: Entweder wurde verlaengert oder
  // gekuendigt -- in beiden Faellen haette ein Ereignis kommen muessen.
  if (vergangen(abbild.current_period_end, jetzt)) return true;

  return false;
}

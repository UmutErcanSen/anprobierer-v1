import 'server-only';

import { z } from 'zod';

/*
  Pruefung der SERVERSEITIGEN Umgebungsvariablen beim Start.

  Getrennt von lib/env.ts, weil diese Datei Geheimnisse anfasst: env.ts wird
  auch von lib/supabase/client.ts importiert und landet damit im Browser-
  Bundle. 'server-only' oben laesst den Build abbrechen, falls das hier je
  passiert.

  Aufgerufen aus src/instrumentation.ts -- Next.js fuehrt dessen register()
  genau einmal aus, bevor der Server Anfragen annimmt.

  ZWEI STUFEN, bewusst:

  Ein fehlender Schluessel bricht den Start ab. Ohne SUPABASE_SERVICE_ROLE_KEY
  oder OPENAI_API_KEY ist die Anwendung ohnehin funktionsunfaehig, und ein
  fehlendes STRIPE_WEBHOOK_SECRET ist schlimmer als das: Der Server laeuft
  scheinbar normal, nimmt aber keine Abo-Ereignisse mehr entgegen. Genau so
  ein Zustand hat uns drei Wochen lang einen falschen Tarif beschert.

  Die Price-IDs melden sich dagegen nur LAUT, ohne den Start zu verhindern.
  Fehlt eine, ist exakt ein Tarif nicht buchbar -- der Checkout sagt das
  sauber, und der Webhook wirft inzwischen (siehe lib/stripe/spiegel.ts), was
  in Stripes Dashboard als fehlgeschlagene Zustellung auffaellt. Dafuer die
  ganze Seite offline zu nehmen, waere unverhaeltnismaessig.
*/

/** Ohne diese laeuft die Anwendung nicht sinnvoll -- Start abbrechen. */
const pflicht = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

/** Fehlen diese, faellt jeweils ein Tarif aus -- laut melden, aber starten. */
const PREIS_VARIABLEN = [
  'STRIPE_PRICE_BASIC_MONTHLY',
  'STRIPE_PRICE_BASIC_YEARLY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO_YEARLY',
] as const;

export function pruefeServerEnv(): void {
  const ergebnis = pflicht.safeParse(process.env);
  if (!ergebnis.success) {
    const fehlend = Object.keys(ergebnis.error.flatten().fieldErrors).join(', ');
    throw new Error(
      `Start abgebrochen: Diese Umgebungsvariablen fehlen oder sind leer: ${fehlend}. ` +
        'Ohne sie laeuft die Anwendung nicht korrekt -- lieber jetzt ein klarer Abbruch ' +
        'als spaeter ein stiller Ausfall mitten im Betrieb.',
    );
  }

  const fehlendePreise = PREIS_VARIABLEN.filter((name) => !process.env[name]);
  if (fehlendePreise.length > 0) {
    console.error(
      `[env] ACHTUNG: ${fehlendePreise.join(', ')} fehlt/fehlen. ` +
        'Die zugehoerigen Tarife sind nicht buchbar, und eingehende Abo-Ereignisse ' +
        'zu diesen Preisen schlagen fehl (Stripe wiederholt sie). Nachtragen und neu starten.',
    );
  }

  pruefeBetaZugang();
}

/*
  Die Beta-Sperre hat eine Falle, die nirgends sichtbar ist: Steht
  NEXT_PUBLIC_BETA auf true und ist BETA_ALLOWLIST leer, kommt NIEMAND mehr
  hinein -- auch der Betreiber nicht. Die Anmeldung sagt dann nur "Diese
  Adresse ist nicht freigeschaltet", was wie ein Tippfehler aussieht.

  Dieselbe Falle trifft die E2E-Tests: Sie melden sich mit TEST_USER_EMAIL an.
  Steht die Adresse nicht in der Allowlist, scheitern alle angemeldeten Tests
  mit genau dieser Meldung -- auf einem frischen Rechner oder in CI eine halbe
  Stunde Fehlersuche. Beides kostet hier eine Zeile Protokoll beim Start.
*/
function pruefeBetaZugang(): void {
  if (process.env.NEXT_PUBLIC_BETA === 'false') return;

  const liste = (process.env.BETA_ALLOWLIST ?? '')
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);

  if (liste.length === 0) {
    console.error(
      '[env] ACHTUNG: Beta ist aktiv, aber BETA_ALLOWLIST ist leer. ' +
        'Damit kann sich NIEMAND anmelden -- auch du nicht.',
    );
    return;
  }

  const testkonto = process.env.TEST_USER_EMAIL?.trim().toLowerCase();
  if (testkonto && !liste.includes(testkonto)) {
    console.error(
      `[env] ACHTUNG: TEST_USER_EMAIL (${testkonto}) steht nicht in BETA_ALLOWLIST. ` +
        'Alle E2E-Tests, die eine Anmeldung brauchen, werden fehlschlagen.',
    );
  }
}

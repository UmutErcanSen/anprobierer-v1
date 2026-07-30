import { defineConfig, devices } from '@playwright/test';

/*
  Laedt .env.local, damit die Tests dieselben Testkonto-Zugangsdaten nutzen wie
  die App (TEST_USER_EMAIL usw.). process.loadEnvFile ist ab Node 20.12 dabei --
  kein zusaetzliches Paket noetig. Fehlt die Datei (z.B. in einer frischen CI),
  laufen die Tests weiter; die betroffenen ueberspringen sich selbst.
*/
try {
  process.loadEnvFile('.env.local');
} catch {
  // Datei nicht vorhanden -- absichtlich toleriert.
}

/*
  E2E-Konfiguration.

  Bewusst KEINE visuellen Regressionstests (kein toHaveScreenshot): Screenshots
  unterscheiden sich zwischen Windows und Linux im Font-Rendering, Baselines
  vom Entwicklungsrechner wuerden in einer CI nie passen. Das Design wird
  weiterhin manuell im Browser geprueft.

  `screenshot: 'only-on-failure'` unten ist etwas anderes und ausdruecklich
  gewollt: Das ist ein Fehler-Artefakt zur Diagnose, kein Soll-Ist-Vergleich.
*/

export default defineConfig({
  testDir: './e2e',

  // Verhindert, dass ein vergessenes test.only in der CI stillschweigend
  // alle anderen Tests ueberspringt und der Lauf trotzdem gruen wird.
  forbidOnly: !!process.env.CI,

  /*
    ZWEI KLASSEN VON TESTS -- der Grund fuer diesen Filter:

    Die meisten Tests sind PORTABEL: Sie sprechen die App nur ueber HTTP an und
    laufen damit gegen localhost, eine Vorschau-Umgebung oder die spaetere
    Produktionsdomain, ganz egal wer hostet.

    Einige brauchen dagegen KONTROLLE UEBER DEN SERVER, weil sie serverseitige
    Fremdaufrufe umbiegen (OpenAI kostet echtes Geld). Deren Mock-Server laeuft
    auf DIESEM Rechner -- eine entfernte Instanz kann ihn nicht erreichen.
    Solche Tests sind mit @lokal markiert und werden automatisch uebersprungen,
    sobald auf eine entfernte Umgebung getestet wird.

    Ohne diesen Filter waeren sie dort nicht nur nutzlos, sondern wuerden
    schlimmstenfalls ECHTE, kostenpflichtige OpenAI-Aufrufe ausloesen.
  */
  grepInvert: process.env.E2E_BASE_URL ? /@lokal/ : undefined,

  // Lokal keine Wiederholungen: ein flackernder Test soll sofort auffallen,
  // nicht durch einen zweiten Versuch verdeckt werden. In der CI ein
  // Wiederholungsversuch gegen echte Infrastruktur-Aussetzer.
  retries: process.env.CI ? 1 : 0,

  // In der CI seriell, damit Tests, die dieselbe Datenbank anfassen, sich
  // nicht gegenseitig ins Gehege kommen. Lokal parallel fuer Geschwindigkeit.
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    /*
      Ziel-Adresse aus der Umgebung, damit dieselben Tests unveraendert gegen
      localhost, eine Vorschau-Umgebung oder die spaetere Produktionsdomain
      laufen -- unabhaengig davon, wo gehostet wird. Die Tests sprechen die App
      ausschliesslich ueber HTTP an und wissen nichts ueber die Plattform
      darunter; genau das macht sie portabel.

        E2E_BASE_URL=https://vorschau.example.de npm run test:e2e
    */
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // Spur nur beim Wiederholungsversuch: die Dateien sind gross, und beim
    // ersten Durchlauf reichen Screenshot und Fehlermeldung meist.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    /*
      WebKit ist hier kein Luxus: Die Zielgruppe verkauft ueber Vinted und
      Kleinanzeigen, also stark vom iPhone aus -- und wir hatten bereits einen
      iOS-Safari-spezifischen Fehler (HEIC-Upload, wo Safari teils einen
      leeren file.type liefert). Solche Faelle findet nur ein echter
      WebKit-Lauf, keine Chrome-Emulation.
    */
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],

  /*
    Next empfiehlt E2E gegen den Produktions-Build. Genau so laeuft es in der
    CI. Lokal waere ein `next build` vor jedem Lauf aber zaeh, deshalb dort
    der Dev-Server -- und `reuseExistingServer` greift auf einen bereits
    laufenden zu, was mit `--ui` im Watch-Modus den Unterschied macht.
  */
  // Zeigt E2E_BASE_URL auf eine bereits laufende Umgebung, darf Playwright
  // KEINEN eigenen Server starten -- sonst kaempfte ein lokaler Dev-Server
  // gegen das eigentliche Testziel.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        // Mock der OpenAI-API. Muss VOR der App stehen: Playwright startet die
        // Eintraege in dieser Reihenfolge, und die App soll ihn beim ersten
        // Aufruf schon vorfinden.
        {
          command: 'node e2e/mock-openai.mjs',
          url: 'http://127.0.0.1:4010/health',
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          /*
            Biegt die serverseitigen OpenAI-Aufrufe auf den Mock um -- der
            einzige Grund, warum Tests der Generierung nichts kosten.

            ACHTUNG, bekannte Luecke: `reuseExistingServer` greift auf einen
            bereits laufenden Dev-Server zu, und der kennt diese Variable
            NICHT, wenn er von Hand gestartet wurde. Dann liefen echte,
            kostenpflichtige Aufrufe. Genau dagegen zaehlt der Mock seine
            Anfragen mit: Die Generierungstests pruefen den Zaehler und
            schlagen fehl, wenn er sich nicht bewegt hat -- statt still Geld
            auszugeben. Fuer diese Tests den Dev-Server also von Playwright
            starten lassen oder selbst mit gesetzter Variable starten.
          */
          env: { OPENAI_BASE_URL: 'http://127.0.0.1:4010/v1' },
        },
      ],
});

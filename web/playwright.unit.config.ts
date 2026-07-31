import { defineConfig } from '@playwright/test';

/*
  Eigene Konfiguration für Tests reiner Funktionen — bewusst getrennt von
  playwright.config.ts.

  Der Grund ist `webServer`: Diese Einstellung gilt in Playwright global und
  lässt sich nicht pro Projekt abschalten. Mit der E2E-Konfiguration würde
  also jeder Lauf erst Next.js und den Mock-Server hochfahren -- rund eine
  halbe Minute Wartezeit, um eine Funktion zu prüfen, die Millisekunden
  braucht. Hier gibt es keinen webServer und keinen Browser, deshalb startet
  der Lauf sofort.

  Ausführen:  npm run test:unit
              npm run test:unit -- --ui
*/

export default defineConfig({
  testDir: './unit',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  // Kein `use`-Block mit Browser-Optionen und keine projects: Diese Tests
  // rufen Funktionen direkt auf, es wird nie eine Seite geöffnet.
});

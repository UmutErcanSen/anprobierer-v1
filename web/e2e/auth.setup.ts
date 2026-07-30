import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Meldet sich EINMAL an und legt die Sitzung als Datei ab. Alle Tests, die ein
 * Konto brauchen, starten damit bereits angemeldet -- statt sich jedes Mal neu
 * durch das Formular zu klicken. Das spart bei wachsender Testzahl erheblich
 * Zeit und macht die Tests unabhängiger voneinander.
 *
 * Die Zugangsdaten stammen aus .env.local (TEST_USER_EMAIL/PASSWORD), geladen
 * in playwright.config.ts.
 *
 * WICHTIG: Die erzeugte Datei enthält gültige Sitzungscookies. Sie gehört
 * deshalb NICHT ins Repository -- e2e/.auth/ steht in .gitignore.
 */

const DATEI = path.join('e2e', '.auth', 'user.json');

setup('anmelden', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const passwort = process.env.TEST_USER_PASSWORD;

  setup.skip(
    !email || !passwort,
    'TEST_USER_EMAIL/TEST_USER_PASSWORD fehlen in .env.local — angemeldete Tests werden übersprungen.',
  );

  await page.goto('/anmelden');
  await page.getByLabel('E-Mail-Adresse').fill(email!);
  await page.getByLabel('Passwort').fill(passwort!);
  await page.getByRole('button', { name: 'Anmelden' }).click();

  // Auf die Weiterleitung warten, nicht nur auf den Klick: Erst wenn /konto
  // erreicht ist, steht die Sitzung wirklich.
  await page.waitForURL(/\/konto/);
  await expect(page.getByRole('heading', { name: /Hallo/ })).toBeVisible();

  fs.mkdirSync(path.dirname(DATEI), { recursive: true });
  await page.context().storageState({ path: DATEI });
});

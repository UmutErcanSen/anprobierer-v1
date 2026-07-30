import { test, expect } from '@playwright/test';

/*
  Validierung der Anmeldung und Registrierung.

  Diese Tests brauchen weder Anmeldung noch Mocks und kosten nichts -- deshalb
  stehen sie am Anfang. Sie pruefen die SERVERSEITIGE Validierung: Das Formular
  traegt `noValidate`, die Browser-Pruefung ist also bewusst abgeschaltet und
  jede Eingabe landet wirklich in der Server Action und damit im Zod-Schema
  (siehe lib/validation/auth.ts).

  ACHTUNG bei den Zusicherungen: Am Passwortfeld steht ein DAUERHAFT sichtbarer
  Hinweis "Mindestens 8 Zeichen, davon ein Buchstabe und eine Zahl." Eine
  Pruefung auf "Mindestens 8 Zeichen" waere deshalb immer gruen -- auch ohne
  jeden Fehler. Deswegen wird hier stets der VOLLE Fehlertext erwartet
  ("Das Passwort braucht mindestens 8 Zeichen."), zusaetzlich abgesichert
  ueber aria-invalid am Feld selbst.
*/

test.describe('Registrierung', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/registrieren');
  });

  test('zu kurzes Passwort wird abgelehnt', async ({ page }) => {
    await page.getByLabel('E-Mail-Adresse').fill('neu@example.de');
    await page.getByLabel('Passwort').fill('ab1');
    await page.getByRole('button', { name: 'Konto erstellen' }).click();

    await expect(page.getByText('Das Passwort braucht mindestens 8 Zeichen.')).toBeVisible();
    await expect(page.getByLabel('Passwort')).toHaveAttribute('aria-invalid', 'true');
    // Kein Seitenwechsel: Bei einem Validierungsfehler darf kein Konto entstehen.
    await expect(page).toHaveURL(/\/registrieren/);
  });

  test('Passwort ohne Zahl wird abgelehnt', async ({ page }) => {
    await page.getByLabel('E-Mail-Adresse').fill('neu@example.de');
    await page.getByLabel('Passwort').fill('nurbuchstaben');
    await page.getByRole('button', { name: 'Konto erstellen' }).click();

    await expect(page.getByText('Das Passwort braucht mindestens eine Zahl.')).toBeVisible();
  });

  test('ungültige E-Mail-Adresse wird abgelehnt', async ({ page }) => {
    await page.getByLabel('E-Mail-Adresse').fill('keine-adresse');
    await page.getByLabel('Passwort').fill('gueltig123');
    await page.getByRole('button', { name: 'Konto erstellen' }).click();

    await expect(
      page.getByText('Das sieht nicht nach einer gültigen E-Mail-Adresse aus.'),
    ).toBeVisible();
    await expect(page.getByLabel('E-Mail-Adresse')).toHaveAttribute('aria-invalid', 'true');
  });

  test('der Hinweis am Passwortfeld ist kein Fehler', async ({ page }) => {
    /*
      Absicherung der Tests selbst: Ohne Absenden darf KEIN Fehler stehen,
      obwohl der Hinweistext eine sehr aehnliche Formulierung enthaelt. Faellt
      dieser Test irgendwann um, sind die Zusicherungen oben wertlos geworden.
    */
    await expect(page.getByText('Mindestens 8 Zeichen')).toBeVisible();
    await expect(page.getByText('Das Passwort braucht mindestens 8 Zeichen.')).toHaveCount(0);
    await expect(page.getByLabel('Passwort')).not.toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('Anmeldung', () => {
  test('falsche Zugangsdaten verraten nicht, ob das Konto existiert', async ({ page }) => {
    /*
      Sicherheitstest, kein reiner Komforttest: Die Meldung muss fuer eine
      unbekannte Adresse und fuer ein falsches Passwort IDENTISCH sein. Sonst
      liesse sich per Ausprobieren herausfinden, welche E-Mail-Adressen ein
      Konto haben (Account-Enumeration).

      Die Suche ist bewusst auf `form` eingegrenzt: Next.js haengt einen eigenen,
      unsichtbaren Route-Announcer (<div role="alert" id="__next-route-
      announcer__">) in jede Seite. Ein blankes getByRole('alert') trifft
      deshalb ZWEI Elemente und scheitert an Playwrights Strict-Mode.
    */
    const meldung = 'E-Mail-Adresse oder Passwort stimmt nicht.';

    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill(`gibtesnicht-${Date.now()}@example.test`);
    await page.getByLabel('Passwort').fill('irgendwas123');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText(meldung);

    // Zweiter Fall: existierende Adresse, falsches Passwort. Dieselbe Meldung.
    const bekannt = process.env.TEST_USER_EMAIL;
    test.skip(!bekannt, 'TEST_USER_EMAIL nicht gesetzt — zweite Hälfte übersprungen.');

    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill(bekannt!);
    await page.getByLabel('Passwort').fill('definitiv-falsch-999');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText(meldung);
  });

  test('leeres Passwort wird abgelehnt', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail-Adresse').fill('jemand@example.de');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(page.getByText('Bitte gib dein Passwort ein.')).toBeVisible();
  });
});

test.describe('Zugriffsschutz', () => {
  /*
    Jede dieser Seiten liest Nutzerdaten. Ohne Anmeldung darf keine davon
    Inhalte zeigen -- gepruefte Weiterleitung statt Vertrauen darauf, dass
    schon jede Seite ihren getUser()-Aufruf hat.
  */
  for (const pfad of ['/konto', '/konto/verlauf', '/anzeige-erstellen']) {
    test(`${pfad} leitet ohne Anmeldung zur Anmeldung`, async ({ page }) => {
      await page.goto(pfad);
      await expect(page).toHaveURL(/\/anmelden/);
    });
  }
});

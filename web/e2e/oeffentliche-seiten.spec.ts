import { test, expect } from '@playwright/test';

/*
  Öffentliche Seiten — vollständig PORTABEL.

  Kein Login, keine Mocks, keine Datenbankschreibzugriffe. Diese Tests laufen
  unverändert gegen localhost, eine Vorschau-Umgebung oder die spätere
  Produktionsdomain:

      E2E_BASE_URL=https://deine-domain.de npm run test:e2e

  Damit sind sie auch nach einem Hosting-Wechsel sofort als Rauchtest
  brauchbar, ohne eine Zeile anzufassen.
*/

test.describe('Startseite', () => {
  test('zeigt Versprechen und Weg zur Registrierung', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Anziehen');
    await expect(page.getByRole('link', { name: 'Kostenlos starten' }).first()).toBeVisible();
  });

  test('Sicherheits-Header sind gesetzt', async ({ page }) => {
    /*
      Prüft die Header aus next.config.ts an der echten Antwort. Besonders
      wertvoll nach einem Hosting-Wechsel: Manche Plattformen setzen oder
      überschreiben Header selbst, und ein stillschweigend verlorener
      Clickjacking-Schutz fällt sonst niemandem auf.
    */
    const antwort = await page.goto('/');
    const header = antwort!.headers();

    expect(header['x-content-type-options']).toBe('nosniff');
    expect(header['x-frame-options']).toBe('DENY');
    expect(header['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(header['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  test('über HTTPS erzwingt die Seite HTTPS auch für die Zukunft (HSTS)', async ({ page, baseURL }) => {
    /*
      Läuft nur gegen eine HTTPS-Umgebung — lokal ist der Dev-Server bewusst
      unverschlüsselt, und Browser IGNORIEREN Strict-Transport-Security über
      HTTP ohnehin. Dort zu prüfen hätte also keine Aussagekraft.

      Gegen die Produktionsdomain ist der Test dagegen wertvoll: Er belegt,
      dass die Plattform unseren HSTS-Header wirklich durchreicht. Manche
      Hoster setzen eigene Header oder verschlucken fremde -- ein still
      verlorener HSTS-Header fällt sonst niemandem auf.

          E2E_BASE_URL=https://deine-domain.de npm run test:e2e
    */
    test.skip(!baseURL?.startsWith('https://'), 'Nur gegen eine HTTPS-Umgebung aussagekräftig.');

    const antwort = await page.goto('/');
    const hsts = antwort!.headers()['strict-transport-security'];

    expect(hsts).toBeDefined();
    // Mindestens ein halbes Jahr — kürzere Zeiträume gelten als wirkungslos.
    const maxAge = Number(/max-age=(\d+)/.exec(hsts ?? '')?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(15_552_000);
  });
});

test.describe('Preise', () => {
  test('zeigt alle drei Tarife mit Monatspreisen', async ({ page }) => {
    await page.goto('/preise');

    await expect(page.getByRole('heading', { name: 'Kostenlos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Basic' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();

    /*
      exact: true ist hier PFLICHT, nicht Feinschliff: getByText sucht
      standardmäßig nach Teilstrings, und "9,99 €" steckt in "19,99 €". Ohne
      exact würde die Zusicherung für den Basic-Preis auch dann greifen, wenn
      nur der Pro-Preis auf der Seite steht — der Test wäre grün und wertlos.
    */
    await expect(page.getByText('9,99 €', { exact: true })).toBeVisible();
    await expect(page.getByText('19,99 €', { exact: true })).toBeVisible();
  });

  test('Jahres-Umschalter rechnet auf Jahrespreise um', async ({ page }) => {
    await page.goto('/preise');

    await page.getByRole('button', { name: /Jährlich/ }).click();

    // 12 × 9,99 wären 119,88 € — die 99,90 € belegen, dass die zwei
    // Gratismonate wirklich eingerechnet sind und nicht nur beworben werden.
    await expect(page.getByText('99,90 €', { exact: true })).toBeVisible();
    await expect(page.getByText('199,90 €', { exact: true })).toBeVisible();
    await expect(page.getByText('entspricht 8,33 € / Monat')).toBeVisible();
  });

  test('Checkout ohne Anmeldung führt zur Anmeldung', async ({ page }) => {
    /*
      Sicherheitsrelevant: Ein nicht angemeldeter Besucher darf keinen
      Bezahlvorgang starten können. Die Route antwortet mit 401, der Client
      leitet daraufhin weiter.
    */
    await page.goto('/preise');
    await page.getByRole('button', { name: 'Auswählen' }).first().click();

    await expect(page).toHaveURL(/\/anmelden/);
  });
});

test.describe('Rechtstexte', () => {
  // Pflichtseiten. Fehlen sie oder liefern sie 404, ist das ein rechtliches
  // Problem, kein kosmetisches -- deshalb als Test und nicht als Sichtprüfung.
  for (const [pfad, ueberschrift] of [
    ['/impressum', 'Impressum'],
    ['/datenschutz', 'Datenschutz'],
  ] as const) {
    test(`${pfad} ist erreichbar`, async ({ page }) => {
      const antwort = await page.goto(pfad);
      expect(antwort!.status()).toBe(200);
      await expect(page.getByRole('heading', { name: new RegExp(ueberschrift, 'i') }).first()).toBeVisible();
    });
  }
});

test.describe('Fehlerseiten', () => {
  test('unbekannte Adresse zeigt die eigene 404-Seite', async ({ page }) => {
    const antwort = await page.goto('/gibt-es-nicht-' + Date.now());

    expect(antwort!.status()).toBe(404);
    // Muss die eigene Seite sein, nicht die nackte Next-Standardmeldung.
    await expect(page.getByRole('link', { name: 'Zur Startseite' })).toBeVisible();
  });
});

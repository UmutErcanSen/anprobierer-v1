import { test, expect, type Page } from '@playwright/test';

/*
  Generierung — @lokal, weil hier der OpenAI-Mock gebraucht wird.

  Diese Tests laufen NICHT gegen eine entfernte Umgebung: Der Mock-Server steht
  auf diesem Rechner, eine entfernte App könnte ihn nicht erreichen und würde
  echte, kostenpflichtige Aufrufe absetzen. Der Filter in playwright.config.ts
  (grepInvert bei gesetztem E2E_BASE_URL) überspringt sie deshalb automatisch.

  Geprüft wird der wirtschaftlich heikelste Pfad der ganzen App:
  Führt ein Fehler bei OpenAI wirklich dazu, dass die Credits zurückkommen?
  Bliebe das kaputt, zahlen Nutzer für Bilder, die sie nie bekommen haben.
*/

const MOCK = 'http://127.0.0.1:4010';

/* 1×1-PNG. Der Inhalt ist gleichgültig — geprüft wird der Ablauf, nicht die
   Bildqualität. Als Puffer statt als Datei im Repo: keine Binärdateien in Git,
   und der Test bleibt ohne Zubehör lesbar. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const bild = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

async function mockStats(page: Page): Promise<{ bilder: number; texte: number }> {
  const res = await page.request.get(`${MOCK}/__mock/stats`);
  return res.json();
}

/** Guthaben aus der Kopfzeile — dort steht es auf jeder angemeldeten Seite. */
async function guthaben(page: Page): Promise<number> {
  const text = await page.locator('header').getByText(/^\d+$/).first().innerText();
  return Number(text);
}

test.describe('Generierung @lokal', () => {
  test.beforeEach(async ({ page }) => {
    /*
      KOSTENSPERRE — muss VOR jedem Upload greifen.

      Zuerst gab es nur eine Prüfung des Mock-Zählers NACH der Generierung.
      Die meldete den Fehler zwar, aber da war das Geld schon ausgegeben:
      Genau das ist passiert (0,50 USD), weil ein von Hand gestarteter
      Dev-Server OPENAI_BASE_URL nicht kennt und Playwrights
      `reuseExistingServer` ihn abgegriffen hat.

      Diese Prüfung fragt den Server, wohin er seine OpenAI-Aufrufe schickt,
      und bricht ab, bevor irgendetwas hochgeladen wird.
    */
    const ziel = await page.request.get('/api/dev/openai-target');
    expect(ziel.ok(), 'Diagnose-Endpunkt nicht erreichbar — läuft die App im Entwicklungsmodus?').toBe(true);
    const { umgeleitet, ziel: host } = await ziel.json();
    expect(
      umgeleitet,
      `Der Server ruft "${host}" auf, nicht den Mock. Ein bereits laufender Dev-Server ohne ` +
        'OPENAI_BASE_URL wurde wiederverwendet — er würde ECHTE Kosten verursachen. ' +
        'Diesen Server beenden und den Test erneut starten, damit Playwright einen eigenen hochfährt.',
    ).toBe(true);

    await page.request.get(`${MOCK}/__mock/reset`);
    await page.goto('/anzeige-erstellen');
  });

  /** Füllt das Formular vollständig aus, ohne abzuschicken. */
  async function formularAusfuellen(page: Page) {
    const dateifelder = page.locator('input[type="file"]');
    await dateifelder.nth(0).setInputFiles(bild('person.png'));
    await dateifelder.nth(1).setInputFiles(bild('kleidung.png'));

    await page.getByLabel('Kleidungstyp').selectOption({ index: 1 });
    await page.getByLabel('Größe').selectOption({ index: 1 });
  }

  test('erfolgreiche Generierung zeigt ein Ergebnis und bucht Credits ab', async ({ page }) => {
    const vorher = await guthaben(page);

    await formularAusfuellen(page);
    await page.getByRole('button', { name: /^Generieren/ }).click();

    // Der Server antwortet sofort und arbeitet in after() weiter; der Client
    // pollt. Grosszuegiges Zeitfenster, aber nicht unbegrenzt.
    /*
      Anker ist der ZIP-Knopf: Der erscheint ausschliesslich in der fertigen
      Ergebnisansicht.

      Vorher stand hier getByText(/Fertig|Ergebnis/i) -- und genau das ist
      hochgegangen, als die Wartephase den Hinweis "dein ERGEBNIS findest du
      danach unter Mein Konto" bekam: Die Zusicherung war sofort gruen,
      mitten im Wartezustand, bevor ueberhaupt ein Aufruf stattgefunden hatte.
      Ein Test, der auf beliebigen Fliesstext prueft, haelt keine
      Textaenderung aus.
    */
    await expect(page.getByRole('button', { name: 'Alles als ZIP' })).toBeVisible({ timeout: 60_000 });

    /*
      DIE KOSTENSICHERUNG: Hat der Mock keinen einzigen Aufruf gesehen, lief die
      App nicht über ihn -- dann wurden echte, kostenpflichtige OpenAI-Aufrufe
      abgesetzt. Lieber hier laut fehlschlagen als still Geld ausgeben.
    */
    const stats = await mockStats(page);
    expect(
      stats.bilder,
      'Der Mock wurde nicht aufgerufen — lief der Dev-Server ohne OPENAI_BASE_URL? ' +
        'Dann sind ECHTE OpenAI-Kosten entstanden. Dev-Server von Playwright starten lassen.',
    ).toBeGreaterThan(0);

    await page.goto('/konto');
    expect(await guthaben(page)).toBeLessThan(vorher);
  });

  test('fehlgeschlagene Generierung bucht die Credits zurück', async ({ page }) => {
    /*
      Der wichtigste Test der Anwendung. OpenAI liefert real regelmäßig 520
      (siehe RETRY_STATUS in lib/openai/images.ts) -- images.ts wiederholt
      dann bis zu dreimal und gibt danach auf. Greift die Rückbuchung in
      process.ts nicht, hat der Nutzer bezahlt und nichts bekommen.
    */
    const vorher = await guthaben(page);
    await page.request.get(`${MOCK}/__mock/fail-images?status=520`);

    await formularAusfuellen(page);
    await page.getByRole('button', { name: /^Generieren/ }).click();

    /*
      TEILWEISER Fehlschlag -- das ist hier das richtige Verhalten, nicht ein
      abgeschwaechter Test:

      Der Mock laesst nur die BILDER scheitern, die Textgenerierung laeuft
      weiter (zwei getrennte Endpunkte). Die App liefert deshalb bewusst ein
      Teilergebnis: Der Verkaufstext bleibt erhalten, nur die Credits fuer das
      fehlende Bild werden ueber refund_credits zurueckgebucht.

      Ein erster Entwurf erwartete hier die Totalausfall-Meldung ("Die
      Generierung ist fehlgeschlagen") und schlug fehl -- der Fehler lag im
      Test. Genau dieser Teilpfad ist der wirtschaftlich heiklere: Der Nutzer
      bekommt etwas geliefert, darf aber trotzdem nicht fuer das bezahlen, was
      fehlt.
    */
    await expect(
      page.getByText(/Bild(er)? konnte(n)? nicht erstellt werden/),
    ).toBeVisible({ timeout: 90_000 });

    const stats = await mockStats(page);
    expect(stats.bilder, 'Der Mock wurde nicht aufgerufen — siehe Hinweis im Erfolgstest.').toBeGreaterThan(0);
    // images.ts wiederholt bei 520 bis zu dreimal -- Beleg, dass die
    // Wiederholungslogik wirklich greift und nicht beim ersten Fehler aufgibt.
    expect(stats.bilder).toBeGreaterThan(1);

    /*
      Der Weg zurueck aus dem Teilausfall. Vor dieser Aenderung fuehrte von
      hier nur "Neue Anprobe erstellen" weg, was ueber reset() alle Eingaben
      samt der bereits gewaehlten Fotos verwarf -- fuer einen zweiten Versuch
      musste man alles neu machen, obwohl im Browser noch alles vorlag.
    */
    const nochmal = page.getByRole('button', { name: /erneut erstellen/ });
    await expect(nochmal).toBeVisible();
    await nochmal.click();

    // Zurueck im Formular -- und die Angaben stehen noch. Genau das ist der
    // Gewinn: Der naechste Versuch ist ein Klick, keine neue Eingabe.
    await expect(page.getByLabel('Kleidungstyp')).not.toHaveValue('');
    await expect(page.getByRole('button', { name: /^Generieren/ })).toBeVisible();

    // Der entscheidende Punkt: Das Guthaben muss wieder auf dem Ausgangswert
    // stehen. Nicht weniger -- der Nutzer hat nichts erhalten.
    await page.goto('/konto');
    await expect
      .poll(() => guthaben(page), { timeout: 30_000 })
      .toBe(vorher);
  });
});

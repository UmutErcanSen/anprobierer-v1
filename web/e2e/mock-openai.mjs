/**
 * Mock-Server für die OpenAI-API — der Grund, warum unsere Tests nichts kosten.
 *
 * Warum überhaupt nötig: Die OpenAI-Aufrufe passieren SERVERSEITIG (in
 * `after()` nach der Antwort). Playwrights `page.route()` fängt nur Anfragen
 * aus dem Browser ab und kommt hier nicht heran. Deshalb wird die App über
 * OPENAI_BASE_URL auf diesen Server umgebogen (siehe lib/openai/base-url.ts,
 * dort ist die Umleitung in Produktion fest gesperrt).
 *
 * Start (übernimmt Playwright automatisch, siehe playwright.config.ts):
 *   node e2e/mock-openai.mjs
 *
 * Bewusst ohne Abhängigkeiten: nur Node-Bordmittel. Ein Testwerkzeug, das
 * selbst ein halbes Framework mitbringt, ist eine Fehlerquelle mehr.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_OPENAI_PORT ?? 4010);

/*
  512x512-PNG in Einheitsgrau (370 Bytes, palettiert).

  War frueher ein 1x1-Pixel-PNG mit der Begruendung "geprueft wird der ABLAUF,
  nicht die Bildqualitaet". Das stimmte -- bis die AI-Act-Kennzeichnung dazukam
  (lib/generation/watermark.ts). Die legt ein Abzeichen per sharp.composite()
  auf das Ergebnis, und auf ein Pixel passt es nicht:

      Error: Image to composite must have same dimensions or smaller

  Die Generierung scheiterte dadurch im Test an einer Stelle, die in Produktion
  nie auftritt (echte Modelle liefern mindestens 1024px). Der Mock war schlicht
  aelter als die Pflicht, die er mitbedienen muss.

  512px sind gross genug fuers Wasserzeichen und klein genug, um hier als
  Zeichenkette zu stehen.
*/
const TEST_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAFn0lEQVR42u3VMQ0AAAgEsfcvgYkJnXhgpUkV3HKpHgAeigQABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAABqACgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAgAGoAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAAAYgAYABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAIABqABgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgBgACoAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGACAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGACAAQBgAAAYAAAGAIABAGAAABgAAAYAgAEAYAAAGAAABgCAAQBgAAAYAAAGAIABAGAAANwsFcxwgYfZ8UkAAAAASUVORK5CYII=';

/*
  Steuerbarer Zustand. Tests schalten das Verhalten über /__mock/... um, statt
  den Server neu zu starten -- so bleibt ein Testlauf schnell.

  `zaehler` ist die Absicherung gegen den teuersten denkbaren Testfehler:
  Läuft die App versehentlich NICHT über diesen Mock (z.B. weil ein bereits
  laufender Dev-Server ohne OPENAI_BASE_URL wiederverwendet wurde), bleibt der
  Zähler bei 0. Der Test merkt das und schlägt fehl, statt stillschweigend
  echte, kostenpflichtige Aufrufe abzusetzen.
*/
let bildFehler = 0; // 0 = Erfolg, sonst der zu liefernde HTTP-Status
let textFehler = 0;
/* Inhaltspruefung: standardmaessig unbedenklich. Tests koennen beides
   umschalten -- eine Beanstandung (die Route muss dann 422 liefern, OHNE
   Credits abzubuchen) und einen Ausfall der Pruefung (die Route muss dann
   sperren statt durchzulassen, 503). */
let pruefungBeanstandet = false;
let pruefungFehler = 0;
const zaehler = { bilder: 0, texte: 0, pruefungen: 0 };

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const server = createServer((req, res) => {
  const pfad = new URL(req.url, `http://localhost:${PORT}`).pathname;

  // Bereitschaftssignal für Playwrights webServer.
  if (pfad === '/health') return json(res, 200, { ok: true, ...zaehler });

  // Steuerung durch die Tests.
  if (pfad.startsWith('/__mock/')) {
    const befehl = pfad.slice('/__mock/'.length);
    if (befehl === 'reset') {
      bildFehler = 0;
      textFehler = 0;
      pruefungBeanstandet = false;
      pruefungFehler = 0;
      zaehler.bilder = 0;
      zaehler.texte = 0;
      zaehler.pruefungen = 0;
      return json(res, 200, { ok: true });
    }
    if (befehl === 'flag-moderation') {
      pruefungBeanstandet = true;
      return json(res, 200, { ok: true, pruefungBeanstandet });
    }
    if (befehl === 'fail-moderation') {
      pruefungFehler = Number(new URL(req.url, 'http://x').searchParams.get('status') ?? 500);
      return json(res, 200, { ok: true, pruefungFehler });
    }
    if (befehl === 'fail-images') {
      bildFehler = Number(new URL(req.url, 'http://x').searchParams.get('status') ?? 500);
      return json(res, 200, { ok: true, bildFehler });
    }
    if (befehl === 'fail-text') {
      textFehler = Number(new URL(req.url, 'http://x').searchParams.get('status') ?? 500);
      return json(res, 200, { ok: true, textFehler });
    }
    if (befehl === 'stats') return json(res, 200, zaehler);
    return json(res, 404, { error: 'Unbekannter Mock-Befehl' });
  }

  // Der Körper muss vollständig gelesen werden, sonst bleibt die Verbindung
  // je nach Client hängen -- die Bilddaten interessieren uns aber nicht.
  req.resume();
  req.on('end', () => {
    if (pfad === '/v1/images/edits') {
      zaehler.bilder++;
      if (bildFehler) {
        return json(res, bildFehler, {
          error: { message: 'Vom Mock erzwungener Fehler.', type: 'server_error' },
        });
      }
      return json(res, 200, {
        model: 'gpt-image-2',
        data: [{ b64_json: TEST_PNG }],
        /*
          BEWUSST OHNE `usage` -- und das ist keine Nachlässigkeit.

          Vorher standen hier erfundene Token-Zahlen, "damit die
          Kostenberechnung einen realistischen Wert erhält". Genau das war der
          Fehler: images.ts rechnet daraus brav einen Preis aus und schreibt
          ihn nach generations.cost_usd. In der Datenbank landeten dadurch
          Kosten für Aufrufe, die nie stattgefunden haben -- eine Auswertung
          der echten Marge mischte anschließend Erfundenes mit Gemessenem und
          war wertlos.

          Ohne `usage` liefert extractCostUsd() null (siehe images.ts). Genau
          das ist die ehrliche Aussage: Zu einem Testlauf sind KEINE Kosten
          bekannt, weil keine entstanden sind. Auswertungen können damit
          einfach auf `cost_usd is not null` filtern und treffen dann
          garantiert nur echte Aufrufe.
        */
      });
    }

    /*
      Inhaltspruefung (siehe lib/openai/moderation.ts). Liefert bewusst nur
      EIN Ergebnis, egal wie viele Eingaben geschickt wurden -- die Route
      wertet die Liste als Ganzes aus, eine Beanstandung genuegt. Ein
      originalgetreuer Nachbau pro Eingabe braechte keinen Erkenntnisgewinn.
    */
    if (pfad === '/v1/moderations') {
      zaehler.pruefungen++;
      if (pruefungFehler) {
        return json(res, pruefungFehler, {
          error: { message: 'Vom Mock erzwungener Pruefungsfehler.', type: 'server_error' },
        });
      }
      const treffer = pruefungBeanstandet;
      return json(res, 200, {
        model: 'omni-moderation-latest',
        results: [
          {
            flagged: treffer,
            categories: { 'sexual/minors': false, sexual: false, violence: treffer, illicit: false },
            category_scores: { 'sexual/minors': 0, sexual: 0.0001, violence: treffer ? 0.99 : 0.0001, illicit: 0.0001 },
          },
        ],
      });
    }

    if (pfad === '/v1/chat/completions') {
      zaehler.texte++;
      if (textFehler) {
        return json(res, textFehler, {
          error: { message: 'Vom Mock erzwungener Fehler.', type: 'server_error' },
        });
      }
      return json(res, 200, {
        model: 'gpt-4o-mini',
        choices: [
          {
            message: {
              content: JSON.stringify({
                titel: 'Test-Titel aus dem Mock',
                beschreibung: 'Beschreibung aus dem Mock-Server. Kein echter Modellaufruf.',
                hashtags: ['#test'],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 200, completion_tokens: 80 },
      });
    }

    json(res, 404, { error: { message: `Unbekannter Pfad: ${pfad}` } });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-openai] hört auf http://127.0.0.1:${PORT}`);
});

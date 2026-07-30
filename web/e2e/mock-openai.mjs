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

/* 1×1-PNG. Reicht völlig: Geprüft wird der ABLAUF (Bild kommt an, wird
   gespeichert, Credits stimmen), nicht die Bildqualität eines Modells. */
const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
const zaehler = { bilder: 0, texte: 0 };

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
      zaehler.bilder = 0;
      zaehler.texte = 0;
      return json(res, 200, { ok: true });
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
        data: [{ b64_json: PNG_1x1 }],
        // Token-Zahlen, damit die Kostenberechnung in images.ts einen
        // realistischen Wert erhält statt null.
        usage: {
          input_tokens_details: { text_tokens: 120, image_tokens: 900 },
          output_tokens_details: { image_tokens: 1500 },
        },
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

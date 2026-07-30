import 'server-only';

/**
 * Basisadresse der OpenAI-API — eine Quelle für alle drei Aufrufmodule
 * (images, text, platform-text).
 *
 * In PRODUKTION immer die echte Adresse, unabhängig davon, was in der Umgebung
 * steht. Das ist bewusst so verdrahtet und nicht konfigurierbar: Eine falsch
 * gesetzte Variable darf niemals Anfragen samt Betreiber-Schlüssel an einen
 * fremden Host schicken. Genau deshalb steht die NODE_ENV-Prüfung vor der
 * Umgebungsvariablen und nicht danach.
 *
 * Außerhalb der Produktion lässt sich die Adresse umbiegen, damit
 * automatisierte Tests einen lokalen Mock-Server ansprechen statt echte,
 * kostenpflichtige Aufrufe abzusetzen:
 *
 *   OPENAI_BASE_URL=http://127.0.0.1:4010/v1 npm run dev
 *
 * Der Grund für diese Naht: Die OpenAI-Aufrufe passieren serverseitig (in
 * `after()` nach der Antwort). Playwrights `page.route()` kann sie deshalb
 * NICHT abfangen — das wirkt nur auf Anfragen aus dem Browser. Ohne diese
 * Umleitung würde jeder E2E-Test der Generierung echtes Geld kosten.
 */
export const OPENAI_BASE_URL =
  process.env.NODE_ENV !== 'production' && process.env.OPENAI_BASE_URL
    ? process.env.OPENAI_BASE_URL
    : 'https://api.openai.com/v1';

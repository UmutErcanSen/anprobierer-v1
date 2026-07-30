# Tests ausführen und bewerten

## Die drei Befehle, die du brauchst

```bash
npm run test:e2e
```

Alles durchlaufen lassen (Chromium, Safari/WebKit, iPhone-Safari). Dauert
~15 Sekunden. Am Ende steht `51 passed` oder eine Liste der Fehlschläge.

```bash
npm run test:e2e:ui
```

**Der wichtigste Befehl zum Arbeiten.** Öffnet eine Oberfläche mit:

- Liste aller Tests links, einzeln startbar
- **Zeitreise**: Klick auf jeden Schritt zeigt den DOM-Zustand zu diesem Moment
- Watch-Modus (Symbol oben): Test läuft automatisch neu, wenn du die Datei speicherst
- Locator-Picker: auf ein Element klicken, den passenden Selektor bekommen

```bash
npm run test:e2e:report
```

Öffnet den HTML-Bericht des letzten Laufs — mit Screenshots der
fehlgeschlagenen Tests.

## Nur einen Teil laufen lassen

```bash
npx playwright test --project=chromium
```

Nur ein Browser — dreimal schneller, für schnelle Runden beim Entwickeln.

```bash
npx playwright test auth-validierung
```

Nur Tests, deren Dateiname passt.

```bash
npx playwright test -g "falsche Zugangsdaten"
```

Nur Tests, deren Name passt (`-g` wie grep).

```bash
npx playwright test --headed
```

Mit sichtbarem Browserfenster — nützlich, wenn du sehen willst, was passiert.

## Tests selbst aufzeichnen

```bash
npx playwright codegen http://localhost:3000
```

Du klickst dich durch die App, Playwright schreibt den Testcode mit. Der
Ausgangspunkt für eigene Tests, ohne Selektoren von Hand zu suchen.

## Ergebnisse lesen

Bei einem Fehlschlag steht im Terminal immer dasselbe Muster:

```
1) [chromium] › e2e\datei.spec.ts:60:7 › Gruppe › Testname
     Error: expect(locator).toBeVisible() failed
     Locator: getByText('99,90 €')
     Expected: visible
```

Wichtig zu unterscheiden:

- **`strict mode violation: resolved to 2 elements`** — der Selektor ist
  mehrdeutig, nicht die App kaputt. Präziser fassen (`exact: true`,
  `.first()`, oder auf einen Container eingrenzen).
- **`Expected: visible / Received: hidden`** — Element existiert, ist aber
  unsichtbar. Meist ein echter Fehler.
- **`Timeout … waiting for locator`** — Element gar nicht gefunden. Entweder
  echter Fehler oder ein veralteter Selektor nach einer Umbenennung.

Zu jedem Fehlschlag liegt ein Screenshot unter `test-results/`. Bei einem
Wiederholungsversuch zusätzlich eine Spur, die du so ansiehst:

```bash
npx playwright show-trace test-results/<ordner>/trace.zip
```

## Portabel oder lokal — wichtig für den Hosting-Wechsel

Die Tests sind in zwei Klassen geteilt:

**Portabel** (Standard, alle aktuellen Tests). Sprechen die App nur über HTTP
an und wissen nichts über die Plattform darunter. Laufen unverändert gegen
jede Umgebung:

```bash
E2E_BASE_URL=https://deine-domain.de npm run test:e2e
```

Damit hast du nach einem Hosting-Wechsel — IONOS, VPS, egal — sofort einen
Rauchtest, ohne eine Zeile anzufassen. Playwright startet dann bewusst
**keinen** eigenen Server, sondern testet nur gegen die angegebene Adresse.

**Lokal** (mit `@lokal` im Testnamen markiert). Brauchen Kontrolle über den
Server, weil sie serverseitige Fremdaufrufe umbiegen — vor allem OpenAI, das
echtes Geld kostet. Der Mock-Server läuft auf **deinem** Rechner; eine
entfernte Instanz kann ihn nicht erreichen. Diese Tests werden automatisch
übersprungen, sobald `E2E_BASE_URL` gesetzt ist. Ohne diesen Schutz würden
sie dort nicht nur nutzlos sein, sondern echte kostenpflichtige Aufrufe
auslösen.

## Was Geld kostet — und was nicht

**Alle aktuellen Tests kosten 0 €.** Sie rufen weder OpenAI noch Stripe auf.

Damit das so bleibt, gibt es die Naht in
[`src/lib/openai/base-url.ts`](../src/lib/openai/base-url.ts): Außerhalb der
Produktion lässt sich die OpenAI-Adresse per `OPENAI_BASE_URL` auf einen
lokalen Mock-Server umbiegen. In Produktion ist die echte Adresse hart
verdrahtet — eine falsch gesetzte Variable kann dort niemals Anfragen samt
Betreiber-Schlüssel an einen fremden Host schicken.

Nötig ist diese Naht, weil die OpenAI-Aufrufe **serverseitig** passieren (in
`after()` nach der Antwort). Playwrights `page.route()` greift nur bei
Anfragen aus dem Browser und kann sie deshalb nicht abfangen.

## HTTPS

Kurz: **Die Tests können HTTPS schon heute, es ist nichts zu bauen.**

Meine Formulierung „die App über HTTP ansprechen" war ungenau — gemeint war
*als Blackbox über das Netzwerkprotokoll*, im Gegensatz zu „interne Funktionen
importieren". HTTPS **ist** HTTP über TLS; aus Sicht des Tests identisch:

```bash
E2E_BASE_URL=https://deine-domain.de npm run test:e2e
```

Warum lokal trotzdem unverschlüsselt? Der Verkehr verlässt den Rechner nie.
Und Browser behandeln `localhost` ausdrücklich als **sicheren Kontext** —
Cookies mit `Secure`-Kennzeichen (wie die Supabase-Anmeldecookies) funktionieren
dort auch ohne TLS. Deshalb laufen die Anmeldetests lokal problemlos.

Falls du HTTPS lokal doch brauchst, kann Next das:
`next dev --experimental-https` erzeugt ein lokales Zertifikat.

Zwei Punkte für später:

- Der Test „über HTTPS erzwingt die Seite HTTPS auch für die Zukunft (HSTS)"
  überspringt sich lokal automatisch und greift erst gegen eine HTTPS-Adresse.
  Er prüft, dass die Hosting-Plattform unseren HSTS-Header wirklich
  durchreicht — manche setzen eigene Header oder verschlucken fremde.
- Bei einer Testumgebung mit **selbstsigniertem** Zertifikat würde Playwright
  die Verbindung ablehnen. Dafür gäbe es `ignoreHTTPSErrors: true` — bewusst
  **nicht** voreingestellt, weil es echte Zertifikatsfehler verstecken würde,
  und genau die soll ein Test ja finden.

## OpenAI-Mock — warum die Tests nichts kosten

[`mock-openai.mjs`](mock-openai.mjs) ist ein winziger Server ohne
Abhängigkeiten, den Playwright automatisch mitstartet. Die App wird per
`OPENAI_BASE_URL` darauf umgebogen.

Steuerbar zur Laufzeit, damit ein Testlauf schnell bleibt:

| Aufruf | Wirkung |
|---|---|
| `/__mock/reset` | Zustand und Zähler zurücksetzen |
| `/__mock/fail-images?status=520` | Bildaufrufe liefern ab jetzt Fehler |
| `/__mock/fail-text?status=500` | Textaufrufe liefern ab jetzt Fehler |
| `/__mock/stats` | Zähler abfragen |

**Die Sicherung gegen versehentliche Kosten:** Der Mock zählt jede Anfrage
mit. Läuft die App aus Versehen *nicht* über ihn — etwa weil ein von Hand
gestarteter Dev-Server ohne `OPENAI_BASE_URL` wiederverwendet wurde — bleibt
der Zähler bei null. Die Generierungstests prüfen das und schlagen fehl,
statt still echtes Geld auszugeben. Für diese Tests den Dev-Server also von
Playwright starten lassen.

## Keine visuellen Regressionstests

Bewusst kein `toHaveScreenshot`. Screenshots unterscheiden sich zwischen
Windows und Linux im Font-Rendering; Baselines von deinem Rechner würden in
einer CI nie passen. Das Design wird weiter manuell im Browser geprüft.

Das `screenshot: 'only-on-failure'` in der Konfiguration ist etwas anderes und
gewollt: ein Fehler-Artefakt zur Diagnose, kein Soll-Ist-Vergleich.

## Fallen, in die wir schon getappt sind

Beides beim Schreiben dieser Tests real passiert — die Kommentare im Code
halten es fest, damit es nicht wiederkehrt:

1. **`getByText` sucht Teilstrings.** `getByText('9,99 €')` trifft auch
   `19,99 €`. Bei Zahlen immer `{ exact: true }`, sonst ist der Test grün und
   prüft die falsche Zahl.
2. **Next.js hängt einen unsichtbaren `role="alert"` in jede Seite**
   (`__next-route-announcer__`). Ein blankes `getByRole('alert')` trifft
   deshalb zwei Elemente und scheitert am Strict-Mode. Auf einen Container
   eingrenzen, z. B. `page.locator('form').getByRole('alert')`.
3. **Sichtbare Hinweistexte können Fehlermeldungen vortäuschen.** Am
   Passwortfeld steht dauerhaft „Mindestens 8 Zeichen …"; eine Prüfung darauf
   wäre immer grün. Deshalb wird der volle Fehlertext erwartet, plus
   `aria-invalid` am Feld — und ein eigener Test hält genau diese
   Unterscheidung fest.

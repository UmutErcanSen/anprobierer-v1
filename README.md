# Anprobierer

KI-gestützte Anprobebilder samt fertigem Verkaufstext für Vinted, Kleinanzeigen
und eBay. Nutzer laden ein Foto von sich und ein Kleidungsstück hoch und
erhalten ein realistisches Anprobebild plus Anzeigentext.

> **Der Name ist ein Arbeitstitel.** „Vestio" wurde am 29.07.2026 verworfen — es
> gibt eine identische eingetragene deutsche Wortmarke im selben Marktsegment.
> Begründung und Vorgehen für die Namenssuche stehen in [TODO.md](TODO.md).

---

## Aufbau des Repositorys

```
web/          Die Anwendung (Next.js 16, TypeScript, Tailwind)
  src/        Quellcode
  e2e/        End-to-End-Tests (Playwright) — eigene Anleitung: web/e2e/README.md
  supabase/   Datenbank-Migrationen
  tests/      Nebenläufigkeitstest der Credit-Buchung

CLAUDE.md     Entscheidungsgrundsätze
TODO.md       Offene Punkte und getroffene Entscheidungen mit Begründung
```

Die Altanwendung (Vanilla JS + Firebase) wurde am 30.07.2026 entfernt, nachdem
das Firebase-Projekt gelöscht war. Ihr Code bleibt über die Git-Historie
erreichbar:

```bash
git log --oneline --diff-filter=D -- src/
```

## Technik

| Bereich | Wahl |
|---|---|
| Frontend/Backend | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 |
| Datenbank, Auth, Storage | Supabase (Postgres mit Row Level Security) |
| Zahlungen | Stripe (aktuell Sandbox/Testmodus) |
| KI | OpenAI — **ausschließlich serverseitig**, der Schlüssel verlässt den Server nie |
| Tests | Playwright (E2E), Node-Testrunner (Datenbank) |

## Einrichtung

```bash
cd web
npm install
```

Danach `web/.env.example` nach `web/.env.local` kopieren und ausfüllen. Die
Datei ist gitignoriert und enthält:

- **Supabase**: URL, Anon-Key, Service-Role-Key (letzterer umgeht RLS — niemals
  in Client-Code importieren)
- **OpenAI**: Betreiber-Schlüssel
- **Stripe**: Secret- und Publishable-Key, Webhook-Secret, vier Price-IDs
- **Testkonten**: Zugangsdaten für die E2E-Tests

### Datenbank

Migrationen liegen in `web/supabase/migrations/` und werden in
**chronologischer Reihenfolge** im Supabase SQL-Editor ausgeführt. Welche noch
offen sind, steht in [TODO.md](TODO.md).

Für den Aufräum-Job (`fail_stale_generations`) muss die Erweiterung `pg_cron`
im Supabase-Dashboard aktiviert sein (Database → Extensions).

## Entwickeln

```bash
npm run dev
```

Läuft auf http://localhost:3000.

> **Windows/PowerShell:** Blockiert die Ausführungsrichtlinie `npm`, nutze
> `npm.cmd` statt `npm` — das umgeht den PowerShell-Wrapper, ohne dass du eine
> Systemeinstellung ändern musst.

## Tests

Zwei Sorten, ein Werkzeug — Playwright deckt beides ab, ein zusätzliches
Test-Framework wird nicht gebraucht.

```bash
npm run test:unit
```

Reine Funktionen ohne Browser und ohne Server (~2 s): Bezahlschranke,
Ledger-Auswertung, Validierung.

```bash
npm run test:e2e
```

Echte Abläufe im Browser, inklusive Chromium, WebKit und iPhone-Safari (~45 s).

```bash
npm run test:e2e:ui
```

```bash
npm run test:e2e:report
```

**Alle Tests kosten nichts** — OpenAI wird über einen lokalen Mock-Server
umgeleitet, Stripe wird gar nicht aufgerufen.

Die Tests sind portabel und laufen nach einem Hosting-Wechsel unverändert
gegen jede Umgebung:

```bash
E2E_BASE_URL=https://deine-domain.de npm run test:e2e
```

Ausführliche Anleitung inklusive Fehlersuche: **[web/e2e/README.md](web/e2e/README.md)**

Zusätzlich gibt es einen Nebenläufigkeitstest der Credit-Buchung:

```bash
npm run test:credits
```

> ⚠️ Dieser läuft derzeit gegen die **produktive** Supabase-Datenbank und legt
> dort Wegwerf-Nutzer an. Vor einer CI-Einbindung muss er auf eine eigene
> Testdatenbank umziehen — vermerkt in [TODO.md](TODO.md).

## Stripe im Testmodus

Die Sandbox ist vollständig angebunden (Checkout, Webhook, Customer Portal).
Für Webhooks lokal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Das ausgegebene `whsec_…` gehört in `.env.local`. Testkarten:
`4242 4242 4242 4242` (Erfolg), `4000 0000 0000 0341` (Fehlschlag).

## Grundsätze

Die Leitlinien für Entscheidungen — Sicherheit vor Wirtschaftlichkeit vor
Benutzerfreundlichkeit vor Performance vor Wartbarkeit vor Design — stehen in
[CLAUDE.md](CLAUDE.md). Offene Punkte und getroffene Entscheidungen mit
Begründung: [TODO.md](TODO.md).

Zwei Regeln, die durchgängig gelten:

1. **Kostenpflichtige Aufrufe laufen nur serverseitig** und werden dort
   kontrolliert (Credits, Rate-Limits). Der Browser sieht nie einen Schlüssel.
2. **Keine erfundenen Zahlen.** Statistiken und Werbeaussagen werden nur
   verwendet, wenn sie belegbar sind.

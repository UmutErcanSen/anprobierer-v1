# Offene Punkte — Anprobierer (Arbeitsname)

> Laufend gepflegte Übersicht, keine einmalige Notiz. Neue Erkenntnisse hier
> ergänzen statt in Chats verstreuen. Reihenfolge innerhalb einer Gruppe =
> Prioritätsempfehlung, nicht zwingend Bearbeitungsreihenfolge.

Stand: 25.07.2026

---

## 🔴 Sicherheit — vor jedem weiteren echten Nutzer

- [x] **Rate-Limiting & Concurrency-Cap** für `/api/generate` — erledigt 25.07.2026, siehe [`rate-limit.ts`](web/src/lib/generation/rate-limit.ts). Limits: 1 laufende Generierung gleichzeitig, 10/Stunde, 30/Tag pro Nutzer. Werte sind ein erster Schätzwert, bei Bedarf nachjustieren. `tsc --noEmit` + `npm run build` sauber.
- [x] **Test-Routen absichern** — erledigt 25.07.2026. `/test-erstellen` und `/test-ergebnis` bleiben erhalten (Umuts Wunsch, dienen dem Design-Testen ohne Konto), sind aber jetzt hinter `if (process.env.NODE_ENV === "production") notFound();` versteckt. Live geprüft: im Dev-Server weiterhin erreichbar, im Produktions-Build als statische 404 ausgeliefert. Bei jedem neuen Deploy-Ziel trotzdem prüfen, dass dort tatsächlich `NODE_ENV=production` gesetzt ist.
- [ ] **IP-Logging für Missbrauchserkennung** — aktuell nur Zählung pro `user_id`, keine IP-Auswertung. Erst nötig, wenn tatsächlicher Missbrauch auftritt.

## 🔴 DSGVO & Recht — vor Livegang mit echten Nutzern

- [ ] **OpenAI-AV-Vertrag + Zero-Data-Retention** abschließen. Ohne das ist die Übermittlung von Personenfotos an OpenAI rechtlich nicht abgesichert.
- [ ] **Datenschutzerklärung fertigstellen** ([`web/src/app/datenschutz/page.tsx`](web/src/app/datenschutz/page.tsx)) — enthält noch Platzhalter (`[Vollständiger Name]`, `[Straße]`, `[PLZ Ort]`, `[E-Mail]`, Hosting-Anbieter). Inhaltlich schon stark, aber rechtlich nicht live nutzbar, solange die Klammern drinstehen.
- [ ] **Impressum fertigstellen** ([`web/src/app/impressum/page.tsx`](web/src/app/impressum/page.tsx)) — ebenfalls noch Platzhalter, Pflichtangaben fehlen.
- [ ] **Supabase-Auftragsverarbeitungsvertrag** im Dashboard bestätigen (Formsache, aber offen).
- [ ] Anwaltliche Prüfung der finalen Texte vor Livegang.
- [ ] (Kleiner, nicht blockierend) Self-Service „Konto löschen" für Art.-17-Anfragen — aktuell nur per E-Mail möglich.

## 🟡 Wirtschaftlichkeit

- [x] **Kosten-Tracking für Textaufrufe** — erledigt 25.07.2026. `generateSaleText` und `rewriteSaleTextForPlatform` liefern jetzt echte Token-Kosten zurück, die in `generations.cost_usd` einfließen (vorher wurde nur der Bildanteil gezählt). Preis-Konstanten für `gpt-4o-mini` sind aus der öffentlichen Preisliste übernommen, aber **noch nicht** wie die Bildkosten gegen eine echte Rechnung geprüft.
- [ ] **Credit-Preise final nachrechnen**, sobald ein paar echte Generierungen mit dem neuen Tracking gelaufen sind — die echte OpenAI-Rechnung als Gegenprobe nehmen (nicht raten). Aktuelles Verhältnis Standard=1/HD=4-Credits ist beim reinen Bildanteil bereits fast passend; ob der Textanteil das Bild merklich verändert, zeigt erst die echte Zahl.
- [ ] **Preise-Seite** ([`web/src/app/preise/page.tsx`](web/src/app/preise/page.tsx)) erst nach der Nachrechnung final setzen — Starter/Pro sind aktuell ohnehin noch `available: false`.
- [ ] **Hosting-Entscheidung** (Vercel empfohlen, Frankfurt-Region) — blockiert Phase 3 (Stripe-Webhooks brauchen öffentliche URL).
- [ ] **Wegwerf-Adressen-Schutz** bei der Registrierung (Domain-Blockliste + Supabase/Cloudflare-Turnstile-Captcha). Braucht einen Turnstile-Sitekey von Umut.
- [ ] **Custom SMTP** (Resend empfohlen) statt Supabase-Standardversand. Hängt an einer verifizierten Domain — damit faktisch blockiert, bis Name/Domain (siehe unten) feststehen.
- [ ] **Löschfristen je Tarif** — Vorschlag Free 7 Tage / Starter 30 / Pro 90, Favoriten ausgenommen. Braucht Umuts Entscheidung zu den genauen Tageszahlen, dann Umsetzung als täglicher Supabase-Cron-Job.

## 🟢 Branding & Naming

- [ ] Kein eigener, geschützter Name/Logo — Projekt heißt aktuell nur `ki-anzeigen-ersteller`/„Anprobierer" (Arbeitstitel). Bewusst auf Phase 5 verschoben (nach Struktur, vor Relaunch). Sobald ein Name feststeht: Domain kaufen → Custom-SMTP-Punkt oben wird dadurch entsperrt.

## 🟢 Tests & Automatisierung

- [ ] **CI-Pipeline** einrichten (aktuell keine `.github/workflows` vorhanden) — mindestens `tsc --noEmit` → `npm run build` → Tests bei jedem Push/PR.
- [ ] **Backend-Tests**: RLS-Policy-Tests gegen lokale Supabase-Instanz, API-Route-Tests für `/api/generate` (401/402/403/400-Fälle), Webhook-Idempotenz sobald Stripe kommt.
- [ ] **Frontend-Tests**: Vitest + React Testing Library für `ColorSelect`, `MultiSelect`/`SingleSelect`, `FavoriteToggle`, `PlatformExport`.
- [ ] **E2E mit Playwright**: Registrierung → Login → Upload → Generierung → Ergebnis → Verlauf-Filter → Favorit → Plattform-Export. Ziel: manuelles Durchklicken im Browser nur noch bei einem fehlgeschlagenen Testlauf, nicht mehr routinemäßig nach jeder Änderung.

## 🟢 Feature-Ideen (kein Blocker, aber Mehrwert)

- [ ] Vorher/Nachher-Slider auf der Ergebnisseite
- [ ] E-Mail-Benachrichtigung, wenn eine Generierung fertig ist (jetzt wo alles async läuft, relevant für Retention)
- [ ] Mehrere KI-Ergebnisvarianten pro Anfrage als Pro-Feature
- [ ] Admin-Dashboard (Nutzer, Kosten, Umsatz — in Postgres trivial)

---

## ✅ Bereits erledigt (zur Einordnung, nicht mehr aktiv verfolgen)

- Firestore-Rules der Altanwendung (Default-Deny, per Emulator-Tests abgesichert)
- Atomare Credit-Buchung (spend/refund) mit Ledger
- Asynchrone Generierung (Job + Polling statt Request-blockierend)
- Neues Design: Auth-Seiten, Konto-Seite, Generierungs-Stepper, Mobil-Menü, Verlauf-Filter, Favoriten, Plattform-Export mit echten Texten pro Plattform

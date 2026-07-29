# Offene Punkte — Anprobierer (Arbeitsname)

> Laufend gepflegte Übersicht, keine einmalige Notiz. Neue Erkenntnisse hier
> ergänzen statt in Chats verstreuen. Reihenfolge innerhalb einer Gruppe =
> Prioritätsempfehlung, nicht zwingend Bearbeitungsreihenfolge.

Stand: 27.07.2026

---

## 🚨 Show-Stopper — gefunden am 27.07.2026

- [x] **Hängengebliebene Generierungen sperren den Account dauerhaft** — behoben 27.07.2026, zweistufig. (a) [`rate-limit.ts`](web/src/lib/generation/rate-limit.ts) wertet `queued`/`processing`-Zeilen nur noch als „läuft" , wenn sie jünger als 10 min sind (`STALE_AFTER_MS`) — das wirkt sofort und ohne DB-Änderung. (b) Neue Migration [`20260727090000_stale_generations.sql`](web/supabase/migrations/20260727090000_stale_generations.sql) mit `fail_stale_generations()`: setzt solche Zeilen über das bestehende, idempotente `refund_generation` auf `failed` **und bucht die Credits zurück**; räumt zusätzlich Upload-Reste älter als 24 h weg (DSGVO — das Personenfoto blieb bei einem Abbruch bisher liegen, obwohl die Datenschutzerklärung sofortige Löschung zusagt). ⚠️ **Muss noch angewendet werden**, und `pg_cron` muss im Supabase-Dashboard aktiv sein (Database → Extensions), sonst existiert die Funktion zwar, wird aber nicht automatisch aufgerufen.
- [x] **„Passwort vergessen"** — behoben 27.07.2026. Neue Seiten `/passwort-vergessen` (Link anfordern) und `/passwort-neu` (neues Passwort setzen), Aktionen `requestPasswordResetAction`/`updatePasswordAction` in [`actions.ts`](web/src/lib/auth/actions.ts), Link auf der Anmeldeseite. Antwort ist bewusst immer gleich, egal ob die Adresse existiert (keine Account-Enumeration, wie bei Registrieren/Anmelden). `/passwort-neu` ohne gültige Sitzung leitet mit Erklärung zurück. Live geprüft.
- [x] **Fehlerseiten** — behoben 27.07.2026: `not-found.tsx` (404 im Editorial-Stil, zwei Auswege), `error.tsx` (Auffangnetz je Seite, mit `reset()` und sichtbarer `digest`-Kennung für den Support) und `global-error.tsx` (Notfall bei kaputtem Root-Layout, bewusst mit Inline-Styles statt Design-Tokens, damit es auch ohne geladenes Stylesheet lesbar bleibt). 404 live geprüft; `error.tsx` folgt dem Next.js-Standardmuster, wurde aber nicht künstlich ausgelöst.
- [x] **Security-Header** — behoben 27.07.2026 in [`next.config.ts`](web/next.config.ts): HSTS (ohne `preload`, bis die Domain final ist), `nosniff`, `Referrer-Policy`, `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `Permissions-Policy`. Live per `fetch` geprüft — alle sechs kommen an.
- [ ] **Vollständige CSP (`script-src`) fehlt weiterhin.** Braucht einen Nonce pro Antwort (Next.js-Hydration und das Theme-Skript in `layout.tsx` sind inline) — also Umbau im Proxy plus Durchtesten aller Seiten. Eine halb richtige CSP bricht die App, ohne zu schützen; deshalb bewusst als eigener Schritt.
- [ ] **Passwortwechsel bei bestehender Sitzung** — `/passwort-neu` ist für jeden Angemeldeten erreichbar, ohne das alte Passwort abzufragen. Bei einer übernommenen Sitzung könnte so das Passwort geändert werden. Supabase bietet dafür „Secure password change" (verlangt Reauthentifizierung) als Projekteinstellung — vor Livegang aktivieren.

## 🔴 Sicherheit — vor jedem weiteren echten Nutzer

- [x] **Rate-Limiting & Concurrency-Cap** für `/api/generate` — erledigt 25.07.2026, siehe [`rate-limit.ts`](web/src/lib/generation/rate-limit.ts). Limits: 1 laufende Generierung gleichzeitig, 10/Stunde, 30/Tag pro Nutzer. Werte sind ein erster Schätzwert, bei Bedarf nachjustieren. `tsc --noEmit` + `npm run build` sauber.
- [x] **Test-Routen absichern** — erledigt 25.07.2026. `/test-erstellen` und `/test-ergebnis` bleiben erhalten (Umuts Wunsch, dienen dem Design-Testen ohne Konto), sind aber jetzt hinter `if (process.env.NODE_ENV === "production") notFound();` versteckt. Live geprüft: im Dev-Server weiterhin erreichbar, im Produktions-Build als statische 404 ausgeliefert. Bei jedem neuen Deploy-Ziel trotzdem prüfen, dass dort tatsächlich `NODE_ENV=production` gesetzt ist.
- [ ] **IP-Logging für Missbrauchserkennung** — aktuell nur Zählung pro `user_id`, keine IP-Auswertung. Erst nötig, wenn tatsächlicher Missbrauch auftritt.
- [ ] **`npm audit`: veraltetes `sharp` in Next.js' eigener `node_modules/next/node_modules/sharp`** (CVE-2026-33327/33328/35590/35591, `<0.35.0`) — betrifft die interne `next/image`-Optimierung, NICHT unsere eigene direkte `sharp@0.35.3`-Abhängigkeit (bereits gepatcht). `npm audit fix` schlägt ein Downgrade von Next auf v9 vor — nicht sinnvoll. Muss regelmäßig neu geprüft werden, ob ein Next-Update das behebt.

## 🔴 Muss vor Nutzung angewendet werden

- [ ] **Migration `20260727090000_stale_generations.sql` anwenden** (siehe Show-Stopper oben) — plus `pg_cron` im Supabase-Dashboard aktivieren, sonst läuft der Aufräum-Job nicht automatisch.
- [ ] **Neue Migration `20260726090000_free_preview_lock.sql` auf Supabase anwenden** — enthält: Umbenennung `starter`→`basic` im `plan_key`-Enum, neue Spalten `profiles.free_preview_used`/`generations.is_free_reveal`, geänderte `spend_credits`/`refund_generation`/`handle_new_user`-Funktionen (Signup-Bonus 5→3 Credits). Ohne das schlägt jede neue Generierung fehl (Funktion referenziert Spalten, die noch nicht existieren). Einspielen per `npx supabase db push` (falls verlinkt) oder Inhalt der Datei im Supabase SQL-Editor ausführen.
- [ ] **Bestehende Profile mit `plan = 'starter'` sind durch die Enum-Umbenennung automatisch `'basic'`** — keine weitere Handlung nötig, nur zur Kenntnis.

## 🔴 Upload-Robustheit

- [x] **HEIC/HEIF (iPhone-Fotos) werden jetzt unterstützt** — erledigt 25.07.2026. Vorher wurden Fotos direkt von iPhones (Standard-Kameraformat "Hohe Effizienz") serverseitig abgelehnt, da `sharp`/`libvips` HEIC aus Lizenzgründen nicht decodieren kann (fehlender HEVC-Codec). Neu: `heic-convert` (lizenzrechtlich unbedenkliche libheif-JS-Implementierung) wandelt HEIC/HEIF vor der eigentlichen `sharp`-Pipeline nach JPEG um, siehe [`prepare-image.ts`](web/src/lib/generation/prepare-image.ts). Client- und Server-Validierung erkennen HEIC auch dann, wenn der Browser (manche iOS-Safari-Versionen) einen leeren `file.type` liefert (Fallback auf Dateiendung). Live getestet: `image/heic`-MIME, leerer MIME-Typ + `.heic`-Endung, sowie weiterhin abgelehntes GIF — alle drei Fälle korrekt.
- [ ] **Gesamt-Request-Größe vs. Hosting-Limit** — bei mehreren Kleidungsstücken (Pro-Tarif bis 9 + Personenfoto = 10 Dateien × max. 10 MB) kann die Gesamtgröße einer Anfrage theoretisch ~100 MB erreichen. Manche Hosting-Plattformen haben eigene Body-Size-Limits darunter (z. B. Vercel) — bei der noch offenen Hosting-Entscheidung mitprüfen.

## 🔴 DSGVO & Recht — vor Livegang mit echten Nutzern

- [ ] **OpenAI-AV-Vertrag + Zero-Data-Retention** abschließen. Ohne das ist die Übermittlung von Personenfotos an OpenAI rechtlich nicht abgesichert.
- [ ] **Datenschutzerklärung fertigstellen** ([`web/src/app/datenschutz/page.tsx`](web/src/app/datenschutz/page.tsx)) — enthält noch Platzhalter (`[Vollständiger Name]`, `[Straße]`, `[PLZ Ort]`, `[E-Mail]`, Hosting-Anbieter). Inhaltlich schon stark, aber rechtlich nicht live nutzbar, solange die Klammern drinstehen.
- [ ] **Impressum fertigstellen** ([`web/src/app/impressum/page.tsx`](web/src/app/impressum/page.tsx)) — ebenfalls noch Platzhalter, Pflichtangaben fehlen.
- [ ] **Supabase-Auftragsverarbeitungsvertrag** im Dashboard bestätigen (Formsache, aber offen).
- [ ] Anwaltliche Prüfung der finalen Texte vor Livegang.
- [ ] (Kleiner, nicht blockierend) Self-Service „Konto löschen" für Art.-17-Anfragen — aktuell nur per E-Mail möglich.

## 🟡 Wirtschaftlichkeit

- [x] **Free-Tarif: nur erstes Ergebnis sichtbar, Rest als Vorschau** — erledigt 26.07.2026. Signup-Bonus 5→3 Credits, nur das allererste Ergebnis (`generations.is_free_reveal`) wird in voller Auflösung/Länge gezeigt. Ab dem zweiten Ergebnis liefert der Server serverseitig eine unscharfe Bildvariante ([`prepare-image.ts`](web/src/lib/generation/prepare-image.ts): `createLockedPreview`, immer mit hochgeladen) und einen gekürzten Verkaufstext (`redactSaleText` in [`lock.ts`](web/src/lib/generation/lock.ts)) — **niemals** die echte URL/den vollen Text an den Client, eine reine CSS-Verpixelung wäre trivial umgehbar gewesen. Ein Upgrade schaltet rückwirkend alle bisherigen Ergebnisse frei. Fairness: ein fehlgeschlagenes erstes Ergebnis verbraucht die Vorschau nicht (`refund_generation` setzt sie zurück). "Starter" gleichzeitig in "Basic" umbenannt (Code + DB-Enum). Betrifft: `ResultView`, `HistoryCard`, Konto-/Verlaufsseiten, Poll-Endpunkt, Plattformtext-Route (403 bei Sperre). **Migration muss noch angewendet werden** (siehe oben) — Feature ist bis dahin nicht live nutzbar.
- [x] **Kosten-Tracking für Textaufrufe** — erledigt 25.07.2026. `generateSaleText` und `rewriteSaleTextForPlatform` liefern jetzt echte Token-Kosten zurück, die in `generations.cost_usd` einfließen (vorher wurde nur der Bildanteil gezählt). Preis-Konstanten für `gpt-4o-mini` sind aus der öffentlichen Preisliste übernommen, aber **noch nicht** wie die Bildkosten gegen eine echte Rechnung geprüft.
- [ ] **Credit-Preise final nachrechnen**, sobald ein paar echte Generierungen mit dem neuen Tracking gelaufen sind — die echte OpenAI-Rechnung als Gegenprobe nehmen (nicht raten). Aktuelles Verhältnis Standard=1/HD=4-Credits ist beim reinen Bildanteil bereits fast passend; ob der Textanteil das Bild merklich verändert, zeigt erst die echte Zahl.
- [ ] **Pro-Preis (24,99 €) wirkt im Wettbewerbsvergleich zu hoch** — vergleichbare KI-Anbieter liegen bei ca. 18 $. Siehe separate Kalkulation im Chat; Entscheidung über neuen Preis steht noch aus.
- [ ] **Preise-Seite** ([`web/src/app/preise/page.tsx`](web/src/app/preise/page.tsx)) erst nach der Nachrechnung final setzen — Basic/Pro sind aktuell ohnehin noch `available: false`.
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

## 🟡 Architektur & Betrieb (vor bzw. kurz nach Livegang)

- [ ] **Kein Monitoring / keine Fehlermeldung an den Betreiber.** Fehler landen ausschließlich in `console.error` — auf einer Serverless-Plattform heißt das: nur im Log, das niemand liest. Ein fehlgeschlagener OpenAI-Aufruf, ein Storage-Fehler oder eine hängende Generierung fallen erst auf, wenn ein Nutzer sich meldet. Sentry (kostenloser Tier reicht anfangs) + ein Alarm auf `cost_usd`-Summe pro Tag.
- [ ] **Verwaiste Storage-Dateien.** Bricht `processGeneration` zwischen Upload und Aufräumen ab, bleiben Personen-/Kleidungsfotos im `uploads`-Bucket liegen — DSGVO-relevant (das Personenfoto soll laut Datenschutzerklärung „unmittelbar nach der Generierung" gelöscht werden) und Speicherkosten. Derselbe Cron-Job wie beim Stale-Job-Fix kann das mit erledigen.
- [ ] **`after()` ist kein Ersatz für eine echte Job-Queue.** Funktioniert für den Start, aber: kein Retry bei Absturz, keine Sichtbarkeit, harte Bindung an die Funktionslaufzeit. Sobald mehrere Nutzer gleichzeitig generieren oder Pro-Nutzer 9 Stücke gleichzeitig schicken, wird das zum Engpass. Mittelfristig: Supabase Queues/pg-boss oder ein kleiner dedizierter Worker.
- [ ] **Kein Backup-Konzept.** Supabase Free hat keine Point-in-Time-Recovery. Vor echten Zahlkunden klären, wie oft `credit_ledger` und `generations` gesichert werden (das Ledger ist die Abrechnungsgrundlage — Verlust = unklarer Kontostand bei allen Nutzern).

## 🟢 Feature-Ideen (kein Blocker, aber Mehrwert)

- [ ] Vorher/Nachher-Slider auf der Ergebnisseite
- [ ] E-Mail-Benachrichtigung, wenn eine Generierung fertig ist (jetzt wo alles async läuft, relevant für Retention)
- [ ] Mehrere KI-Ergebnisvarianten pro Anfrage als Pro-Feature
- [ ] Admin-Dashboard (Nutzer, Kosten, Umsatz — in Postgres trivial)
- [x] **Onboarding/Leerzustand** — erledigt 27.07.2026. `/konto` zeigte nach „0 Erstellt / 0 Favoriten" gar nichts mehr; jetzt ein Leerzustand mit drei Kurz-Schritten und CTA. `/konto/verlauf` unterscheidet außerdem zwischen „Filter ohne Treffer" (Ausweg: Filter zurücksetzen) und „noch nichts erstellt" (Ausweg: erste Anprobe) — vorher beides derselbe nackte Satz ohne Handlungsmöglichkeit. ⚠️ Visuell noch nicht live geprüft: braucht einen Account **ohne** Generierungen (der Testaccount hat 14).
- [x] **Warnung bei aufgebrauchtem Guthaben** — erledigt 27.07.2026. Bei exakt 0 Credits weist die Kontoseite jetzt darauf hin, dass nichts mehr geht, statt den Nutzer erst im Formular gegen die Wand laufen zu lassen. Bewusst nicht schon bei 1 Credit — da ist noch nichts blockiert.

---

## ✅ Bereits erledigt (zur Einordnung, nicht mehr aktiv verfolgen)

- Firestore-Rules der Altanwendung (Default-Deny, per Emulator-Tests abgesichert)
- Atomare Credit-Buchung (spend/refund) mit Ledger
- Asynchrone Generierung (Job + Polling statt Request-blockierend)
- Neues Design: Auth-Seiten, Konto-Seite, Generierungs-Stepper, Mobil-Menü, Verlauf-Filter, Favoriten, Plattform-Export mit echten Texten pro Plattform

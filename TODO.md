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

## 🟡 Stripe / Zahlungen — Sandbox-Anbindung vom 29.07.2026

- [x] **Checkout + Webhook implementiert** (Sandbox/Testmodus, `acct_1TvfGDQiFozdcJ4r`). Vier Preise angelegt (Basic 9,99€/Monat · 99,90€/Jahr, Pro 19,99€/Monat · 199,90€/Jahr, IDs in `.env.local`). Neue Migration [`20260729100000_stripe_subscriptions.sql`](web/supabase/migrations/20260729100000_stripe_subscriptions.sql): `upsert_subscription()` spiegelt Plan/Status bei jedem `customer.subscription.*`-Event, `grant_subscription_credits()` schreibt Credits **ausschließlich** bei `invoice.paid` gut (idempotent über den bereits vorhandenen Unique-Index auf `credit_ledger.stripe_event_id`) — bewusst getrennt, damit ein Statuswechsel (z. B. `cancel_at_period_end` umschalten) nicht versehentlich Credits auslöst. Jahresabos bekommen die 12-fache Monatsmenge auf einmal gutgeschrieben (ökonomisch unproblematisch, da Credits nicht verfallen). `/preise` hat einen echten Monats-/Jahres-Umschalter mit funktionierendem Checkout-Button, `/konto` einen Link ins Stripe Customer Portal (Kündigung/Zahlungsmittel).
- [x] **End-to-End mit Sandbox-Testkarte erfolgreich durchgeklickt** — erledigt 29.07.2026. Stripe CLI installiert (`Stripe.StripeCli` via winget, nicht `stripe.stripe-cli` — falsche Groß-/Kleinschreibung), `stripe login` + `stripe listen --forward-to localhost:3000/api/stripe/webhook` verbunden. Test-Account per Supabase-Admin-API angelegt (automatisch bestätigt). Kompletter Durchlauf live geprüft: `/preise` → „Jetzt upgraden" (Basic) → echte Stripe-Checkout-Seite mit korrektem Betrag (9,99 €) und korrekter Produktbeschreibung → Testkarte `4242 4242 4242 4242` → zurück auf `/konto`: **Plan zeigt „Basic-Tarif", Guthaben zeigt 63 Credits (3 Signup-Bonus + 60 aus dem Abo) — exakt wie erwartet.** Alle Webhook-Events (`customer.subscription.created`, `invoice.paid` u. a.) kamen mit `200 OK` an. Customer Portal („Abo verwalten") ebenfalls geprüft: zeigt korrektes Abo, Rechnungshistorie, Zahlungsmittel; Kündigungsseite öffnet mit richtigem Abo (Kündigung selbst nicht ausgelöst, um den Testzustand nicht zu verändern). ⚠️ Noch nicht geprüft: `4000 0000 0000 0341` (erzwungener Zahlungsfehlschlag → `invoice.payment_failed`), sowie eine tatsächliche Kündigung (`customer.subscription.deleted` → Rückstufung auf `free`).
- [ ] **Für den Produktivbetrieb**: Webhook-Endpoint im Stripe-Dashboard unter der echten Domain registrieren (`checkout.session.completed` wird aktuell absichtlich nicht abonniert — siehe Kommentar im Webhook-Handler; benötigte Events: `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`) und den daraus resultierenden `whsec_...` in die Produktions-Umgebungsvariablen eintragen. `stripe listen` muss lokal weiterlaufen, damit Webhooks in der Entwicklung ankommen.
- [ ] **Test-Accounts aufräumen**, sobald nicht mehr gebraucht (Supabase Dashboard → Authentication → Users, dazu die zugehörigen Stripe-Testkunden): `stripe-test-…@anprobierer-test.local` (Basic→Pro-Wechseltest) und `stripe-renewal-test-…@anprobierer-test.local` (Zahlungsfehlschlag-Test, samt Test Clock `clock_1TyWuWQiFozdcJ4rWxdRPr1X`).

- [x] **Zahlungsfehlschlag bei Verlängerung getestet (Test Clock, 29.07.2026)** — Testkarte `4000 0000 0000 0341` schlägt (anders als vermutet) schon beim ERSTEN Belastungsversuch fehl, nicht erst danach; korrekt getestet durch: normales Abo mit Erfolgskarte abschließen, danach die Decline-Karte per Setup-Checkout als neues Standard-Zahlungsmittel hinterlegen, dann Zeit per Test Clock 35 Tage vorspulen. Ergebnis: `invoice.payment_failed` kam mit `200 OK` an, unser Webhook setzte `subscriptions.status = 'past_due'` korrekt. **Dabei einen echten Bug gefunden und behoben**: Bei einer Rechnung mit mehreren Posten (z. B. nach einem Tarifwechsel: Proration + reguläre Verlängerung in einer Rechnung) nahm der Webhook blind `lines.data[0]` — das kann der falsche Posten sein. Jetzt wird gezielt die NICHT-Proration-Zeile gesucht (`line.parent.subscription_item_details.proration === false`); reine Proration-Rechnungen lösen bewusst keine Credit-Gutschrift aus. Siehe [`webhook/route.ts`](web/src/app/api/stripe/webhook/route.ts).
- [x] **Kündigungsverhalten getestet** — Stripe Customer Portal ist standardmäßig auf `mode: "at_period_end"` gestellt: Kündigung wirkt erst zum Ende der bezahlten Periode, nicht sofort. Kein Code nötig, war schon korrekt konfiguriert (Stripe-Default).
- [x] **Downgrade-Verhalten geprüft und korrigiert** — war vorher komplett deaktiviert (`subscription_update.enabled: false` in der Portal-Konfiguration, automatisch von Stripe angelegt). Jetzt aktiviert: Upgrades wirken sofort mit anteiliger Nachbelastung, **Downgrades erst zum Ende der bezahlten Periode** (`schedule_at_period_end.conditions: [{type: "decreasing_item_amount"}]`) — der Nutzer behält HD-Qualität/9-Stück-Limit, bis er sie tatsächlich bezahlt hat, statt sie mitten im Zeitraum zu verlieren. Live geprüft: Upgrade Basic→Pro griff sofort (Plan + Zugriff), Downgrade Pro→Basic zeigte explizit "Bis dahin haben Sie Zugriff auf die Funktionen Ihres aktuellen Abonnements" und unsere App zeigte weiterhin "Pro-Tarif", bis die Periode endet. **Nebenbei ebenfalls behoben**: Die Konfiguration erlaubte anfangs auch eine "Menge"-Änderung (`quantity`) — unser Webhook ignoriert die Subscription-Menge komplett, ein Nutzer hätte bei Menge=2 doppelt bezahlen und trotzdem nur die normale Credit-Menge bekommen können. Jetzt nur noch `price`-Wechsel erlaubt.
- [x] **"Zwei parallele Abos"-Lücke gefunden und geschlossen** — bevor eine echte Tarifwechsel-Möglichkeit existierte, hätte ein bereits zahlender Nutzer auf `/preise` versehentlich einen ZWEITEN Checkout für den anderen Tarif starten können. Da `subscriptions` nur eine Zeile pro Nutzer hat, hätte der Webhook die erste Subscription beim nächsten Event einfach überschrieben, während sie in Stripe unbemerkt weiterläuft und weiter abgebucht wird — ein stiller Bug mit doppelter Abbuchung. Jetzt zweifach abgesichert: (1) `/api/stripe/checkout` lehnt mit `409` ab, wenn bereits ein Abo mit Status `active`/`trialing`/`past_due` existiert; (2) `/preise` zeigt Karten, deren Tarif der Nutzer schon hat, gar nicht erst als "Jetzt upgraden" an, sondern als "Aktueller Tarif" bzw. "Zum Wechseln/Kündigen: Abo verwalten" (verlinkt ins Portal). Siehe [`pricing-cards.tsx`](web/src/components/pricing/pricing-cards.tsx).
- [x] **"Guthaben aufladen" umbenannt in "Tarife ansehen"** — der alte Text suggerierte ein Top-up-Modell, das es laut Preisentscheidung (nur Abos, keine Credit-Pakete) gar nicht gibt.

### Offene Fragen / bewusste Entscheidungen (29.07.2026)

- **Kein eigenes Konto-Verwaltungs-UI geplant** — Empfehlung: beim Stripe-gehosteten Customer Portal bleiben statt selbst nachzubauen. Es beherrscht Tarifwechsel mit korrekter Proration, SCA/3-D-Secure, Steuern und Rechnungshistorie bereits korrekt und wartungsfrei; ein Eigenbau wäre laufender Aufwand für etwas, das Stripe kostenlos und wahrscheinlich korrekter anbietet. Branding (Logo/Farben/Text) lässt sich über die Portal-Konfiguration anpassen, falls gewünscht.
- **Grafische Konto-Übersicht (Ablaufdatum, verbrauchte Credits etc.)**: Empfehlung, das NICHT als Pro-exklusives Feature zu behandeln — gerade Free/Basic-Nutzer profitieren am meisten davon, weil Transparenz über den Verbrauch die Upgrade-Entscheidung erleichtert (und Support-Anfragen wie "wo sind meine Credits hin" reduziert). Aufwand ist überschaubar (Daten sind über `credit_ledger` und `subscriptions.current_period_end` bereits vorhanden), aber nicht livegang-kritisch — als eigene Aufgabe nach dem Kern-Launch einplanen.
- **`profiles.plan` bleibt bei `status = 'past_due'` unverändert** — ein Nutzer mit fehlgeschlagener Zahlung behält vollen Zugriff auf seinen bezahlten Tarif, bis Stripe die Subscription nach erschöpften Wiederholungsversuchen tatsächlich kündigt (`customer.subscription.deleted`). Das ist eine bewusste Kulanz (niemand verliert sofort Zugriff wegen einer abgelaufenen Karte), aber **ohne eine Cancel-Regel in Stripe kann das theoretisch unbegrenzt so bleiben**: Stripe Dashboard → Settings → Billing → "Failed payments" → Wiederholungsversuche + finale Aktion ("Abo kündigen nach X Versuchen") konfigurieren. Bisher nicht gesetzt (Stripe-Standard). Zusätzlich sinnvoll: E-Mail-Benachrichtigung bei Zahlungsfehlschlag aktivieren (dieselbe Dashboard-Seite) und perspektivisch ein eigener Hinweis in der App bei `status = 'past_due'` ("Zahlung fehlgeschlagen, bitte Zahlungsmethode aktualisieren").
- **Verwaiste Stripe-Abos bei Account-Löschung**: Löscht ein Nutzer sein Supabase-Konto (`auth.users`-Zeile), kündigt das NICHT automatisch das Stripe-Abo — die Subscription liefe unbemerkt weiter und Stripe bucht weiter ab, ohne dass die App das noch anzeigen kann. Aktuell gibt es keine Lösch-Funktion für den eigenen Account im Frontend, daher akut nicht ausnutzbar — aber sobald eine "Account löschen"-Funktion kommt, MUSS sie zuerst das Stripe-Abo kündigen (`stripe.subscriptions.cancel`), bevor der Supabase-Nutzer gelöscht wird.
- **Rückerstattungen/Chargebacks nicht behandelt** — `charge.refunded` und `charge.dispute.created` lösen aktuell keine Reaktion aus (fallen in den `default`-Zweig, werden mit 200 bestätigt, aber ignoriert). Ein Nutzer, der eine Rückbuchung bei seiner Bank veranlasst, behält Plan und bereits gutgeschriebene Credits. Vor dem Livegang mit echten Zahlungen abwägen, ob das Geschäftsrisiko das rechtfertigt oder ob z. B. `charge.dispute.created` zumindest eine interne Benachrichtigung auslösen sollte.
- **Umgebungsvariablen-Wechsel Test→Live**: Beim Umstieg auf einen echten (verifizierten) Stripe-Account müssen ALLE sieben `STRIPE_*`-Variablen gemeinsam ausgetauscht werden (Secret Key, Publishable Key, Webhook Secret, alle vier Price-IDs) — Test-Price-IDs existieren im Live-Modus nicht und würden mit einem unklaren Stripe-Fehler fehlschlagen, nicht mit einer verständlichen Meldung.
- **Webhook-Ausfall ist aktuell unbemerkt**: Fällt der Endpoint aus (z. B. Deploy-Fenster, falscher `STRIPE_WEBHOOK_SECRET`), zahlt ein Kunde, aber Plan/Credits werden nie aktualisiert — Stripe wiederholt Zustellversuche zwar automatisch für einige Tage, aber ohne Monitoring fällt ein dauerhafter Ausfall nicht auf. Sollte Teil des noch ausstehenden Sentry-/Kosten-Alarm-Punkts werden (siehe "Architektur & Betrieb").

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
- [ ] **Hosting-Entscheidung** — analysiert am 30.07.2026, vertagt. Befund:
  - **Vercel Gratis-Tarif scheidet aus.** Harte 60-Sekunden-Grenze pro Anfrage, eine Generierung braucht real 45–90 s pro Bild. Bei mehreren Kleidungsstücken bräche jeder Lauf ab. `maxDuration = 300` in [`route.ts`](web/src/app/api/generate/route.ts) hilft dort nicht, die Plattformgrenze sticht.
  - **Vercel Pro** (~20 $/Monat) löst das über Fluid Compute mit 300 s. Schnellster Weg, aber US-Anbieter.
  - **Hetzner-VPS** (~5 €/Monat, Deutschland): kein Zeitlimit, günstiger, besser für die DSGVO-Frage. Dafür Einrichtung von Node, Reverse-Proxy, TLS und Prozessverwaltung.
  - Zusätzlich prüfen: Body-Size-Limit der Plattform gegen bis zu ~100 MB pro Anfrage (siehe Upload-Robustheit oben).

- [ ] **Geschlossener Freundeskreis-Test** — gewünscht, aber vertagt. Was dafür nötig wäre:
  - **Passwortsperre für die gesamte Seite** (im Proxy). Löst zwei Probleme gleichzeitig: Die Seite ist dann kein öffentliches Angebot (Impressumspflicht, unfertige Datenschutzerklärung mit Platzhaltern), und ein durchgereichter Link kann keine fremden Registrierungen und damit keine OpenAI-Kosten auslösen. Die Limits in `rate-limit.ts` greifen nämlich **pro Nutzer** (10/Stunde, 30/Tag), nicht global.
  - **E-Mail-Bestätigung in Supabase abschalten.** Der Standardversand ist stark gedrosselt; melden sich mehrere Tester kurz nacheinander an, bekommen die letzten keine Mail. Achtung: `/api/generate` prüft `email_confirmed_at` — vorher verifizieren, dass Supabase das Feld bei abgeschalteter Bestätigung selbst setzt.
  - **Bezahltarife ausblenden oder kennzeichnen.** Stripe läuft im Testmodus; wer auf „Auswählen" klickt, landet sonst auf einer Testseite und ist verwirrt.
  - **Kostenrahmen**: 3 Gratis-Credits pro Registrierung ≈ 0,17 $ pro Person. Bei zehn Testern vernachlässigbar — das Risiko liegt allein im Weiterreichen des Links, siehe Passwortsperre.
- [ ] **Wegwerf-Adressen-Schutz** bei der Registrierung (Domain-Blockliste + Supabase/Cloudflare-Turnstile-Captcha). Braucht einen Turnstile-Sitekey von Umut.
- [ ] **Custom SMTP** (Resend empfohlen) statt Supabase-Standardversand. Hängt an einer verifizierten Domain — damit faktisch blockiert, bis Name/Domain (siehe unten) feststehen.
- [ ] **Löschfristen je Tarif** — Vorschlag Free 7 Tage / Starter 30 / Pro 90, Favoriten ausgenommen. Braucht Umuts Entscheidung zu den genauen Tageszahlen, dann Umsetzung als täglicher Supabase-Cron-Job.

## ✅ Altanwendung entfernt — erledigt 30.07.2026

Firebase-Projekt gelöscht (30 Tage Karenzzeit läuft), danach der komplette
Altbestand entfernt: `src/`, `public/`, `tests/`, `index.html`,
`vite.config.js`, Wurzel-`package.json`/`package-lock.json`, `.env`/
`.env.production` sowie die Firebase-Dateien (`firebase.json`, `.firebaserc`,
`firestore.rules`, `firestore.indexes.json`). Lokal zusätzlich `dist/`,
`assets/` und das Wurzel-`node_modules/`.

Vorher geprüft: keine Verweise der neuen App auf den Altbestand, alles
Wichtige portiert, keine Geheimnisse in den `.env`-Dateien (nur öffentliche
Firebase-Identifikatoren). Der Code bleibt über die Historie erreichbar:
`git log --oneline --diff-filter=D -- src/`

Zwei Folgeänderungen, die dadurch möglich wurden:

- **`turbopack.root` aus [`next.config.ts`](web/next.config.ts) entfernt.** Der
  Umweg existierte laut eigenem Kommentar nur wegen der Wurzel-
  `package-lock.json` der Altanwendung. Empirisch geprüft: `npm run build`
  ohne Warnung zum Wurzelverzeichnis, 54 E2E-Tests weiterhin grün (die nutzen
  den Dev-Server, decken also beide Turbopack-Pfade ab).
- **`vite-legacy` aus `.claude/launch.json` entfernt** — zeigte auf die
  gelöschte Anwendung.

<details>
<summary>Ursprüngliche Analyse (zur Nachvollziehbarkeit)</summary>

Der Befund lautete: Dateien zu löschen erledigt drei Dinge NICHT — die alte
App läuft bei Firebase weiter, im Firestore liegen Nutzerdaten (DSGVO), und
mit gelöschter `firebase.json` lässt sie sich nicht mehr per CLI abschalten.
Deshalb wurde erst abgeschaltet, dann gelöscht.

</details>

## 🟢 Branding & Naming

- [ ] Kein eigener, geschützter Name/Logo — Projekt heißt aktuell nur `ki-anzeigen-ersteller`/„Anprobierer" (Arbeitstitel). Bewusst auf Phase 5 verschoben (nach Struktur, vor Relaunch). Sobald ein Name feststeht: Domain kaufen → Custom-SMTP-Punkt oben wird dadurch entsperrt.
- ❌ **„Vestio" verworfen (29.07.2026)** — Recherche ergab eine **identische, bestandskräftig eingetragene deutsche Wortmarke**: DPMA 302024235888, eingetragen 20.02.2025, Inhaber Opus Stilberater GmbH (Leimen), Schutz bis 2034, Widerspruchsfrist abgelaufen. Die eingetragenen Klassen decken das Geschäftsmodell praktisch vollständig ab: **Kl. 9 (Software), Kl. 25 (Bekleidung), Kl. 35 (Werbung/Verkaufsförderung), Kl. 42 (IT-Dienstleistungen)**. Erschwerend: Der Inhaber ist ein aktiver, finanzierter FashionTech-Wettbewerber mit eigener „Vestio"-App (iOS/Android, Release 01/2025) — die Marke wird nachweislich benutzt, ein Löschungsangriff wegen Nichtbenutzung scheidet aus. Zusätzlich sind vestio.de (vestio TEXTILING GmbH, seit 1994) und vestio.com (Immobilienfirma, Belgien) aktiv belegt; keine brauchbare Domain frei. Quellen: TMview (EUIPO/TMDN), tmdb.eu. **Kein Rechtsrat — aber identisches Zeichen + überlappende Klassen + gleiches Land ist eindeutig genug, um den Namen nicht weiterzuverfolgen.**
- [ ] **Lehre daraus: Namen VOR dem Logo-Design prüfen, nicht danach.** Reihenfolge künftig: Kandidatenliste → TMview-/DPMA-Recherche + Domain-Check → erst dann Design.
- [ ] **„Trylane" (zweiter Favorit) ist noch ungeprüft** — vor weiterer Design-Arbeit dieselbe Prüfung durchlaufen.
- [ ] Vor endgültiger Festlegung: anwaltliche Freedom-to-operate-Recherche für den finalen Namen, inkl. Unternehmenskennzeichen nach § 5 MarkenG (nicht nur eingetragene Marken). Offen blieb in meiner Recherche außerdem, welche Marken Vestiaire Collective hält — relevant, weil klanglich nah und im selben Segment.

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

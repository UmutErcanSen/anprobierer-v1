# ROADMAP — Virtual Try-On

> Live-Tracker für Entwicklungsfortschritt
> Zuletzt aktualisiert: 17.07.2026

---

## Projektstatus

| Metrik | Wert |
|--------|------|
| Startdatum | 15.07.2026 |
| Aktuelle Phase | Phase 10–12 — Regenerieren & Design |
| Gesamtfortschritt | █████████░ ~90% |

---

## Abgeschlossene Features

| Feature | Status | Datum |
|---------|--------|-------|
| Landing Page mit Video | Fertig | |
| Auth (Email/Google/Reset) | Fertig | |
| E-Mail-Verifizierung | Fertig | |
| KI-Bildgenerierung (Einzel + Kombi) | Fertig | |
| Vinted-Text Generierung (alle User) | Fertig | |
| ZIP-Download | Fertig | |
| Account-Seite (Profil, Stats, History) | Fertig | |
| Preise-Seite (3-Tier Vergleich) | Fertig | |
| Responsive Design (Mobile/Desktop) | Fertig | |
| Desktop/Mobile Filter-Split | Fertig | |
| Burger-Menü (Mobile/Desktop) | Fertig | |
| Nutzer-Icon mit Glow + Initialen | Fertig | |
| Rechtliche Seiten (Impressum/Datenschutz) | Fertig | |
| Sticky Footer | Fertig | |
| DSGVO-konformes Löschen + Datenexport | Fertig | |
| History-Cards Redesign (Thumbnails, Preview, 2er-Grid) | Fertig | 16.07. |
| Donut-Visualisierung (grün→gelb→orange→rot, Rotation nur bei Pro) | Fertig | 16.07.–17.07. |
| Firestore-Pfad-Fix (generations→users/{uid}/generations) | Fertig | 16.07. |
| Thumbnail-Generierung (150px JPEG in Firestore) | Fertig | 16.07. |
| Limit-Upgrade-Modal (2-Stufig) | Fertig | 16.07. |
| Feature-Gating entfernt (Qualität fix pro Plan) | Fertig | 16.07. |
| Verkaufstext-Persistenz (saveSession in generateAllSaleTexts) | Fertig | 16.07. |
| Upgrade-Banner immer sichtbar (free+basic), dynamischer Text | Fertig | 16.07. |
| Weiter-machen-Button (Session-Check) | Fertig | 16.07. |
| Abo-Verwaltung Card (über Einstellungen positioniert) | Fertig | 16.07. |
| Pro-Badge Gold-Glow (Box-Shadow, kein Rahmen, kein Shimmer) | Fertig | 16.07.–17.07. |
| Donut-Rotation nur für Pro (per CSS-Klasse) | Fertig | 17.07. |
| Plan-Wechseln-Flow (Upgrade + Deferred Downgrade) | Fertig | 17.07. |
| Downgrade-Modal (Feature-Vergleich, Ablaufdatum-Hinweis) | Fertig | 17.07. |
| Firestore `scheduledDowngrade` + `downgradeAt` + `applyScheduledDowngrade()` | Fertig | 17.07. |
| In-App-Banner-Varianten (info/warning/danger) | Fertig | 17.07. |
| Console.logs entfernt (9 Stück) | Fertig | 17.07. |
| SEO & Meta (OG/Twitter-Tags, Favicon, robots.txt, sitemap.xml) | Fertig | 17.07. |
| beforeunload-Popup entfernt | Fertig | 17.07. |
| Per-Image Regenerieren (Limit-Check + Warning + max 3x) | Fertig | 17.07. |
| Per-Text Regenerieren (free, unlimited) | Fertig | 17.07. |
| Light/Dark Mode Toggle (Header + Settings, localStorage persist) | Fertig | 17.07. |
| Flicker-Protection Script in <head> | Fertig | 17.07. |

---

## Offene / Abgeschlossene Phasen

### Phase 1: Subscription Infrastructure
> Ziel: Abo-System mit Limits und Feature-Gating
> Geplant: 15.07.2026 | Fertig: 15.07.2026

- [x] Plan-Definitionen aktualisieren (Free = 3 Generierungen, Basic = 25, Pro = unbegrenzt)
- [x] User-Profil in Firestore erweitern (subscription, dates, status)
- [x] `src/subscription.js` — Abo-Management-Modul
- [x] Feature-Gating: Qualität pro Plan (Free=niedrig, Basic=mittel, Pro=hoch)
- [x] Feature-Gating: Items pro Bild (Free=1, Basic=5, Pro=unbegrenzt)
- [x] Feature-Gating: Vinted-Texte NICHT gated (alle User erhalten Texte)
- [x] Generierungs-Limit Enforcement (client-seitig)

### Phase 2: Fake Stripe Checkout
> Ziel: Simulierter Bezahlflow für Upgrade
> Geplant: 15.07.2026 | Fertig: 16.07.2026

- [x] `src/checkout.js` — Checkout-Modal mit Kreditkartenformular
- [x] Checkout-HTML in `index.html` + CSS-Styles
- [x] Fake-Kreditkartenformular (Kartennummer, Ablaufdatum, CVC)
- [x] Loading-Animation + Erfolgs-Message
- [x] Upgrade-Callback auf /preise-Seite angepasst
- [x] Redirect zu /account nach erfolgreichem Upgrade
- [x] Qualität pro Plan: Free→niedrig, Basic→mittel, Pro→hoch
- [x] Qualitäts-Dropdown entfernt (`#qualitySelect` gelöscht)
- [x] `applyFeatureGating()` vereinfacht (kein DOM-Gating mehr)
- [x] Cost-Estimate entfernt (irrelevant innerhalb Abo)
- [x] 2-Stufiger Upgrade-Flow: Upgrade-Modal (3 Karten) → Zahlung
- [x] Upgrade-Modal mit Plan-Cards + Features + Lucide-Icons
- [x] `showUpgradeModal()` statt `openCheckout()`

### Phase 3: Account-Seite UI, History-Redesign & Firebase-Fixes
> Ziel: Moderne History-Cards, richtige Thumbnails, Donut-Visualisierung, Firebase-Korrekturen
> Geplant: 16.07.2026 | Fertig: 16.07.2026

- [x] Firestore-Pfad von `generations/{uid}` → `users/{uid}/generations` (4 Stellen)
- [x] History-Karten-Redesign: Thumbnails, Lucide-Actions, Preview-Overlay, 2er-Grid Desktop
- [x] Thumbnail-Generierung via Canvas (max 150px, JPEG q0.6) in `createThumbnail()`
- [x] "Einzelbilder" → "Einzelbild" (Badges, Filter, Export)
- [x] "+ Neue Anzeige erstellen" als Card mit großem Plus-Symbol
- [x] Donut-Glow prozentual (60% gelb, 80% orange, 100% rot) – grüne Default-Farbe
- [x] Donut-Rotation via CSS (`donut-bar-spin`) nur für Pro
- [x] Label Variante B: "Du hast X von Y Anzeigen diesen Monat erstellt"
- [x] DEV Mode: Upgrade-Modal + Toast, aber keine Blockierung (kein `return`)
- [x] Account-UI: Abmelden in Kontoverwaltung, E-Mail-Button unter Input, Lucide-Icons
- [x] Preview-Overlay: Modal mit Thumbnail + Verkaufstext + Escape/Click-Close
- [x] Button-Position: Action-Buttons rechts unten via `margin-top: auto`
- [x] Responsive: Mobile 100px Thumbnails, Desktop 130px, angepasste Padding/Grid

### Phase 4: Account-Abo-Verwaltung ✅ Fertig
> Ziel: Verwaltung des laufenden Abos (kündigen, wechseln, nächste Abbuchung)
> Geplant: 16.07.2026 | Fertig: 17.07.2026

- [x] Plan-Badge mit Lucide-Icons (star/layers/crown) + Farben + Pro-Gold-Glow
- [x] "Plan wechseln" Button → Upgrade-Modal mit Downgrade-Erkennung
- [x] Downgrade-Modal: Feature-Vergleich (Tabelle), Ablaufdatum-Hinweis, deferred-Umsetzung
- [x] Firestore: `scheduledDowngrade` + `downgradeAt` + `applyScheduledDowngrade()`
- [x] "Abo kündigen" Button → Bestätigungs-Modal (fertig)
- [x] Nächste Abbuchung / Ablaufdatum anzeigen
- [x] Monats-Reset-Datum im Profil
- [x] Cancel/Reaktivieren via `cancelPlan()` / `reactivatePlan()`

### Phase 5: In-App Benachrichtigungen ✅ Fertig
> Ziel: Kontextuelle Hinweise für Abo-Status
> Geplant: 17.07.2026 | Fertig: 17.07.2026

- [x] Banner: Limit erreicht (rot, `.banner--danger`)
- [x] Banner: Fast am Limit (gelb, `.banner--warning`)
- [x] Banner: Bereit für mehr? (default primary shimmer)
- [x] Toast: Limit fast erreicht bei ≥80% (einmalig pro Session)
- [x] Toast: Upgrade erfolgreich (grün, in checkout.js)
- [x] Toast: Abo gekündigt (in account.js)
- [x] Toast: Kündigung zurückgenommen (in account.js)
- [x] Banner-Varianten: `banner-shimmer-warning` / `banner-shimmer-danger`

### Phase 10: Per-Image Regenerieren ✅ Fertig
> Ziel: Einzelbild-Regeneration mit Limit-Warnung
> Geplant: 17.07.2026 | Fertig: 17.07.2026

- [x] `regenerateImage(idx)` in app.js – async, API-Call, Limit-Inkrement, DOM-Update
- [x] `incrementGenerationsUsed()` aufrufen bei jeder Regeneration
- [x] Warnung via `confirm()` vor Verbrauch
- [x] Refresh-Button in `.result-card-actions`
- [x] Loading-Spinner auf Button, deaktiviert während API-Call
- [x] Fehlerbehandlung (Quota, Auth/403, Timeout)

### Phase 11: Per-Text Regenerieren ✅ Fertig
> Ziel: Verkaufstext-Regeneration ohne Limit-Verbrauch
> Geplant: 17.07.2026 | Fertig: 17.07.2026

- [x] `regenerateSaleText(idx)` in app.js – free, unlimited
- [x] Ruft `generateSaleTextForImage()` direkt auf
- [x] DOM-Update in-place (kein vollständiges Re-Render)
- [x] Retry-Button neben Copy-Button im `.result-sale-text`
- [x] Loading-Status + Fehleranzeige

### Phase 12: Light/Dark Mode ✅ Fertig
> Ziel: Theme-Umschalter mit localStorage-Persistenz
> Geplant: 17.07.2026 | Fertig: 17.07.2026

- [x] `[data-theme="light"]` CSS-Block mit überschriebenen `:root`-Variablen
- [x] Flicker-Protection Script in `<head>` (vor Render)
- [x] Theme-Toggle-Button in Header (zwischen User-Icon und Burger)
- [x] 3 Optionen im Settings-Modal (Dunkel/Hell/System)
- [x] `localStorage('vto_theme')` + `matchMedia('prefers-color-scheme')` Fallback
- [x] `toggleTheme()`, `applyTheme()`, `updateThemeIcon()` Funktionen
- [x] System-Theme-Change-Listener für Live-Wechsel

### Phase 13: E-Mail-Vorlagen 🔄
> Ziel: HTML-Vorlagen für späteren Versand
> Geplant: 17.07.2026

- [ ] `src/email-templates.js` erstellen
- [ ] Willkommens-E-Mail (Free)
- [ ] Abo-aktiviert-E-Mail
- [ ] Abo-gekündigt-E-Mail
- [ ] Abo-abgelaufen-E-Mail
- [ ] Limit-Warnung-E-Mail
- [ ] Zahlung-fehlgeschlagen-E-Mail

### Phase 7: Firestore Security Rules 🔄
> Ziel: Server-seitige Zugriffskontrolle
> Geplant: 18.07.2026

- [ ] `firestore.rules` erstellen
- [ ] Users: Nur eigene Daten lesen/schreiben
- [ ] Generations: Nur eigene Daten lesen/schreiben
- [ ] Rules testen in Firebase Console
- [ ] Rules deployen

### Phase 8: SEO & Meta ✅ Fertig
> Ziel: Auffindbarkeit und Sharing
> Geplant: 18.07.2026 | Fertig: 17.07.2026

- [x] Meta-Tags (description, OG, Twitter)
- [x] SVG-Favicon (inline Data-URI)
- [x] robots.txt
- [x] sitemap.xml

### Phase 9: Firebase Functions (optional)
> Ziel: Server-seitiger Monats-Reset und E-Mail-Versand
> Geplant: offen

- [ ] Functions-Projekt initialisieren
- [ ] Monats-Reset Cron-Job
- [ ] E-Mail-Versand via SendGrid/Mailgun
- [ ] Webhook für Stripe-Events (wenn echte Bezahlung)

---

## Notizen

- Free-Plan: 3 Gratis-Generierungen, Basic: 25/Monat, Pro: Unbegrenzt
- Qualität pro Plan fest: Free=niedrig (`low`), Basic=mittel (`medium`), Pro=hoch (`high`)
- Vinted-Texte für ALLE User (Feature-Gating existiert in `subscription.js` ist aber nicht in `app.js` eingebunden)
- Cost-Estimate entfernt (Abrechnung läuft über Abo, nicht pro Bild)
- Kein 7-Tage-Trial
- BYOK (Bring Your Own Key) für OpenAI bleibt bestehen
- Fake Stripe Checkout für Dummy-Bezahlung
- Firestore-Pfad: `users/{uid}/generations/{genId}` (nicht mehr `generations/{uid}`)
- Thumbnails werden client-seitig via Canvas erstellt und als Base64-JPEG in Firestore gespeichert
- Firebase Functions kommen später
- Glow-Effekt nutzt `box-shadow` auf Container (`border-radius: 50%`), nicht SVG `filter: drop-shadow`
- **Downgrade-Mechanismus**: `scheduledDowngrade` + `downgradeAt` in Firestore; `applyScheduledDowngrade()` prüft beim Account-Laden ob Fälligkeit erreicht ist
- **Pro-Badge**: 3-fach geschichteter `box-shadow` in `@keyframes pro-glow` – kein `::before`/`::after` mehr
- **Donut-Farben**: Default `stroke:#22c55e` (grün), + Farbklassen mit `!important`, Rotation nur via `.account-donut-fill--pro`
- **Plan-Wechseln**: `showUpgradeModal('account')` erkennt Upgrade/Downgrade automatisch anhand Plan-Reihenfolge; Downgrade-Modal wird dynamisch erzeugt

---

## Zeitstrahl

```
15.07. Phase 1+2:     Abo-System + Checkout
16.07. Phase 2+3:     Checkout-Fixes, History-Redesign, Firestore-Fixes, Donut-Visualisierung, Abo-Verwaltung (begonnen)
17.07. Phase 4+5+8:   Abo-Verwaltung (fertig), Benachrichtigungen, SEO & Meta
17.07. Phase 10+11+12: Bild-Regenerieren, Text-Regenerieren, Light/Dark Mode
18.07. Phase 13+14:   E-Mail-Vorlagen + Security Rules
```

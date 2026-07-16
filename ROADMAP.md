# ROADMAP — Virtual Try-On

> Live-Tracker für Entwicklungsfortschritt
> Zuletzt aktualisiert: 16.07.2026

---

## Projektstatus

| Metrik | Wert |
|--------|------|
| Startdatum | 15.07.2026 |
| Aktuelle Phase | Phase 4 — Abo-Verwaltung im Account |
| Gesamtfortschritt | ██████░░░░ ~60% |

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
| Donut-Glow (gelb→orange→rot, prozentual) | Fertig | 16.07. |
| Firestore-Pfad-Fix (generations→users/{uid}/generations) | Fertig | 16.07. |
| Thumbnail-Generierung (150px JPEG in Firestore) | Fertig | 16.07. |
| Limit-Upgrade-Modal (2-Stufig) | Fertig | 16.07. |
| Feature-Gating entfernt (Qualität fix pro Plan) | Fertig | 16.07. |

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
- [x] **Qualität pro Plan**: Free→niedrig, Basic→mittel, Pro→hoch
- [x] **Qualitäts-Dropdown entfernt** (`#qualitySelect` gelöscht)
- [x] **`applyFeatureGating()`** vereinfacht (kein DOM-Gating mehr)
- [x] **Cost-Estimate entfernt** (irrelevant innerhalb Abo)
- [x] **2-Stufiger Upgrade-Flow**: Upgrade-Modal (3 Karten) → Zahlung
- [x] **Upgrade-Modal** mit Plan-Cards + Features + Lucide-Icons
- [x] **`showUpgradeModal()`** statt `openCheckout()`

### Phase 3: Account-Seite UI, History-Redesign & Firebase-Fixes
> Ziel: Moderne History-Cards, richtige Thumbnails, Donut-Visualisierung, Firebase-Korrekturen
> Geplant: 16.07.2026 | Fertig: 16.07.2026

- [x] **Firestore-Pfad** von `generations/{uid}` → `users/{uid}/generations` (4 Stellen)
- [x] **History-Karten-Redesign**: Thumbnails, Lucide-Actions, Preview-Overlay, 2er-Grid Desktop
- [x] **Thumbnail-Generierung** via Canvas (max 150px, JPEG q0.6) in `createThumbnail()`
- [x] **"Einzelbilder"** → **"Einzelbild"** (Badges, Filter, Export)
- [x] **"+ Neue Anzeige erstellen"** als Card mit großem Plus-Symbol
- [x] **Donut-Glow** prozentual (60% gelb, 80% orange, 100% rot) – kein Rechteck-Flackern mehr
- [x] **Label Variante B**: "Du hast X von Y Anzeigen diesen Monat erstellt"
- [x] **DEV Mode**: Upgrade-Modal + Toast, aber keine Blockierung (kein `return`)
- [x] **Account-UI**: Abmelden in Kontoverwaltung, E-Mail-Button unter Input, Lucide-Icons
- [x] **Preview-Overlay**: Modal mit Thumbnail + Verkaufstext + Escape/Click-Close
- [x] **Button-Position**: Action-Buttons rechts unten via `margin-top: auto`
- [x] **Responsive**: Mobile 100px Thumbnails, Desktop 130px, angepasste Padding/Grid

### Phase 4: Account-Abo-Verwaltung 🔄 in Arbeit
> Ziel: Verwaltung des laufenden Abos (kündigen, wechseln, nächste Abbuchung)
> Geplant: 16.07.2026

- [x] **Plan-Badge mit Lucide-Icons** (star/layers/crown) + Farben
- [ ] "Plan wechseln" Button → Upgrade-Modal
- [ ] "Abo kündigen" Button → Bestätigungs-Modal
- [ ] Nächste Abbuchung / Ablaufdatum anzeigen
- [ ] Monats-Reset-Datum im Profil

### Phase 5: In-App Benachrichtigungen
> Ziel: Kontextuelle Hinweise für Abo-Status
> Geplant: 17.07.2026

- [ ] Banner: Limit erreicht (rot)
- [ ] Toast: Limit fast erreicht (gelb)
- [ ] Toast: Upgrade erfolgreich (grün)
- [ ] Banner: Abo gekündigt (gelb)
- [ ] Banner: Abo abgelaufen (rot)
- [ ] Modal: Premium-Feature blockiert

### Phase 6: E-Mail-Vorlagen
> Ziel: HTML-Vorlagen für späteren Versand
> Geplant: 17.07.2026

- [ ] `src/email-templates.js` erstellen
- [ ] Willkommens-E-Mail (Free)
- [ ] Abo-aktiviert-E-Mail
- [ ] Abo-gekündigt-E-Mail
- [ ] Abo-abgelaufen-E-Mail
- [ ] Limit-Warnung-E-Mail
- [ ] Zahlung-fehlgeschlagen-E-Mail

### Phase 7: Firestore Security Rules
> Ziel: Server-seitige Zugriffskontrolle
> Geplant: 18.07.2026

- [ ] `firestore.rules` erstellen
- [ ] Users: Nur eigene Daten lesen/schreiben
- [ ] Generations: Nur eigene Daten lesen/schreiben
- [ ] Rules testen in Firebase Console
- [ ] Rules deployen

### Phase 8: SEO & Meta
> Ziel: Auffindbarkeit und Sharing
> Geplant: 18.07.2026

- [ ] Meta-Tags (description, OG, Twitter)
- [ ] Favicon
- [ ] robots.txt
- [ ] sitemap.xml

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

---

## Zeitstrahl

```
15.07. Phase 1+2:     Abo-System + Checkout
16.07. Phase 2 abschluss + Phase 3: Checkout-Fixes, History-Redesign, Firestore-Fixes, Donut-Visualisierung
17.07. Phase 4+5:     Abo-Verwaltung + Benachrichtigungen
18.07. Phase 6+7+8:   E-Mail-Vorlagen + Security Rules + SEO
```

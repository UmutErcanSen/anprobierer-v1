# 🗺️ ROADMAP — Virtual Try-On

> Live-Tracker für Entwicklungsfortschritt
> Zuletzt aktualisiert: 16.07.2026

---

## 📊 Projektstatus

| Metrik | Wert |
|--------|------|
| Startdatum | 15.07.2026 |
| Aktuelle Phase | Phase 3 — Account-Seite Abo-Status ⏳ |
| Gesamtfortschritt | ████░░░░░░ ~40% |

---

## ✅ Abgeschlossene Features

| Feature | Status | Datum |
|---------|--------|-------|
| Landing Page mit Video | ✅ Fertig | |
| Auth (Email/Google/Reset) | ✅ Fertig | |
| E-Mail-Verifizierung | ✅ Fertig | |
| KI-Bildgenerierung (Einzel + Kombi) | ✅ Fertig | |
| Vinted-Text Generierung | ✅ Fertig | |
| ZIP-Download | ✅ Fertig | |
| Account-Seite (Profil, Stats, History) | ✅ Fertig | |
| Preise-Seite (3-Tier Vergleich) | ✅ Fertig | |
| Responsive Design (Mobile/Desktop) | ✅ Fertig | |
| Desktop/Mobile Filter-Split | ✅ Fertig | |
| Burger-Menü (Mobile/Desktop) | ✅ Fertig | |
| Nutzer-Icon mit Glow + Initialen | ✅ Fertig | |
| Rechtliche Seiten (Impressum/Datenschutz) | ✅ Fertig | |
| Sticky Footer | ✅ Fertig | |
| DSGVO-konformes Löschen + Datenexport | ✅ Fertig | |

---

## 🚧 Offene Phasen

### Phase 1: Subscription Infrastructure
> Ziel: Abo-System mit Limits und Feature-Gating
> Geplant: 15.07.2026 | Fertig: 15.07.2026

- [x] Plan-Definitionen aktualisieren (Free = 3 Generierungen) ✅ 15.07.
- [x] User-Profil in Firestore erweitern (subscription, dates, status) ✅ 15.07.
- [x] `src/subscription.js` — Abo-Management-Modul erstellen ✅ 15.07.
- [x] Feature-Gating: Qualität nur für Free="mittel" ✅ 15.07.
- [x] Feature-Gating: Items pro Bild (Free=1, Basic=5, Pro=∞) ✅ 15.07.
- [x] Feature-Gating: Vinted-Texte nur für Basic/Pro ✅ 15.07.
- [x] Generierungs-Limit Enforcement (client-seitig) ✅ 15.07.

### Phase 2: Fake Stripe Checkout ✅ Fertig
> Ziel: Simulierter Bezahlflow für Upgrade
> Geplant: 15.07.2026 | Fertig: 16.07.2026

- [x] `src/checkout.js` — Checkout-Modal mit Kreditkartenformular ✅ 15.07.
- [x] Checkout-HTML in `index.html` + CSS-Styles ✅ 15.07.
- [x] Fake-Kreditkartenformular (Kartennummer, Ablaufdatum, CVC) ✅ 15.07.
- [x] Loading-Animation + Erfolgs-Message ✅ 15.07.
- [x] Upgrade-Callback auf `/preise`-Seite angepasst ✅ 15.07.
- [x] Redirect zu `/account` nach erfolgreichem Upgrade ✅ 15.07.
- [x] **Qualität pro Plan**: Free→niedrig, Basic→mittel, Pro→hoch ✅ 16.07.
- [x] **Qualitäts-Dropdown entfernt** (`#qualitySelect` gelöscht) ✅ 16.07.
- [x] **`applyFeatureGating()`** vereinfacht (kein DOM-Gating mehr) ✅ 16.07.
- [x] **Cost-Estimate entfernt** (irrelevant innerhalb Abo) ✅ 16.07.
- [x] **2-Stufiger Upgrade-Flow**: Upgrade-Modal (3 Plan-Karten) → Zahlung ✅ 16.07.
- [x] **Upgrade-Modal** mit Plan-Cards + Features + Lucide-Icons ✅ 16.07.
- [x] **`showUpgradeModal()`** statt `openCheckout()` ✅ 16.07.

### Phase 3: Account-Seite Abo-Status 🔄 in Arbeit
> Ziel: Abo-Informationen und Verwaltung im Profil
> Geplant: 16.07.2026

- [x] **Plan-Badge mit Lucide-Icons** (star/layers/crown) + Farben ✅ 16.07.
- [ ] Aktueller Plan + Status-Anzeige
- [ ] Nächste Abbuchung / Ablaufdatum
- [ ] Generierungsfortschritt (Balken)
- [ ] "Plan wechseln" Button → öffnet Upgrade-Modal
- [ ] "Abo kündigen" Button → Bestätigungs-Modal
- [ ] Kündigungs-Modal mit Warnung

### Phase 4: In-App Benachrichtigungen
> Ziel: Kontextuelle Hinweise für Abo-Status
> Geplant: 16.07.2026

- [ ] Banner: Limit erreicht (rot)
- [ ] Toast: Limit fast erreicht (gelb)
- [ ] Toast: Upgrade erfolgreich (grün)
- [ ] Banner: Abo gekündigt (gelb)
- [ ] Banner: Abo abgelaufen (rot)
- [ ] Modal: Premium-Feature blockiert

### Phase 5: Generierungen Bugfix
> Ziel: Korrekte Speicherung und Anzeige von Generierungen
> Geplant: 17.07.2026

- [ ] `clothingType` in `saveGeneration()` speichern
- [ ] Mock-Fallback durch echte Fehlermeldung ersetzen
- [ ] DEV_MODE: Generierungen auch in Firestore speichern
- [ ] Account-Seite: Echte Daten statt Mock-Daten
- [ ] Kleidungsfilter mit echten Daten funktioniert
- [ ] Header-Behavior auf allen Seiten vereinheitlichen

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
- [ ] Favicon erstellen
- [ ] robots.txt
- [ ] sitemap.xml

### Phase 9: Firebase Functions (optional)
> Ziel: Server-seitiger Monats-Reset und E-Mail-Versand
> Geplant: ---

- [ ] Functions-Projekt initialisieren
- [ ] Monats-Reset Cron-Job
- [ ] E-Mail-Versand via SendGrid/Mailgun
- [ ] Webhook für Stripe-Events (wenn echte Bezahlung)

---

## 📝 Notizen

- Free-Plan: 3 Gratis-Generierungen (nicht 5)
- Basic-Plan: 25 Generierungen/Monat (nicht 50)
- Qualität pro Plan fest: Free=niedrig, Basic=mittel, Pro=hoch
- Cost-Estimate entfernt (Abrechnung läuft über Abo, nicht pro Bild)
- Kein 7-Tage-Trial
- BYOK (Bring Your Own Key) für OpenAI bleibt bestehen
- Fake Stripe Checkout für Dummy-Bezahlung
- Firebase Functions kommen später

---

## 📅 Zeitstrahl

```
15.07. Phase 1+2: Abo-System + Checkout
16.07. Phase 3+4: Account-Abo + Benachrichtigungen
17.07. Phase 5+6: Generierungen-Bugfix + E-Mail-Vorlagen
18.07. Phase 7+8: Security Rules + SEO
```

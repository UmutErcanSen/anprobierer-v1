# Virtual Try-On – KI Anzeigen Erstellung

KI-gestützte Anprobebilder für Vinted-Anzeigen. Users upload a person photo + clothing items, and the app generates realistic try-on images via OpenAI GPT Image 2.

Live: https://virtual-try-on-6d197.web.app
GitHub: https://github.com/UmutErcanSen/anprobierer-v1

---

## Features

- **KI-Bildgenerierung**: Einzel- & Kombi-Modus mit Fortschrittsanzeige
- **Vinted-Texte**: Automatische Verkaufstexte für alle User
- **ZIP-Download**: Bilder + Texte als ZIP herunterladen
- **Account-System**: Email/Google-Login, E-Mail-Verifizierung, Profil-Verwaltung
- **Abo-System**: Free (3/Monat), Basic (25/Monat), Pro (Unlimited)
- **Qualität pro Plan**: Niedrig (Free), Mittel (Basic), Hoch (Pro) — keine User-Auswahl
- **History-Cards**: Thumbnails, Preview-Overlay, 2er-Grid auf Desktop
- **Donut-Visualisierung**: Prozentualer Fortschritt mit gelb/orange/rot Glow
- **Responsive**: Mobile & Desktop optimiert
- **Burger-Menü**: Hamburger-Icon mit Dropdown-Overlay (Mobile/Desktop)
- **Nutzer-Icon**: Glow-Effekt + erster Buchstabe des Displaynamens
- **Rechtliche Seiten**: Impressum & Datenschutzerklärung
- **Sticky Footer**: Bleibt immer unten, auch bei wenig Inhalt
- **Header mit Scroll-Shadow**: Box-Shadow erscheint beim Scrollen
- **DSGVO-konform**: Löschen + Datenexport mit Vorschau-Modal

---

## 🚀 Lokal entwickeln

### Voraussetzungen

- [Node.js](https://nodejs.org) 18+ (auf Mac mit nvm: `nvm use 24`)
- npm (wird mit Node.js installiert)

### Dev-Server starten

```bash
npm run dev
```

→ http://localhost:5173

### API-Key automatisch hinterlegen (optional)

1. Erstelle `.env.local` im Projektstamm (wird nicht committed)
2. Trag deinen Key ein:

```
VITE_DEV_API_KEY=sk-dein-wirklicher-key
```

### DEV_MODE

In `.env` oder `.env.local`:
```
VITE_DEV_MODE=true   # Kein Login nötig, 7 Gratis-Generierungen
VITE_DEV_MODE=false  # Login nötig, 3 Gratis-Generierungen (Produktion)
```

---

## 🔥 Live schalten (Firebase Hosting)

### Empfohlenes Workflow

**Mac (Entwicklung):**
```bash
git add -A && git commit -m "Beschreibung" && git push
```

**PC (Deployment):**
```bash
git pull && npm run build && firebase deploy --only hosting
```

Danach Browser-Cache leeren: **Cmd+Shift+Delete** → Cache leeren → Seite neu laden.

### Quick-Deploy (nur Hosting)

```bash
# Mac
git pull && npm run build && firebase deploy --only hosting

# Windows
cmd /c "git pull && npm run build && firebase deploy --only hosting"
```

---

## 📝 Änderungen commiten und pushen

```bash
# Mac
git add -A && git commit -m "Beschreibung" && git push

# Windows
cmd /c "git add -A && git commit -m "Beschreibung" && git push"
```

---

## 📁 Projektstruktur

```
src/
├── main.js              Einstiegspunkt
├── firebase.js          Firebase Init
├── auth.js              Login/Registrierung/Google + AuthGuard
├── account.js           Account-Seite (Profil, Stats, History, Donut, Preview-Overlay)
├── firestore.js         Firestore CRUD (Profile, Generierungen, Thumbnails)
├── app.js               Hauptlogik (Upload, Generierung, Ergebnisse, createThumbnail)
├── api.js               OpenAI API-Aufrufe (Bilder + Texte)
├── subscription.js      Abo-Management (Upgrade, Cancel, Reset, Quality-Gating)
├── plans.js             Abo-Vergleich & Definitionen
├── legal-content.js     Rechtliche Seiten (Impressum, Datenschutz)
├── utils.js             Hilfsfunktionen
├── router.js            Client-seitige Navigation (6 Routes)
├── icons.js             SVG-Icon-System (35+ Lucide-Icons)
├── checkout.js          Fake Stripe Checkout (Phase 2)
└── styles.css           Styles (~1550 Zeilen)

public/
├── assets/              Bilder (phone-preview, gut, schlecht, …)
└── js/loading.json      Lottie-Animation

index.html               HTML-Grundgerüst (884 Zeilen)
firebase.json            Firebase Hosting Config
.firebaserc              Firebase Projekt-Alias
.env                     Basis-Umgebungsvariablen (committed)
.env.local               Lokale Overrides (NICHT committed)
.env.production          Produktions-Umgebungsvariablen (committed)
ROADMAP.md               Entwicklungsroadmap & Fortschritt
```

---

## 🔑 Abo-Modelle

| Feature | Free | Basic (9,99 €/Mo) | Pro (19,99 €/Mo) |
|---------|------|-------------------|-------------------|
| Generierungen/Monat | 3 | 25 | Unbegrenzt |
| Bildqualität | Niedrig | Mittel | Hoch |
| Kleidungsstücke/Bild | 1 | Bis zu 5 | Unbegrenzt |
| Kombi-Modus | Ja (max 3) | Ja (max 9) | Ja (max 9) |
| Vinted-Anzeigentexte | Ja | Ja | Ja |
| Support | Standard | Priorität | Premium |

---

## 🏗 Architektur

- **Frontend**: Vanilla JS (kein Framework), Vite 6
- **Backend**: Firebase (Auth, Firestore, Hosting)
- **KI**: OpenAI GPT Image 2 (Bilder), GPT-4o-mini (Texte)
- **API-Key**: BYOK (Bring Your Own Key) — User bringt eigenen OpenAI-Key
- **Hosting**: Firebase Hosting (`dist/` Ordner)

### Datenfluss

```
User → Upload Fotos → OpenAI API → Generierte Bilder → Download
                                    ↓
                              Firestore (users/{uid}/generations/{id})
                              ├── mode, quality, itemCount, notes
                              ├── imageCount, clothingType
                              └── thumbnail (Base64 JPEG, max 150px)
```

### Abo-System

- Free-User: 3 Generierungen/Monat, Niedrigqualität, 1 Kleidungsstück
- Basic-User: 25 Generierungen/Monat, Mittelqualität, bis 5 Kleidungsstücke
- Pro-User: Unbegrenzt, Hochqualität, unbegrenzte Kleidungsstücke
- Monats-Reset: Wird beim nächsten Login geprüft (client-seitig)
- Upgrade/Cancel: Wird in `src/subscription.js` + `src/checkout.js` verwaltet
- Quality-Gating: `getQualityForPlan()` in `subscription.js`, kein User-Dropdown mehr

### Router-System (6 Routes)

| Route | Beschreibung |
|-------|-------------|
| `/` | Startseite (Landing Page) |
| `/anzeige-erstellen` | KI-Generierung (geschützt) |
| `/account` | Account-Seite (geschützt) |
| `/preise` | Preisvergleich |
| `/datenschutz` | Datenschutzerklärung |
| `/impressum` | Impressum |

### Modal-Pattern

Alle Modale folgen dem gleichen Muster:
```js
// Öffnen
modal.classList.add('visible');
document.body.style.overflow = 'hidden';

// Schließen
modal.classList.remove('visible');
document.body.style.overflow = '';
```

### Toast-System

`showToast(message, type, duration)` mit Typen:
- `error` (rot), `success` (grün), `warning` (gelb), `info` (blau)

---

## 🛠 Nützliche Befehle

| Befehl | Was passiert? |
|--------|--------------|
| `npm run dev` | Startet lokalen Dev-Server (http://localhost:5173) |
| `npm run build` | Baut prod-ready Version nach `dist/` |
| `npm run preview` | Testet den Build lokal |
| `git pull` | Holt neuesten Code von GitHub |
| `firebase deploy --only hosting` | Deployet nur Hosting |

---

## 📊 Entwicklung

Siehe `ROADMAP.md` für den aktuellen Entwicklungsstand und geplante Features.

# Virtual Try-On – KI Anzeigen Erstellung

KI-gestützte Anprobebilder für Vinted-Anzeigen. Users upload a person photo + clothing items, and the app generates realistic try-on images via OpenAI GPT Image 2.

Live: https://virtual-try-on-6d197.web.app

---

## Features

- **KI-Bildgenerierung**: Einzel- & Kombi-Modus mit Fortschrittsanzeige
- **Vinted-Texte**: Automatische Anzeigentext-Generierung (Basic/Pro)
- **ZIP-Download**: Bilder + Texte als ZIP herunterladen
- **Account-System**: Email/Google-Login, E-Mail-Verifizierung
- **Abo-System**: Free (3/Monat), Basic (50/Monat), Pro (Unlimited)
- **Feature-Gating**: Qualität, Items pro Bild, Vinted-Texte nach Plan
- **Responsive**: Mobile & Desktop optimiert

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

Im `.env` ist `VITE_DEV_MODE=false` → Login nötig.

### API-Key automatisch hinterlegen (optional)

1. Erstelle `.env.local` im Projektstamm (wird nicht committed)
2. Trag deinen Key ein:

```
VITE_DEV_API_KEY=sk-dein-wirklicher-key
```

---

## 🔥 Live schalten (Firebase Hosting)

```bash
# Mac
git pull && npm run build && firebase deploy --only hosting

# Windows
cmd /c "git pull && npm run build && firebase deploy --only hosting"
```

Danach Browser-Cache leeren: **Cmd+Shift+Delete** → Cache leeren → Seite neu laden.

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
├── account.js           Account-Seite (Profil, Stats, History)
├── firestore.js         Firestore CRUD (Profile, Generierungen)
├── app.js               Hauptlogik (Upload, Generierung, Ergebnisse)
├── api.js               OpenAI API-Aufrufe
├── subscription.js      Abo-Management (Upgrade, Cancel, Reset)
├── utils.js             Hilfsfunktionen
├── router.js            Client-seitige Navigation
├── plans.js             Abo-Vergleich & Definitionen
├── icons.js             SVG-Icon-System
└── styles.css           Styles

public/
├── assets/              Bilder (phone-preview, gut, schlecht, …)
└── js/loading.json      Lottie-Animation

index.html               HTML-Grundgerüst
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
| Generierungen/Monat | 3 | 50 | Unbegrenzt |
| Bildqualität | Mittel | Hoch | Max |
| Kleidungsstücke/Bild | 1 | Bis zu 5 | Unbegrenzt |
| Kombi-Modus | Ja (max 3) | Ja (max 9) | Ja (max 9) |
| Vinted-Anzeigentexte | Nein | Ja | Ja |
| Support | Standard | Prioritaet | Premium |

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
                              Firestore (Generierungs-Record)
```

### Abo-System

- Free-User: 3 Generierungen/Monat, nur Mittelqualität, 1 Kleidungsstück
- Basic-User: 50 Generierungen/Monat, Hochqualität, bis 5 Kleidungsstücke, Vinted-Texte
- Pro-User: Unbegrenzt, Maxqualität, unbegrenzte Kleidungsstücke, Vinted-Texte
- Monats-Reset: Wird beim nächsten Login geprüft (client-seitig)
- Upgrade/Cancel: Wird in `src/subscription.js` verwaltet

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

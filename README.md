# Virtual Try-On – KI Anzeigen Erstellung

KI-gestützte Anprobebilder für Vinted-Anzeigen.

---

## 🚀 Lokal entwickeln

### Voraussetzungen

- [Node.js](https://nodejs.org) 18+ (auf Mac mit nvm: `nvm use 24`)
- npm (wird mit Node.js installiert)

### Dev-Server starten

**Windows (PowerShell):**
```bash
cmd /c "npm run dev"
```

**Mac (Terminal):**
```bash
npm run dev
```

→ http://localhost:5173

Im `.env` ist `VITE_DEV_MODE=true` → kein Login nötig.

### API-Key automatisch hinterlegen (optional)

Damit du den Key nicht jedes Mal manuell eintragen musst:

1. Erstelle `.env.local` im Projektstamm (wird nicht committed)
2. Trag deinen Key ein:

```
VITE_DEV_API_KEY=sk-dein-wirklicher-key
```

Beim nächsten Start wird der Key automatisch geladen.

---

## 🔥 Live schalten (Firebase Hosting)

### Einmalig: Einloggen

**Windows (PowerShell):**
```bash
cmd /c "firebase login"
```

**Mac (Terminal):**
```bash
firebase login
```

→ Browser öffnet sich → Google-Konto auswählen → fertig.

### Deployen (nach jeder Änderung)

**Windows (PowerShell):**
```bash
cmd /c "npm run deploy"
```

**Mac (Terminal):**
```bash
npm run deploy
```

→ Baut `dist/` + lädt auf Firebase CDN hoch.

Live unter: https://virtual-try-on-6d197.web.app

---

## 💾 Code sichern (optional)

**Windows (PowerShell):**
```bash
git add -A && git commit -m "Was geändert wurde"
cmd /c "git push"
```

**Mac (Terminal):**
```bash
git add -A && git commit -m "Was geändert wurde"
git push
```

---

## 📁 Projektstruktur

```
src/
├── main.js          Einstiegspunkt
├── firebase.js      Firebase Init
├── auth.js          Login/Registrierung/Google + AuthGuard
├── user.js          Benutzer-Profil-Modal
├── firestore.js     Firestore CRUD (Profile, Generierungen)
├── app.js           Hauptlogik (Upload, Generierung, Ergebnisse)
├── api.js           OpenAI API-Aufrufe
├── utils.js         Hilfsfunktionen
└── styles.css       Styles

public/
├── assets/          Bilder (phone-preview, gut, schlecht, …)
└── js/loading.json   Lottie-Animation

index.html           HTML-Grundgerüst
firebase.json        Firebase Hosting Config
.firebaserc          Firebase Projekt-Alias
```

---

## 🔑 Abo-Modelle

| Modell | Generierungen | Modus | Qualität |
|--------|--------------|-------|----------|
| Free   | 5 / Monat    | Nur Einzeln | Nur Niedrig |
| Basic  | 50 / Monat   | Einzeln + Kombiniert | Niedrig + Mittel |
| Pro    | Unbegrenzt   | Alle | Alle |

---

## 🛠 Nützliche Befehle

### Lokaler Dev-Server

| Platform | Befehl |
|----------|--------|
| Windows | `cmd /c "npm run dev"` |
| Mac | `npm run dev` |

### Build (ohne Deploy)

| Platform | Befehl |
|----------|--------|
| Windows | `cmd /c "npm run build"` |
| Mac | `npm run build` |

### Build-Export lokal testen

| Platform | Befehl |
|----------|--------|
| Windows | `cmd /c "npm run preview"` |
| Mac | `npm run preview` |

### Deploy (Bauen + Live schalten)

| Platform | Befehl |
|----------|--------|
| Windows | `cmd /c "npm run deploy"` |
| Mac | `npm run deploy` |

# Virtual Try-On – KI Anzeigen Erstellung

KI-gestützte Anprobebilder für Vinted-Anzeigen.

---

## 🚀 Lokal entwickeln

PowerShell blockiert `.ps1`-Skripte. Darum immer **`cmd /c`** vor jedem Befehl:

```bash
cmd /c "npm run dev"
```

→ http://localhost:5173

Im `.env` ist `VITE_DEV_MODE=true` → kein Login nötig.

### API-Key automatisch hinterlegen (optional)

Damit du den Key nicht jedes Mal manuell eintragen musst:

1. Erstelle `src/../.env.local` (wird nicht committed)
2. Trag deinen Key ein:

```
VITE_DEV_API_KEY=sk-dein-wirklicher-key
```

Beim nächsten `cmd /c "npm run dev"` wird der Key automatisch geladen.

---

## 🔥 Live schalten (Firebase Hosting)

### Einmalig: Einloggen

```bash
cmd /c "firebase login"
```

→ Browser öffnet sich → Google-Konto auswählen → fertig.

### Deployen (nach jeder Änderung)

```bash
cmd /c "npm run deploy"
```

→ Baut `dist/` + lädt auf Firebase CDN hoch.

Live unter: https://virtual-try-on-6d197.web.app

---

## 💾 Code sichern (optional)

```bash
git add -A && git commit -m "Was geändert wurde"
cmd /c "git push"
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

| Befehl | Beschreibung |
|--------|-------------|
| `cmd /c "npm run dev"` | Lokaler Dev-Server |
| `cmd /c "npm run build"` | Nur bauen (ohne deploy) |
| `cmd /c "npm run preview"` | Gebaute `dist/` lokal testen |
| `cmd /c "npm run deploy"` | Bauen + live schalten |

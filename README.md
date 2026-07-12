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

Im `.env` ist `VITE_DEV_MODE=false` → Login nötig.

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

### Schritt 1: Neuesten Code holen

Im Terminal im Projektordner:

**Windows (PowerShell):**
```bash
cmd /c "git pull"
```

**Mac (Terminal):**
```bash
git pull
```

→ Holt die neuesten Dateien vom GitHub-Repository.

### Schritt 2: Neu bauen

**Windows (PowerShell):**
```bash
cmd /c "npm run build"
```

**Mac (Terminal):**
```bash
npm run build
```

→ Erzeugt frische Dateien im `dist/`-Ordner.
→ **WICHTIG:** Ohne diesen Schritt wird die alte Version deployed!

### Schritt 3: Auf Firebase hochladen

**Windows (PowerShell):**
```bash
cmd /c "firebase deploy --only hosting"
```

**Mac (Terminal):**
```bash
firebase deploy --only hosting
```

→ Lädt den `dist/`-Ordner auf Firebase CDN hoch.

### Schritt 4: Browser-Cache leeren

Im Browser:
1. **Cmd+Shift+Delete** (Mac) oder **Strg+Shift+Delete** (Windows)
2. "Bilder und Dateien im Cache" auswählen
3. "Cache leeren" klicken
4. Seite neu laden: https://virtual-try-on-6d197.web.app

### Oder alles in einem Befehl (nach git pull):

```bash
# Mac
npm run build && firebase deploy --only hosting

# Windows
cmd /c "npm run build && firebase deploy --only hosting"
```

---

## 📝 Änderungen commiten und pushen

Nach dem Programmieren:

**Windows (PowerShell):**
```bash
cmd /c "git add -A && git commit -m "Beschreibung""
cmd /c "git push"
```

**Mac (Terminal):**
```bash
git add -A && git commit -m "Beschreibung"
git push
```

→ Speichert die Änderungen auf GitHub.

---

## 📁 Projektstruktur

```
src/
├── main.js          Einstiegspunkt
├── firebase.js      Firebase Init
├── auth.js          Login/Registrierung/Google + AuthGuard
├── account.js       Benutzer-Profil bearbeiten
├── firestore.js     Firestore CRUD (Profile, Generierungen)
├── app.js           Hauptlogik (Upload, Generierung, Ergebnisse)
├── api.js           OpenAI API-Aufrufe
├── utils.js         Hilfsfunktionen
├── router.js        Client-seitige Navigation
├── plans.js         Abo-Vergleich
└── styles.css       Styles

public/
├── assets/          Bilder (phone-preview, gut, schlecht, …)
└── js/loading.json   Lottie-Animation

index.html           HTML-Grundgerüst
firebase.json        Firebase Hosting Config
.firebaserc          Firebase Projekt-Alias
.env                 Basis-Umgebungsvariablen (committed)
.env.local           Lokale Overrides (NICHT committed, gitignore)
.env.production      Produktions-Umgebungsvariablen (committed)
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

| Befehl | Was passiert? | Windows |
|--------|--------------|---------|
| `npm run dev` | Startet lokalen Dev-Server (http://localhost:5173) | `cmd /c "npm run dev"` |
| `npm run build` | Baut prod-ready Version nach `dist/` | `cmd /c "npm run build"` |
| `npm run deploy` | Baut + deployed auf Firebase | `cmd /c "npm run deploy"` |
| `npm run preview` | Testet den Build lokal | `cmd /c "npm run preview"` |
| `git pull` | Holt neuesten Code von GitHub | `cmd /c "git pull"` |
| `firebase deploy --only hosting` | Deployet nur Hosting (schneller) | `cmd /c "firebase deploy --only hosting"` |

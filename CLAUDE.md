# DEVELOPMENT_GUIDE.md

> **Rolle:** Du agierst als Kombination aus Senior Frontend Engineer, UX/UI Designer, SaaS Product Designer, Conversion Rate Optimizer, Startup Co-Founder, AI Product Expert und Performance Engineer.
>
> **Kontext:** Du erhältst das komplette Webprojekt als Grundlage. Ziel ist **nicht**, nur Bugs zu fixen oder das Design zu verschönern. Ziel ist es, das Projekt zu einer professionellen, kommerziell erfolgreichen SaaS-Webanwendung weiterzuentwickeln.
>
> Arbeite nicht wie ein Dienstleister, sondern wie ein Mitgründer mit Produktverantwortung.

---

## 1. Projektbeschreibung

Die Anwendung ermöglicht es Nutzern:

- einen Account zu erstellen
- ein Abonnement abzuschließen
- ein Personenfoto hochzuladen
- ein oder mehrere Kleidungsstücke hochzuladen
- Informationen zur Kleidung auszuwählen
- über die OpenAI API automatisch realistische Bilder generieren zu lassen, auf denen die Kleidung von der Person getragen wird
- automatisch professionelle Verkaufstitel und -texte für Plattformen wie Vinted, Kleinanzeigen o. Ä. erstellen zu lassen

**Wichtig:** Die Bildgenerierung verursacht reale Kosten, die zunächst vom Betreiber getragen werden. Jede technische Entscheidung muss deshalb auch wirtschaftlich bewertet werden.

---

## 2. Zielsetzung

Modernisiere das komplette Projekt – nicht nur optisch, sondern auch:

- technisch
- wirtschaftlich
- UX-technisch
- architektonisch
- hinsichtlich Skalierbarkeit

Jede Änderung muss begründet werden. Erkanntes Verbesserungspotenzial wird eigenständig umgesetzt. Bestehende Designs, Abläufe oder Funktionen dürfen vollständig überarbeitet werden, wenn das Produkt dadurch besser wird.

**Maßstab:** Das Ergebnis soll sich wie ein modernes Premium-SaaS-Produkt anfühlen.

---

## 3. Entscheidungsprinzipien (Priorität bei jeder Änderung)

Bei jeder Design-, Architektur- oder Funktionsentscheidung gilt diese Reihenfolge:

1. **Sicherheit**
2. **Wirtschaftlichkeit**
3. **Benutzerfreundlichkeit**
4. **Performance**
5. **Wartbarkeit**
6. **Design**

Keine Entscheidung ausschließlich aus optischen Gründen. Bei mehreren Lösungsoptionen: die mit dem größten langfristigen Nutzen für Produkt und Betreiber wählen.

---

## 4. Design-Richtlinien

**Qualitäts-Referenz** (Niveau, nicht kopieren): OpenAI, Linear, Vercel, Framer, Stripe, Notion, Apple.

Das Design soll wirken:
- modern, minimalistisch, hochwertig
- ruhig, professionell, vertrauenswürdig

**Kein** Bootstrap-Look, **kein** Standard-Template, **kein** "0815-Dashboard".

**Umsetzung:**
- viel Weißraum
- klare Typografie
- hochwertige Icons
- dezente Animationen
- moderne Karten (Cards)
- saubere Abstände
- konsistente Komponenten
- Design Tokens
- Responsive Design, Mobile First

---

## 5. UX-Analyse (pro Screen)

Für jeden Screen kritisch prüfen:

- Kann der Nutzer schneller ans Ziel kommen?
- Ist sofort verständlich, was zu tun ist?
- Kann ein Schritt entfallen?
- Fehlen Informationen?
- Sind Texte verständlich?
- Sind Buttons logisch platziert?
- Sind Fehlermeldungen hilfreich?
- Ist die Anwendung intuitiv?

Der komplette Workflow wird auf dieser Basis verbessert.

---

## 6. KI-Workflow (Bildgenerierung)

Der KI-Prozess soll hochwertig wirken. Statt eines einfachen Ladebalkens: sinnvolle, sichtbare Zwischenschritte, z. B.

```
✓ Personenfoto analysieren
✓ Kleidung erkennen
✓ Größenverhältnis berechnen
✓ Stoffstruktur übertragen
✓ Perspektive anpassen
✓ Licht berechnen
✓ Verkaufsbeschreibung erstellen
✓ Qualitätsprüfung
```

---

## 7. Commercial First

Jede Entscheidung wird auch wirtschaftlich bewertet. Optimierungsfokus:

- Conversion
- Nutzerbindung (Retention)
- Upgrade-Rate
- Vertrauen
- Abschlussquote
- Customer Lifetime Value (CLV)
- ARPU (Average Revenue Per User)

Zusätzliche Monetarisierungsmöglichkeiten aktiv vorschlagen, sofern sinnvoll.

---

## 8. Abo- & Preismodell

Bestehendes Free-/Basic-/Pro-Modell kritisch analysieren. Bei Bedarf anpassen:

- Preise
- Leistungsumfang
- Credits
- Limits
- Funktionen
- Upgrade-Strategie

**Mögliche Modell-Bausteine, die geprüft werden sollen:**
- Credit-System
- Credit-Pakete (Top-ups)
- Add-ons
- Pay-per-Use
- Team-Abos
- Jahresrabatte

Ziel: wirtschaftlich nachhaltiges Geschäftsmodell.

---

## 9. Kostenschutz & Missbrauchsprävention

Da jede Bildgenerierung reale Kosten verursacht, muss Missbrauch aktiv verhindert werden:

- Credits
- Rate Limits (pro Stunde/Tag)
- Geräteerkennung
- Browser-Fingerprinting
- IP-Limits
- Account-Limits
- Queue-System für KI-Jobs
- Logging & Monitoring
- Kostenkontrolle
- Erkennung ungewöhnlichen Nutzerverhaltens

> **Harte Regel:** Die OpenAI API darf **niemals** direkt vom Browser aus aufgerufen werden. Alle kostenpflichtigen Prozesse laufen ausschließlich serverseitig und werden dort kontrolliert.

---

## 10. Technik & Code-Qualität

Konsequent verbessern:

- HTML / CSS / JavaScript
- Komponentenstruktur
- Architektur
- Performance
- Accessibility
- Wartbarkeit & Lesbarkeit
- Skalierbarkeit

Unnötig komplizierter Code wird vollständig refaktoriert. Clean Code, keine unnötige Komplexität.

**Code soll:**
- komponentenbasiert
- wiederverwendbar
- leicht testbar
- gut dokumentiert
- klar strukturiert
- möglichst typsicher (TypeScript)
- leicht erweiterbar sein

---

## 11. Sicherheit

Produktionsreife berücksichtigen:

- sichere Authentifizierung & Autorisierung
- API-Schutz
- Eingabevalidierung
- XSS-Schutz
- CSRF-Schutz
- sichere Datei-Uploads
- Berechtigungskonzept
- Fehlerbehandlung
- Logging & Monitoring

Zusätzliche sinnvolle Sicherheitsmaßnahmen aktiv vorschlagen.

---

## 12. Mögliche neue Features

Bei klarem Mehrwert ergänzen:

- Verlauf aller Generierungen
- Favoriten
- Vorher-/Nachher-Vergleich
- mehrere KI-Ergebnisvarianten
- Batch-Erstellung
- Download-Center
- automatische Preisvorschläge
- automatische Kategorien & Hashtags
- plattformspezifische Exportformate
- gespeicherte Vorlagen / Prompt-Historie
- Benachrichtigungen
- Statistiken
- Admin-Dashboard
- Rechnungs- & Nutzungsübersicht

Weitere sinnvolle Funktionen dürfen eigenständig ergänzt werden.

---

## 13. Performance

Konsequent optimieren:

- Ladezeiten
- Lighthouse Score / Core Web Vitals
- Rendering
- Bundlegröße
- Caching
- Bildoptimierung
- Lazy Loading
- API-Aufrufe

---

## 14. Skalierbarkeit

Architektur so auslegen, dass Wachstum auf Tausende bis Zehntausende Nutzer problemlos möglich ist. Potenzielle spätere Bottlenecks frühzeitig benennen und Alternativen vorschlagen.

**Architektur soll zukünftig ohne Großumbau ermöglichen:**
- Mehrsprachigkeit
- Mobile App
- Team-Accounts
- Admin-Dashboard
- Affiliate-System
- Credits & Gutscheine
- öffentliche API
- White-Label
- Multi-Tenancy
- Warteschlangen für KI-Jobs
- Bildhistorie
- Benachrichtigungen

---

## 15. Tech-Stack (Zielarchitektur)

### Frontend
- React
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- React Hook Form
- Zod
- TanStack Query (React Query)

### Backend
- Next.js Server Actions
- Next.js API Routes
- Firebase Functions (oder vergleichbare serverseitige Lösung)

### Authentifizierung
- Firebase Authentication (bevorzugt)

### Datenbank
- Firestore, alternativ Supabase oder PostgreSQL, falls langfristig sinnvoller

### Payments
- Stripe

### KI
- OpenAI API **ausschließlich serverseitig**
- API-Keys niemals im Browser verfügbar

---

## 16. Migration

Bestehende HTML-/CSS-/JS-Dateien dürfen vollständig nach React/Next.js migriert werden. Bestehende Funktionen bleiben erhalten oder werden verbessert. Eine saubere, skalierbare Codebasis hat Vorrang vor minimalen Änderungen – Neustrukturierung ist ausdrücklich erlaubt.

---

## 17. Arbeitsweise

- Wie ein Mitgründer denken, nicht wie ein reiner Auftragsentwickler
- Bestehende Lösungen kritisch hinterfragen
- Unternehmerisch und langfristig denken
- Verbesserungspotenzial überall im Produkt aktiv suchen
- Größere Änderungen nachvollziehbar begründen

**Aktiv suchen nach Möglichkeiten, um:**
- die Conversion zu erhöhen
- die Nutzererfahrung zu verbessern
- Kosten zu senken
- die Plattform profitabler zu machen
- Wartungsaufwand zu reduzieren
- Vertrauen aufzubauen
- sich von Konkurrenzlösungen abzuheben

---

## 18. Zusammenfassung

Das Ziel ist **nicht**, möglichst wenig zu verändern. Das Ziel ist eine hochwertige, moderne, skalierbare und wirtschaftlich erfolgreiche SaaS-Plattform, die Nutzer begeistert und sich langfristig profitabel betreiben lässt.

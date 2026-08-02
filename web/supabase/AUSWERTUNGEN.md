# Auswertungen — was läuft, was kostet es, was verdient es

Fünf fertige Abfragen für den **Supabase-SQL-Editor**. Kein eigenes
Admin-Dashboard nötig, kein zusätzlicher Angriffspunkt.

> **Einmalig:** Migration `20260731090000_admin_views.sql` einspielen.

## Sicherheit

Die Views liegen im Schema `admin`, **nicht** in `public`. Das ist der
entscheidende Punkt: Supabase stellt `public` automatisch über die REST-API
bereit — eine Auswertung dort wäre für jeden angemeldeten Nutzer abrufbar,
samt fremder E-Mail-Adressen und Umsätze. Das Schema `admin` steht nicht in
der API-Konfiguration und ist über HTTP gar nicht erreichbar. Zusätzlich sind
alle Rechte für `anon` und `authenticated` ausdrücklich entzogen.

Erreichbar sind sie damit nur im SQL-Editor oder mit dem
`service_role`-Schlüssel.

---

## Die fünf Abfragen

### Was kostet uns ein Credit wirklich?

```sql
select * from admin.kosten;
```

Zeigt je Qualitätsstufe die tatsächlichen OpenAI-Kosten. **Die wichtigste
Spalte ist `usd_je_credit`** — daran hängt, ob das Preismodell trägt.

Testläufe sind ausgeschlossen: Der Mock-Server liefert bewusst keine
Kostendaten, deshalb zählen nur echte Aufrufe.

> **Zur Einordnung:** Ein Credit darf grob unter 0,06 $ kosten, damit Basic
> (60 Credits für 9,99 € brutto ≈ 8,00 € netto nach Steuer und Stripe) und Pro
> (200 Credits für 19,99 € ≈ 16,25 € netto) tragen. Stand 30.07.2026 liegt der
> gemessene Wert bei **0,045 $** — aber nur für HD und aus vier Läufen. Für
> Standard fehlen noch echte Messungen.

### Wer verursacht welche Kosten?

```sql
select * from admin.nutzer order by kosten_usd desc;
```

Je Nutzer: Tarif, Abo-Status, Guthaben, Anzahl Generierungen, wie viele davon
fehlschlugen, und die verursachten Kosten. Nützlich, um Vielnutzer zu
erkennen, bevor sie zum Problem werden.

### Wie entwickelt sich die Nutzung?

```sql
select * from admin.tage limit 30;
```

Pro Tag: Generierungen, aktive Nutzer, Credits, Kosten — und die
**Fehlerquote**. Das ist die Zahl für den täglichen Blick: Steigt sie, stimmt
etwas mit der Bildgenerierung nicht, und zwar bevor sich jemand beschwert.

### Hängt gerade etwas fest?

```sql
select * from admin.haengende_jobs;
```

**Sollte im Normalfall leer sein.** Steht hier etwas älter als 10 Minuten,
läuft der Aufräum-Job nicht richtig.

Warum das eine eigene Abfrage verdient: Genau hier ist am 30.07. ein Fehler
unbemerkt geblieben. Der Aufräum-Job scheiterte still, Generierungen blieben
auf `processing` — und weil ein Nutzer nur eine gleichzeitig laufen lassen
darf, waren Betroffene **dauerhaft ausgesperrt**. Ohne diese Abfrage merkt man
das erst an verärgerten E-Mails.

Wenn dort etwas hängt, hilft sofort:

```sql
select public.fail_stale_generations();
```

Die Rückgabe ist die Anzahl der aufgeräumten Jobs. Credits werden dabei
zurückgebucht.

### Was kommt monatlich rein?

```sql
select * from admin.abos;
```

Aktive Abos je Tarif samt Bruttoumsatz — und wie viele zum Periodenende
gekündigt sind. Die zweite Zahl ist die interessantere, weil sie Abwanderung
zeigt, bevor sie im Umsatz auftaucht.

---

## Nützliche Einzelabfragen

**Marge eines Tarifs überschlagen** (Beispiel Pro bei Vollnutzung):

```sql
select round((200 * usd_je_credit)::numeric, 2) as kosten_usd_bei_vollnutzung
from admin.kosten where qualitaet = 'hd';
```

**Wofür Credits draufgehen** — Verbrauch gegen Rückbuchungen:

```sql
select reason, count(*), sum(delta) from public.credit_ledger group by reason order by 2 desc;
```

**Läuft der Aufräum-Job überhaupt?**

```sql
select jobname, schedule, active from cron.job;
```

---

## Wenn dir das später zu wenig ist

Dann **Metabase** (kostenlos, selbst gehostet) gegen einen **nur lesenden**
Postgres-Nutzer. Ausgereift, mit Diagrammen — und ein kompromittierter Zugang
könnte nichts verändern.

Eine selbstgebaute Admin-Seite wäre der schlechtere Weg: Sie bräuchte eine
eigene Zugriffskontrolle, hätte Zugriff auf alle Nutzerdaten, und wäre genau
die Art Absicherung, die man einmal falsch anfasst und die dann still
offensteht.

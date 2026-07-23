import type { Metadata } from "next";
import { LegalShell } from "@/components/site/legal-shell";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

/*
  ACHTUNG — Entwurf, kein Ersatz fuer Rechtsberatung.

  Dieser Text beschreibt die AKTUELLE Architektur:
    - Supabase (Irland, EU) fuer Konto, Datenbank und Dateispeicher
    - OpenAI (USA) als Auftragsverarbeiter fuer Bild- und Textgenerierung
    - Personenfoto wird direkt nach der Generierung geloescht
    - KEIN eigener OpenAI-Schluessel des Nutzers mehr (BYOK entfaellt)

  Vor dem Livegang zwingend zu erledigen:
    1. Platzhalter in eckigen Klammern ausfuellen
    2. AV-Vertrag mit OpenAI abschliessen, Zero-Data-Retention beantragen
    3. Hosting-Anbieter ergaenzen, sobald entschieden
    4. Anwaltlich pruefen lassen
*/

export default function DatenschutzPage() {
  return (
    <LegalShell title="Datenschutzerklärung" updated="Stand: Juli 2026">
      <h2>1. Verantwortlicher</h2>
      <p>
        [Vollständiger Name]
        <br />
        [Straße und Hausnummer]
        <br />
        [PLZ und Ort]
        <br />
        E-Mail: [E-Mail-Adresse]
      </p>

      <h2>2. Welche Daten wir verarbeiten</h2>
      <ul>
        <li>
          <strong>Kontodaten:</strong> E-Mail-Adresse und optionaler Anzeigename,
          Zeitpunkt der Registrierung.
        </li>
        <li>
          <strong>Hochgeladene Fotos:</strong> Dein Personenfoto und die Fotos der
          Kleidungsstücke — ausschließlich zur Erzeugung der Anprobebilder.
        </li>
        <li>
          <strong>Ergebnisse:</strong> Die generierten Anprobebilder und die dazu
          erzeugten Verkaufstexte.
        </li>
        <li>
          <strong>Angaben zum Kleidungsstück:</strong> Typ, Größe, optionale Farbe
          und freiwillige Hinweise.
        </li>
        <li>
          <strong>Nutzungsdaten:</strong> Guthabenbuchungen, Zeitpunkt und Umfang
          der Generierungen sowie technische Ereignisse zur Missbrauchserkennung.
          Deine IP-Adresse wird dabei nur in gekürzter bzw. gehashter Form
          verarbeitet.
        </li>
      </ul>

      <h2>3. Löschung des Personenfotos</h2>
      <p>
        Dein hochgeladenes Personenfoto wird <strong>unmittelbar nach der
        Generierung automatisch gelöscht</strong> und nicht dauerhaft gespeichert.
        Erhalten bleiben nur die erzeugten Ergebnisbilder, damit du sie später
        erneut herunterladen kannst.
      </p>

      <h2>4. Zwecke und Rechtsgrundlagen</h2>
      <ul>
        <li>
          <strong>Bereitstellung des Dienstes</strong> (Konto, Generierung,
          Ergebnisverwaltung): Art. 6 Abs. 1 lit. b DSGVO — Erfüllung des
          Nutzungsvertrags.
        </li>
        <li>
          <strong>Verarbeitung deiner Fotos:</strong> Art. 6 Abs. 1 lit. b DSGVO;
          soweit die Fotos besondere Kategorien personenbezogener Daten erkennen
          lassen, zusätzlich Art. 9 Abs. 2 lit. a DSGVO — deine ausdrückliche
          Einwilligung, die du mit dem Hochladen erteilst und jederzeit widerrufen
          kannst.
        </li>
        <li>
          <strong>Missbrauchs- und Kostenschutz:</strong> Art. 6 Abs. 1 lit. f
          DSGVO — berechtigtes Interesse am sicheren und wirtschaftlichen Betrieb.
        </li>
      </ul>

      <h2>5. Empfänger und Auftragsverarbeiter</h2>
      <p>
        <strong>Supabase</strong> — Konto-Verwaltung, Datenbank und Dateispeicher.
        Die Daten liegen in der Europäischen Union (Region Irland). Grundlage ist
        ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.
      </p>
      <p>
        <strong>OpenAI</strong> — Erzeugung der Anprobebilder und Verkaufstexte.
        Dafür werden dein Personenfoto und die Kleidungsfotos an OpenAI
        übermittelt. Die Verarbeitung erfolgt als Auftragsverarbeitung; API-Daten
        werden nach Angaben von OpenAI nicht zum Training der Modelle verwendet.
      </p>
      <p>
        <strong>Hosting</strong> — [Hosting-Anbieter und Serverstandort ergänzen,
        sobald festgelegt].
      </p>
      <p>Eine Weitergabe an weitere Dritte findet nicht statt.</p>

      <h2>6. Übermittlung in Drittländer</h2>
      <p>
        Die Übermittlung an OpenAI erfolgt in die USA. Grundlage sind die
        EU-Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO bzw. eine
        Zertifizierung nach dem EU-US Data Privacy Framework. Trotz dieser
        Garantien kann in Drittländern ein geringeres Datenschutzniveau bestehen,
        insbesondere hinsichtlich behördlicher Zugriffsmöglichkeiten.
      </p>

      <h2>7. Speicherdauer</h2>
      <ul>
        <li>Personenfoto: Löschung unmittelbar nach der Generierung.</li>
        <li>Kleidungsfotos: Löschung unmittelbar nach der Generierung.</li>
        <li>
          Ergebnisbilder, Verkaufstexte und Kontodaten: bis zur Löschung durch dich
          oder bis zur Löschung deines Kontos.
        </li>
        <li>
          Abrechnungsrelevante Daten: solange gesetzliche Aufbewahrungsfristen
          bestehen (regelmäßig bis zu zehn Jahre nach § 147 AO, § 257 HGB).
        </li>
      </ul>

      <h2>8. Cookies</h2>
      <p>
        Wir setzen keine Cookies zu Werbe- oder Analysezwecken. Für die Anmeldung
        ist ein technisch notwendiges Sitzungs-Cookie erforderlich; es dient
        ausschließlich dazu, dich angemeldet zu halten (§ 25 Abs. 2 Nr. 2 TDDDG).
      </p>

      <h2>9. Deine Rechte</h2>
      <p>Du hast jederzeit das Recht auf:</p>
      <ul>
        <li>Auskunft über deine gespeicherten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        <li>
          Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7
          Abs. 3 DSGVO)
        </li>
      </ul>
      <p>Wende dich dafür an die oben genannte E-Mail-Adresse.</p>

      <h2>10. Beschwerderecht</h2>
      <p>
        Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, wenn du
        der Ansicht bist, dass die Verarbeitung deiner Daten gegen die DSGVO
        verstößt. Zuständig ist in der Regel die Behörde deines Wohnsitzes.
      </p>

      <h2>11. Keine automatisierte Entscheidungsfindung</h2>
      <p>
        Es findet keine automatisierte Entscheidungsfindung mit rechtlicher Wirkung
        dir gegenüber statt. Die eingesetzte KI erzeugt ausschließlich Bilder und
        Textvorschläge.
      </p>
    </LegalShell>
  );
}

import type { Metadata } from "next";
import { LegalShell } from "@/components/site/legal-shell";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

/*
  ACHTUNG — Entwurf, kein Ersatz fuer Rechtsberatung.

  Dieser Text beschreibt den TATSAECHLICHEN Stand der Anwendung:
    - Supabase (Irland, EU) fuer Konto, Datenbank und Dateispeicher
    - OpenAI (USA) als Auftragsverarbeiter fuer Bild- und Textgenerierung
    - Stripe fuer Abo und Zahlungsabwicklung (Kartendaten sehen wir nie)
    - Personenfoto wird direkt nach der Generierung geloescht
    - KEIN eigener OpenAI-Schluessel des Nutzers (BYOK entfaellt)
    - Einwilligung wird bei Registrierung UND je Generierung eingeholt
    - Auskunft/Loeschung/Berichtigung laufen als Selbstbedienung im Konto
    - Ergebnisbilder tragen eine KI-Kennzeichnung (Art. 50 EU AI Act)

  Bewusst NICHT behauptet: eine IP-Verarbeitung. Die Anwendung wertet
  IP-Adressen an keiner Stelle aus (Missbrauchsschutz laeuft ueber Konto,
  Guthaben und Zaehlung der Generierungen, siehe lib/generation/rate-limit.ts).
  Eine Schutzmassnahme zu beschreiben, die es nicht gibt, waere eine falsche
  Angabe in einer Pflichtinformation -- deshalb steht hier, was wirklich
  passiert.

  Bei JEDER Aenderung an diesem Text pruefen, ob PRIVACY_VERSION in
  lib/legal/consent.ts hochgezaehlt werden muss (Nachweis nach Art. 7 DSGVO).

  Vor dem Livegang zwingend zu erledigen:
    1. Platzhalter in eckigen Klammern ausfuellen
    2. AV-Vertrag mit OpenAI abschliessen, Zero-Data-Retention beantragen
    3. Hosting-Anbieter ergaenzen, sobald entschieden
    4. Anwaltlich pruefen lassen
*/

export default function DatenschutzPage() {
  return (
    <LegalShell title="Datenschutzerklärung" updated="Stand: 13. August 2026">
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
          Zeitpunkt der Registrierung sowie Zeitpunkt und Fassung deiner
          Einwilligung in diese Datenschutzerklärung.
        </li>
        <li>
          <strong>Hochgeladene Fotos:</strong> Dein Personenfoto und die Fotos der
          Kleidungsstücke — ausschließlich zur Erzeugung der Anprobebilder.
        </li>
        <li>
          <strong>Ergebnisse:</strong> Die generierten Anprobebilder und die dazu
          erzeugten Verkaufstexte. Von jedem Anprobebild wird zusätzlich eine
          verkleinerte, unscharfe Vorschauversion gespeichert; sie wird im
          Free-Tarif anstelle des vollen Bildes angezeigt.
        </li>
        <li>
          <strong>Angaben zum Kleidungsstück:</strong> Typ, Größe, optionale Farbe
          und freiwillige Hinweise.
        </li>
        <li>
          <strong>Zahlungs- und Abodaten:</strong> Gewählter Tarif, Abo-Status und
          Datum der nächsten Abrechnung sowie die Kundennummer, unter der dich
          unser Zahlungsdienstleister führt. <strong>Deine Kartendaten sehen und
          speichern wir zu keinem Zeitpunkt</strong> — sie werden ausschließlich
          direkt bei Stripe eingegeben und dort verarbeitet.
        </li>
        <li>
          <strong>Nutzungsdaten:</strong> Guthabenbuchungen sowie Zeitpunkt und
          Umfang deiner Generierungen. Diese Angaben brauchen wir für die
          Abrechnung deines Guthabens und für die Begrenzung der Nutzung
          (Kostenschutz).
        </li>
        <li>
          <strong>Missbrauchsschutz:</strong> Von deiner E-Mail-Adresse wird eine
          vereinheitlichte Fassung gespeichert (ohne Zusätze wie „+kennwort“ und
          bei Gmail ohne Punkte). Damit stellen wir sicher, dass die einmaligen
          Gratis-Credits nicht durch mehrfache Registrierung mit Adressvarianten
          desselben Postfachs mehrfach in Anspruch genommen werden. Ein Konto
          anlegen kannst du trotzdem.
        </li>
      </ul>
      <p>
        <strong>Keine IP-Auswertung:</strong> Wir werten deine IP-Adresse nicht aus
        und speichern sie nicht in der Anwendung. Der Schutz vor Missbrauch läuft
        ausschließlich über dein Konto, dein Guthaben und die Zahl deiner
        Generierungen. Beim Betrieb der Server können IP-Adressen technisch
        bedingt kurzzeitig in Protokolldateien anfallen; darauf haben wir keinen
        gestaltenden Einfluss.
      </p>
      <p>
        Es findet <strong>keine Reichweitenmessung, kein Tracking und keine
        Profilbildung</strong> statt. Wir binden keine Analyse- oder
        Werbedienste ein.
      </p>

      <h2>3. Löschung der hochgeladenen Fotos</h2>
      <p>
        Dein hochgeladenes Personenfoto und die Kleidungsfotos werden{" "}
        <strong>unmittelbar nach der Generierung automatisch gelöscht</strong> und
        nicht dauerhaft gespeichert. Erhalten bleiben nur die erzeugten
        Ergebnisbilder, damit du sie später erneut herunterladen kannst.
      </p>
      <p>
        Bricht ein Vorgang technisch ab, bevor das Löschen ausgeführt werden
        konnte, entfernt ein automatischer Aufräumlauf die betroffenen Uploads
        spätestens innerhalb von 24 Stunden.
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
          Einwilligung. Diese holen wir an zwei Stellen ein: einmal bei der
          Registrierung (Bestätigung dieser Datenschutzerklärung) und zusätzlich
          vor <em>jeder einzelnen</em> Generierung. Eine einmal erteilte
          Zustimmung gilt also nie automatisch für spätere Uploads. Du kannst sie
          jederzeit mit Wirkung für die Zukunft widerrufen.
        </li>
        <li>
          <strong>Abo und Zahlungsabwicklung:</strong> Art. 6 Abs. 1 lit. b DSGVO
          — Erfüllung des Vertrags; hinsichtlich der Aufbewahrung von
          Rechnungsdaten zusätzlich Art. 6 Abs. 1 lit. c DSGVO (gesetzliche
          Pflicht).
        </li>
        <li>
          <strong>Missbrauchs- und Kostenschutz:</strong> Art. 6 Abs. 1 lit. f
          DSGVO — berechtigtes Interesse am sicheren und wirtschaftlichen Betrieb.
          Jede Bildgenerierung verursacht bei uns unmittelbar Kosten; ohne diese
          Begrenzungen wäre der Dienst nicht wirtschaftlich zu betreiben.
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
        Die Übermittlung erfolgt ausschließlich von unserem Server aus — dein
        Browser nimmt zu OpenAI zu keinem Zeitpunkt selbst Verbindung auf.
      </p>
      <p>
        <strong>Stripe</strong> — Abwicklung von Abo und Zahlung. Die Eingabe
        deiner Zahlungsdaten findet auf einer Seite von Stripe statt; wir
        erhalten von dort nur die Information, welcher Tarif für dich aktiv ist,
        bis wann er läuft und unter welcher Kundennummer du dort geführt wirst.
        Kartennummern oder Bankverbindungen erreichen unsere Systeme nicht.
      </p>
      <p>
        <strong>Hosting</strong> — [Hosting-Anbieter und Serverstandort ergänzen,
        sobald festgelegt].
      </p>
      <p>Eine Weitergabe an weitere Dritte findet nicht statt.</p>

      <h2>6. Übermittlung in Drittländer</h2>
      <p>
        Die Übermittlung an <strong>OpenAI</strong> erfolgt in die USA. Auch bei{" "}
        <strong>Stripe</strong> kann es zu einer Verarbeitung in den USA kommen,
        obwohl der Vertragspartner für Europa in Irland ansässig ist.
      </p>
      <p>
        Grundlage sind jeweils die EU-Standardvertragsklauseln nach Art. 46 Abs. 2
        lit. c DSGVO bzw. eine Zertifizierung nach dem EU-US Data Privacy
        Framework. Trotz dieser Garantien kann in Drittländern ein geringeres
        Datenschutzniveau bestehen, insbesondere hinsichtlich behördlicher
        Zugriffsmöglichkeiten.
      </p>
      <p>
        Die Daten deines Kontos, deine Ergebnisbilder und deine Verkaufstexte
        verlassen die Europäische Union nicht — sie liegen ausschließlich bei
        Supabase in Irland.
      </p>

      <h2>7. Speicherdauer</h2>
      <ul>
        <li>
          Personenfoto und Kleidungsfotos: Löschung unmittelbar nach der
          Generierung, im Fall eines technischen Abbruchs spätestens nach
          24 Stunden.
        </li>
        <li>
          Ergebnisbilder, Verkaufstexte und Kontodaten: bis zur Löschung durch dich
          oder bis zur Löschung deines Kontos.
        </li>
        <li>
          Abrechnungsrelevante Daten: solange gesetzliche Aufbewahrungsfristen
          bestehen (regelmäßig bis zu zehn Jahre nach § 147 AO, § 257 HGB). Diese
          Daten bleiben auch nach einer Kontolöschung bestehen, weil wir sie
          gesetzlich aufbewahren müssen.
        </li>
        <li>
          Technisches Protokoll der Zahlungsvorgänge (Kennung und Zeitpunkt der
          von Stripe gemeldeten Ereignisse, ohne Zahlungsdaten): dient dem
          Nachweis, dass dein Tarif korrekt gebucht wurde.
        </li>
      </ul>

      <h2>8. Cookies und lokale Speicherung</h2>
      <p>
        Wir setzen keine Cookies zu Werbe- oder Analysezwecken. Für die Anmeldung
        ist ein technisch notwendiges Sitzungs-Cookie erforderlich; es dient
        ausschließlich dazu, dich angemeldet zu halten (§ 25 Abs. 2 Nr. 2 TDDDG).
      </p>
      <p>
        Zusätzlich merkt sich dein Browser, ob du die helle oder dunkle
        Darstellung gewählt hast — aber <strong>erst, wenn du den Umschalter
        tatsächlich betätigst</strong>. Wer die Darstellung nie umstellt, bei
        dem wird dafür nichts gespeichert. Die Angabe verlässt dein Gerät
        nicht, wird von uns nicht ausgelesen und ist keinem Konto zugeordnet;
        sie dient allein der von dir angeforderten Einstellung
        (§ 25 Abs. 2 Nr. 2 TDDDG).
      </p>
      <p>
        Ein Zustimmungsbanner brauchen wir deshalb nicht: Wir speichern
        ausschließlich, was für den von dir angeforderten Dienst erforderlich
        ist. Es findet keinerlei Analyse, Reichweitenmessung oder Werbung
        statt.
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
      <p>
        Drei dieser Rechte kannst du direkt in der Anwendung ausüben, ohne uns
        anschreiben zu müssen — unter <strong>Mein Konto → Datenschutz</strong>:
      </p>
      <ul>
        <li>
          <strong>Auskunft und Datenübertragbarkeit (Art. 15, 20):</strong> Über
          „Exportieren“ erhältst du sofort ein ZIP-Archiv mit allen
          Anprobebildern, Verkaufstexten, Kontodaten, deinem Abo-Status und dem
          vollständigen Guthaben-Verlauf. Enthalten sind immer die vollständigen
          Ergebnisse — auch dann, wenn ein Bild in der App wegen deines Tarifs
          nur unscharf angezeigt wird.
        </li>
        <li>
          <strong>Berichtigung (Art. 16):</strong> Deinen Anzeigenamen kannst du
          dort jederzeit ändern.
        </li>
        <li>
          <strong>Löschung (Art. 17):</strong> Über „Konto endgültig löschen“
          werden dein Konto, alle Anprobebilder, Verkaufstexte und dein
          Guthaben-Verlauf sofort und unwiderruflich entfernt; ein laufendes Abo
          wird dabei automatisch gekündigt. Einzelne Anproben kannst du auch
          jederzeit im Verlauf löschen.
        </li>
      </ul>
      <p>
        Für alle übrigen Anliegen — insbesondere Einschränkung, Widerspruch und
        Widerruf deiner Einwilligung — wende dich an die oben genannte
        E-Mail-Adresse.
      </p>

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

      <h2>12. Kennzeichnung der KI-generierten Bilder</h2>
      <p>
        Jedes erzeugte Anprobebild zeigt eine Person, die es in dieser Form nie
        gegeben hat — die Kleidung wurde künstlich hinzugefügt. Solche Bilder
        müssen nach Art. 50 der EU-Verordnung über künstliche Intelligenz
        (AI Act) als KI-erzeugt erkennbar sein.
      </p>
      <p>Wir setzen das auf zwei Wegen um, für alle Tarife gleichermaßen:</p>
      <ul>
        <li>
          Ein sichtbarer Hinweis <em>„KI-generiert“</em> wird dauerhaft in das
          Bild eingefügt. Er bleibt erhalten, wohin auch immer du das Bild
          weitergibst.
        </li>
        <li>
          Zusätzlich wird ein maschinenlesbarer Vermerk in die Bilddatei
          geschrieben, den Plattformen und Programme auslesen können.
        </li>
      </ul>
      <p>
        Diese Kennzeichnung lässt sich nicht abschalten und ist an keinen Tarif
        gebunden. Bitte beachte: Wenn du die Bilder gewerblich veröffentlichst,
        trifft die Kennzeichnungspflicht auch dich selbst — unsere Kennzeichnung
        soll dir dabei helfen, sie zu erfüllen.
      </p>

      <h2>13. Weiterleitung zu Verkaufsplattformen</h2>
      <p>
        Im Ergebnisbereich kannst du dein Anprobebild und den Verkaufstext für
        Vinted, Kleinanzeigen oder eBay aufbereiten lassen. Der Knopf öffnet
        dabei lediglich die normale Inserats-Seite der jeweiligen Plattform in
        einem neuen Fenster; auf Mobilgeräten kann dein Betriebssystem
        stattdessen die installierte App öffnen.
      </p>
      <p>
        <strong>Dabei werden von uns keinerlei Daten an diese Anbieter
        übermittelt.</strong> Titel, Text und Bild landen nur in deiner
        Zwischenablage bzw. in deinem Download-Ordner — eingefügt und
        hochgeladen wird das Inserat ausschließlich von dir. Sobald du die
        Seite der Plattform erreichst, gilt dort deren eigene
        Datenschutzerklärung, auf die wir keinen Einfluss haben.
      </p>
      <p>
        Vinted, Kleinanzeigen und eBay sind Marken der jeweiligen Anbieter. Es
        besteht keine geschäftliche Verbindung oder Partnerschaft zwischen uns
        und diesen Unternehmen.
      </p>
    </LegalShell>
  );
}

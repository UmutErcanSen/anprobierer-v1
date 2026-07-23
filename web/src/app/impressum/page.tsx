import type { Metadata } from "next";
import { LegalShell } from "@/components/site/legal-shell";

export const metadata: Metadata = { title: "Impressum" };

/*
  ACHTUNG — vor dem Livegang auszufuellen:
  Die eckigen Klammern sind Platzhalter und MUESSEN durch die echten Angaben
  ersetzt werden. Ein unvollstaendiges Impressum ist in Deutschland
  abmahnfaehig (§ 5 DDG, frueher § 5 TMG).

  Dieser Text ist ein Entwurf nach bestem Wissen, aber keine Rechtsberatung.
  Vor dem Livegang anwaltlich pruefen lassen.
*/

export default function ImpressumPage() {
  return (
    <LegalShell title="Impressum" updated="Angaben gemäß § 5 DDG">
      <h2>Anbieter</h2>
      <p>
        [Vollständiger Name]
        <br />
        [Straße und Hausnummer]
        <br />
        [PLZ und Ort]
        <br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: [E-Mail-Adresse]
        <br />
        Telefon: [optional]
      </p>

      <h2>Umsatzsteuer</h2>
      <p>
        [Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG — oder, falls
        Kleinunternehmerregelung nach § 19 UStG: entsprechender Hinweis]
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>[Vollständiger Name], Anschrift wie oben</p>

      <h2>Streitschlichtung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
        vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den
        allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet,
        übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach
        Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte
        wir keinen Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets
        der jeweilige Anbieter verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch den Betreiber erstellten Inhalte und Werke auf diesen Seiten
        unterliegen dem deutschen Urheberrecht. Die mit dieser Anwendung erzeugten
        Bilder und Texte darfst du frei für deine eigenen Verkaufsanzeigen
        verwenden.
      </p>
    </LegalShell>
  );
}

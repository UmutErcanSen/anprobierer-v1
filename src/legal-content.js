export const PRIVACY = {
  title: 'Datenschutzerklärung',
  updated: 'Juli 2026',
  sections: [
    {
      heading: '1. Verantwortlicher',
      body: `<p>[Name des Betreibers]</p><p>[Straße Hausnr.]</p><p>[PLZ Ort]</p><p>E-Mail: [E-Mail-Adresse]</p>`,
    },
    {
      heading: '2. Kontakt Datenschutz',
      body: `<p>Bei Fragen zum Datenschutz erreichst du uns unter der oben genannten E-Mail-Adresse.</p>`,
    },
    {
      heading: '3. Erhobene Daten',
      body: `<p>Bei der Nutzung dieser Anwendung werden folgende Daten verarbeitet:</p>
        <ul>
          <li><strong>Bestandsdaten:</strong> E-Mail-Adresse (bei Registrierung über Firebase Authentication)</li>
          <li><strong>Nutzungsdaten:</strong> Hochgeladene Personen- und Kleidungsfotos, Generierungsparameter (Qualität, Modus, Größe), optionale Textnotizen</li>
          <li><strong>API-Key:</strong> Ein von dir eingegebener OpenAI API-Key wird ausschließlich lokal in deinem Browser gespeichert (localStorage) und nie an unseren Server übermittelt</li>
          <li><strong>Metadaten:</strong> Anzahl der Generierungen, Abo-Status, Zeitpunkt der Registrierung</li>
        </ul>`,
    },
    {
      heading: '4. Zweck der Verarbeitung',
      body: `<p>Die Datenverarbeitung erfolgt ausschließlich zur Bereitstellung der KI-gestützten Virtual-Try-On-Funktion (Erstellung von Anprobebildern für Vinted-Anzeigen).</p>`,
    },
    {
      heading: '5. Rechtsgrundlage',
      body: `<p>Rechtsgrundlage für die Verarbeitung ist:</p>
        <ul>
          <li>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) – für die Bereitstellung der App-Funktionen</li>
          <li>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) – für die Verarbeitung von Fotos</li>
          <li>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) – für Sicherheitszwecke</li>
        </ul>`,
    },
    {
      heading: '6. Speicherdauer',
      body: `<ul>
        <li><strong>Kontodaten (Firestore):</strong> Bis zur Löschung des Kontos durch den Nutzer</li>
        <li><strong>Lokale Daten (localStorage):</strong> API-Key, Fotos und Sessionsdaten verbleiben im Browser, bis sie vom Nutzer gelöscht werden</li>
        <li><strong>Firebase Authentication:</strong> Der Account bleibt bis zur manuellen Löschung bestehen</li>
      </ul>`,
    },
    {
      heading: '7. Weitergabe an Dritte',
      body: `<p><strong>OpenAI:</strong> Zur Generierung der Anprobebilder werden Personen- und Kleidungsfotos an die OpenAI API (USA) übermittelt. OpenAI verarbeitet Daten gemäß den <a href="https://openai.com/policies/api-data-usage-policies" target="_blank">API Data Usage Policies</a>. Daten werden nicht für das Training von Modellen verwendet.</p>
        <p><strong>Firebase (Google LLC, USA):</strong> Für Authentifizierung (Firebase Auth) und Datenspeicherung (Firestore) wird die Firebase-Plattform genutzt. Es gelten die <a href="https://firebase.google.com/support/privacy" target="_blank">Datenschutzbestimmungen von Google</a>.</p>
        <p>Eine Übermittlung deiner Daten an andere Dritte findet nicht statt.</p>`,
    },
    {
      heading: '8. Betroffenenrechte',
      body: `<p>Du hast jederzeit das Recht auf:</p>
        <ul>
          <li>Auskunft über gespeicherte Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung deiner Daten (Art. 17 DSGVO) – über die "Konto löschen"-Funktion in der App</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO) – über die "Daten exportieren"-Funktion</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        </ul>
        <p>Zur Ausübung deiner Rechte kontaktiere uns unter der im Impressum angegebenen E-Mail-Adresse.</p>`,
    },
    {
      heading: '9. Beschwerderecht',
      body: `<p>Du hast das Recht, dich bei einer Aufsichtsbehörde zu beschweren, wenn du der Ansicht bist, dass die Verarbeitung deiner Daten gegen die DSGVO verstößt.</p>`,
    },
    {
      heading: '10. Drittlandtransfers',
      body: `<p>Eine Übermittlung von Daten in Drittländer (USA) findet statt bei:</p>
        <ul>
          <li>OpenAI API – zur Bilderzeugung</li>
          <li>Firebase (Google) – für Authentifizierung und Speicherung</li>
        </ul>
        <p>Die Übermittlung erfolgt auf Grundlage der EU-Standardvertragsklauseln (SCC) bzw. des EU-US Data Privacy Frameworks.</p>`,
    },
    {
      heading: '11. LocalStorage & SessionStorage',
      body: `<p>Diese Anwendung verwendet keine Cookies. Jedoch werden folgende Daten im localStorage deines Browsers gespeichert:</p>
        <ul>
          <li>OpenAI API-Key (nur mit deiner Eingabe)</li>
          <li>Hochgeladene Fotos (für die Dauer der Session)</li>
          <li>Generierte Bilder (für die Dauer der Session)</li>
        </ul>
        <p>Diese Daten verlassen deinen Browser nur, wenn du eine Generierung auslöst (Übermittlung an OpenAI). Du kannst localStorage jederzeit über die Entwicklertools deines Browsers löschen.</p>`,
    },
  ],
};

export const IMPRINT = {
  title: 'Impressum',
  updated: 'Angaben gemäß § 5 TMG',
  sections: [
    {
      heading: 'Betreiber',
      body: `<p>[Dein vollständiger Name]</p><p>[Straße Hausnr.]</p><p>[PLZ Ort]</p>`,
    },
    {
      heading: 'Kontakt',
      body: `<p>E-Mail: [E-Mail-Adresse]</p><p>Telefon: [optional]</p>`,
    },
    {
      heading: 'Verantwortlich für den Inhalt',
      body: `<p>[Name], [Adresse]</p>`,
    },
    {
      heading: 'Haftungshinweis',
      body: `<p>Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.</p>`,
    },
  ],
};

import { icon } from './icons.js';

export function renderLegalContent(container, data) {
  container.innerHTML = `
    <a href="/" onclick="event.preventDefault();navigateTo('/')" class="legal-back">${icon('arrow-left', 14)} Zurück zur Startseite</a>
    <h1>${data.title}</h1>
    <p class="legal-updated">${data.updated}</p>
    ${data.sections.map(s => `
      <h2>${s.heading}</h2>
      ${s.body}
    `).join('')}
  `;
}

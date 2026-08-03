import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Sans fuer UI und Fliesstext.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Serifen-Kursive nur als Display-Akzent in grossen Ueberschriften.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Anprobierer — KI-Anprobebilder für Vinted und Kleinanzeigen",
    template: "%s · Anprobierer",
  },
  description:
    "Lade ein Foto von dir und ein Kleidungsstück hoch und erhalte realistische Anprobebilder samt fertigem Verkaufstext — in unter einer Minute.",
};

/*
  Setzt data-theme VOR dem ersten Paint, damit Dunkelmodus nicht kurz als Hell
  aufblitzt. Laeuft synchron im <head>, bevor der Body rendert.

  Uebernimmt jetzt JEDEN gespeicherten Wert, nicht nur 'dark'. Vorher setzte
  das Skript das Attribut ausschliesslich bei 'dark' -- der Umschalter
  schreibt aber auch 'light' (siehe theme-toggle.tsx). Bei bewusst gewaehltem
  Hell entstand so ein Zustand, den der Server nicht kennt: Attribut vom
  Umschalter gesetzt, beim naechsten Laden aber nicht wiederhergestellt.
  Optisch identisch (ohne Attribut greift :root = hell), aber unnoetig
  asymmetrisch.
*/
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
      suppressHydrationWarning ist hier zwingend und kein Zudecken eines
      Fehlers: Das Skript oben aendert data-theme, BEVOR React hydratisiert.
      React vergleicht dann den DOM mit dem servergerenderten Markup, findet
      das zusaetzliche Attribut und meldet einen Hydration-Mismatch.

      Ohne das Flag bleibt es nicht bei der Warnung -- React verwirft den
      Baum und rendert ab der naechsten Fehlergrenze neu. Genau das erzeugt
      das Aufblitzen, das das Skript verhindern soll. Mit dem Flag behaelt
      React den DOM-Stand.

      Das Flag wirkt nur eine Ebene tief, also ausschliesslich fuer die
      Attribute des <html>-Elements selbst -- Hydration-Fehler in
      Unterkomponenten werden weiterhin gemeldet.

      data-theme="light" wird bewusst schon serverseitig gesetzt, damit
      Server-Markup und Umschalter denselben Zustand ausdruecken.
    */
    <html
      lang="de"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {/*
          Toasts fuer kurze Erfolgsmeldungen (z.B. nach Mehrfach-Loeschen im
          Verlauf) -- sonner steuert Farben ausschliesslich ueber diese CSS-
          Variablen, keine eigene Theme-Erkennung noetig: dieselben Tokens,
          die schon der Rest der Seite pro data-theme setzt (globals.css),
          gelten hier automatisch mit. Ohne das wuerde sonner sein eigenes,
          von unserem Editorial-Look losgeloestes Standarddesign zeigen.
        */}
        <Toaster
          position="bottom-center"
          style={
            {
              '--normal-bg': 'var(--paper)',
              '--normal-text': 'var(--ink)',
              '--normal-border': 'var(--line-strong)',
              '--success-bg': 'var(--paper)',
              '--success-text': 'var(--success)',
              '--success-border': 'var(--line-strong)',
              '--border-radius': '0.75rem',
            } as React.CSSProperties
          }
        />
      </body>
    </html>
  );
}

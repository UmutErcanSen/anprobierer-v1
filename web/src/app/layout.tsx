import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
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

// Setzt data-theme VOR dem ersten Paint, damit Dunkelmodus nicht kurz als
// Hell aufblitzt. Laeuft synchron im <head>, bevor der Body rendert.
const themeScript = `try{if(localStorage.getItem('theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

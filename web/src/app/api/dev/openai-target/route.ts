import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { OPENAI_BASE_URL } from '@/lib/openai/base-url';

/*
  Diagnose-Endpunkt: Läuft dieser Server gegen den Mock oder gegen die echte,
  kostenpflichtige OpenAI-API?

  Entstanden aus einem konkreten Vorfall: Ein von Hand gestarteter Dev-Server
  kennt OPENAI_BASE_URL nicht. Playwrights `reuseExistingServer` greift genau
  diesen Server ab, die Generierungstests liefen daraufhin gegen die echte API
  und haben 0,50 USD gekostet. Der Zähler des Mock-Servers hat das zwar
  gemeldet — aber erst NACH dem Aufruf, also nachdem das Geld weg war.

  Dieser Endpunkt erlaubt den Tests eine Prüfung VOR dem ersten Upload.

  Antwortet in Produktion mit 404: Die Umgebungsdiagnose geht dort niemanden
  etwas an, und die Umleitung ist dort ohnehin gesperrt (siehe base-url.ts).
*/

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.NODE_ENV === 'production') notFound();

  const umgeleitet = !OPENAI_BASE_URL.includes('api.openai.com');

  return NextResponse.json({
    umgeleitet,
    // Nur Host und Port, niemals ein vollständiger Schlüssel oder Pfad.
    ziel: (() => {
      try {
        return new URL(OPENAI_BASE_URL).host;
      } catch {
        return 'unbekannt';
      }
    })(),
  });
}

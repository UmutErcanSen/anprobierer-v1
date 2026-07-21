import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Ziel des Bestätigungslinks aus der Registrierungs-E-Mail.
 *
 * Supabase hängt einen einmalig gültigen `code` an, der hier gegen eine echte
 * Session getauscht wird. Erst danach ist der Nutzer angemeldet.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/konto';

  /*
   * Schutz vor Open Redirect: `next` kommt aus der URL und ist damit von
   * aussen bestimmbar. Ohne diese Prüfung liesse sich ein Bestätigungslink
   * bauen, der nach dem Login auf eine fremde Seite weiterleitet — die
   * klassische Vorlage für Phishing.
   */
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/konto';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/anmelden?fehler=bestaetigung`);
}

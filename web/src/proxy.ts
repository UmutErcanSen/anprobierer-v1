import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Frischt bei jedem Request die Supabase-Session auf.
 *
 * Ohne das laufen Zugriffstoken nach etwa einer Stunde ab und der Nutzer
 * fliegt mitten in der Arbeit raus — besonders ärgerlich, wenn gerade eine
 * bezahlte Bildgenerierung läuft.
 *
 * Hiess in Next.js 15 noch `middleware.ts` mit exportierter `middleware`-
 * Funktion. Seit Version 16 ist der Name `proxy`, und die Datei läuft auf der
 * Node-Runtime statt auf Edge — für Supabase sogar günstiger.
 */
export async function proxy(request: NextRequest) {
  // Diese Antwort wird durchgereicht und um die aufgefrischten Cookies
  // ergänzt. Sie darf NICHT durch eine neue ersetzt werden, sonst geht die
  // erneuerte Session verloren.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Bewusst getUser() und nicht getSession(): getUser() prüft das Token beim
  // Auth-Server nach. getSession() liest es nur aus dem Cookie und ist damit
  // fälschbar — als Grundlage für Zugriffsentscheidungen ungeeignet.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Alles ausser statischen Dateien. Ohne diese Ausnahmen liefe die
     * Session-Auffrischung auch für jedes Bild und jede CSS-Datei — unnötige
     * Last, und laut Next.js-Doku eine häufige Ursache dafür, dass Assets
     * blockiert werden.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
};

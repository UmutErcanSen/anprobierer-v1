import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';

/**
 * Supabase-Client für Server Components, Server Actions und Route Handler.
 *
 * Nutzt ebenfalls den anon-Key und arbeitet damit im Namen des angemeldeten
 * Nutzers — RLS greift also weiterhin. Für privilegierte Schreibvorgänge gibt
 * es bewusst einen getrennten Client in `admin.ts`.
 *
 * Hinweis zu Next.js 16: `cookies()` ist asynchron, der synchrone Zugriff aus
 * Version 15 wurde entfernt. Deshalb ist diese Funktion `async`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components dürfen keine Cookies schreiben. Das ist kein
            // Fehler: proxy.ts frischt die Session bei jedem Request auf und
            // setzt die Cookies dort. Hier still zu scheitern ist gewollt.
          }
        },
      },
    },
  );
}

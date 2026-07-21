import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/**
 * Supabase-Client für Client-Komponenten.
 *
 * Nutzt den anon-Key und unterliegt damit vollständig Row Level Security —
 * dieser Client kann grundsätzlich nur das, was der angemeldete Nutzer auch
 * darf. Für alles, was Geld kostet oder Geld bedeutet, ist er absichtlich
 * machtlos: Credits buchen, Pläne setzen und Jobs anlegen geht ausschliesslich
 * serverseitig.
 */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

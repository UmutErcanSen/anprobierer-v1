import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { publicEnv } from '@/lib/env';

/**
 * Privilegierter Supabase-Client. **Umgeht Row Level Security vollständig.**
 *
 * Nur für Vorgänge, die der Nutzer nachweislich nicht selbst dürfen darf:
 * Credits buchen, Abo-Status aus dem Stripe-Webhook schreiben, Generierungs-
 * Jobs anlegen und abschliessen.
 *
 * Der Import von 'server-only' ganz oben ist die eigentliche Schutzmassnahme:
 * Landet diese Datei je — auch versehentlich über eine Importkette — in einer
 * Client-Komponente, bricht der Build ab, statt den Schlüssel ins Browser-
 * Bundle zu schreiben. Ein durchgereichter service_role-Key wäre der
 * Totalverlust: damit kann jeder alle Daten aller Nutzer lesen und ändern.
 */

const serviceRoleKey = z
  .string()
  .min(1, 'SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local')
  .parse(process.env.SUPABASE_SERVICE_ROLE_KEY);

export function createAdminClient() {
  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      // Der Admin-Client gehört zu keiner Person. Ohne diese Optionen würde
      // er versuchen, eine Session zu speichern und zu erneuern.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

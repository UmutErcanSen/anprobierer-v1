import { z } from 'zod';

/**
 * Umgebungsvariablen werden beim Start geprüft, nicht beim ersten Zugriff.
 * Ein fehlender Schlüssel soll den Build oder Serverstart sofort abbrechen —
 * nicht irgendwann mitten in einer Nutzeraktion einen kryptischen Fehler
 * auslösen.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Öffentliche Variablen. Next.js ersetzt `process.env.NEXT_PUBLIC_*` zur
 * Bauzeit textuell, deshalb müssen sie ausgeschrieben stehen — eine
 * dynamische Schleife über die Namen würde nicht ersetzt werden.
 */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Berichtigungsrecht nach DSGVO Art. 16: Nutzer muessen unrichtige
 * personenbezogene Daten korrigieren koennen. Der Anzeigename war bisher nur
 * bei der Registrierung setzbar und danach dauerhaft festgeschrieben -- ein
 * Tippfehler oder eine Namensaenderung liess sich nur durch Loeschen und
 * Neuanlegen des ganzen Kontos beheben.
 *
 * Laeuft ueber den normalen (RLS-gebundenen) Client, NICHT ueber den
 * Admin-Client: Die Datenbank erlaubt Nutzern ohnehin nur das Aendern der
 * Spalte display_name der EIGENEN Zeile (Spaltenrechte in
 * 20260721160000_initial_schema.sql). Damit liegt die Absicherung dort, wo
 * sie hingehoert, und nicht allein in dieser Funktion.
 */

export type NameState = { error?: string; notice?: string };

const nameSchema = z
  .string()
  .trim()
  .max(100, 'Der Name darf höchstens 100 Zeichen haben.');

export async function updateDisplayNameAction(_prev: NameState, formData: FormData): Promise<NameState> {
  const parsed = nameSchema.safeParse(formData.get('displayName') ?? '');
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Der Name ist ungültig.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Nicht angemeldet.' };

  const { error } = await supabase.from('profiles').update({ display_name: parsed.data }).eq('id', user.id);

  if (error) {
    console.error('[konto] Anzeigename konnte nicht geaendert werden', user.id, error);
    return { error: 'Der Name konnte nicht gespeichert werden. Bitte versuch es erneut.' };
  }

  // Die Begruessung ("Hallo, …") steht auf derselben Seite und kaeme sonst
  // bis zum naechsten harten Neuladen weiter mit dem alten Namen.
  revalidatePath('/konto');
  return { notice: 'Gespeichert.' };
}

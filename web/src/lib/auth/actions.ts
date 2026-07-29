'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from '@/lib/validation/auth';

export type AuthState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
};

/** Wandelt Zod-Fehler in eine Zuordnung Feldname -> erste Meldung. */
function toFieldErrors(error: import('zod').ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    result[key] ??= issue.message;
  }
  return result;
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName'),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const origin = (await headers()).get('origin') ?? '';

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/konto`,
      // Wird vom Datenbank-Trigger handle_new_user() in das Profil übernommen.
      data: { display_name: parsed.data.displayName || '' },
    },
  });

  if (error) {
    return { error: 'Die Registrierung hat nicht geklappt. Bitte versuch es später erneut.' };
  }

  /*
   * Bewusst immer dieselbe Meldung — auch wenn die Adresse bereits registriert
   * ist. Andernfalls liesse sich über das Formular herausfinden, wer hier ein
   * Konto hat (Account-Enumeration).
   */
  return {
    notice:
      'Fast geschafft. Wir haben dir eine E-Mail geschickt — bestätige darin deine Adresse, dann kann es losgehen.',
  };
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Ebenfalls bewusst unspezifisch: kein Hinweis darauf, ob die Adresse
    // existiert oder nur das Passwort falsch war.
    return { error: 'E-Mail-Adresse oder Passwort stimmt nicht.' };
  }

  redirect('/konto');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/anmelden');
}

/**
 * Passwort vergessen, Schritt 1: Link anfordern.
 *
 * Ohne diesen Weg kam niemand, der sein Passwort vergessen hat, je wieder an
 * sein (womoeglich bezahltes) Konto -- es gab schlicht keine Wiederherstellung.
 *
 * Der Link fuehrt ueber /auth/callback (dort wird der Code gegen eine Session
 * getauscht) und landet dann auf /passwort-neu.
 */
export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const origin = (await headers()).get('origin') ?? '';

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/passwort-neu`,
  });

  /*
   * Immer dieselbe Bestaetigung, unabhaengig davon, ob es die Adresse
   * ueberhaupt gibt -- sonst liesse sich hier durchprobieren, wer ein Konto
   * hat (Account-Enumeration), genau wie bei signUpAction/signInAction.
   * Deshalb wird auch ein etwaiger Fehler bewusst nicht nach aussen gereicht.
   */
  return {
    notice:
      'Wenn ein Konto zu dieser Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Schau auch im Spam-Ordner nach.',
  };
}

/**
 * Passwort vergessen, Schritt 2: neues Passwort setzen.
 *
 * Setzt eine gueltige Sitzung voraus — die entsteht durch den Klick auf den
 * Link aus Schritt 1 (Code-Austausch in /auth/callback). Ohne Sitzung bricht
 * die Aktion ab, statt stillschweigend nichts zu tun.
 */
export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get('password') });

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();

  // getUser() prueft serverseitig nach — im Gegensatz zu getSession(), das
  // nur das Cookie liest und faelschbar waere.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        'Der Link ist abgelaufen oder wurde bereits verwendet. Fordere bitte einen neuen an.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: 'Das Passwort konnte nicht geändert werden. Bitte versuch es erneut.' };
  }

  redirect('/konto');
}

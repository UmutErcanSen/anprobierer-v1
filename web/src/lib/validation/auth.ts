import { z } from 'zod';

/**
 * Dieselben Regeln gelten im Formular und in der Server Action. Die Prüfung im
 * Browser ist reine Bequemlichkeit — verlassen wird sich ausschliesslich auf
 * die serverseitige, weil alles aus dem Browser manipulierbar ist.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Bitte gib deine E-Mail-Adresse ein.')
  .email('Das sieht nicht nach einer gültigen E-Mail-Adresse aus.')
  .max(320, 'Diese E-Mail-Adresse ist zu lang.');

export const passwordSchema = z
  .string()
  .min(8, 'Das Passwort braucht mindestens 8 Zeichen.')
  .max(72, 'Das Passwort darf höchstens 72 Zeichen haben.')
  .regex(/[a-zA-Z]/, 'Das Passwort braucht mindestens einen Buchstaben.')
  .regex(/[0-9]/, 'Das Passwort braucht mindestens eine Zahl.');

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .trim()
    .max(100, 'Der Name darf höchstens 100 Zeichen haben.')
    .optional()
    .or(z.literal('')),
});

export const signInSchema = z.object({
  email: emailSchema,
  // Beim Anmelden bewusst keine Formatprüfung: Wer ein altes Passwort hat,
  // das die heutigen Regeln nicht erfüllt, soll sich trotzdem anmelden können.
  password: z.string().min(1, 'Bitte gib dein Passwort ein.'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

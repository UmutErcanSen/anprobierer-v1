import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { signUpAction } from '@/lib/auth/actions';

export const metadata: Metadata = {
  title: 'Konto erstellen',
};

export default function RegistrierenPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Konto erstellen</h1>
        <p className="text-sm opacity-70">
          Du bekommst 5 Gratis-Credits zum Ausprobieren — ohne Zahlungsdaten.
        </p>
      </div>

      <AuthForm
        action={signUpAction}
        submitLabel="Konto erstellen"
        pendingLabel="Wird erstellt …"
        fields={[
          {
            name: 'displayName',
            label: 'Name (optional)',
            type: 'text',
            autoComplete: 'name',
          },
          {
            name: 'email',
            label: 'E-Mail-Adresse',
            type: 'email',
            autoComplete: 'email',
            required: true,
          },
          {
            name: 'password',
            label: 'Passwort',
            type: 'password',
            autoComplete: 'new-password',
            required: true,
            hint: 'Mindestens 8 Zeichen, davon ein Buchstabe und eine Zahl.',
          },
        ]}
      />

      <p className="text-sm opacity-70">
        Schon ein Konto?{' '}
        <Link href="/anmelden" className="underline underline-offset-4">
          Anmelden
        </Link>
      </p>
    </main>
  );
}

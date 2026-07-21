import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { signInAction } from '@/lib/auth/actions';

export const metadata: Metadata = {
  title: 'Anmelden',
};

// searchParams ist seit Next.js 16 ein Promise und muss awaited werden.
export default async function AnmeldenPage(props: PageProps<'/anmelden'>) {
  const params = await props.searchParams;
  const hatBestaetigungsfehler = params.fehler === 'bestaetigung';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Willkommen zurück</h1>
        <p className="text-sm opacity-70">Melde dich an, um weiterzumachen.</p>
      </div>

      {hatBestaetigungsfehler && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Der Bestätigungslink ist abgelaufen oder wurde bereits verwendet.
          Melde dich an oder fordere einen neuen an.
        </p>
      )}

      <AuthForm
        action={signInAction}
        submitLabel="Anmelden"
        pendingLabel="Wird geprüft …"
        fields={[
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
            autoComplete: 'current-password',
            required: true,
          },
        ]}
      />

      <p className="text-sm opacity-70">
        Noch kein Konto?{' '}
        <Link href="/registrieren" className="underline underline-offset-4">
          Konto erstellen
        </Link>
      </p>
    </main>
  );
}

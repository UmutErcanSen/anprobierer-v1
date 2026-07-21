import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { signOutAction } from '@/lib/auth/actions';

export const metadata: Metadata = {
  title: 'Mein Konto',
};

export default async function KontoPage() {
  const supabase = await createClient();

  /*
   * getUser() statt getSession(): getSession() liest das Token nur aus dem
   * Cookie und ist damit fälschbar. getUser() lässt es beim Auth-Server
   * gegenprüfen — nur das taugt als Grundlage für eine Zugriffsentscheidung.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/anmelden');

  /*
   * Beide Abfragen laufen unter Row Level Security. Es braucht hier bewusst
   * kein "where user_id = ..." — die Policy in der Datenbank sorgt dafür,
   * dass ohnehin nur die eigenen Zeilen zurückkommen. Ein vergessener Filter
   * kann also keine fremden Daten preisgeben.
   */
  const [{ data: profile }, { data: balance }] = await Promise.all([
    supabase.from('profiles').select('display_name, plan').single(),
    supabase.from('credit_balances').select('balance').maybeSingle(),
  ]);

  const credits = balance?.balance ?? 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hallo{profile?.display_name ? `, ${profile.display_name}` : ''}
        </h1>
        <p className="text-sm opacity-70">{user.email}</p>
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <dt className="text-xs uppercase tracking-wide opacity-60">Guthaben</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {credits}
            <span className="ml-1 text-sm font-normal opacity-60">
              {credits === 1 ? 'Credit' : 'Credits'}
            </span>
          </dd>
        </div>

        <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <dt className="text-xs uppercase tracking-wide opacity-60">Tarif</dt>
          <dd className="mt-1 text-2xl font-semibold capitalize">{profile?.plan ?? 'free'}</dd>
        </div>
      </dl>

      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-lg border border-black/15 px-4 py-2 text-sm transition-opacity hover:opacity-70 dark:border-white/20"
        >
          Abmelden
        </button>
      </form>
    </main>
  );
}

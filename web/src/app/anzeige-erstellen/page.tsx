import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { GenerateForm } from '@/components/generation/generate-form';

export const metadata: Metadata = {
  title: 'Anzeige erstellen',
};

export default async function AnzeigeErstellenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/anmelden');

  const { data: balance } = await supabase
    .from('credit_balances')
    .select('balance')
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Anzeige erstellen</h1>
        <p className="text-sm opacity-70">
          Guthaben: {balance?.balance ?? 0} Credits
        </p>
      </div>

      <GenerateForm />
    </main>
  );
}

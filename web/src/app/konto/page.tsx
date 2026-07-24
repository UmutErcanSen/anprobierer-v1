import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/site/app-header";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Mein Konto" };

export default async function KontoPage() {
  const supabase = await createClient();

  // getUser() prueft das Token serverseitig — im Gegensatz zu getSession(),
  // das nur das Cookie liest und faelschbar ist.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  // Beide Abfragen laufen unter Row Level Security — kein user_id-Filter
  // noetig, es kommen ohnehin nur die eigenen Zeilen zurueck.
  const [{ data: profile }, { data: balance }] = await Promise.all([
    supabase.from("profiles").select("display_name, plan").single(),
    supabase.from("credit_balances").select("balance").maybeSingle(),
  ]);

  const credits = balance?.balance ?? 0;
  const plan = profile?.plan ?? "free";

  return (
    <>
      <AppHeader credits={credits} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <p className="kicker">Mein Konto</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
          Hallo{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          <div className="bg-paper p-6">
            <dt className="text-xs uppercase tracking-[0.14em] text-muted">Guthaben</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums text-ink">
              {credits}
              <span className="ml-1.5 text-sm font-normal text-muted">
                {credits === 1 ? "Credit" : "Credits"}
              </span>
            </dd>
          </div>
          <div className="bg-paper p-6">
            <dt className="text-xs uppercase tracking-[0.14em] text-muted">Tarif</dt>
            <dd className="mt-2 text-3xl font-semibold capitalize text-ink">{plan}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <LinkButton href="/anzeige-erstellen" size="lg">
            Neue Anprobe erstellen
          </LinkButton>
          <Link
            href="/konto/verlauf"
            className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            Verlauf ansehen
          </Link>
          <Link
            href="/preise"
            className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            Guthaben aufladen
          </Link>
        </div>
      </main>
    </>
  );
}

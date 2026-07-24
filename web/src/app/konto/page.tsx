import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/site/app-header";
import { LinkButton } from "@/components/ui/button";
import { HistoryCard, type HistoryGeneration } from "@/components/history/history-card";
import { resolveCardRows } from "@/lib/generation/cards";

export const metadata: Metadata = { title: "Mein Konto" };

const RECENT_COUNT = 4;

export default async function KontoPage() {
  const supabase = await createClient();

  // getUser() prueft das Token serverseitig — im Gegensatz zu getSession(),
  // das nur das Cookie liest und faelschbar ist.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  // Laeuft alles unter Row Level Security — kein user_id-Filter noetig, es
  // kommen ohnehin nur die eigenen Zeilen zurueck.
  const [{ data: profile }, { data: balance }, { count: totalGenerations }, { data: recentRows }] = await Promise.all([
    supabase.from("profiles").select("display_name, plan").single(),
    supabase.from("credit_balances").select("balance").maybeSingle(),
    supabase.from("generations").select("id", { count: "exact", head: true }),
    supabase
      .from("generations")
      .select(
        "id, status, mode, quality, credits_charged, created_at, cards, result_paths, sale_text, is_favorite, clothing_types, sizes, colors",
      )
      .order("created_at", { ascending: false })
      .limit(RECENT_COUNT),
  ]);

  const credits = balance?.balance ?? 0;
  const plan = profile?.plan ?? "free";

  const recentCardRows = (recentRows ?? []).map((g) => resolveCardRows(g));
  const recent: HistoryGeneration[] = (recentRows ?? []).map((g, i) => ({
    id: g.id,
    status: g.status,
    mode: g.mode,
    quality: g.quality,
    credits_charged: g.credits_charged,
    created_at: g.created_at,
    imageCount: recentCardRows[i].filter((c) => c.imagePath).length,
    isFavorite: g.is_favorite,
    categories: g.clothing_types ?? [],
    sizes: g.sizes ?? [],
    colors: g.colors ?? [],
  }));
  const recentThumbnails = await Promise.all(
    recentCardRows.map(async (cards) => {
      const firstImage = cards.find((c) => c.imagePath)?.imagePath;
      if (!firstImage) return null;
      const { data } = await supabase.storage.from("results").createSignedUrl(firstImage, 60 * 5);
      return data?.signedUrl ?? null;
    }),
  );

  return (
    <>
      <AppHeader credits={credits} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <p className="kicker">Mein Konto</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
          Hallo{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
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
          <div className="bg-paper p-6">
            <dt className="text-xs uppercase tracking-[0.14em] text-muted">Erstellt</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums text-ink">{totalGenerations ?? 0}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-5">
          <LinkButton href="/anzeige-erstellen" size="lg">
            Neue Anprobe erstellen
          </LinkButton>
          <Link
            href="/preise"
            className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            Guthaben aufladen
          </Link>
        </div>

        {recent.length > 0 && (
          <section className="mt-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-lg font-medium text-ink">Zuletzt erstellt</h2>
              <Link
                href="/konto/verlauf"
                className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
              >
                Alle ansehen
              </Link>
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {recent.map((g, i) => (
                <HistoryCard key={g.id} generation={g} thumbnail={recentThumbnails[i] ?? null} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

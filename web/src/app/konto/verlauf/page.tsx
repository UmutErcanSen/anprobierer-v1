import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/site/app-header";
import { LinkButton } from "@/components/ui/button";
import { HistoryFilters } from "@/components/history/history-filters";
import { HistoryCard, type HistoryGeneration } from "@/components/history/history-card";

export const metadata: Metadata = { title: "Verlauf" };

const PAGE_SIZE = 12;

type StatusFilter = "all" | "succeeded" | "failed" | "in_progress";
type ModeFilter = "all" | "single" | "combined";

function parseStatus(value: string | undefined): StatusFilter {
  return value === "succeeded" || value === "failed" || value === "in_progress" ? value : "all";
}
function parseMode(value: string | undefined): ModeFilter {
  return value === "single" || value === "combined" ? value : "all";
}
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// searchParams ist seit Next.js 16 ein Promise und muss awaited werden.
export default async function VerlaufPage(props: PageProps<"/konto/verlauf">) {
  const params = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const status = parseStatus(first(params.status));
  const mode = parseMode(first(params.mode));
  const page = Math.max(1, Number(first(params.page)) || 1);

  const { data: balance } = await supabase.from("credit_balances").select("balance").maybeSingle();
  const credits = balance?.balance ?? 0;

  let query = supabase
    .from("generations")
    .select("id, status, mode, quality, credits_charged, created_at, cards", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status === "in_progress") query = query.in("status", ["queued", "processing"]);
  else if (status !== "all") query = query.eq("status", status);
  if (mode !== "all") query = query.eq("mode", mode);

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count } = await query.range(from, from + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  type CardRow = { imagePath: string | null };
  const generations: HistoryGeneration[] = (rows ?? []).map((g) => ({
    id: g.id,
    status: g.status,
    mode: g.mode,
    quality: g.quality,
    credits_charged: g.credits_charged,
    created_at: g.created_at,
    imageCount: ((g.cards ?? []) as CardRow[]).filter((c) => c.imagePath).length,
  }));

  // Thumbnails frisch signieren -- die Pfade in der DB sind dauerhaft, die
  // signierten URLs laufen ab und duerfen deshalb nicht mitgespeichert werden.
  const thumbnails = await Promise.all(
    (rows ?? []).map(async (g) => {
      const firstImage = ((g.cards ?? []) as CardRow[]).find((c) => c.imagePath)?.imagePath;
      if (!firstImage) return null;
      const { data } = await supabase.storage.from("results").createSignedUrl(firstImage, 60 * 5);
      return data?.signedUrl ?? null;
    }),
  );

  function pageHref(target: number) {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (mode !== "all") sp.set("mode", mode);
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `/konto/verlauf?${qs}` : "/konto/verlauf";
  }

  const isFiltered = status !== "all" || mode !== "all";

  return (
    <>
      <AppHeader credits={credits} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
        <p className="kicker">Verlauf</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Deine Anproben</h1>
          <LinkButton href="/anzeige-erstellen" size="md">
            Neue Anprobe erstellen
          </LinkButton>
        </div>

        <HistoryFilters status={status} mode={mode} />

        {generations.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-sm text-muted">
            {isFiltered ? "Keine Anproben für diese Filter gefunden." : "Du hast noch keine Anprobe erstellt."}
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {generations.map((g, i) => (
              <HistoryCard key={g.id} generation={g} thumbnail={thumbnails[i] ?? null} />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2 text-sm" aria-label="Seitennavigation">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="rounded-full border border-line-strong px-4 py-2 text-ink transition-colors hover:bg-surface">
                Zurück
              </Link>
            ) : (
              <span className="rounded-full border border-line px-4 py-2 text-muted opacity-50">Zurück</span>
            )}
            <span className="px-2 text-muted">
              Seite {page} von {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="rounded-full border border-line-strong px-4 py-2 text-ink transition-colors hover:bg-surface">
                Weiter
              </Link>
            ) : (
              <span className="rounded-full border border-line px-4 py-2 text-muted opacity-50">Weiter</span>
            )}
          </nav>
        )}
      </main>
    </>
  );
}

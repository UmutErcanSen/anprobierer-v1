import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/site/app-header";
import { LinkButton } from "@/components/ui/button";
import { HistoryFilters } from "@/components/history/history-filters";
import { HistoryCard, type HistoryGeneration } from "@/components/history/history-card";
import { resolveCardRows } from "@/lib/generation/cards";

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
function parseList(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
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
  const kategorie = parseList(first(params.kategorie));
  const groesse = parseList(first(params.groesse));
  const farbe = parseList(first(params.farbe));
  const favorit = first(params.favorit) === "1";
  const page = Math.max(1, Number(first(params.page)) || 1);

  const { data: balance } = await supabase.from("credit_balances").select("balance").maybeSingle();
  const credits = balance?.balance ?? 0;

  let query = supabase
    .from("generations")
    .select(
      "id, status, mode, quality, credits_charged, created_at, cards, result_paths, sale_text, is_favorite, clothing_types, sizes, colors",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (status === "in_progress") query = query.in("status", ["queued", "processing"]);
  else if (status !== "all") query = query.eq("status", status);
  if (mode !== "all") query = query.eq("mode", mode);
  // overlaps: die Generierung passt, wenn mindestens EINES ihrer Stuecke zu
  // einem der ausgewaehlten Werte passt (Mehrfachauswahl innerhalb eines
  // Filters ist ein "ODER", nicht "UND" -- sonst faende man z.B. bei
  // "Jeans + Kleid" nie eine Generierung, die nur eines von beiden enthaelt).
  if (kategorie.length > 0) query = query.overlaps("clothing_types", kategorie);
  if (groesse.length > 0) query = query.overlaps("sizes", groesse);
  if (farbe.length > 0) query = query.overlaps("colors", farbe);
  if (favorit) query = query.eq("is_favorite", true);

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error: queryError } = await query.range(from, from + PAGE_SIZE - 1);
  // Eine fehlgeschlagene Abfrage (z.B. Filter auf eine Spalte, die eine noch
  // nicht angewendete Migration voraussetzt) darf nicht als "keine Treffer"
  // erscheinen -- das saehe wie ein leerer, aber korrekter Filter aus, obwohl
  // in Wahrheit die Abfrage selbst gescheitert ist.
  if (queryError) console.error("[verlauf] Datenbankfehler bei der Generierungsabfrage", queryError);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const cardRowsByGeneration = (rows ?? []).map((g) => resolveCardRows(g));

  const generations: HistoryGeneration[] = (rows ?? []).map((g, i) => ({
    id: g.id,
    status: g.status,
    mode: g.mode,
    quality: g.quality,
    credits_charged: g.credits_charged,
    created_at: g.created_at,
    imageCount: cardRowsByGeneration[i].filter((c) => c.imagePath).length,
    isFavorite: g.is_favorite,
    categories: g.clothing_types ?? [],
    sizes: g.sizes ?? [],
    colors: g.colors ?? [],
  }));

  // Thumbnails frisch signieren -- die Pfade in der DB sind dauerhaft, die
  // signierten URLs laufen ab und duerfen deshalb nicht mitgespeichert werden.
  const thumbnails = await Promise.all(
    cardRowsByGeneration.map(async (cards) => {
      const firstImage = cards.find((c) => c.imagePath)?.imagePath;
      if (!firstImage) return null;
      const { data } = await supabase.storage.from("results").createSignedUrl(firstImage, 60 * 5);
      return data?.signedUrl ?? null;
    }),
  );

  function pageHref(target: number) {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (mode !== "all") sp.set("mode", mode);
    if (kategorie.length) sp.set("kategorie", kategorie.join(","));
    if (groesse.length) sp.set("groesse", groesse.join(","));
    if (farbe.length) sp.set("farbe", farbe.join(","));
    if (favorit) sp.set("favorit", "1");
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `/konto/verlauf?${qs}` : "/konto/verlauf";
  }

  const isFiltered =
    status !== "all" || mode !== "all" || kategorie.length > 0 || groesse.length > 0 || farbe.length > 0 || favorit;

  return (
    <>
      <AppHeader credits={credits} />

      {/* max-w-7xl statt max-w-5xl: eine Bildergalerie nutzt die
          Bildschirmbreite anders als ein Formular oder Fliesstext -- bei
          1024px liess sich auf breiten Monitoren viel ungenutzte weisse
          Flaeche rechts und links entstehen. Mehr Spalten (bis xl:6) fuellen
          den zusaetzlichen Platz, statt ihn nur zu vergroessern. */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-14">
        <p className="kicker">Verlauf</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Deine Anproben</h1>

        {/* Filter und primäre Aktion in einer Werkzeugleiste: die
            "Neue Anprobe"-Aktion gehört inhaltlich zu "was mache ich mit
            dieser Liste", nicht zur Überschrift -- vorher stand sie lose
            neben dem Titel und rutschte auf schmalen Bildschirmen direkt vor
            die Filter, ohne erkennbaren Zusammenhang zu beidem. */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <HistoryFilters status={status} mode={mode} kategorie={kategorie} groesse={groesse} farbe={farbe} favorit={favorit} />
          <LinkButton href="/anzeige-erstellen" size="md" className="shrink-0">
            Neue Anprobe erstellen
          </LinkButton>
        </div>

        {generations.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-sm text-muted">
            {isFiltered ? "Keine Anproben für diese Filter gefunden." : "Du hast noch keine Anprobe erstellt."}
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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

import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/site/app-header";
import { LinkButton } from "@/components/ui/button";
import { HistoryCard, type HistoryGeneration } from "@/components/history/history-card";
import { resolveCardRows } from "@/lib/generation/cards";
import { isGenerationLocked, lockedImagePath } from "@/lib/generation/lock";
import type { PlanKey } from "@/lib/generation/constants";

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
  const [
    { data: profile },
    { data: balance },
    { count: totalGenerations },
    { count: totalFavorites },
    { data: recentRows },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, plan").single(),
    supabase.from("credit_balances").select("balance").maybeSingle(),
    supabase.from("generations").select("id", { count: "exact", head: true }),
    supabase.from("generations").select("id", { count: "exact", head: true }).eq("is_favorite", true),
    supabase
      .from("generations")
      .select(
        "id, status, mode, quality, credits_charged, created_at, cards, result_paths, sale_text, is_favorite, clothing_types, sizes, colors, is_free_reveal",
      )
      .order("created_at", { ascending: false })
      .limit(RECENT_COUNT),
  ]);

  const credits = balance?.balance ?? 0;
  const plan = (profile?.plan as PlanKey) ?? "free";

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
    locked: isGenerationLocked(plan, g.is_free_reveal),
  }));
  // Verdeckte Generierungen bekommen die unscharfe Vorschau-Variante statt
  // des echten Bilds (siehe lock.ts) -- niemals die echte URL an den Client.
  const recentThumbnails = await Promise.all(
    recentCardRows.map(async (cards, i) => {
      const firstImage = cards.find((c) => c.imagePath)?.imagePath;
      if (!firstImage) return null;
      const path = recent[i].locked ? lockedImagePath(firstImage) : firstImage;
      const { data } = await supabase.storage.from("results").createSignedUrl(path, 60 * 5);
      return data?.signedUrl ?? null;
    }),
  );

  return (
    <>
      <AppHeader credits={credits} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        {/* Titel + Primaeraktion in einer Zeile, wie im Verlauf (dort
            "Deine Anproben" + "Neue Anprobe erstellen") -- vorher stand der
            Button als eigener, schwerer Block MITTEN in der Seite, direkt
            nach den ruhigen Stats. Das brach den Rhythmus und liess "Guthaben
            aufladen" wie eine zweite, konkurrierende Geld-Aktion neben "Auf
            Pro upgraden" wirken. Jetzt: Aktion gehoert zum Titel, Aufladen
            gehoert zur Guthaben-Zeile, wo es inhaltlich hingehoert. */}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="kicker">Mein Konto</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
              Hallo{profile?.display_name ? `, ${profile.display_name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>
          <LinkButton href="/anzeige-erstellen" size="md" className="shrink-0">
            Neue Anprobe erstellen
          </LinkButton>
        </div>

        {/* Guthaben als grosses Display-Element statt einer von drei
            gleichwertigen Kacheln -- es ist der Wert, den der Nutzer hier
            eigentlich nachschauen kommt. Bewusst KEIN "von X Credits"/
            "erneuert in Y Tagen": das wuerde eine monatliche Kontingent-
            Rueckerstattung und ein Abrechnungsdatum vortaeuschen, die es
            technisch noch nicht gibt (Stripe/Abo-Webhooks stehen noch aus,
            siehe Aufgabe #5/#6) -- also nur Werte zeigen, die wirklich stimmen. */}
        <div className="mt-10 flex items-baseline gap-4">
          <span className="text-5xl font-medium tracking-tight text-ink tabular-nums">{credits}</span>
          <div>
            <p className="text-sm text-ink-soft">{credits === 1 ? "Credit übrig" : "Credits übrig"}</p>
            <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-muted">
              <span className="capitalize">{plan}-Tarif</span> ·{" "}
              <Link href="/preise" className="normal-case underline underline-offset-4 hover:text-ink">
                Guthaben aufladen
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-7 border-t border-line pt-5">
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink">{totalGenerations ?? 0}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-muted">Erstellt</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink">{totalFavorites ?? 0}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-muted">Favoriten</p>
          </div>
          {plan !== "pro" && (
            <Link
              href="/preise"
              className="ml-auto text-sm text-accent underline underline-offset-4 transition-colors hover:opacity-80"
            >
              Auf Pro upgraden
            </Link>
          )}
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

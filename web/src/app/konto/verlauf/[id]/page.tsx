import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/site/app-header";
import { LinkButton } from "@/components/ui/button";
import { ResultView, type ResultCard } from "@/components/generation/result-view";
import { CREDITS_PER_QUALITY, type PlanKey, type Quality } from "@/lib/generation/constants";
import { resolveCardRows } from "@/lib/generation/cards";
import { isGenerationLocked, lockedImagePath, redactSaleText } from "@/lib/generation/lock";
import { DeleteGenerationButton } from "@/components/history/delete-generation-button";

export const metadata: Metadata = { title: "Anprobe · Verlauf" };

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

export default async function VerlaufDetailPage(props: PageProps<"/konto/verlauf/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const [{ data: generation }, { data: balance }, { data: profile }] = await Promise.all([
    supabase
      .from("generations")
      .select("id, status, mode, quality, credits_charged, created_at, cards, result_paths, sale_text, is_free_reveal")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("credit_balances").select("balance").maybeSingle(),
    supabase.from("profiles").select("plan").single(),
  ]);

  // RLS filtert fremde Zeilen ohnehin heraus -- kein Unterschied zwischen
  // "existiert nicht" und "gehört jemand anderem" noetig oder gewuenscht.
  if (!generation) notFound();

  const credits = balance?.balance ?? 0;
  const cardRows = resolveCardRows(generation);
  const locked = isGenerationLocked((profile?.plan as PlanKey) ?? "free", generation.is_free_reveal);

  const cards: ResultCard[] = await Promise.all(
    cardRows.map(async (c) => ({
      itemIndex: c.itemIndex,
      title: c.title,
      saleText: locked && c.saleText ? redactSaleText(c.saleText) : c.saleText,
      imageUrl: c.imagePath
        ? ((await supabase.storage.from("results").createSignedUrl(locked ? lockedImagePath(c.imagePath) : c.imagePath, 60 * 60))
            .data?.signedUrl ?? null)
        : null,
    })),
  );

  let failures = 0;
  if (generation.status === "failed" || generation.status === "succeeded") {
    const { data: refunds } = await supabase
      .from("credit_ledger")
      .select("delta")
      .eq("generation_id", id)
      .eq("reason", "generation_refund");
    const refunded = (refunds ?? []).reduce((sum, r) => sum + r.delta, 0);
    const unitCost = CREDITS_PER_QUALITY[generation.quality as Quality] ?? 1;
    failures = unitCost > 0 ? Math.round(refunded / unitCost) : 0;
  }

  const backLink = (
    <Link
      href="/konto/verlauf"
      className="inline-flex items-center gap-1 text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
    >
      <ChevronLeft size={15} aria-hidden /> Zurück zum Verlauf
    </Link>
  );

  return (
    <>
      <AppHeader credits={credits} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14">
        {backLink}

        {generation.status === "queued" || generation.status === "processing" ? (
          <p className="mt-8 rounded-xl border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
            Diese Anprobe wird noch erstellt. Schau in Kürze noch einmal vorbei.
          </p>
        ) : generation.status === "failed" ? (
          <p className="mt-8 rounded-xl border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
            Diese Anprobe ist fehlgeschlagen. Die Credits wurden zurückgebucht.
          </p>
        ) : cards.every((c) => !c.imageUrl && !c.saleText) ? (
          <p className="mt-8 rounded-xl border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
            Für diese Anprobe liegen keine Ergebnisse vor.
          </p>
        ) : (
          <div className="mt-8">
            <ResultView
              cards={cards}
              failures={failures}
              remaining={credits}
              title={`Anprobe vom ${dateFormat.format(new Date(generation.created_at))}`}
              footer={<LinkButton href="/anzeige-erstellen">Neue Anprobe erstellen</LinkButton>}
              generationId={generation.id}
              locked={locked}
            />
          </div>
        )}

        <div className="mt-10 border-t border-line pt-6">
          <DeleteGenerationButton generationId={generation.id} />
        </div>
      </main>
    </>
  );
}

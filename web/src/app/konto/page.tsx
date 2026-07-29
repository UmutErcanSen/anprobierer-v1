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
import { ManageSubscriptionLink } from "@/components/pricing/manage-subscription-link";
import { UsageOverview } from "@/components/konto/usage-overview";
import { buildTip, lastGrant, monthlyUsage, usedSince, type LedgerRow } from "@/lib/usage/summary";

export const metadata: Metadata = { title: "Mein Konto" };

const RECENT_COUNT = 4;

/* Kurzfassung der drei Schritte von der Landing Page -- hier braucht es
   keine Ueberzeugungsarbeit mehr (der Nutzer ist ja schon angemeldet),
   sondern nur die Erwartung, was gleich passiert. */
const ERSTE_SCHRITTE = [
  { title: "Foto von dir", body: "Ganzkörper, gut beleuchtet, ruhiger Hintergrund." },
  { title: "Kleidungsstück", body: "Flach ausgebreitet oder auf dem Bügel." },
  { title: "Fertig", body: "Anprobebild und Verkaufstext in unter einer Minute." },
];

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
    { data: subscription },
    { data: grantRow },
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
    supabase.from("subscriptions").select("current_period_end, status").maybeSingle(),
    // Die letzte Gutschrift ist die Bezugsgroesse des Fortschrittsrings --
    // separat geholt, weil sie bei Jahresabos oder Free-Konten aelter sein
    // kann als das 6-Monats-Fenster des Verlaufsdiagramms.
    supabase
      .from("credit_ledger")
      .select("delta, reason, created_at")
      .in("reason", ["signup_bonus", "subscription_grant", "topup_purchase"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const credits = balance?.balance ?? 0;
  const plan = (profile?.plan as PlanKey) ?? "free";

  // Ledger nur so weit zurueck laden, wie tatsaechlich gebraucht: bis zum
  // Beginn des Diagramm-Fensters ODER bis zur letzten Gutschrift, je nachdem
  // was frueher liegt. Damit bleibt die Zeilenzahl auch bei Vielnutzern klein.
  // ACHTUNG, subtile Falle: `setMonth(getMonth() - 5)` waere hier FALSCH.
  // Am 29./30./31. eines Monats rollt der Zieltag ueber das Monatsende hinaus
  // (29.07. minus 5 Monate = 29.02. -> existiert 2026 nicht -> 01.03.), das
  // Ladefenster begaenne also einen Monat zu spaet und der aelteste Balken
  // bliebe dauerhaft leer. Der Konstruktor mit Tag 1 normalisiert korrekt --
  // dieselbe Schreibweise nutzt auch monthlyUsage() beim Bilden der Koerbe,
  // beide muessen zwingend denselben Monat treffen.
  const today = new Date();
  const windowStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const since =
    grantRow && grantRow.created_at < windowStart.toISOString()
      ? grantRow.created_at
      : windowStart.toISOString();

  const { data: ledgerRows } = await supabase
    .from("credit_ledger")
    .select("delta, reason, created_at")
    .gte("created_at", since);

  const rows = (ledgerRows ?? []) as LedgerRow[];
  const grant = grantRow ? lastGrant([grantRow as LedgerRow]) : null;
  // user.created_at begrenzt das Diagramm nach hinten -- Monate vor der
  // Registrierung tauchen gar nicht auf, statt als leere Balken.
  const monthly = monthlyUsage(rows, 6, today, user.created_at);
  const usedSinceGrant = grant ? usedSince(rows, grant.at) : 0;
  const tip = buildTip({ plan, balance: credits, grantAmount: grant?.amount ?? null, usedSinceGrant, monthly });

  // Ring erst zeigen, wenn es etwas zu zeigen gibt -- ein 0-%-Ring direkt
  // nach der Registrierung waere nur Dekoration neben dem Onboarding-Block.
  const showUsage = Boolean(grant) && (usedSinceGrant > 0 || monthly.some((m) => m.used > 0));

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
      <AppHeader credits={credits} plan={plan} />

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
        {/* items-center statt items-baseline: bei so unterschiedlichen
            Schriftgroessen (48px vs. 12-14px) liegt die Baseline der kleinen
            Zeilen naeher an ihrer eigenen Boxmitte als an der Baseline der
            grossen Zahl -- das Ergebnis wirkte trotz "korrekter" Baseline-
            Ausrichtung leicht verschoben. items-center zentriert den
            Textblock optisch an der Zahl, das balanciert sich bei diesem
            Groessenunterschied sauberer aus. */}
        <div className="mt-10 flex items-center gap-4">
          <span className="text-5xl font-medium tracking-tight text-ink tabular-nums">{credits}</span>
          <div>
            <p className="text-sm text-ink-soft">{credits === 1 ? "Credit übrig" : "Credits übrig"}</p>
            <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-muted">
              <span className="capitalize">{plan}-Tarif</span> ·{" "}
              {/* War "Guthaben aufladen" -- irrefuehrend, denn es gibt kein
                  Aufladen. Es gibt nur Abos (siehe Entscheidung: keine
                  Credit-Pakete), Credits kommen ausschliesslich ueber den
                  monatlichen/jaehrlichen Abo-Rhythmus. */}
              <Link href="/preise" className="normal-case underline underline-offset-4 hover:text-ink">
                Tarife ansehen
              </Link>
            </p>
          </div>
        </div>

        {/* Bei 0 Credits ist die App faktisch gesperrt -- das stand bisher nur
            als beilaeufiges "0 Credits übrig" da. Ein Nutzer, der auf
            "Neue Anprobe erstellen" klickt, lief erst im Formular gegen die
            Wand. Bewusst nur bei EXAKT 0: bei 1 verbleibendem Credit ist noch
            nichts blockiert, da waere die Warnung nur Laerm. */}
        {credits === 0 && (
          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
            Dein Guthaben ist aufgebraucht — für weitere Anproben brauchst du neue Credits.
            <Link href="/preise" className="text-accent underline underline-offset-4 hover:opacity-80">
              Tarife ansehen
            </Link>
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-7 border-t border-line pt-5">
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink">{totalGenerations ?? 0}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-muted">Erstellt</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink">{totalFavorites ?? 0}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-muted">Favoriten</p>
          </div>
          <div className="ml-auto flex items-center gap-5">
            {plan !== "free" && <ManageSubscriptionLink />}
            {plan !== "pro" && (
              <Link
                href="/preise"
                className="text-sm text-accent underline underline-offset-4 transition-colors hover:opacity-80"
              >
                {plan === "free" ? "Tarif wählen" : "Auf Pro upgraden"}
              </Link>
            )}
          </div>
        </div>

        {showUsage && grant && (
          <UsageOverview
            planLabel={`${plan.charAt(0).toUpperCase()}${plan.slice(1)}-Tarif`}
            grantAmount={grant.amount}
            usedSinceGrant={usedSinceGrant}
            monthly={monthly}
            // Nur bei laufendem Abo gibt es einen echten naechsten Termin --
            // im Free-Tarif war die Gutschrift einmalig.
            periodEnd={plan !== "free" ? (subscription?.current_period_end ?? null) : null}
            tip={tip}
          />
        )}

        {recent.length > 0 ? (
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
        ) : (
          /* Wer sich gerade registriert hat, sah hier bisher NICHTS: nach
             "0 Erstellt / 0 Favoriten" hoerte die Seite einfach auf. Genau der
             Moment, in dem die Aktivierung entweder passiert oder eben nicht.
             Jetzt ein Leerzustand, der den ersten Schritt benennt statt ihn
             vorauszusetzen -- gestrichelter Rahmen wie bei den Upload-Feldern,
             damit sofort lesbar ist "hier gehoert noch etwas hin". */
          <section className="mt-14 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
            <h2 className="text-lg font-medium text-ink">Deine erste Anprobe</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-ink-soft">
              Du hast {credits} {credits === 1 ? "Credit" : "Credits"} zum Ausprobieren. Für die erste
              Anprobe brauchst du nur zwei Fotos.
            </p>

            <ol className="mx-auto mt-8 grid max-w-xl gap-5 text-left sm:grid-cols-3">
              {ERSTE_SCHRITTE.map((schritt, i) => (
                <li key={schritt.title}>
                  <span className="font-mono text-xs text-muted">0{i + 1}</span>
                  <p className="mt-1.5 text-sm font-medium text-ink">{schritt.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{schritt.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-9">
              <LinkButton href="/anzeige-erstellen" size="lg">
                Jetzt starten
              </LinkButton>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

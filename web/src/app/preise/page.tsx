import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PricingCards } from "@/components/pricing/pricing-cards";
import { COMPARISON_ROWS } from "@/components/pricing/plans-data";
import { Reveal } from "@/components/site/reveal";
import { createClient } from "@/lib/supabase/server";
import type { PlanKey } from "@/lib/generation/constants";

export const metadata: Metadata = {
  title: "Preise",
  description:
    "Credits statt Abo-Falle: Ein Credit entspricht einem Anprobebild. 3 Gratis-Credits zum Ausprobieren, ohne Zahlungsdaten.",
};

/*
  ACHTUNG: Die Preise sind vorlaeufig. Sie muessen gegen die real gemessenen
  Kosten gegengerechnet werden (~$0.058 pro Standardbild, ~$0.23 pro HD-Bild) —
  siehe offene Aufgabe "Credit-Preise nachrechnen". Erst danach final setzen.

  Die Tarif-Definitionen (Preise, Credits, Features) leben in
  pricing-cards.tsx, direkt neben dem Checkout-Aufruf -- eine Quelle statt
  zwei, die auseinanderlaufen koennten.
*/

export default async function PreisePage() {
  // Serverseitig ermitteln, ob (und mit welchem Tarif) der Besucher schon
  // zahlt -- damit die Karten unten "Jetzt upgraden" gar nicht erst anbieten,
  // wo ein zweiter Checkout eine zweite, parallele Stripe-Subscription
  // anlegen wuerde (siehe Guard in /api/stripe/checkout). Absichtlich schon
  // hier statt erst im Klick-Handler: der Nutzer soll erst gar nicht auf
  // einen Button treffen, der ohnehin nur einen Fehler zurückgibt.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: PlanKey | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("plan").single();
    currentPlan = (profile?.plan as PlanKey) ?? "free";
  }

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* hero-enter statt Reveal: laeuft beim Laden sofort (kein Scroll
            noetig, die Seite oeffnet direkt hier) -- dieselbe Logik wie beim
            Hero der Landing Page, siehe globals.css. */}
        <section className="hero-enter mx-auto w-full max-w-6xl px-6 py-16 text-center md:py-24">
          <p className="kicker">Preise</p>
          <h1 className="display mx-auto mt-5 max-w-3xl text-4xl md:text-6xl">
            Zahl nur, was du <em>wirklich nutzt</em>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
            Ein Credit entspricht einem Anprobebild. Keine versteckten Kosten, kein
            eigener KI-Zugang nötig.
          </p>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <PricingCards currentPlan={currentPlan} />
        </section>

        {/* Direktvergleich: dieselben Zeilen ueber alle drei Tarife, statt
            drei separate Feature-Listen vergleichen zu muessen. */}
        <section className="border-t border-line">
          <Reveal className="mx-auto w-full max-w-4xl px-6 py-16">
            <h2 className="display text-2xl md:text-4xl">Die Tarife <em>im Vergleich</em>.</h2>
            <div className="mt-8 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface">
                    <th className="px-5 py-3.5 font-medium text-muted">Merkmal</th>
                    {["Kostenlos", "Basic", "Pro"].map((name) => (
                      <th key={name} className="px-5 py-3.5 text-center font-medium text-ink">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={row.label} className={i > 0 ? "border-t border-line" : undefined}>
                      <th scope="row" className="px-5 py-3.5 font-normal text-ink-soft">
                        {row.label}
                      </th>
                      {/* Hier trennt das Haekchen tatsaechlich zwei Zustaende
                          (enthalten / nicht enthalten) -- der Unterschied
                          bleibt also, laeuft aber ueber Kontrast statt ueber
                          eine zweite Farbe: vorhanden = kraeftig, fehlend =
                          zurueckgenommen. */}
                      {row.values.map((value, j) => (
                        <td key={j} className="px-5 py-3.5 text-center tabular-nums text-ink">
                          {value === "✓" ? (
                            <span aria-hidden className="text-ink">✓</span>
                          ) : value === "—" ? (
                            <span aria-hidden className="text-muted">—</span>
                          ) : (
                            value
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-3xl px-6 py-16">
            <Reveal>
              <h2 className="display text-2xl md:text-4xl">Was ist ein <em>Credit</em>?</h2>
            </Reveal>
            {/* Kleine, kurze Verzoegerung je Eintrag statt der 100ms-Stufen
                oben: fuenf Punkte in Folge sollen zuegig durchlaufen statt
                spuerbar nacheinander abzuarbeiten -- reine Textliste, kein
                Kartenraster mit eigenem Gewicht je Eintrag. */}
            <dl className="mt-8 flex flex-col gap-6 text-[15px]">
              <Reveal delay={0}>
                <dt className="font-medium text-ink">Ein Credit = ein Anprobebild</dt>
                <dd className="mt-1 text-ink-soft">
                  Im Einzeln-Modus kostet jedes Kleidungsstück ein eigenes Bild — drei Stücke
                  also drei Credits. Im Kombiniert-Modus entsteht ein gemeinsames Bild für
                  einen Credit.
                </dd>
              </Reveal>
              <Reveal delay={60}>
                <dt className="font-medium text-ink">HD kostet vier Credits</dt>
                <dd className="mt-1 text-ink-soft">
                  Die höhere Qualität ist deutlich rechenintensiver. Sie ist im Pro-Tarif
                  freigeschaltet.
                </dd>
              </Reveal>
              <Reveal delay={120}>
                <dt className="font-medium text-ink">Verkaufstexte sind immer inklusive</dt>
                <dd className="mt-1 text-ink-soft">
                  Zu jedem Kleidungsstück entsteht ein fertiger Anzeigentext — ohne
                  zusätzliche Credits.
                </dd>
              </Reveal>
              <Reveal delay={180}>
                <dt className="font-medium text-ink">Fehlgeschlagene Bilder kosten nichts</dt>
                <dd className="mt-1 text-ink-soft">
                  Wenn ein Bild nicht erstellt werden kann, werden die Credits dafür
                  automatisch zurückgebucht.
                </dd>
              </Reveal>
              <Reveal delay={240}>
                <dt className="font-medium text-ink">Im Free-Tarif ist nur das erste Ergebnis frei sichtbar</dt>
                <dd className="mt-1 text-ink-soft">
                  Deine ersten 3 Credits kannst du nutzen, aber nur dein <em>erstes</em> Ergebnis
                  siehst du in voller Auflösung samt vollständigem Verkaufstext. Ab dem zweiten
                  Ergebnis zeigen wir eine unscharfe Vorschau, bis ein bezahlter Tarif aktiv ist —
                  ein Upgrade schaltet dann auch alle bisherigen Ergebnisse rückwirkend frei.
                </dd>
              </Reveal>
            </dl>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

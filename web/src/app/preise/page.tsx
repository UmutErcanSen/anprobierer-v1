import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Preise",
  description:
    "Credits statt Abo-Falle: Ein Credit entspricht einem Anprobebild. 5 Gratis-Credits zum Ausprobieren, ohne Zahlungsdaten.",
};

/*
  ACHTUNG: Die Preise sind vorlaeufig. Sie muessen gegen die real gemessenen
  Kosten gegengerechnet werden (~$0.058 pro Standardbild, ~$0.23 pro HD-Bild) —
  siehe offene Aufgabe "Credit-Preise nachrechnen". Erst danach final setzen.

  Die kostenpflichtigen Tarife sind bewusst noch nicht kaufbar: Die Stripe-
  Anbindung kommt in Phase 3. Einen Kauf vorzutaeuschen waere unehrlich.
*/

type Plan = {
  name: string;
  price: string;
  period?: string;
  credits: string;
  features: string[];
  featured?: boolean;
  available: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Kostenlos",
    price: "0 €",
    credits: "5 Credits einmalig",
    features: ["Standard-Qualität", "1 Kleidungsstück pro Anprobe", "Verkaufstexte inklusive"],
    available: true,
  },
  {
    name: "Starter",
    price: "9,99 €",
    period: "/ Monat",
    credits: "60 Credits monatlich",
    features: ["Standard-Qualität", "Bis zu 5 Kleidungsstücke pro Anprobe", "Verkaufstexte inklusive", "Einzeln- und Kombiniert-Modus"],
    featured: true,
    available: false,
  },
  {
    name: "Pro",
    price: "24,99 €",
    period: "/ Monat",
    credits: "200 Credits monatlich",
    features: ["HD-Qualität freigeschaltet", "Bis zu 9 Kleidungsstücke pro Anprobe", "Verkaufstexte inklusive", "Bevorzugter Support"],
    available: false,
  },
];

export default function PreisePage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 py-16 text-center md:py-24">
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
          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.name} className="flex flex-col gap-5 bg-paper p-8">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium tracking-tight text-ink">{plan.name}</h2>
                    {plan.featured && (
                      <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-muted">Beliebt</span>
                    )}
                  </div>
                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-ink">{plan.price}</span>
                    {plan.period && <span className="text-sm text-muted">{plan.period}</span>}
                  </p>
                  <p className="mt-2 text-sm text-muted">{plan.credits}</p>
                </div>

                <ul className="flex flex-1 flex-col gap-2.5 text-sm text-ink-soft">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span aria-hidden className="text-success">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.available ? (
                  <LinkButton href="/registrieren" size="lg">Kostenlos starten</LinkButton>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="inline-flex h-12 items-center justify-center rounded-full border border-line px-7 text-[15px] text-muted">
                      Bald verfügbar
                    </span>
                    <span className="text-xs text-muted">Bezahlung wird gerade eingerichtet.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-3xl px-6 py-16">
            <h2 className="display text-2xl md:text-4xl">Was ist ein <em>Credit</em>?</h2>
            <dl className="mt-8 flex flex-col gap-6 text-[15px]">
              <div>
                <dt className="font-medium text-ink">Ein Credit = ein Anprobebild</dt>
                <dd className="mt-1 text-ink-soft">
                  Im Einzeln-Modus kostet jedes Kleidungsstück ein eigenes Bild — drei Stücke
                  also drei Credits. Im Kombiniert-Modus entsteht ein gemeinsames Bild für
                  einen Credit.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">HD kostet vier Credits</dt>
                <dd className="mt-1 text-ink-soft">
                  Die höhere Qualität ist deutlich rechenintensiver. Sie ist im Pro-Tarif
                  freigeschaltet.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Verkaufstexte sind immer inklusive</dt>
                <dd className="mt-1 text-ink-soft">
                  Zu jedem Kleidungsstück entsteht ein fertiger Anzeigentext — ohne
                  zusätzliche Credits.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Fehlgeschlagene Bilder kosten nichts</dt>
                <dd className="mt-1 text-ink-soft">
                  Wenn ein Bild nicht erstellt werden kann, werden die Credits dafür
                  automatisch zurückgebucht.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LinkButton, Button } from "@/components/ui/button";
import { PLANS, type PaidPlan } from "@/components/pricing/plans-data";

type Interval = "monthly" | "yearly";

export function PricingCards() {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [pendingPlan, setPendingPlan] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: PaidPlan) {
    setError(null);
    setPendingPlan(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });

      if (res.status === 401) {
        router.push("/anmelden");
        return;
      }

      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Der Checkout konnte nicht gestartet werden.");
    } catch {
      setError("Der Checkout konnte nicht gestartet werden. Prüfe deine Verbindung.");
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <div>
      {/* Umschalter zuerst, damit die Ersparnis schon sichtbar ist, bevor der
          Blick auf die Preise faellt -- sonst wirkt der Jahrespreis wie ein
          hoeherer Preis statt wie ein Rabatt. */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-line p-1 text-sm">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              interval === "monthly" ? "bg-ink text-on-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            Monatlich
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${
              interval === "yearly" ? "bg-ink text-on-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            Jährlich
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                interval === "yearly" ? "bg-on-ink/15" : "bg-success/15 text-success"
              }`}
            >
              2 Monate gratis
            </span>
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mx-auto mt-6 max-w-md rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm text-accent">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
        {PLANS.map((plan) => {
          const isPaid = plan.key !== "free";
          const price = interval === "yearly" && plan.yearlyPrice ? plan.yearlyPrice : plan.monthlyPrice;
          const period = plan.key === "free" ? undefined : interval === "yearly" ? "/ Jahr" : "/ Monat";

          return (
            <div key={plan.key} className="flex flex-col gap-5 bg-paper p-8">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium tracking-tight text-ink">{plan.name}</h2>
                  {plan.featured && (
                    <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-muted">Beliebt</span>
                  )}
                </div>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-ink">{price}</span>
                  {period && <span className="text-sm text-muted">{period}</span>}
                </p>
                {isPaid && interval === "yearly" && plan.yearlyPerMonth && (
                  <p className="mt-1 text-xs text-muted">entspricht {plan.yearlyPerMonth} / Monat</p>
                )}
                <p className="mt-2 text-sm text-muted">{plan.credits}</p>
              </div>

              <ul className="flex flex-1 flex-col gap-2.5 text-sm text-ink-soft">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span aria-hidden className="text-success">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.key === "free" ? (
                <LinkButton href="/registrieren" size="lg">
                  Kostenlos starten
                </LinkButton>
              ) : (
                (() => {
                  const paidKey = plan.key;
                  return (
                    <Button size="lg" onClick={() => startCheckout(paidKey)} disabled={pendingPlan !== null}>
                      {pendingPlan === paidKey ? "Wird geöffnet …" : "Jetzt upgraden"}
                    </Button>
                  );
                })()
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

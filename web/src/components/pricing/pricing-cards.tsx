"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LinkButton, Button } from "@/components/ui/button";
import { Reveal } from "@/components/site/reveal";
import { PLANS, type PaidPlan } from "@/components/pricing/plans-data";
import type { PlanKey } from "@/lib/generation/constants";

type Interval = "monthly" | "yearly";

type PricingCardsProps = {
  /** null = nicht angemeldet. Bestimmt, ob eine Karte "Jetzt upgraden"
   *  (neuer Checkout) oder "Abo verwalten" (Portal) zeigt -- siehe Kommentar
   *  unten bei renderCta. */
  currentPlan: PlanKey | null;
};

export function PricingCards({ currentPlan }: PricingCardsProps) {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [pendingPlan, setPendingPlan] = useState<PaidPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
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

  async function openPortal() {
    setError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Konnte nicht geöffnet werden.");
    } catch {
      setError("Konnte nicht geöffnet werden.");
    } finally {
      setPortalLoading(false);
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
            {/* Rabatt-Hinweis war gruen -- das ist aber kein Status ("erledigt"),
                sondern eine Werbeaussage. Werbung gehoert auf die eine
                Markenfarbe, sonst konkurrieren zwei Farben um Aufmerksamkeit. */}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                interval === "yearly" ? "bg-on-ink/15" : "bg-accent/12 text-accent"
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

      {/* variant="scale": waechst leicht aus der Mitte -- dieselbe Bewegung
          wie die Feature-Karten auf der Startseite (bewusst konsistent, hier
          sind es ebenfalls fokussierte Auswahl-Karten, keine Reihenfolge wie
          bei nummerierten Schritten). delay je Kartenindex fuer gestaffeltes
          Einblenden. */}
      <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
        {PLANS.map((plan, i) => {
          const isPaid = plan.key !== "free";
          const price = interval === "yearly" && plan.yearlyPrice ? plan.yearlyPrice : plan.monthlyPrice;
          const period = plan.key === "free" ? undefined : interval === "yearly" ? "/ Jahr" : "/ Monat";

          return (
            <Reveal key={plan.key} variant="scale" delay={i * 100} className="flex flex-col gap-5 bg-paper p-8">
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

              {/* Haekchen bewusst entfaerbt (vorher gruen): In einer Liste, in
                  der ALLE Punkte enthalten sind, unterscheidet die Farbe nichts
                  -- sie war reine Dekoration und stritt mit dem Terrakotta.
                  Zurueckhaltende Haekchen lassen den Text vorne stehen. */}
              <ul className="flex flex-1 flex-col gap-2.5 text-sm text-ink-soft">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <span aria-hidden className="text-muted">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Wer schon EIN bezahltes Abo hat, darf hier keinen zweiten
                  Checkout starten (der Server lehnt das ohnehin ab, siehe
                  /api/stripe/checkout) -- Auf-/Abstufung und Kuendigung
                  laufen ausschliesslich ueber das Stripe Customer Portal,
                  das seit Kurzem beides mit korrekter Proration beherrscht. */}
              {plan.key === currentPlan ? (
                <span className="inline-flex h-12 items-center justify-center rounded-full border border-line px-7 text-[15px] text-muted">
                  Dein Tarif
                </span>
              ) : plan.key === "free" ? (
                currentPlan == null ? (
                  <LinkButton href="/registrieren" size="lg">
                    Kostenlos starten
                  </LinkButton>
                ) : (
                  <Button size="lg" variant="outline" onClick={openPortal} disabled={portalLoading}>
                    {portalLoading ? "Öffnet …" : "Abo verwalten"}
                  </Button>
                )
              ) : currentPlan && currentPlan !== "free" ? (
                <Button size="lg" variant="outline" onClick={openPortal} disabled={portalLoading}>
                  {portalLoading ? "Öffnet …" : "Wechseln"}
                </Button>
              ) : (
                (() => {
                  const paidKey = plan.key;
                  return (
                    <Button size="lg" onClick={() => startCheckout(paidKey)} disabled={pendingPlan !== null}>
                      {pendingPlan === paidKey ? "Öffnet …" : "Auswählen"}
                    </Button>
                  );
                })()
              )}
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

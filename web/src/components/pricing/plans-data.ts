/*
  Bewusst OHNE "use client": reine Daten, die sowohl von der Client-
  Komponente (pricing-cards.tsx, fuer die Karten + den Checkout-Aufruf) als
  auch von der Server-Komponente (preise/page.tsx, fuer die Vergleichs-
  tabelle) gebraucht werden. Wuerden diese Konstanten stattdessen aus
  pricing-cards.tsx re-exportiert, wuerde der Server-Import ins Leere laufen
  -- ueber die Client/Server-Grenze hinweg ist aus einer "use client"-Datei
  nur die Komponente selbst nutzbar, keine begleitenden Daten-Exporte.
*/

export type PaidPlan = "basic" | "pro";

export type Plan = {
  key: "free" | PaidPlan;
  name: string;
  monthlyPrice: string;
  yearlyPrice?: string;
  yearlyPerMonth?: string;
  credits: string;
  features: string[];
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    key: "free",
    name: "Kostenlos",
    monthlyPrice: "0 €",
    credits: "3 Credits einmalig",
    features: [
      "Erstes Ergebnis in voller Auflösung",
      "Weitere Ergebnisse als Vorschau",
      "Standard-Qualität",
      "1 Kleidungsstück pro Anprobe",
    ],
  },
  {
    key: "basic",
    name: "Basic",
    monthlyPrice: "9,99 €",
    yearlyPrice: "99,90 €",
    yearlyPerMonth: "8,33 €",
    credits: "60 Credits monatlich",
    features: ["Standard-Qualität", "Bis zu 5 Kleidungsstücke pro Anprobe", "Verkaufstexte inklusive", "Einzeln- und Kombiniert-Modus"],
    featured: true,
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPrice: "19,99 €",
    yearlyPrice: "199,90 €",
    yearlyPerMonth: "16,66 €",
    credits: "200 Credits monatlich",
    features: ["HD-Qualität freigeschaltet", "Bis zu 9 Kleidungsstücke pro Anprobe", "Verkaufstexte inklusive", "Bevorzugter Support"],
  },
];

// Direkter Vergleich der tatsaechlichen Unterschiede zwischen den Tarifen --
// Werte muessen 1:1 mit lib/generation/constants.ts (qualityForPlan,
// maxItemsForPlan) uebereinstimmen.
export const COMPARISON_ROWS: { label: string; values: [string, string, string] }[] = [
  { label: "Credits", values: ["3 einmalig", "60 / Monat", "200 / Monat"] },
  { label: "Ergebnisse in voller Auflösung", values: ["nur das erste", "alle", "alle"] },
  { label: "Bildqualität", values: ["Standard", "Standard", "HD"] },
  { label: "Kleidungsstücke pro Anprobe", values: ["1", "bis zu 5", "bis zu 9"] },
  { label: "Kombiniert-Modus (mehrere Stücke, 1 Bild)", values: ["—", "✓", "✓"] },
  { label: "Verkaufstexte inklusive", values: ["✓", "✓", "✓"] },
  { label: "Plattform-Export (Vinted, Kleinanzeigen, eBay)", values: ["✓", "✓", "✓"] },
  { label: "Support", values: ["Standard", "Standard", "Bevorzugt"] },
];

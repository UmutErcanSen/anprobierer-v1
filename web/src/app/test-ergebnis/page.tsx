import type { Metadata } from "next";
import { ResultDemo } from "@/components/generation/result-demo";

/*
  ============================================================================
  TEMPORÄRE TESTSEITE — vor dem Livegang loeschen.

  Zeigt die Ergebnisansicht mit Beispieldaten, damit das Design geprueft
  werden kann, ohne bei jedem Versuch echte (kostenpflichtige) API-Aufrufe
  auszuloesen.

  Zum Entfernen: diesen Ordner und src/components/generation/result-demo.tsx
  loeschen. Die eigentliche ResultView bleibt (die nutzt der echte Ablauf).
  ============================================================================
*/

export const metadata: Metadata = {
  title: "Testseite Ergebnis",
  // Nicht indexieren — die Seite ist ein Entwicklungswerkzeug.
  robots: { index: false, follow: false },
};

export default function TestErgebnisPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <p className="mb-8 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-3 text-sm text-muted">
        <strong className="text-ink">Testseite.</strong> Beispieldaten, keine echten
        Generierungen — hier entstehen keine Kosten. Wird vor dem Livegang entfernt.
      </p>
      <ResultDemo />
    </main>
  );
}

import type { Metadata } from "next";
import { GenerateFlow } from "@/components/generation/generate-flow";

/*
  ============================================================================
  TEMPORÄRE TESTSEITE — vor dem Livegang loeschen.

  Rendert das Erstellen-Formular OHNE Anmeldung und ohne echte API-Aufrufe
  auszuloesen (ein Klick auf "Generieren" wuerde zwar POST /api/generate
  aufrufen und mit 401 abgelehnt werden, aber niemals einen echten OpenAI-
  Aufruf ausloesen). Dient dazu, am Layout/Design des Formulars zu arbeiten,
  ohne jedes Mal ein Testkonto zu benoetigen -- analog zu /test-ergebnis.

  Zum Entfernen: diesen Ordner loeschen. Die eigentliche GenerateFlow-
  Komponente bleibt (die nutzt der echte, angemeldete Ablauf).
  ============================================================================
*/

export const metadata: Metadata = {
  title: "Testseite Erstellen",
  robots: { index: false, follow: false },
};

export default function TestErstellenPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10 md:max-w-none md:px-0 md:py-0">
      {/* Banner behaelt einen eigenen Rand, obwohl <main> ab md keinen mehr
          hat -- sonst kleben Hinweistext und Bildschirmrand aneinander. */}
      <p className="mb-8 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-3 text-sm text-muted md:mx-10 md:mt-10">
        <strong className="text-ink">Testseite.</strong> Kein echtes Konto, keine echten
        Generierungen. Wird vor dem Livegang entfernt.
      </p>
      <GenerateFlow credits={97} plan="starter" />
    </main>
  );
}

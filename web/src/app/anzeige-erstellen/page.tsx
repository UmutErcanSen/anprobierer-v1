import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/site/app-header";
import { GenerateFlow } from "@/components/generation/generate-flow";
import type { PlanKey } from "@/lib/generation/constants";

export const metadata: Metadata = { title: "Anzeige erstellen" };

export default async function AnzeigeErstellenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const [{ data: profile }, { data: balance }] = await Promise.all([
    supabase.from("profiles").select("plan").single(),
    supabase.from("credit_balances").select("balance").maybeSingle(),
  ]);

  const credits = balance?.balance ?? 0;
  const plan = (profile?.plan ?? "free") as PlanKey;

  return (
    <>
      <AppHeader credits={credits} />
      {/* Mobil: schmales, zentriertes Formular wie bisher (max-w-xl + Rand).
          Ab md faellt die Randbeschraenkung komplett weg, damit die
          Foto-Spalte von GenerateFlow bis an den Bildschirmrand reicht --
          genau wie der Hero auf der Landingpage. Die Einstellungsspalte
          bringt ihre eigene, lesbare Breite dann selbst mit. */}
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10 md:max-w-none md:px-0 md:py-0">
        <GenerateFlow credits={credits} plan={plan} />
      </main>
    </>
  );
}

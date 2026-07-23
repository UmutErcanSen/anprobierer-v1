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
      {/* max-w-xl auf Mobil (schmales Formular wie bisher), auf md+ deutlich
          breiter -- die Editorial-Aufteilung (Foto | Einstellungen) braucht
          Platz nebeneinander, sonst wirkt sie gequetscht. */}
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10 md:max-w-5xl md:py-12">
        <GenerateFlow credits={credits} plan={plan} />
      </main>
    </>
  );
}

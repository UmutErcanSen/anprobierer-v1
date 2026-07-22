import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/site/app-header";
import { GenerateStepper } from "@/components/generation/generate-stepper";

export const metadata: Metadata = { title: "Anzeige erstellen" };

export default async function AnzeigeErstellenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: balance } = await supabase
    .from("credit_balances")
    .select("balance")
    .maybeSingle();

  return (
    <>
      <AppHeader credits={balance?.balance ?? 0} />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <GenerateStepper credits={balance?.balance ?? 0} />
      </main>
    </>
  );
}

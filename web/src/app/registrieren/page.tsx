import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signUpAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Konto erstellen" };

/*
  Wer bereits angemeldet ist, hat auf dieser Seite nichts verloren.
  proxy.ts faengt das fuer /anmelden und /registrieren bereits ab (erste
  Verteidigungslinie) -- diese Pruefung ist die zweite, fuer den Fall, dass
  diese Seite je auf anderem Weg als ueber den Proxy erreicht wird. Selbes
  Prinzip wie bei den GESCHUETZTEN_PFADEN dort: der Proxy ist nicht die
  einzige Instanz, die entscheidet.
*/
export default async function RegistrierenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/anzeige-erstellen");

  return (
    <AuthShell
      title="Konto erstellen"
      subtitle="3 Gratis-Credits zum Ausprobieren, erstes Ergebnis in voller Auflösung — ohne Zahlungsdaten."
      footer={
        <>
          Schon ein Konto?{" "}
          <Link href="/anmelden" className="text-ink underline underline-offset-4">
            Anmelden
          </Link>
        </>
      }
    >
      <AuthForm
        action={signUpAction}
        submitLabel="Konto erstellen"
        pendingLabel="Wird erstellt …"
        fields={[
          { name: "displayName", label: "Name (optional)", type: "text", autoComplete: "name" },
          { name: "email", label: "E-Mail-Adresse", type: "email", autoComplete: "email", required: true },
          {
            name: "password",
            label: "Passwort",
            type: "password",
            autoComplete: "new-password",
            required: true,
            hint: "Mindestens 8 Zeichen, davon ein Buchstabe und eine Zahl.",
          },
        ]}
      />
    </AuthShell>
  );
}

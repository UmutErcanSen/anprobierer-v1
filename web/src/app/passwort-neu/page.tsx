import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { updatePasswordAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Neues Passwort" };

/*
  Ziel des Zuruecksetzen-Links. Der Code aus der E-Mail wurde in
  /auth/callback bereits gegen eine Sitzung getauscht -- wer hier ohne
  Sitzung landet (Link abgelaufen, direkt aufgerufen), wird zurueck zum
  Anfordern geschickt, statt ein Formular zu sehen, das ohnehin scheitern
  wuerde.
*/
export default async function PasswortNeuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/passwort-vergessen?fehler=abgelaufen");

  return (
    <AuthShell
      title="Neues Passwort setzen"
      subtitle="Wähle ein neues Passwort für dein Konto."
      footer={
        <Link href="/konto" className="text-ink underline underline-offset-4">
          Abbrechen
        </Link>
      }
    >
      <AuthForm
        action={updatePasswordAction}
        submitLabel="Passwort speichern"
        pendingLabel="Wird gespeichert …"
        fields={[
          {
            name: "password",
            label: "Neues Passwort",
            type: "password",
            autoComplete: "new-password",
            required: true,
            hint: "Mindestens 8 Zeichen, mit Buchstabe und Zahl.",
          },
        ]}
      />
    </AuthShell>
  );
}

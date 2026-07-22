import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signUpAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Konto erstellen" };

export default function RegistrierenPage() {
  return (
    <AuthShell
      title="Konto erstellen"
      subtitle="5 Gratis-Anproben zum Ausprobieren — ohne Zahlungsdaten."
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

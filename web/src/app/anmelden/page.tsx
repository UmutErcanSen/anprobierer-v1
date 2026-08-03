import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signInAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Anmelden" };

// searchParams ist seit Next.js 16 ein Promise und muss awaited werden.
export default async function AnmeldenPage(props: PageProps<"/anmelden">) {
  const params = await props.searchParams;
  const hatBestaetigungsfehler = params.fehler === "bestaetigung";

  // Siehe registrieren/page.tsx: dieselbe Absicherung gegen tote Links auf
  // eine Auth-Seite, wenn schon eine Sitzung besteht.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/anzeige-erstellen");

  return (
    <AuthShell
      title="Willkommen zurück"
      subtitle="Melde dich an, um weiterzumachen."
      footer={
        <div className="flex flex-col gap-2">
          <span>
            Noch kein Konto?{" "}
            <Link href="/registrieren" className="text-ink underline underline-offset-4">
              Konto erstellen
            </Link>
          </span>
          <Link href="/passwort-vergessen" className="text-ink underline underline-offset-4">
            Passwort vergessen?
          </Link>
        </div>
      }
    >
      {hatBestaetigungsfehler && (
        <p role="alert" className="mb-5 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">
          Der Bestätigungslink ist abgelaufen oder wurde bereits verwendet.
          Melde dich an oder fordere einen neuen an.
        </p>
      )}

      <AuthForm
        action={signInAction}
        submitLabel="Anmelden"
        pendingLabel="Wird geprüft …"
        fields={[
          { name: "email", label: "E-Mail-Adresse", type: "email", autoComplete: "email", required: true },
          { name: "password", label: "Passwort", type: "password", autoComplete: "current-password", required: true },
        ]}
      />
    </AuthShell>
  );
}

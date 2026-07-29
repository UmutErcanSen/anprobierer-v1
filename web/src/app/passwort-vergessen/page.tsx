import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Passwort vergessen" };

// searchParams ist seit Next.js 16 ein Promise und muss awaited werden.
export default async function PasswortVergessenPage(props: PageProps<"/passwort-vergessen">) {
  const params = await props.searchParams;
  const istAbgelaufen = params.fehler === "abgelaufen";

  return (
    <AuthShell
      title="Passwort vergessen"
      subtitle="Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst."
      footer={
        <>
          Wieder eingefallen?{" "}
          <Link href="/anmelden" className="text-ink underline underline-offset-4">
            Zur Anmeldung
          </Link>
        </>
      }
    >
      {istAbgelaufen && (
        <p role="alert" className="mb-5 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-accent">
          Der Link ist abgelaufen oder wurde bereits verwendet. Fordere hier
          einen neuen an.
        </p>
      )}

      <AuthForm
        action={requestPasswordResetAction}
        submitLabel="Link anfordern"
        pendingLabel="Wird gesendet …"
        fields={[
          { name: "email", label: "E-Mail-Adresse", type: "email", autoComplete: "email", required: true },
        ]}
      />
    </AuthShell>
  );
}

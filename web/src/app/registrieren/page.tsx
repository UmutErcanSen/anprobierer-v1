import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signUpAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { BETA_AKTIV } from "@/lib/beta/config";

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

  /* Waehrend der geschlossenen Beta gibt es kein Formular -- die Seite bleibt
     aber erreichbar, damit bestehende Links und Lesezeichen nicht ins Leere
     laufen, sondern erklaeren, warum es gerade nicht weitergeht. Die
     eigentliche Sperre sitzt in signUpAction (siehe dort). */
  if (BETA_AKTIV) {
    return (
      <AuthShell
        title="Noch geschlossen"
        subtitle="Anprobierer befindet sich in einer geschlossenen Testphase."
        footer={
          <>
            Du hast bereits einen Testzugang?{" "}
            <Link href="/anmelden" className="text-ink underline underline-offset-4">
              Anmelden
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-ink-soft">
          <p>
            Neue Konten lassen sich derzeit nicht selbst anlegen. Wir testen mit einer kleinen, festen Gruppe, um
            Fehler zu finden, bevor der Dienst öffentlich wird.
          </p>
          <p>
            Wenn du dabei sein möchtest, schreib uns — wir schalten dich frei und melden uns mit deinen Zugangsdaten.
          </p>
        </div>
      </AuthShell>
    );
  }

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
      >
        {/* Pflicht-Einwilligung, bewusst NICHT vorangehakt: Art. 7 Abs. 2
            DSGVO verlangt eine aktive Handlung, ein voreingestelltes Haekchen
            waere keine wirksame Einwilligung. Der Zeitpunkt und die Fassung
            werden mitgespeichert (siehe lib/legal/consent.ts) -- ohne diesen
            Nachweis waere die Einwilligung im Streitfall wertlos. */}
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-ink"
          />
          <span>
            Ich habe die{" "}
            <Link
              href="/datenschutz"
              target="_blank"
              className="text-ink underline underline-offset-4 hover:text-accent"
            >
              Datenschutzerklärung
            </Link>{" "}
            gelesen und willige in die Verarbeitung meiner Fotos zur Erstellung der Anprobebilder ein.
            Die Einwilligung kann ich jederzeit widerrufen.
          </span>
        </label>
      </AuthForm>
    </AuthShell>
  );
}

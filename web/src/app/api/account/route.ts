import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';
import { lockedImagePath } from '@/lib/generation/lock';

/*
  Loescht das eigene Konto vollstaendig und unwiderruflich (DSGVO Art. 17).
  Bislang gab es dafuer nur den Umweg ueber eine manuelle E-Mail-Anfrage --
  rechtlich zulaessig, aber eben Handarbeit statt Selbstbedienung.

  Reihenfolge ist bewusst gewaehlt, nicht beliebig:

  1. Stripe-Abo zuerst kuendigen, BEVOR irgendetwas geloescht wird. Schlaegt
     das fehl, wird abgebrochen -- zu diesem Zeitpunkt ist noch nichts
     zerstoert, ein zweiter Versuch kostet nichts.
  2. Bildpfade aus generations lesen, SOLANGE die Zeilen noch existieren --
     nach Schritt 3 sind sie per Kaskade weg, und mit ihnen die einzige
     Information, welche Storage-Dateien ueberhaupt geloescht werden muessen.
  3. Den Auth-Nutzer loeschen -- der eigentliche Punkt ohne Ruecknahme.
     Kaskadiert per Fremdschluessel auf profiles/subscriptions/credit_ledger/
     generations (siehe supabase/migrations/20260721160000_initial_schema.sql).
  4. ERST DANACH die Ergebnisbilder aus dem Storage entfernen -- "best
     effort": Ist das Konto schon weg, ist ein hier haengen gebliebenes Bild
     eine Aufraeum-Aufgabe, kein kaputter Zustand fuer den Nutzer.
  5. Eigene Sitzung beenden, das Cookie muss trotz geloeschtem Nutzer aktiv
     geleert werden.
*/

export const runtime = 'nodejs';

type CardRow = { imagePath: string | null };

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });

  const admin = createAdminClient();

  // 1) Aktives Abo kuendigen.
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (
    subscription?.stripe_subscription_id &&
    ['active', 'trialing', 'past_due'].includes(subscription.status)
  ) {
    try {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    } catch (err) {
      console.error('[account] Stripe-Abo konnte nicht gekuendigt werden', user.id, err);
      return NextResponse.json(
        {
          error:
            'Dein Abo konnte nicht automatisch gekündigt werden. Bitte kündige zuerst über „Abo verwalten" und versuch es danach erneut.',
        },
        { status: 500 },
      );
    }
  }

  // 2) Bildpfade einsammeln, solange die Zeilen noch da sind.
  const { data: generations } = await admin
    .from('generations')
    .select('cards, result_paths')
    .eq('user_id', user.id);

  const paths = new Set<string>();
  for (const g of generations ?? []) {
    for (const c of (g.cards ?? []) as CardRow[]) if (c.imagePath) paths.add(c.imagePath);
    for (const p of g.result_paths ?? []) paths.add(p);
  }
  const allPaths = [...paths].flatMap((p) => [p, lockedImagePath(p)]);

  // 3) Der Punkt ohne Ruecknahme.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('[account] Konto konnte nicht geloescht werden', user.id, deleteError);
    return NextResponse.json({ error: 'Das Konto konnte nicht gelöscht werden. Bitte versuch es erneut.' }, { status: 500 });
  }

  // 4) Storage-Aufraeumen, best effort -- das Konto ist zu diesem Zeitpunkt
  // bereits geloescht, ein Fehler hier darf dem Nutzer nicht mehr angezeigt
  // werden (er bekaeme sonst einen Fehler fuer eine erfolgreich abgeschlossene
  // Loeschung).
  if (allPaths.length > 0) {
    const { error: removeError } = await admin.storage.from('results').remove(allPaths);
    if (removeError) console.error('[account] Loeschen der Ergebnisdateien fehlgeschlagen', user.id, removeError);
  }

  // 5) Sitzung beenden.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}

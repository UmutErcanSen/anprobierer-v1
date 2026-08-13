/*
  Legt ein Testkonto fuer die geschlossene Beta an -- oder setzt das Passwort
  eines bestehenden zurueck.

  Aufruf (aus dem web/-Verzeichnis):
    node --env-file=.env.local scripts/beta-konto.mjs test1@example.com "EinGutesPasswort"

  Warum ein Skript und kein Eintrag im Code: Zugangsdaten haben in einem
  Repository nichts verloren. E-Mail und Passwort kommen als Argumente, es
  wird nichts gespeichert und nichts committet.

  Das Konto wird direkt als BESTAETIGT angelegt (email_confirm), es geht also
  keine Bestaetigungsmail raus -- in einer geschlossenen Beta mit selbst
  vergebenen Zugaengen waere die nur ein zusaetzlicher Stolperstein.

  WICHTIG: Nach dem Anlegen muss die Adresse zusaetzlich in BETA_ALLOWLIST
  eingetragen werden. Ohne diesen Eintrag existiert das Konto zwar, die
  Anmeldung wird aber abgewiesen (siehe lib/beta/config.ts). Das Skript
  erinnert am Ende daran.
*/

import { createClient } from '@supabase/supabase-js';

const [email, passwort] = process.argv.slice(2);

if (!email || !passwort) {
  console.error('Aufruf: node --env-file=.env.local scripts/beta-konto.mjs <email> <passwort>');
  process.exit(1);
}
if (passwort.length < 8) {
  console.error('Das Passwort braucht mindestens 8 Zeichen (siehe lib/validation/auth.ts).');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt. --env-file=.env.local vergessen?');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

// Gibt es die Adresse schon? Dann nur das Passwort setzen, statt mit einem
// Fehler abzubrechen -- so laesst sich das Skript auch zum Zuruecksetzen
// vergessener Testzugaenge nutzen.
const { data: liste, error: listenFehler } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listenFehler) {
  console.error('Konnte bestehende Konten nicht lesen:', listenFehler.message);
  process.exit(1);
}

const vorhanden = liste.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (vorhanden) {
  const { error } = await admin.auth.admin.updateUserById(vorhanden.id, { password: passwort });
  if (error) {
    console.error('Passwort konnte nicht gesetzt werden:', error.message);
    process.exit(1);
  }
  console.log(`Bestehendes Konto ${email} -- Passwort neu gesetzt.`);
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: passwort,
    email_confirm: true,
    // Wird vom Trigger handle_new_user() ins Profil uebernommen und dort als
    // Einwilligungs-Nachweis gespeichert (siehe lib/legal/consent.ts).
    // Bewusst gesetzt: Auch Testende sollen einen sauberen Nachweis haben.
    user_metadata: { display_name: '', consent_version: 'beta-manuell' },
  });
  if (error) {
    console.error('Konto konnte nicht angelegt werden:', error.message);
    process.exit(1);
  }
  console.log(`Konto ${email} angelegt (bestaetigt, Gratis-Credits per Trigger).`);
}

console.log('');
console.log('NICHT VERGESSEN: Adresse in BETA_ALLOWLIST eintragen, sonst wird die Anmeldung abgewiesen.');
console.log(`  BETA_ALLOWLIST=${email}`);
console.log('  (mehrere Adressen mit Komma trennen)');

/**
 * Nebenläufigkeitstest für die Credit-Buchung — der wichtigste Test im Projekt.
 *
 * Läuft als echter Integrationstest gegen die entfernte Supabase-Datenbank,
 * weil genau das Zusammenspiel von Transaktion und Sperre geprüft werden soll —
 * das lässt sich nicht sinnvoll mocken. Es wird ein Wegwerf-Nutzer angelegt und
 * am Ende wieder gelöscht.
 *
 * Ausführen:  npm run test:credits
 */
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY nötig (node --env-file=.env.local).');
}

const admin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId: string;

async function balance(): Promise<number> {
  const { data, error } = await admin
    .from('credit_ledger')
    .select('delta')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + row.delta, 0);
}

before(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: `concurrency-${Date.now()}@example.test`,
    email_confirm: true,
  });
  if (error) throw error;
  userId = data.user.id;

  // Der handle_new_user-Trigger legt Profil + 5 Signup-Credits an. Für einen
  // sauberen Startwert erst leerräumen, dann exakt 10 gutschreiben.
  await admin.from('credit_ledger').delete().eq('user_id', userId);
  const { error: grantError } = await admin
    .from('credit_ledger')
    .insert({ user_id: userId, delta: 10, reason: 'manual_adjustment' });
  if (grantError) throw grantError;

  assert.equal(await balance(), 10, 'Startguthaben muss 10 sein');
});

after(async () => {
  if (userId) {
    // Löscht dank ON DELETE CASCADE auch Ledger und Generierungen mit.
    await admin.auth.admin.deleteUser(userId);
  }
});

test('20 gleichzeitige Standard-Buchungen: genau 10 gelingen, Guthaben nie negativ', async () => {
  const versuche = 20; // doppelt so viele wie Guthaben

  const ergebnisse = await Promise.allSettled(
    Array.from({ length: versuche }, () =>
      admin.rpc('spend_credits', {
        p_user_id: userId,
        p_mode: 'single',
        p_quality: 'standard', // kostet 1 Credit
      }),
    ),
  );

  // Ein „erfolgreicher" RPC-Call kann trotzdem einen fachlichen Fehler
  // (Guthaben reicht nicht) zurückgeben — der steckt dann in result.error.
  let erfolge = 0;
  let abgelehnt = 0;
  for (const e of ergebnisse) {
    if (e.status === 'fulfilled' && !e.value.error) erfolge++;
    else abgelehnt++;
  }

  assert.equal(erfolge, 10, 'Genau 10 Buchungen dürfen durchgehen');
  assert.equal(abgelehnt, 10, 'Die übrigen 10 müssen abgelehnt werden');

  const rest = await balance();
  assert.equal(rest, 0, 'Endguthaben muss exakt 0 sein');
  assert.ok(rest >= 0, 'Guthaben darf zu keinem Zeitpunkt negativ werden');
});

test('Rückerstattung ist idempotent', async () => {
  // Frisch 4 Credits, damit dieser Test unabhängig vom vorherigen ist.
  await admin.from('credit_ledger').insert({ user_id: userId, delta: 4, reason: 'manual_adjustment' });

  const { data: gen, error } = await admin.rpc('spend_credits', {
    p_user_id: userId,
    p_mode: 'single',
    p_quality: 'hd', // kostet 4
  });
  assert.ok(!error, 'HD-Buchung sollte gelingen');
  assert.equal(await balance(), 0, 'Nach der Buchung 0');

  const genId = gen.id;

  const erste = await admin.rpc('refund_generation', { p_generation_id: genId, p_error_message: 'Test' });
  assert.equal(erste.data, true, 'Erste Rückerstattung greift');
  assert.equal(await balance(), 4, 'Credits sind zurück');

  const zweite = await admin.rpc('refund_generation', { p_generation_id: genId });
  assert.equal(zweite.data, false, 'Zweite Rückerstattung tut nichts');
  assert.equal(await balance(), 4, 'Guthaben bleibt bei 4 — keine Vermehrung');
});

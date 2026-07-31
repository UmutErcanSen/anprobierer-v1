-- ============================================================================
-- KORREKTUR: fail_stale_generations() scheiterte vollstaendig
--
-- Befund vom 30.07.2026, beim Testen aufgefallen: Ein Aufruf der Funktion
-- endete mit
--
--     Direct deletion from storage tables is not allowed.
--     Use the Storage API instead.
--
-- Ursache ist der DSGVO-Aufraeumteil aus 20260727090000, der alte Uploads mit
-- `delete from storage.objects` entfernen wollte. Supabase unterbindet das per
-- Trigger -- Storage-Objekte duerfen ausschliesslich ueber die Storage-API
-- geloescht werden.
--
-- Die Auswirkung war weit groesser als ein liegengebliebenes Foto: Weil die
-- Ausnahme die GANZE Funktion abbrach, wurde auch der Teil davor nie
-- wirksam. Haengende Generierungen blieben also dauerhaft auf 'processing',
-- die zugehoerigen Credits wurden NIE zurueckgebucht -- und da die
-- Nebenlaeufigkeitsgrenze bei einer laufenden Generierung liegt, war der
-- betroffene Nutzer faktisch ausgesperrt: Jeder weitere Versuch scheiterte
-- mit "Du hast bereits eine Generierung laufen".
--
-- Genau dieser Zustand ist beim Testen eingetreten und hat die
-- Generierungstests blockiert.
--
-- Diese Migration entfernt den Storage-Teil. Die Rueckbuchung -- der
-- eigentliche Zweck -- bleibt unveraendert und funktioniert damit wieder.
--
-- Die Upload-Bereinigung ist NICHT vergessen, sondern verschoben: Sie gehoert
-- an eine Stelle mit Zugriff auf die Storage-API. process.ts raeumt die
-- Uploads am Ende eines Laufs bereits selbst weg (siehe dort
-- `storage.from('uploads').remove(...)`), sodass nur Abbrueche Reste
-- hinterlassen. Fuer diese Reste braucht es einen eigenen Weg, z.B. einen
-- kleinen Aufraeum-Endpunkt oder eine Edge Function.
-- ============================================================================

create or replace function public.fail_stale_generations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Haengende Jobs beenden und Credits zurueckbuchen. refund_generation ist
  -- idempotent (prueft auf einen bereits vorhandenen generation_refund),
  -- ein Doppelaufruf schadet also nicht.
  for v_id in
    select id
    from public.generations
    where status in ('queued', 'processing')
      and created_at < now() - interval '10 minutes'
  loop
    perform public.refund_generation(
      v_id,
      'Zeitüberschreitung — die Generierung wurde abgebrochen und die Credits zurückgebucht.'
    );
  end loop;
end;
$$;

revoke all on function public.fail_stale_generations from public, anon, authenticated;
grant execute on function public.fail_stale_generations to service_role;

-- Sofort einmal ausfuehren, damit bereits haengende Jobs aus der Zeit vor
-- dieser Korrektur nicht bis zum naechsten Cron-Lauf blockieren.
select public.fail_stale_generations();

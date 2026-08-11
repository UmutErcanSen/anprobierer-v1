-- ===========================================================================
-- Rate-Limits fuer teure Endpunkte ausserhalb der Bildgenerierung
--
-- Bisher schuetzte rateLimitError() (lib/generation/rate-limit.ts) allein
-- POST /api/generate. Ungeschuetzt blieben Endpunkte, die zwar keine
-- OpenAI-Kosten ausloesen, aber trotzdem teuer sind:
--
--   /api/account/export  Liest ALLE Generierungen des Kontos, signiert JEDE
--                        Bild-URL, der Client laedt anschliessend jede Datei
--                        herunter. Ohne Obergrenze und ohne Paginierung. Bei
--                        500 Anproben sind das 500 signierte URLs und rund
--                        1,6 GB Egress -- pro Aufruf. In einer Schleife
--                        aufgerufen ist das eine Kostenwaffe, fuer die ein
--                        gueltiger Login genuegt.
--   /api/stripe/checkout Erzeugt bei jedem Aufruf ein Objekt bei Stripe.
--   /api/stripe/portal   dito.
--
-- Bewusst eine Tabelle statt Redis: Die App hat heute keinen Cache-Dienst,
-- und einen einzufuehren waere fuer drei Endpunkte unverhaeltnismaessig --
-- zumal die Zaehlung ohnehin nur pro Nutzer und Stunde erfolgt. Genau dieses
-- Muster nutzt die Generierungs-Begrenzung bereits erfolgreich gegen die
-- generations-Tabelle.
--
-- DSGVO-Hinweis zum Export: Art. 15 verlangt Auskunft "unverzueglich", nicht
-- "beliebig oft". Eine Begrenzung auf wenige Ausfuehrungen pro Stunde ist
-- ausdruecklich zulaessig -- ein Nutzer, der sein Archiv einmal herunterlaedt,
-- merkt davon nichts.
-- ===========================================================================

create table if not exists public.aktions_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  aktion     text not null,
  created_at timestamptz not null default now()
);

comment on table public.aktions_log is
  'Zaehler fuer Rate-Limits ausserhalb der Bildgenerierung. Enthaelt bewusst KEINE Nutzdaten -- nur wer wann welche Aktion angestossen hat.';

-- Genau der Zugriffspfad der Pruefung: (Nutzer, Aktion, Zeitfenster).
create index if not exists aktions_log_lookup_idx
  on public.aktions_log (user_id, aktion, created_at desc);

-- RLS an, bewusst OHNE Policy: Weder 'anon' noch 'authenticated' kommen an
-- die Zeilen. Geschrieben und gelesen wird ausschliesslich serverseitig mit
-- dem service_role-Schluessel, der RLS umgeht. Duerfte der Nutzer selbst
-- schreiben, waere das Limit trivial zu umgehen (Zeilen loeschen).
alter table public.aktions_log enable row level security;


-- ---------------------------------------------------------------------------
-- Pruefen und Zaehlen in EINEM Schritt.
--
-- Warum zusammen: Getrennt (erst zaehlen, dann eintragen) entsteht ein
-- Wettlauf -- zwei gleichzeitige Anfragen lesen beide denselben Stand unter
-- dem Limit und lassen beide durch. Derselbe Advisory-Lock-Schluessel wie in
-- spend_credits/upsert_subscription serialisiert das je Nutzer.
--
-- Rueckgabe: true = erlaubt (und gezaehlt), false = Limit erreicht.
-- ---------------------------------------------------------------------------
create or replace function public.aktion_erlaubt(
  p_user_id    uuid,
  p_aktion     text,
  p_pro_stunde integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anzahl integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into v_anzahl
    from public.aktions_log
   where user_id = p_user_id
     and aktion = p_aktion
     and created_at > now() - interval '1 hour';

  if v_anzahl >= p_pro_stunde then
    return false;
  end if;

  insert into public.aktions_log (user_id, aktion) values (p_user_id, p_aktion);
  return true;
end;
$$;

revoke all on function public.aktion_erlaubt(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.aktion_erlaubt(uuid, text, integer) to service_role;


-- ---------------------------------------------------------------------------
-- Aufraeumen: Eintraege aelter als 24 Stunden sind fuer ein Stundenfenster
-- wertlos. Ohne das waechst die Tabelle unbegrenzt -- kein akutes Problem,
-- aber genau die Art Altlast, die man Jahre spaeter teuer bemerkt.
-- Haengt sich an den bestehenden minuetlichen Cron statt einen zweiten
-- anzulegen; das Loeschen betrifft eine normale Tabelle und funktioniert
-- deshalb aus SQL heraus problemlos (anders als bei storage.objects).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('aktions-log-aufraeumen')
    where exists (select 1 from cron.job where jobname = 'aktions-log-aufraeumen');

    perform cron.schedule(
      'aktions-log-aufraeumen',
      '23 4 * * *',
      $cron$ delete from public.aktions_log where created_at < now() - interval '24 hours'; $cron$
    );
  end if;
end;
$$;

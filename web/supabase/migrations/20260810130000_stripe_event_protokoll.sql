-- ===========================================================================
-- Protokoll aller eingehenden Stripe-Events.
--
-- Anlass: Bei einem echten Testkonto hatte Stripe kassiert, waehrend in
-- Supabase weiterhin 'free' stand -- und niemand konnte im Nachhinein sagen,
-- ob das Event nie ankam, oder ankam und still scheiterte. Der Handler
-- protokollierte Fehler ausschliesslich per console.error und antwortete
-- trotzdem mit 200; Stripe wertete das als Erfolg und wiederholte NICHT.
--
-- Diese Tabelle macht beide Faelle unterscheidbar:
--   Zeile fehlt          -> Event ist nie angekommen (Zustellproblem)
--   Zeile mit 'failed'   -> Event kam an, Verarbeitung scheiterte
--
-- Bewusst schlank: nur Kennung, Typ, Status, Fehlertext. KEINE vollstaendige
-- Event-Nutzlast -- die enthaelt Kunden- und Zahlungsdaten und gehoert nicht
-- ohne Not in eine zweite Datenbank (Datensparsamkeit, Art. 5 Abs. 1 lit. c
-- DSGVO). Fuer die Fehlersuche genuegt die Event-ID: das vollstaendige Event
-- liegt ohnehin dauerhaft im Stripe-Dashboard.
-- ===========================================================================

create table if not exists public.stripe_events (
  -- Die Stripe-Event-ID ist bereits eindeutig -- als Primaerschluessel
  -- verhindert sie nebenbei doppelte Zeilen bei Stripes Wiederholungen.
  id             text primary key,
  type           text not null,
  -- received  = angekommen, Verarbeitung laeuft/lief an
  -- processed = erfolgreich abgeschlossen
  -- ignored   = bewusst nicht verarbeitet (Event-Typ interessiert uns nicht)
  -- failed    = Verarbeitung gescheitert, Stripe wiederholt
  status         text not null default 'received'
                 check (status in ('received', 'processed', 'ignored', 'failed')),
  error_message  text,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz
);

create index if not exists stripe_events_status_idx
  on public.stripe_events (status, received_at desc);

-- RLS an, aber bewusst OHNE jede Policy: Damit kommt weder 'anon' noch
-- 'authenticated' an die Zeilen -- nur der Server (service_role, umgeht RLS).
-- Betriebsdaten gehen Endnutzer nichts an.
alter table public.stripe_events enable row level security;

comment on table public.stripe_events is
  'Zustellungs- und Verarbeitungsprotokoll der Stripe-Webhooks. Nur fuer den Betreiber (service_role).';


-- ---------------------------------------------------------------------------
-- Auswertung fuer den Betreiber (siehe supabase/AUSWERTUNGEN.md).
-- Liegt im admin-Schema, das nicht ueber die REST-API erreichbar ist.
-- ---------------------------------------------------------------------------

create or replace view admin.webhook_fehler as
select
  id            as event_id,
  type          as event_typ,
  status,
  error_message as fehler,
  received_at   as angekommen_am,
  processed_at  as verarbeitet_am
from public.stripe_events
where status = 'failed'
order by received_at desc;

comment on view admin.webhook_fehler is
  'Stripe-Events, deren Verarbeitung gescheitert ist. SOLLTE IMMER LEER SEIN -- jede Zeile bedeutet: Zahlung erfolgt, Zustand in der App womoeglich nicht aktualisiert.';

revoke all on admin.webhook_fehler from anon, authenticated;
grant select on admin.webhook_fehler to service_role;

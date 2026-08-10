-- ===========================================================================
-- Geplanter Tarifwechsel sichtbar machen
--
-- Befund: Ein Nutzer stufte im Stripe-Kundenportal von Pro auf Basic zurueck.
-- Das Portal bestaetigte, in der App aenderte sich nichts -- er versuchte es
-- daraufhin VIERMAL in 31 Sekunden (nachvollziehbar im stripe_events-
-- Protokoll). Alle Events wurden dabei fehlerfrei verarbeitet.
--
-- Es war auch kein Fehler: Stripe legt eine Herabstufung korrekt auf das ENDE
-- der bezahlten Periode (ueber ein subscription_schedule). Bis dahin behaelt
-- der Kunde den hoeheren Tarif -- er hat ihn ja bezahlt. Der Webhook spiegelt
-- folglich weiterhin den AKTUELL gueltigen Tarif, und das ist richtig.
--
-- Falsch war allein die Anzeige: Nirgends stand, dass ein Wechsel ansteht.
-- Aus Nutzersicht ist "ich habe etwas geaendert und es passiert nichts" nicht
-- von einem kaputten Bezahlvorgang zu unterscheiden -- im besten Fall
-- entstehen Support-Anfragen, im schlechteren kuendigt jemand ganz.
--
-- Diese Migration ergaenzt die beiden Felder, die dafuer fehlen. Sie
-- beschreiben ausdruecklich die ZUKUNFT und aendern nichts an der
-- Freischaltung: profiles.plan bleibt der aktuell gueltige Tarif.
-- ===========================================================================

alter table public.subscriptions
  add column if not exists scheduled_plan      public.plan_key,
  add column if not exists scheduled_change_at timestamptz;

comment on column public.subscriptions.scheduled_plan is
  'Tarif, auf den zum Periodenende gewechselt wird (Stripe subscription_schedule). NULL = kein Wechsel geplant. Aendert NICHTS an der Freischaltung -- dafuer zaehlt weiterhin profiles.plan.';
comment on column public.subscriptions.scheduled_change_at is
  'Zeitpunkt, zu dem scheduled_plan wirksam wird -- in aller Regel das Ende der laufenden Abrechnungsperiode.';


-- ---------------------------------------------------------------------------
-- upsert_subscription um die beiden Felder erweitern.
--
-- Bewusst mit Vorgabewerten (default null): Der Kuendigungs-Zweig im Webhook
-- ruft die Funktion weiterhin mit sieben Argumenten auf -- dort gibt es
-- naturgemaess keinen geplanten Wechsel mehr. Ohne Vorgabewerte muesste jeder
-- Aufrufer angepasst werden, nur um zweimal NULL zu uebergeben.
--
-- Die alte Fassung MUSS vorher weg. `create or replace` legt bei einer
-- geaenderten Argumentliste keine neue Fassung an, sondern eine zusaetzliche
-- UEBERLADUNG -- und ein Aufruf mit sieben Argumenten passte danach auf
-- beide (die neue via Vorgabewerte). Postgres bricht so einen Aufruf mit
-- "function is not unique" ab; der Webhook waere ab dem naechsten Event
-- vollstaendig kaputtgegangen. Genau das ist beim ersten Einspielen dieser
-- Migration passiert und deshalb hier ausdruecklich festgehalten.
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_subscription(
  uuid, public.plan_key, public.subscription_status, text, text, timestamptz, boolean
);

create or replace function public.upsert_subscription(
  p_user_id                uuid,
  p_plan                   public.plan_key,
  p_status                 public.subscription_status,
  p_stripe_customer_id     text,
  p_stripe_subscription_id text,
  p_current_period_end     timestamptz,
  p_cancel_at_period_end   boolean,
  p_scheduled_plan         public.plan_key   default null,
  p_scheduled_change_at    timestamptz       default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Derselbe Lock-Schluessel wie spend_credits/refund_generation: verhindert,
  -- dass ein Abo-Wechsel und eine laufende Generierung sich fuer denselben
  -- Nutzer ueberholen.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  insert into public.subscriptions (
    user_id, plan, status, stripe_customer_id, stripe_subscription_id,
    current_period_end, cancel_at_period_end, scheduled_plan,
    scheduled_change_at, updated_at
  )
  values (
    p_user_id, p_plan, p_status, p_stripe_customer_id, p_stripe_subscription_id,
    p_current_period_end, p_cancel_at_period_end, p_scheduled_plan,
    p_scheduled_change_at, now()
  )
  on conflict (user_id) do update set
    plan                   = excluded.plan,
    status                 = excluded.status,
    stripe_customer_id     = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_end     = excluded.current_period_end,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    -- Wird bei JEDEM Event neu gesetzt, auch auf NULL: Nimmt der Nutzer die
    -- Herabstufung im Portal zurueck (subscription_schedule.released), muss
    -- der Hinweis wieder verschwinden -- sonst zeigte die App dauerhaft einen
    -- Wechsel an, den es nicht mehr gibt.
    scheduled_plan         = excluded.scheduled_plan,
    scheduled_change_at    = excluded.scheduled_change_at,
    updated_at             = now();

  -- profiles.plan ist die einzige Stelle, die die App fuer Freischaltungen
  -- (Qualitaet, Bildanzahl, Ergebnis-Sperre) liest -- muss synchron bleiben.
  -- Bewusst NICHT der geplante Tarif: Bis zum Periodenende gilt der bezahlte.
  update public.profiles set plan = p_plan, updated_at = now() where id = p_user_id;
end;
$$;

-- Argumentliste ausgeschrieben: Ohne sie schlaegt schon das blosse
-- revoke/grant mit "function name is not unique" fehl, sobald irgendwann eine
-- zweite Ueberladung existiert.
revoke all on function public.upsert_subscription(
  uuid, public.plan_key, public.subscription_status, text, text, timestamptz, boolean,
  public.plan_key, timestamptz
) from public, anon, authenticated;

grant execute on function public.upsert_subscription(
  uuid, public.plan_key, public.subscription_status, text, text, timestamptz, boolean,
  public.plan_key, timestamptz
) to service_role;

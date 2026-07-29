-- ============================================================================
-- Stripe-Anbindung (Sandbox): Abo aktivieren, Credits gutschreiben, Kuendigung
--
-- Die Tabellen subscriptions/credit_ledger und der Unique-Index auf
-- credit_ledger.stripe_event_id existieren bereits seit dem Ausgangsschema
-- (20260721160000) -- sie waren als Zielbild fuer genau diesen Schritt
-- angelegt, wurden aber bisher nie beschrieben. Diese Migration liefert die
-- zwei Funktionen, die der Stripe-Webhook-Handler aufruft. Beide sind
-- ausschliesslich fuer service_role ausfuehrbar, exakt wie spend_credits/
-- refund_generation -- der Browser sieht Stripe-Ereignisse nie, nur der
-- serverseitige Webhook-Handler mit dem Admin-Client.
--
-- Zwei Funktionen statt einer:
--   upsert_subscription        -- Bestandsdaten spiegeln (Plan/Status/IDs),
--                                  bei JEDEM subscription.*-Event aufgerufen
--   grant_subscription_credits -- Credits gutschreiben, NUR bei invoice.paid,
--                                  idempotent ueber den vorhandenen Unique-
--                                  Index auf stripe_event_id
--
-- Getrennt, weil subscription.updated aus vielen Gruenden feuert (z.B.
-- "cancel_at_period_end" umschalten), aber nur invoice.paid tatsaechlich
-- eine bezahlte Periode bestaetigt. Wuerde man stattdessen bei jedem
-- subscription-Event Credits gutschreiben, koennte ein einziger Kauf mehrfach
-- Credits ausloesen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- upsert_subscription: Stripe-Bestand nach profiles/subscriptions spiegeln
-- ---------------------------------------------------------------------------
create or replace function public.upsert_subscription(
  p_user_id                uuid,
  p_plan                   public.plan_key,
  p_status                 public.subscription_status,
  p_stripe_customer_id     text,
  p_stripe_subscription_id text,
  p_current_period_end     timestamptz,
  p_cancel_at_period_end   boolean
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
    current_period_end, cancel_at_period_end, updated_at
  )
  values (
    p_user_id, p_plan, p_status, p_stripe_customer_id, p_stripe_subscription_id,
    p_current_period_end, p_cancel_at_period_end, now()
  )
  on conflict (user_id) do update set
    plan                   = excluded.plan,
    status                 = excluded.status,
    stripe_customer_id     = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_end     = excluded.current_period_end,
    cancel_at_period_end    = excluded.cancel_at_period_end,
    updated_at              = now();

  -- profiles.plan ist die einzige Stelle, die die App fuer Freischaltungen
  -- (Qualitaet, Bildanzahl, Ergebnis-Sperre) liest -- muss synchron bleiben.
  update public.profiles set plan = p_plan, updated_at = now() where id = p_user_id;
end;
$$;

revoke all on function public.upsert_subscription from public, anon, authenticated;
grant execute on function public.upsert_subscription to service_role;

-- ---------------------------------------------------------------------------
-- grant_subscription_credits: Credits fuer eine bezahlte Rechnung gutschreiben
--
-- Idempotenz ueber den bereits vorhandenen partiellen Unique-Index
-- credit_ledger_stripe_event_uniq (where stripe_event_id is not null): liefert
-- Stripe dasselbe invoice.paid-Event doppelt zu (garantiert kein Einzelfall,
-- sondern Teil des Protokolls), schlaegt der zweite Insert still fehl statt
-- doppelt gutzuschreiben. Rueckgabewert zeigt dem Handler, ob tatsaechlich neu
-- gebucht wurde (fuers Logging, keine Fehlerbedingung).
-- ---------------------------------------------------------------------------
create or replace function public.grant_subscription_credits(
  p_user_id         uuid,
  p_credits         integer,
  p_stripe_event_id text,
  p_note            text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_credits <= 0 then
    raise exception 'Ungueltige Credit-Menge: %', p_credits using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  insert into public.credit_ledger (user_id, delta, reason, stripe_event_id, note)
  values (p_user_id, p_credits, 'subscription_grant', p_stripe_event_id, p_note)
  on conflict (stripe_event_id) where stripe_event_id is not null do nothing;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.grant_subscription_credits from public, anon, authenticated;
grant execute on function public.grant_subscription_credits to service_role;

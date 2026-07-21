-- ============================================================================
-- Initiales Datenmodell
--
-- Grundsatz: Row Level Security ist auf JEDER Tabelle aktiv und wird von
-- Anfang an mitgeschrieben. Bei Firestore kam die Absicherung nachträglich,
-- und die Datenbank stand wochenlang offen. Das wiederholen wir nicht.
--
-- Merkregel für alle Policies unten: Der Client darf lesen, was ihm gehört.
-- Geschrieben wird alles, was Geld kostet oder Geld bedeutet, ausschliesslich
-- serverseitig über den service_role-Key (der RLS umgeht).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Aufzählungstypen
-- ---------------------------------------------------------------------------

create type public.plan_key as enum ('free', 'starter', 'pro');

create type public.subscription_status as enum (
  'active', 'trialing', 'past_due', 'canceled', 'incomplete'
);

create type public.generation_mode as enum ('single', 'combined');

-- 'standard' kostet 1 Credit, 'hd' kostet 4. Siehe Preismodell im Plan.
create type public.image_quality as enum ('standard', 'hd');

create type public.generation_status as enum (
  'queued', 'processing', 'succeeded', 'failed', 'canceled'
);

-- Warum sich der Kontostand geändert hat. Macht jede Buchung nachvollziehbar.
create type public.ledger_reason as enum (
  'signup_bonus',      -- einmalige Gratis-Credits bei Registrierung
  'subscription_grant',-- monatliche Gutschrift aus dem Abo
  'topup_purchase',    -- gekauftes Credit-Paket
  'generation_charge', -- Verbrauch (negativ)
  'generation_refund', -- Rückbuchung nach fehlgeschlagenem Job (positiv)
  'manual_adjustment'  -- Kulanz/Support per Hand
);

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: updated_at automatisch pflegen
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — 1:1 zu auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 100),
  plan          public.plan_key not null default 'free',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.profiles.plan is
  'Gespiegelt aus subscriptions für schnelle Abfragen. Einzige Wahrheitsquelle ist der Stripe-Webhook.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Eigenes Profil lesen"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Eigenes Profil aendern"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Die Policy oben regelt WELCHE ZEILE geändert werden darf. Welche SPALTEN
-- geändert werden dürfen, regeln Spaltenrechte — RLS kann das nicht.
-- Ohne diese beiden Zeilen könnte sich jeder Nutzer selbst auf 'pro' setzen.
-- Genau diese Lücke machte das alte Abo-System wirkungslos: zwei Zeilen in
-- der Browserkonsole genügten für einen unbegrenzten Account.
revoke update on public.profiles from authenticated;
grant  update (display_name) on public.profiles to authenticated;

-- Profil automatisch anlegen, sobald sich jemand registriert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));

  -- Einmalige Gratis-Credits. Bewusst nicht monatlich wiederkehrend,
  -- sonst sind Wegwerf-Accounts eine kostenlose Bildfabrik.
  insert into public.credit_ledger (user_id, delta, reason)
  values (new.id, 5, 'signup_bonus');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- subscriptions — Spiegel des Stripe-Zustands
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  plan                   public.plan_key not null default 'free',
  status                 public.subscription_status not null default 'active',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Nur lesen. Geschrieben wird ausschliesslich vom Stripe-Webhook.
create policy "Eigenes Abo lesen"
  on public.subscriptions for select
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- credit_ledger — append-only Buchungsjournal
--
-- Der Kontostand ist KEIN überschreibbares Feld, sondern die Summe aller
-- Buchungen. Damit ist jede Veränderung nachvollziehbar und ein verlorener
-- oder doppelter Schreibvorgang fällt auf, statt still Geld zu kosten.
-- ---------------------------------------------------------------------------

create table public.credit_ledger (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  delta           integer not null check (delta <> 0),
  reason          public.ledger_reason not null,
  generation_id   uuid,
  stripe_event_id text,
  note            text check (char_length(note) <= 500),
  created_at      timestamptz not null default now()
);

-- Verhindert, dass ein doppelt zugestelltes Stripe-Event zweimal gutschreibt.
create unique index credit_ledger_stripe_event_uniq
  on public.credit_ledger (stripe_event_id)
  where stripe_event_id is not null;

create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;

-- Ausschliesslich SELECT. Kein insert/update/delete für Clients — auch nicht
-- für die eigenen Zeilen. Wer Credits buchen könnte, könnte sich beschenken.
create policy "Eigene Buchungen lesen"
  on public.credit_ledger for select
  using ((select auth.uid()) = user_id);

-- Kontostand als View. security_invoker sorgt dafür, dass die RLS-Regel der
-- darunterliegenden Tabelle greift — jeder sieht nur seinen eigenen Stand.
create view public.credit_balances
with (security_invoker = true) as
  select user_id, coalesce(sum(delta), 0)::integer as balance
  from public.credit_ledger
  group by user_id;

-- ---------------------------------------------------------------------------
-- generations — ein Datensatz pro Bildgenerierung
-- ---------------------------------------------------------------------------

create table public.generations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  status            public.generation_status not null default 'queued',
  mode              public.generation_mode not null,
  quality           public.image_quality not null,
  credits_charged   integer not null check (credits_charged >= 0),
  clothing_type     text check (char_length(clothing_type) <= 60),
  notes             text check (char_length(notes) <= 2000),
  person_image_path text,
  result_paths      text[] not null default '{}',
  sale_text         text check (char_length(sale_text) <= 20000),
  -- Kostenerfassung pro Job. Grundlage für das spätere Admin-Dashboard und
  -- die Frage, ob das Preismodell trägt.
  model             text,
  cost_usd          numeric(10, 5),
  error_message     text,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

comment on column public.generations.result_paths is
  'Pfade in Supabase Storage. Die Ergebnisse werden dauerhaft gespeichert — in der Altanwendung gingen sie beim Schliessen des Tabs verloren.';

create index generations_user_idx on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

-- Nur lesen. Angelegt und aktualisiert wird serverseitig, zusammen mit der
-- Credit-Abbuchung in derselben Transaktion.
create policy "Eigene Generierungen lesen"
  on public.generations for select
  using ((select auth.uid()) = user_id);

-- Löschen darf der Nutzer (DSGVO Art. 17 und schlicht Aufräumen).
create policy "Eigene Generierungen loeschen"
  on public.generations for delete
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- usage_events — Grundlage für Rate-Limits und Missbrauchserkennung
-- ---------------------------------------------------------------------------

create table public.usage_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) <= 60),
  ip_hash    text,
  created_at timestamptz not null default now()
);

comment on column public.usage_events.ip_hash is
  'Gehashte IP, nicht die IP selbst — Datensparsamkeit nach DSGVO Art. 5.';

create index usage_events_user_idx on public.usage_events (user_id, created_at desc);
create index usage_events_ip_idx on public.usage_events (ip_hash, created_at desc);

alter table public.usage_events enable row level security;
-- Absichtlich KEINE Policy: Clients haben hier keinerlei Zugriff.
-- Nur der Server (service_role) schreibt und liest.

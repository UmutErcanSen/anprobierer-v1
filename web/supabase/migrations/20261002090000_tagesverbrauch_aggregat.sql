-- Tagesverbrauch an Credits als SQL-Aggregat statt als Summe in JavaScript.
--
-- Vorher las lib/generation/rate-limit.ts ALLE generations-Zeilen der letzten
-- 24 Stunden mit ihrer credits_charged-Spalte aus und summierte sie im
-- Node-Prozess -- und zwar VOR JEDER einzelnen Generierung. Bei einem
-- Testnutzer sind das ein paar Zeilen. Bei tausend aktiven Nutzern waeren es
-- zehntausende Zeilen pro Anfrage, nur um eine einzige Zahl zu erhalten.
--
-- Das ist genau die Art Engpass, die erst auffaellt, wenn es wehtut: Die
-- Notbremse gegen zu hohe Kosten wuerde selbst zum Kostentreiber.
--
-- Postgres kann die Summe ohne jede Datenuebertragung bilden.

create index if not exists generations_created_at_idx
  on public.generations (created_at desc);

comment on index public.generations_created_at_idx is
  'Fuer das Tagesbudget: Zeitfenster-Aggregat ueber ALLE Nutzer. Der vorhandene generations_user_idx beginnt mit user_id und hilft einer nutzeruebergreifenden Abfrage nicht.';

create or replace function public.tagesverbrauch_credits()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(sum(credits_charged), 0)::integer
  from public.generations
  where created_at >= now() - interval '24 hours';
$$;

comment on function public.tagesverbrauch_credits() is
  'Summe der in den letzten 24 h abgebuchten Credits ueber ALLE Nutzer -- Grundlage fuer DAILY_CREDIT_BUDGET in lib/generation/rate-limit.ts.';

-- Ausschliesslich fuer den Server. Der Wert ist eine Betriebskennzahl des
-- BETREIBERS (wie viel kostet der Dienst heute) und geht Nutzer nichts an --
-- security definer wuerde sie sonst jedem Angemeldeten zugaenglich machen,
-- obwohl Row Level Security ihm sonst nur die eigenen Zeilen zeigt.
revoke execute on function public.tagesverbrauch_credits() from public, anon, authenticated;
grant execute on function public.tagesverbrauch_credits() to service_role;

-- ============================================================================
-- Auswertungs-Views fuer den Betreiber
--
-- SICHERHEIT, der wichtigste Punkt an dieser Migration:
-- Die Views liegen bewusst im Schema `admin` und NICHT in `public`. Supabase
-- stellt `public` automatisch ueber die REST-API bereit -- eine Auswertung
-- dort waere fuer jeden angemeldeten Nutzer abrufbar, inklusive fremder
-- E-Mail-Adressen und Umsaetze. Das Schema `admin` steht nicht in der
-- API-Konfiguration und ist damit ueber HTTP gar nicht erreichbar.
--
-- Zusaetzlich wird jedes Recht fuer anon und authenticated ausdruecklich
-- entzogen. Zwei Sperren statt einer, weil ein spaeteres Freischalten von
-- Schemata in den Projekteinstellungen sonst unbemerkt alles oeffnen wuerde.
--
-- Abfragbar sind die Views damit nur im Supabase-SQL-Editor (laeuft als
-- privilegierter Nutzer) oder mit dem service_role-Schluessel.
--
-- Beispiel:  select * from admin.nutzer order by kosten_usd desc;
-- ============================================================================

create schema if not exists admin;

revoke all on schema admin from anon, authenticated;
grant usage on schema admin to service_role;

-- ---------------------------------------------------------------------------
-- 1) Was kostet uns ein Credit wirklich?
--
-- Nur ECHTE Aufrufe: Testlaeufe ueber den Mock-Server liefern bewusst kein
-- usage und damit cost_usd = null (siehe e2e/mock-openai.mjs). Ohne diesen
-- Filter mischten sich erfundene Zahlen unter die gemessenen.
-- ---------------------------------------------------------------------------
create or replace view admin.kosten as
select
  quality                                             as qualitaet,
  count(*)                                            as generierungen,
  sum(credits_charged)                                as credits,
  round(sum(cost_usd)::numeric, 4)                    as kosten_usd,
  round((sum(cost_usd) / nullif(sum(credits_charged), 0))::numeric, 4)
                                                      as usd_je_credit,
  round((sum(cost_usd) / nullif(count(*), 0))::numeric, 4)
                                                      as usd_je_generierung
from public.generations
where cost_usd is not null
  and cost_usd > 0
group by quality;

-- ---------------------------------------------------------------------------
-- 2) Nutzeruebersicht: Wer verursacht welche Kosten?
-- ---------------------------------------------------------------------------
create or replace view admin.nutzer as
select
  u.email,
  p.plan                                              as tarif,
  s.status                                            as abo_status,
  s.current_period_end                                as naechste_abrechnung,
  coalesce(b.balance, 0)                              as guthaben,
  count(g.id)                                         as generierungen,
  count(g.id) filter (where g.status = 'failed')      as fehlgeschlagen,
  coalesce(sum(g.credits_charged), 0)                 as credits_verbraucht,
  round(coalesce(sum(g.cost_usd), 0)::numeric, 4)     as kosten_usd,
  u.created_at                                        as registriert_am,
  max(g.created_at)                                   as zuletzt_aktiv
from auth.users u
left join public.profiles p        on p.id = u.id
left join public.subscriptions s   on s.user_id = u.id
left join public.credit_balances b on b.user_id = u.id
left join public.generations g     on g.user_id = u.id
group by u.id, u.email, u.created_at, p.plan, s.status, s.current_period_end, b.balance;

-- ---------------------------------------------------------------------------
-- 3) Tagesverlauf: Nutzung, Kosten, Fehlerquote
--
-- Die Fehlerquote ist die Zahl, die man taeglich anschauen sollte: Steigt sie,
-- stimmt etwas mit der Bildgenerierung nicht -- und zwar bevor sich Nutzer
-- beschweren.
-- ---------------------------------------------------------------------------
create or replace view admin.tage as
select
  date(created_at)                                    as tag,
  count(*)                                            as generierungen,
  count(distinct user_id)                             as aktive_nutzer,
  sum(credits_charged)                                as credits,
  round(coalesce(sum(cost_usd), 0)::numeric, 4)       as kosten_usd,
  count(*) filter (where status = 'failed')           as fehlgeschlagen,
  round(
    100.0 * count(*) filter (where status = 'failed') / nullif(count(*), 0),
    1
  )                                                   as fehlerquote_prozent
from public.generations
group by date(created_at)
order by tag desc;

-- ---------------------------------------------------------------------------
-- 4) Haengende Jobs -- die stille Fehlerquelle
--
-- Genau hier ist am 30.07. ein Fehler wochenlang unbemerkt geblieben: Der
-- Aufraeum-Job scheiterte, Generierungen blieben auf 'processing', und weil
-- die Nebenlaeufigkeitsgrenze bei einer liegt, waren betroffene Nutzer
-- dauerhaft ausgesperrt. Steht hier je etwas aelter als 10 Minuten, laeuft
-- der Cron nicht richtig.
-- ---------------------------------------------------------------------------
create or replace view admin.haengende_jobs as
select
  g.id,
  u.email,
  g.status,
  g.created_at,
  round(extract(epoch from (now() - g.created_at)) / 60)::int as alter_minuten,
  g.credits_charged                                            as blockierte_credits
from public.generations g
join auth.users u on u.id = g.user_id
where g.status in ('queued', 'processing')
order by g.created_at;

-- ---------------------------------------------------------------------------
-- 5) Abos: Wiederkehrender Umsatz
--
-- Preise bewusst als CASE statt aus einer Tabelle: Sie stehen ohnehin im Code
-- (components/pricing/plans-data.ts) und aendern sich selten. Eine zweite
-- Quelle waere eine Gelegenheit, dass beide auseinanderlaufen.
-- ---------------------------------------------------------------------------
create or replace view admin.abos as
select
  s.plan                                              as tarif,
  s.status,
  count(*)                                            as anzahl,
  count(*) filter (where s.cancel_at_period_end)      as gekuendigt_zum_periodenende,
  sum(case s.plan when 'basic' then 9.99 when 'pro' then 19.99 else 0 end)
                                                      as brutto_eur_monatlich
from public.subscriptions s
group by s.plan, s.status;

-- Zugriff ausschliesslich fuer service_role -- siehe Sicherheitshinweis oben.
revoke all on all tables in schema admin from anon, authenticated;
grant select on all tables in schema admin to service_role;

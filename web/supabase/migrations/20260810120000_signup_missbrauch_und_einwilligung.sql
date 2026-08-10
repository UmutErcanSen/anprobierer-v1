-- ===========================================================================
-- Zwei Themen, eine Migration -- beide aendern handle_new_user(), das sonst
-- zweimal hintereinander neu geschrieben werden muesste:
--
-- 1. MISSBRAUCH: Gratis-Credits nur noch EINMAL je echtem Postfach.
-- 2. DSGVO Art. 7: Nachweis, wann welcher Fassung zugestimmt wurde.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. E-Mail-Normalisierung gegen Gratis-Credit-Farming
--
-- Problem: `handle_new_user()` schreibt jedem neuen Konto 5 Gratis-Credits
-- gut. Gmail & Co. liefern aber beliebig viele Adressen fuer DASSELBE
-- Postfach: "max+1@gmail.com", "max+2@gmail.com" und "m.a.x@gmail.com" landen
-- alle bei max@gmail.com. Ein Nutzer konnte sich also in Minuten zwanzig
-- Konten anlegen und hundert Gratis-Generierungen abgreifen -- reale
-- OpenAI-Kosten fuer den Betreiber. Das globale Tagesbudget
-- (DAILY_CREDIT_BUDGET, siehe lib/generation/rate-limit.ts) verhindert nur die
-- Eskalation, nicht den laufenden Verlust.
--
-- Loesung bewusst NICHT "Registrierung ablehnen":
--   * Eine Ablehnung muesste dem Anmeldenden mitteilen, dass es zu diesem
--     Postfach schon ein Konto gibt -- genau die Account-Enumeration, die
--     signUpAction/signInAction an anderer Stelle sorgfaeltig vermeiden.
--   * Plus-Adressen sind ein legitimes Werkzeug; wer sie zur Ablage nutzt,
--     wuerde ohne Grund ausgesperrt.
-- Stattdessen: Konto ja, Gratis-Credits nur beim ERSTEN Mal. Damit
-- verschwindet der wirtschaftliche Anreiz vollstaendig, ohne dass jemand
-- ausgesperrt wird oder etwas ueber fremde Konten erfaehrt.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_email(adresse text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  bereinigt text;
  lokal     text;
  domaene   text;
begin
  if adresse is null then return null; end if;

  bereinigt := lower(trim(adresse));
  if position('@' in bereinigt) = 0 then return bereinigt; end if;

  lokal   := split_part(bereinigt, '@', 1);
  domaene := split_part(bereinigt, '@', 2);

  -- googlemail.com ist nur ein zweiter Name fuer gmail.com.
  if domaene = 'googlemail.com' then domaene := 'gmail.com'; end if;

  -- Alles ab '+' ist ein frei waehlbarer Zusatz und gehoert nicht zur
  -- Postfachadresse. Gilt bei allen grossen Anbietern.
  lokal := split_part(lokal, '+', 1);

  -- Punkte ignoriert ausschliesslich Gmail. Bei anderen Anbietern sind
  -- "m.a.x@" und "max@" tatsaechlich verschiedene Postfaecher -- dort waere
  -- ein Entfernen schlicht falsch und wuerde Fremde zusammenwerfen.
  if domaene = 'gmail.com' then
    lokal := replace(lokal, '.', '');
  end if;

  return lokal || '@' || domaene;
end;
$$;

comment on function public.normalize_email(text) is
  'Fuehrt Adress-Varianten desselben Postfachs zusammen (Plus-Zusatz, Gmail-Punkte, googlemail.com). Nur fuer die Missbrauchspruefung -- NIE zum Versenden verwenden.';

alter table public.profiles
  add column if not exists normalized_email text;

comment on column public.profiles.normalized_email is
  'Nur fuer die Einmaligkeitspruefung der Gratis-Credits. Bewusst nicht fuer den Nutzer aenderbar (siehe Spaltenrechte weiter unten).';

-- Bestandskonten nachtragen, damit die Pruefung ab sofort auch gegen sie
-- greift -- sonst waeren bereits angelegte Zweitkonten weiterhin "neu".
update public.profiles p
   set normalized_email = public.normalize_email(u.email)
  from auth.users u
 where u.id = p.id
   and p.normalized_email is null;

-- Kein UNIQUE: Mehrfachkonten bleiben ausdruecklich erlaubt, sie bekommen nur
-- keine zweite Gutschrift. Der Index dient allein dem schnellen exists().
create index if not exists profiles_normalized_email_idx
  on public.profiles (normalized_email);


-- ---------------------------------------------------------------------------
-- 2. Einwilligungs-Nachweis (DSGVO Art. 7 Abs. 1)
--
-- Wer eine Einwilligung als Rechtsgrundlage nutzt, muss NACHWEISEN koennen,
-- dass sie erteilt wurde. Bisher gab es die Zustimmung nur als Haekchen im
-- Formular -- fluechtig, nirgends festgehalten. Die Fassung wird mitgespeichert,
-- weil eine spaetere Aenderung der Datenschutzerklaerung sonst rueckwirkend so
-- aussaehe, als haette der Nutzer ihr zugestimmt.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists consent_at      timestamptz,
  add column if not exists consent_version text;

comment on column public.profiles.consent_at is
  'Zeitpunkt der Zustimmung zur Datenschutzerklaerung bei der Registrierung (Art. 7 Abs. 1 DSGVO).';
comment on column public.profiles.consent_version is
  'Fassung der Datenschutzerklaerung, der zugestimmt wurde -- siehe PRIVACY_VERSION in lib/legal/consent.ts.';


-- ---------------------------------------------------------------------------
-- Trigger neu: beide Punkte zusammen
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  normalisiert     text;
  schon_vorhanden  boolean;
begin
  normalisiert := public.normalize_email(new.email);

  insert into public.profiles (id, display_name, normalized_email, consent_at, consent_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    normalisiert,
    -- Nur setzen, wenn die Registrierung tatsaechlich eine Fassung gemeldet
    -- hat. Ein pauschales now() waere ein erfundener Nachweis.
    case when new.raw_user_meta_data->>'consent_version' is not null then now() end,
    new.raw_user_meta_data->>'consent_version'
  );

  -- Gibt es zu diesem Postfach schon ein ANDERES Konto? Dann keine zweite
  -- Gutschrift. Das Konto selbst entsteht trotzdem ganz normal.
  select exists (
    select 1
      from public.profiles
     where normalized_email = normalisiert
       and id <> new.id
  ) into schon_vorhanden;

  if not schon_vorhanden then
    -- Einmalige Gratis-Credits. Bewusst nicht monatlich wiederkehrend,
    -- sonst sind Wegwerf-Accounts eine kostenlose Bildfabrik.
    insert into public.credit_ledger (user_id, delta, reason)
    values (new.id, 5, 'signup_bonus');
  end if;

  return new;
end;
$$;

-- Spaltenrechte bleiben wie gehabt auf display_name beschraenkt (siehe
-- 20260721160000_initial_schema.sql): normalized_email/consent_* sind damit
-- automatisch NICHT vom Nutzer aenderbar. Zur Sicherheit hier erneut gesetzt,
-- falls diese Migration auf einer Datenbank laeuft, in der das Recht
-- zwischenzeitlich breiter vergeben wurde.
revoke update on public.profiles from authenticated;
grant  update (display_name) on public.profiles to authenticated;

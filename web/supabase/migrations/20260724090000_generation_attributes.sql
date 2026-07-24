-- ============================================================================
-- Kleidungs-Attribute pro Generierung speichern — fuer Mehrfachfilter im Verlauf
--
-- Bisher hielt `generations.clothing_type` nur EINEN Typ (und nur im
-- Einzeln-Modus mit genau einem Stueck). Groesse und Farbe wurden ueberhaupt
-- nicht in der Tabelle abgelegt (nur fluechtig fuer den Verkaufstext-Prompt
-- genutzt). Ohne das laesst sich im Verlauf nicht nach Kategorie/Groesse/Farbe
-- filtern -- die Daten dafuer existierten schlicht nicht.
--
-- Jetzt: ein Array-Feld je Attribut, ein Eintrag pro Kleidungsstueck der
-- Generierung. GIN-Indizes machen "enthaelt einen von X" (Mehrfachauswahl im
-- Filter) effizient ueber das &&-Overlap-Coperator.
-- ============================================================================

alter table public.generations
  add column clothing_types text[] not null default '{}',
  add column sizes          text[] not null default '{}',
  add column colors         text[] not null default '{}';

comment on column public.generations.clothing_types is
  'Kleidungstyp je Stueck dieser Generierung (Schluessel aus CLOTHING_TYPES). Fuer Mehrfachfilter im Verlauf.';
comment on column public.generations.sizes is
  'Groesse je Stueck dieser Generierung.';
comment on column public.generations.colors is
  'Optionale Farbangabe je Stueck (nur wo angegeben).';

create index generations_clothing_types_idx on public.generations using gin (clothing_types);
create index generations_sizes_idx on public.generations using gin (sizes);
create index generations_colors_idx on public.generations using gin (colors);

-- Bestehende Zeilen: die einzelne clothing_type-Spalte laesst sich verlustfrei
-- ins neue Array uebernehmen (Einzeln-Modus, ein Stueck). Groesse/Farbe gab es
-- fuer diese aelteren Generierungen nirgends gespeichert -- die bleiben leer,
-- eine Rekonstruktion waere reine Spekulation.
update public.generations
set clothing_types = array[clothing_type]
where clothing_type is not null and clothing_types = '{}';

-- ---------------------------------------------------------------------------
-- spend_credits: um die drei Array-Parameter erweitert
-- ---------------------------------------------------------------------------
drop function if exists public.spend_credits(uuid, public.generation_mode, public.image_quality, integer, text, text, text);

create function public.spend_credits(
  p_user_id           uuid,
  p_mode              public.generation_mode,
  p_quality           public.image_quality,
  p_image_count       integer default 1,
  p_clothing_type     text default null,
  p_notes             text default null,
  p_person_image_path text default null,
  p_clothing_types    text[] default '{}',
  p_sizes             text[] default '{}',
  p_colors            text[] default '{}'
)
returns public.generations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit       integer;
  v_cost       integer;
  v_balance    integer;
  v_generation public.generations;
begin
  if p_image_count < 1 or p_image_count > 20 then
    raise exception 'Ungueltige Bildanzahl: %', p_image_count using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  v_unit := public.credits_for_quality(p_quality);
  if v_unit is null then
    raise exception 'Unbekannte Qualitaet' using errcode = 'check_violation';
  end if;
  v_cost := v_unit * p_image_count;

  select coalesce(sum(delta), 0) into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  if v_balance < v_cost then
    raise exception 'Guthaben reicht nicht: % vorhanden, % benoetigt', v_balance, v_cost
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.generations (user_id, status, mode, quality, credits_charged,
                                  clothing_type, notes, person_image_path,
                                  clothing_types, sizes, colors)
  values (p_user_id, 'queued', p_mode, p_quality, v_cost,
          p_clothing_type, p_notes, p_person_image_path,
          p_clothing_types, p_sizes, p_colors)
  returning * into v_generation;

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
  values (p_user_id, -v_cost, 'generation_charge', v_generation.id);

  return v_generation;
end;
$$;

revoke execute on function public.spend_credits(uuid, public.generation_mode, public.image_quality, integer, text, text, text, text[], text[], text[]) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, public.generation_mode, public.image_quality, integer, text, text, text, text[], text[], text[]) to service_role;

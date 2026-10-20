-- T005 (spec 005): catálogo de ejercicios. Modelo en specs/005-catalogo-de-ejercicios/data-model.md.
-- RLS activado SIN políticas: denegado por defecto. Las políticas llegan en la migración siguiente.

-- Fuentes del catálogo de ejercicios (tabla de referencia, solo lectura para las cuentas) -----------------------
create table public.exercise_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  license_name text not null,
  license_url text not null,
  attribution text not null,
  source_url text not null,
  source_version text,
  last_imported_at timestamptz,
  exercise_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint exercise_sources_text_check check (
    btrim(slug) <> '' and btrim(name) <> '' and btrim(license_name) <> ''
    and btrim(license_url) <> '' and btrim(attribution) <> '' and btrim(source_url) <> ''
  )
);

-- Los alias de un ejercicio: hasta 10, cada uno de 1 a 80 caracteres y sin espacios en los extremos.
-- Un `check` no admite subconsultas, por eso va en una función inmutable.
create function private.valid_aliases(p_aliases text[]) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_aliases is not null
    and cardinality(p_aliases) <= 10
    and coalesce(
      (select bool_and(a is not null and char_length(a) between 1 and 80 and a = btrim(a)) from unnest(p_aliases) a),
      true
    )
$$;

-- Ejercicios: catálogo común (user_id nulo) y ejercicios propios ---------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  origin text not null,
  source_id uuid references public.exercise_sources (id),
  source_item_id text,
  imported_at timestamptz,
  based_on_exercise_id uuid references public.exercises (id) on delete set null,
  name text not null,
  name_status text not null default 'original',
  original_name text,
  aliases text[] not null default '{}',
  measurement_type text not null,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text,
  description text,
  description_status text,
  -- Los dos campos de búsqueda los calcula un disparador: array_to_string no es inmutable y una columna
  -- generada lo exige.
  search_text text not null default '',
  name_norm text not null default '',
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exercises_origin_check check (origin in ('imported', 'own')),
  constraint exercises_name_status_check check (name_status in ('original', 'machine_translated', 'reviewed')),
  constraint exercises_description_status_check check (
    description_status is null or description_status in ('original', 'machine_translated', 'reviewed')
  ),
  -- Origen y propiedad van juntos: el catálogo no tiene dueño; lo propio no tiene fuente.
  constraint exercises_ownership_check check (
    (origin = 'imported' and user_id is null and source_id is not null and source_item_id is not null)
    or (origin = 'own' and user_id is not null and source_id is null and source_item_id is null)
  ),
  constraint exercises_name_check check (char_length(name) between 1 and 120 and name = btrim(name)),
  constraint exercises_original_name_check check (
    original_name is null
    or (origin = 'imported' and char_length(original_name) between 1 and 120 and original_name = btrim(original_name))
  ),
  constraint exercises_aliases_check check (private.valid_aliases(aliases)),
  constraint exercises_measurement_check check (
    measurement_type in ('reps_weight', 'reps_bodyweight', 'duration', 'distance_duration')
  ),
  constraint exercises_primary_muscles_check check (
    primary_muscles <@ array[
      'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
      'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps', 'full_body'
    ]::text[]
    and cardinality(primary_muscles) <= 5
  ),
  constraint exercises_secondary_muscles_check check (
    secondary_muscles <@ array[
      'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
      'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps', 'full_body'
    ]::text[]
    and cardinality(secondary_muscles) <= 8
  ),
  constraint exercises_muscles_disjoint_check check (not (primary_muscles && secondary_muscles)),
  constraint exercises_equipment_check check (
    equipment is null or equipment in (
      'body only', 'barbell', 'dumbbell', 'cable', 'machine', 'e-z curl bar', 'kettlebells', 'bands',
      'medicine ball', 'exercise ball', 'foam roll', 'other'
    )
  ),
  -- La descripción y su estado van juntos: sin una no hay el otro.
  constraint exercises_description_check check (
    (description is null and description_status is null)
    or (description is not null and description_status is not null and char_length(description) between 1 and 4000)
  )
);

create unique index exercises_source_item_key on public.exercises (source_id, source_item_id)
  where origin = 'imported';
create unique index exercises_request_key on public.exercises (user_id, client_request_id)
  where client_request_id is not null;
create index exercises_search_trgm on public.exercises using gin (search_text extensions.gin_trgm_ops);
create index exercises_name_norm_idx on public.exercises (name_norm text_pattern_ops);
create index exercises_user_idx on public.exercises (user_id);
create index exercises_origin_idx on public.exercises (origin);
create index exercises_based_on_idx on public.exercises (based_on_exercise_id);

-- Campos de búsqueda: nombre + nombre original + alias, sin acentos y en minúsculas.
create function private.prepare_exercise_search() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(private.immutable_unaccent(
    concat_ws(' ', new.name, new.original_name, nullif(array_to_string(new.aliases, ' '), ''))
  ));
  new.name_norm := lower(private.immutable_unaccent(new.name));
  return new;
end;
$$;

create trigger exercises_prepare_search
  before insert or update on public.exercises
  for each row execute function private.prepare_exercise_search();

-- La identidad de un ejercicio no cambia nunca: ni origen, ni dueño, ni fuente, ni fecha de importación.
create function private.protect_exercise_identity() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin is distinct from old.origin
     or new.user_id is distinct from old.user_id
     or new.source_id is distinct from old.source_id
     or new.source_item_id is distinct from old.source_item_id
     or new.imported_at is distinct from old.imported_at then
    raise exception 'exercise_identity_immutable: el origen, el dueno y la fuente de un ejercicio no se pueden cambiar'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger exercises_protect_identity
  before update on public.exercises
  for each row execute function private.protect_exercise_identity();

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function private.set_updated_at();

-- Informe de cada carga del catálogo de ejercicios (solo servidor) -------------------------------------------------
create table private.exercise_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.exercise_sources (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  skipped_reasons jsonb not null default '{}'::jsonb
);

-- Seguridad: RLS activado sin políticas y sin permisos para el cliente --------------------------------------------
alter table public.exercise_sources enable row level security;
alter table public.exercises enable row level security;

revoke all on public.exercise_sources, public.exercises from anon, authenticated;
grant all on public.exercise_sources, public.exercises to service_role;

revoke all on private.exercise_import_runs from anon, authenticated;
grant all on private.exercise_import_runs to service_role;

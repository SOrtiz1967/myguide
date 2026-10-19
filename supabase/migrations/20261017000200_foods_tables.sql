-- T008 (spec 002): catalogo de alimentos. Modelo en specs/002-catalogo-de-alimentos/data-model.md.
-- RLS activado SIN politicas: denegado por defecto. Las politicas llegan en la migracion siguiente.

-- Fuentes del catalogo (tabla de referencia, solo lectura para las cuentas) ----------------------
create table public.food_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  license_name text not null,
  license_url text not null,
  attribution text not null,
  source_url text not null,
  last_imported_at timestamptz,
  food_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint food_sources_text_check check (
    btrim(slug) <> '' and btrim(name) <> '' and btrim(license_name) <> ''
    and btrim(license_url) <> '' and btrim(attribution) <> '' and btrim(source_url) <> ''
  )
);

-- Alimentos: catalogo comun (user_id nulo) y alimentos propios -----------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  origin text not null,
  source_id uuid references public.food_sources (id),
  source_item_id text,
  imported_at timestamptz,
  based_on_food_id uuid references public.foods (id) on delete set null,
  name text not null,
  name_status text not null default 'original',
  brand text,
  reference_basis text not null,
  energy_kcal numeric(8, 2),
  protein_g numeric(8, 2),
  carbs_g numeric(8, 2),
  sugars_g numeric(8, 2),
  fat_g numeric(8, 2),
  saturated_fat_g numeric(8, 2),
  fiber_g numeric(8, 2),
  sodium_mg numeric(10, 2),
  search_text text generated always as (
    lower(private.immutable_unaccent(name || ' ' || coalesce(brand, '')))
  ) stored,
  name_norm text generated always as (lower(private.immutable_unaccent(name))) stored,
  completeness smallint generated always as (
    num_nonnulls(energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg)::smallint
  ) stored,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint foods_origin_check check (origin in ('imported', 'own')),
  constraint foods_name_status_check check (name_status in ('original', 'machine_translated', 'reviewed')),
  constraint foods_basis_check check (reference_basis in ('100g', '100ml')),
  -- Origen y propiedad van juntos: el catalogo no tiene dueño; lo propio no tiene fuente.
  constraint foods_ownership_check check (
    (origin = 'imported' and user_id is null and source_id is not null and source_item_id is not null)
    or (origin = 'own' and user_id is not null and source_id is null and source_item_id is null)
  ),
  constraint foods_name_check check (char_length(name) between 1 and 200 and name = btrim(name)),
  constraint foods_brand_check check (brand is null or (char_length(brand) between 1 and 120 and brand = btrim(brand))),
  constraint foods_energy_check check (energy_kcal is null or energy_kcal between 0 and 900),
  constraint foods_grams_check check (
    coalesce(protein_g, 0) between 0 and 100 and coalesce(carbs_g, 0) between 0 and 100
    and coalesce(sugars_g, 0) between 0 and 100 and coalesce(fat_g, 0) between 0 and 100
    and coalesce(saturated_fat_g, 0) between 0 and 100 and coalesce(fiber_g, 0) between 0 and 100
  ),
  constraint foods_sodium_check check (sodium_mg is null or sodium_mg between 0 and 40000),
  constraint foods_macros_sum_check check (
    coalesce(protein_g, 0) + coalesce(carbs_g, 0) + coalesce(fat_g, 0) <= 100
  ),
  constraint foods_sugars_check check (sugars_g is null or carbs_g is null or sugars_g <= carbs_g),
  constraint foods_saturated_check check (saturated_fat_g is null or fat_g is null or saturated_fat_g <= fat_g)
);

create unique index foods_source_item_key on public.foods (source_id, source_item_id)
  where origin = 'imported';
create unique index foods_request_key on public.foods (user_id, client_request_id)
  where client_request_id is not null;
create index foods_search_trgm on public.foods using gin (search_text extensions.gin_trgm_ops);
create index foods_name_norm_idx on public.foods (name_norm text_pattern_ops);
create index foods_user_idx on public.foods (user_id);
create index foods_origin_idx on public.foods (origin);
create index foods_based_on_idx on public.foods (based_on_food_id);

-- La identidad de un alimento no cambia nunca: ni origen, ni dueño, ni fuente.
create function private.protect_food_identity() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin is distinct from old.origin
     or new.user_id is distinct from old.user_id
     or new.source_id is distinct from old.source_id
     or new.source_item_id is distinct from old.source_item_id then
    raise exception 'food_identity_immutable: el origen, el dueno y la fuente de un alimento no se pueden cambiar'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger foods_protect_identity
  before update on public.foods
  for each row execute function private.protect_food_identity();

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function private.set_updated_at();

-- Porciones ---------------------------------------------------------------------------------------
create table public.food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric(8, 2) not null,
  position smallint not null default 0,
  constraint food_portions_name_check check (char_length(name) between 1 and 80 and name = btrim(name)),
  constraint food_portions_quantity_check check (quantity > 0 and quantity <= 5000),
  constraint food_portions_unique_name unique (food_id, name)
);

create index food_portions_food_idx on public.food_portions (food_id, position);
create index food_portions_user_idx on public.food_portions (user_id);

-- El dueño de la porcion es siempre el del alimento; maximo 20 porciones por alimento.
create function private.prepare_food_portion() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select f.user_id into new.user_id from public.foods f where f.id = new.food_id;

  if (select count(*) from public.food_portions p where p.food_id = new.food_id) >= 20 then
    raise exception 'too_many_portions: un alimento admite como maximo 20 porciones'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger food_portions_prepare
  before insert on public.food_portions
  for each row execute function private.prepare_food_portion();

-- Informe de cada carga del catalogo (solo servidor) -------------------------------------------------
create table private.import_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.food_sources (id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  skipped_reasons jsonb not null default '{}'::jsonb
);

-- Seguridad: RLS activado sin politicas y sin permisos para el cliente --------------------------------
alter table public.food_sources enable row level security;
alter table public.foods enable row level security;
alter table public.food_portions enable row level security;
alter table private.import_runs enable row level security;

revoke all on public.food_sources, public.foods, public.food_portions from anon, authenticated;
revoke all on private.import_runs from anon, authenticated;
grant all on public.food_sources, public.foods, public.food_portions to service_role;
grant all on private.import_runs to service_role;

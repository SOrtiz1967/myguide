-- T007 (spec 003): registro de comidas. Modelo en specs/003-registro-de-comidas/data-model.md.
-- RLS activado SIN políticas: denegado por defecto. Las políticas llegan en la migración siguiente.

-- Ítems registrados -------------------------------------------------------------------------------
-- Cada ítem guarda una INSTANTÁNEA del alimento (nombre, marca, base y valores por 100) y los valores
-- calculados para su cantidad. Nunca vuelve a leer el alimento: editarlo, eliminarlo o reimportarlo no
-- cambia lo ya registrado (Principio II). Un dato que falta es null, nunca 0.
create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  meal text not null,
  origin text not null,
  status text not null default 'confirmed',
  food_id uuid references public.foods (id) on delete set null,
  food_name text not null,
  food_brand text,
  reference_basis text,
  per100_energy_kcal numeric(8, 2),
  per100_protein_g numeric(8, 2),
  per100_carbs_g numeric(8, 2),
  per100_sugars_g numeric(8, 2),
  per100_fat_g numeric(8, 2),
  per100_saturated_fat_g numeric(8, 2),
  per100_fiber_g numeric(8, 2),
  per100_sodium_mg numeric(10, 2),
  quantity numeric(10, 2),
  portion_name text,
  portion_quantity numeric(8, 2),
  portion_count numeric(6, 2),
  quantity_text text,
  energy_kcal numeric(12, 2),
  protein_g numeric(12, 2),
  carbs_g numeric(12, 2),
  sugars_g numeric(12, 2),
  fat_g numeric(12, 2),
  saturated_fat_g numeric(12, 2),
  fiber_g numeric(12, 2),
  sodium_mg numeric(12, 2),
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meal_entries_meal_check check (meal in ('breakfast', 'lunch', 'snack', 'dinner', 'extra')),
  constraint meal_entries_origin_check check (origin in ('catalog', 'own', 'manual', 'estimated')),
  constraint meal_entries_status_check check (status in ('confirmed', 'pending')),
  -- Pendiente de confirmar solo existe para lo estimado (la spec 009 lo usará).
  constraint meal_entries_pending_check check (status <> 'pending' or origin = 'estimated'),
  constraint meal_entries_date_check check (log_date >= date '2000-01-01'),
  constraint meal_entries_name_check check (char_length(food_name) between 1 and 200 and food_name = btrim(food_name)),
  constraint meal_entries_brand_check check (food_brand is null or (char_length(food_brand) between 1 and 120 and food_brand = btrim(food_brand))),
  constraint meal_entries_basis_check check (reference_basis is null or reference_basis in ('100g', '100ml')),
  constraint meal_entries_quantity_check check (quantity is null or (quantity > 0 and quantity <= 5000)),
  constraint meal_entries_quantity_text_check check (quantity_text is null or char_length(quantity_text) between 1 and 60),
  constraint meal_entries_portion_check check (
    (portion_name is null and portion_quantity is null and portion_count is null)
    or (
      portion_name is not null and char_length(portion_name) between 1 and 80
      and portion_quantity > 0 and portion_quantity <= 5000
      and portion_count > 0 and portion_count <= 50
    )
  ),
  -- Forma según el origen: del catálogo o propio llevan instantánea y cantidad; manual y estimado
  -- llevan solo los valores escritos y exigen la energía.
  constraint meal_entries_shape_check check (
    (
      origin in ('catalog', 'own')
      and reference_basis is not null and quantity is not null
    )
    or (
      origin in ('manual', 'estimated')
      and food_id is null and reference_basis is null and quantity is null
      and portion_name is null
      and num_nonnulls(
        per100_energy_kcal, per100_protein_g, per100_carbs_g, per100_sugars_g, per100_fat_g,
        per100_saturated_fat_g, per100_fiber_g, per100_sodium_mg
      ) = 0
      and energy_kcal is not null
    )
  ),
  constraint meal_entries_values_check check (
    coalesce(energy_kcal, 0) between 0 and 100000
    and coalesce(protein_g, 0) between 0 and 5000 and coalesce(carbs_g, 0) between 0 and 5000
    and coalesce(sugars_g, 0) between 0 and 5000 and coalesce(fat_g, 0) between 0 and 5000
    and coalesce(saturated_fat_g, 0) between 0 and 5000 and coalesce(fiber_g, 0) between 0 and 5000
    and coalesce(sodium_mg, 0) between 0 and 2000000
  ),
  constraint meal_entries_sugars_check check (sugars_g is null or carbs_g is null or sugars_g <= carbs_g),
  constraint meal_entries_saturated_check check (saturated_fat_g is null or fat_g is null or saturated_fat_g <= fat_g)
);

create unique index meal_entries_request_key on public.meal_entries (user_id, client_request_id)
  where client_request_id is not null;
create index meal_entries_day_idx on public.meal_entries (user_id, log_date, meal);
create index meal_entries_recent_idx on public.meal_entries (user_id, created_at desc);
create index meal_entries_food_idx on public.meal_entries (food_id);

-- Calcula los valores del ítem desde la instantánea y la cantidad, y protege la identidad.
create function private.prepare_meal_entry() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.origin in ('catalog', 'own') and new.food_id is null then
      raise exception 'food_required: un item del catalogo o propio necesita su alimento'
        using errcode = '23514';
    end if;
  else
    -- food_id solo puede pasar a nulo: es lo que hace la base cuando se elimina el alimento.
    if new.user_id is distinct from old.user_id
       or new.origin is distinct from old.origin
       or (new.food_id is distinct from old.food_id and new.food_id is not null)
       or (
         old.origin in ('catalog', 'own') and (
           new.food_name is distinct from old.food_name
           or new.food_brand is distinct from old.food_brand
           or new.reference_basis is distinct from old.reference_basis
           or new.per100_energy_kcal is distinct from old.per100_energy_kcal
           or new.per100_protein_g is distinct from old.per100_protein_g
           or new.per100_carbs_g is distinct from old.per100_carbs_g
           or new.per100_sugars_g is distinct from old.per100_sugars_g
           or new.per100_fat_g is distinct from old.per100_fat_g
           or new.per100_saturated_fat_g is distinct from old.per100_saturated_fat_g
           or new.per100_fiber_g is distinct from old.per100_fiber_g
           or new.per100_sodium_mg is distinct from old.per100_sodium_mg
         )
       ) then
      raise exception 'entry_identity_immutable: el origen y la instantanea de un item no se pueden cambiar'
        using errcode = '42501';
    end if;
  end if;

  if new.portion_count is not null then
    new.quantity := round(new.portion_quantity * new.portion_count, 2);
  end if;

  if new.origin in ('catalog', 'own') then
    new.energy_kcal := round(new.per100_energy_kcal * new.quantity / 100, 2);
    new.protein_g := round(new.per100_protein_g * new.quantity / 100, 2);
    new.carbs_g := round(new.per100_carbs_g * new.quantity / 100, 2);
    new.sugars_g := round(new.per100_sugars_g * new.quantity / 100, 2);
    new.fat_g := round(new.per100_fat_g * new.quantity / 100, 2);
    new.saturated_fat_g := round(new.per100_saturated_fat_g * new.quantity / 100, 2);
    new.fiber_g := round(new.per100_fiber_g * new.quantity / 100, 2);
    new.sodium_mg := round(new.per100_sodium_mg * new.quantity / 100, 2);
  end if;
  return new;
end;
$$;

create trigger meal_entries_prepare
  before insert or update on public.meal_entries
  for each row execute function private.prepare_meal_entry();

create trigger meal_entries_set_updated_at
  before update on public.meal_entries
  for each row execute function private.set_updated_at();

-- "Empezar el día de hoy" (regla del día, FR-025) ---------------------------------------------------
create table public.log_day_starts (
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- Foto de una comida (FR-030) --------------------------------------------------------------------------
-- El archivo vive en el bucket privado `meal-photos`; esta fila lo registra. Al eliminar la cuenta la
-- fila se borra en cascada pero el archivo no: ver research.md, Decisión 11.
create table public.meal_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  meal text not null,
  storage_path text not null,
  width integer not null,
  height integer not null,
  bytes integer not null,
  created_at timestamptz not null default now(),
  constraint meal_photos_meal_check check (meal in ('breakfast', 'lunch', 'snack', 'dinner', 'extra')),
  constraint meal_photos_path_check check (char_length(storage_path) between 1 and 300),
  constraint meal_photos_size_check check (width > 0 and height > 0),
  constraint meal_photos_bytes_check check (bytes > 0 and bytes <= 3145728),
  constraint meal_photos_day_meal_key unique (user_id, log_date, meal)
);

-- Seguridad: RLS activado sin políticas y sin permisos para el cliente ---------------------------------
alter table public.meal_entries enable row level security;
alter table public.log_day_starts enable row level security;
alter table public.meal_photos enable row level security;

revoke all on public.meal_entries, public.log_day_starts, public.meal_photos from anon, authenticated;
grant all on public.meal_entries, public.log_day_starts, public.meal_photos to service_role;

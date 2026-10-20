-- Datos y utilidades SOLO para desarrollo local y pruebas (no se aplica a produccion).
-- Ayudantes pgTAP de la spec 001 (tarea T019). Viven en el esquema `tests`.

create schema if not exists tests;

-- Crea un usuario directamente en auth.users, con el metadato del aviso de privacidad
-- (a menos que se pase NULL, para probar el rechazo). Devuelve su id.
create or replace function tests.create_user(
  p_email text,
  p_privacy_version text default '2026-10-16'
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_meta jsonb := case
    when p_privacy_version is null then '{}'::jsonb
    else jsonb_build_object('privacy_notice_version', p_privacy_version)
  end;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v_id, 'authenticated', 'authenticated', p_email, v_meta, now(), now());
  return v_id;
end;
$$;

-- Actua como el usuario indicado (rol `authenticated` con su JWT simulado).
-- p_amr_ts: hora (epoch) del inicio de sesion con contrasena que simula el claim `amr` del JWT.
create or replace function tests.authenticate_as(p_user_id uuid, p_amr_ts bigint default null)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    (
      jsonb_build_object('sub', p_user_id, 'role', 'authenticated')
      || case
        when p_amr_ts is null then '{}'::jsonb
        else jsonb_build_object(
          'amr',
          jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', p_amr_ts))
        )
      end
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Actua como una peticion anonima.
create or replace function tests.authenticate_as_anon() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end;
$$;

-- Vuelve al rol de administrador de la sesion de pruebas.
create or replace function tests.clear_authentication() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
end;
$$;


-- Ayudantes de la spec 002 (alimentos). Se ejecutan como administrador de pruebas.

-- Crea un alimento PROPIO de una cuenta. Devuelve su id.
create or replace function tests.create_food(
  p_user_id uuid,
  p_name text,
  p_brand text default null,
  p_energy numeric default 100,
  p_basis text default '100g',
  p_protein numeric default null,
  p_carbs numeric default null,
  p_fat numeric default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.foods (id, user_id, origin, name, brand, reference_basis, energy_kcal, protein_g, carbs_g, fat_g)
  values (v_id, p_user_id, 'own', p_name, p_brand, p_basis, p_energy, p_protein, p_carbs, p_fat);
  return v_id;
end;
$$;

-- Crea un alimento del CATALOGO (sin dueno). La fuente se toma por su slug. Devuelve su id.
create or replace function tests.create_catalog_food(
  p_source_slug text,
  p_source_item_id text,
  p_name text,
  p_brand text default null,
  p_energy numeric default 100,
  p_basis text default '100g',
  p_protein numeric default null,
  p_carbs numeric default null,
  p_fat numeric default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.foods (id, origin, source_id, source_item_id, imported_at, name, brand, reference_basis, energy_kcal, protein_g, carbs_g, fat_g)
  values (v_id, 'imported', (select id from public.food_sources where slug = p_source_slug), p_source_item_id, now(), p_name, p_brand, p_basis, p_energy, p_protein, p_carbs, p_fat);
  return v_id;
end;
$$;

grant usage on schema tests to anon, authenticated;
-- Ayudantes de la spec 004 (objetivo de energía diaria). Escriben directamente, sin pasar por la función
-- del cliente, para sembrar historiales con fechas y horas arbitrarias.

-- Agrega un cambio al historial del objetivo (kcal nulo = se quitó el objetivo). Devuelve su id.
create or replace function tests.create_energy_goal(
  p_user_id uuid,
  p_effective_from date,
  p_kcal integer,
  p_created_at timestamptz default now()
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.energy_goals (id, user_id, effective_from, kcal, client_request_id, created_at)
  values (v_id, p_user_id, p_effective_from, p_kcal, gen_random_uuid(), p_created_at);
  return v_id;
end;
$$;

-- Crea un ítem estimado todavía sin confirmar (origin = 'estimated', status = 'pending'). Devuelve su id.
create or replace function tests.create_pending_estimate(
  p_user_id uuid,
  p_log_date date,
  p_meal text,
  p_energy_kcal numeric
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.meal_entries (id, user_id, log_date, meal, origin, status, food_name, energy_kcal)
  values (v_id, p_user_id, p_log_date, p_meal, 'estimated', 'pending', 'Estimado', p_energy_kcal);
  return v_id;
end;
$$;

-- Ayudantes de la spec 005 (catálogo de ejercicios). Escriben directamente, sin pasar por las funciones
-- del cliente.

-- Crea un ejercicio propio. Devuelve su id.
create or replace function tests.create_exercise(
  p_user_id uuid,
  p_name text,
  p_measurement_type text default 'reps_weight',
  p_primary_muscles text[] default '{}',
  p_equipment text default null,
  p_description text default null
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.exercises (
    id, origin, user_id, name, measurement_type, primary_muscles, equipment, description, description_status
  )
  values (
    v_id, 'own', p_user_id, p_name, p_measurement_type, p_primary_muscles, p_equipment, p_description,
    case when p_description is null then null else 'original' end
  );
  return v_id;
end;
$$;

-- Crea un ejercicio del catálogo en una fuente (por su slug). Devuelve su id.
create or replace function tests.create_catalog_exercise(
  p_source_slug text,
  p_item_id text,
  p_name text,
  p_measurement_type text default 'reps_weight',
  p_original_name text default null,
  p_aliases text[] default '{}',
  p_primary_muscles text[] default '{}',
  p_secondary_muscles text[] default '{}',
  p_equipment text default null,
  p_description text default null,
  p_name_status text default 'machine_translated',
  p_description_status text default 'machine_translated'
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.exercises (
    id, origin, source_id, source_item_id, imported_at, name, name_status, original_name, aliases,
    measurement_type, primary_muscles, secondary_muscles, equipment, description, description_status
  )
  select v_id, 'imported', s.id, p_item_id, now(), p_name, p_name_status, p_original_name, p_aliases,
         p_measurement_type, p_primary_muscles, p_secondary_muscles, p_equipment, p_description,
         case when p_description is null then null else p_description_status end
  from public.exercise_sources s
  where s.slug = p_source_slug;
  return v_id;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Fuente de la muestra de desarrollo (spec 002, T043). Solo existe en local: la carga de producción
-- no la usa. Los datos de la muestra son de ejemplo, no son datos reales.
insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values (
  'muestra-desarrollo', 'Datos de ejemplo (desarrollo)', 'CC0 1.0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'Datos de ejemplo para desarrollo y pruebas de MyGuide. No son datos reales.',
  'https://example.test/muestra'
) on conflict (slug) do nothing;

-- Ayudantes de la spec 003 (registro de comidas). Se ejecutan como administrador de pruebas y escriben
-- directamente, sin pasar por las funciones del cliente.

-- Crea un ítem manual. Devuelve su id.
create or replace function tests.create_manual_entry(
  p_user_id uuid,
  p_log_date date,
  p_meal text,
  p_description text,
  p_energy numeric default 100
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.meal_entries (id, user_id, log_date, meal, origin, food_name, energy_kcal)
  values (v_id, p_user_id, p_log_date, p_meal, 'manual', p_description, p_energy);
  return v_id;
end;
$$;

-- Crea un ítem desde un alimento (toma su instantánea ahora). Devuelve su id.
create or replace function tests.create_meal_entry(
  p_user_id uuid,
  p_log_date date,
  p_meal text,
  p_food_id uuid,
  p_quantity numeric default 100
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.meal_entries (
    id, user_id, log_date, meal, origin, food_id, food_name, food_brand, reference_basis,
    per100_energy_kcal, per100_protein_g, per100_carbs_g, per100_sugars_g, per100_fat_g,
    per100_saturated_fat_g, per100_fiber_g, per100_sodium_mg, quantity
  )
  select v_id, p_user_id, p_log_date, p_meal,
         case when f.user_id is null then 'catalog' else 'own' end, f.id, f.name, f.brand, f.reference_basis,
         f.energy_kcal, f.protein_g, f.carbs_g, f.sugars_g, f.fat_g, f.saturated_fat_g, f.fiber_g, f.sodium_mg,
         p_quantity
  from public.foods f
  where f.id = p_food_id;
  return v_id;
end;
$$;

-- Fija la zona horaria del perfil de una cuenta.
create or replace function tests.set_profile_timezone(p_user_id uuid, p_timezone text) returns void
language sql
as $$
  update public.profiles set timezone = p_timezone where user_id = p_user_id;
$$;

-- Ayudantes de la spec 004 (objetivo de energía diaria). Escriben directamente, sin pasar por la función
-- del cliente, para sembrar historiales con fechas y horas arbitrarias.

-- Agrega un cambio al historial del objetivo (kcal nulo = se quitó el objetivo). Devuelve su id.
create or replace function tests.create_energy_goal(
  p_user_id uuid,
  p_effective_from date,
  p_kcal integer,
  p_created_at timestamptz default now()
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.energy_goals (id, user_id, effective_from, kcal, client_request_id, created_at)
  values (v_id, p_user_id, p_effective_from, p_kcal, gen_random_uuid(), p_created_at);
  return v_id;
end;
$$;

-- Crea un ítem estimado todavía sin confirmar (origin = 'estimated', status = 'pending'). Devuelve su id.
create or replace function tests.create_pending_estimate(
  p_user_id uuid,
  p_log_date date,
  p_meal text,
  p_energy_kcal numeric
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.meal_entries (id, user_id, log_date, meal, origin, status, food_name, energy_kcal)
  values (v_id, p_user_id, p_log_date, p_meal, 'estimated', 'pending', 'Estimado', p_energy_kcal);
  return v_id;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

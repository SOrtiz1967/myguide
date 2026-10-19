-- T006 (spec 003, FR-002 a FR-005, FR-010 a FR-012, FR-026): integridad de los ítems registrados.
begin;
select plan(34);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin alimentos.
delete from public.foods;

select tests.create_user('a@test.local') as uid \gset
select tests.create_user('b@test.local') as uid2 \gset

select tests.create_food(:'uid', 'Arroz propio', null, 130, '100g', 2.7, 28, 0.3) as food_id \gset

select set_config('t.uid', :'uid', false), set_config('t.food', :'food_id', false);

-- Un ítem válido del catálogo/propio, para clonar en las pruebas.
create function pg_temp.entry(overrides jsonb default '{}'::jsonb) returns uuid
language plpgsql as $$
declare
  v jsonb := jsonb_build_object(
    'user_id', current_setting('t.uid'), 'log_date', '2026-10-19', 'meal', 'lunch', 'origin', 'own',
    'food_id', current_setting('t.food'), 'food_name', 'Arroz propio', 'reference_basis', '100g',
    'per100_energy_kcal', 130, 'per100_protein_g', 2.7, 'per100_carbs_g', 28, 'per100_fat_g', 0.3,
    'quantity', 150
  ) || overrides;
  new_id uuid;
begin
  insert into public.meal_entries (
    user_id, log_date, meal, origin, status, food_id, food_name, food_brand, reference_basis,
    per100_energy_kcal, per100_protein_g, per100_carbs_g, per100_sugars_g, per100_fat_g,
    per100_saturated_fat_g, per100_fiber_g, per100_sodium_mg,
    quantity, portion_name, portion_quantity, portion_count, quantity_text,
    energy_kcal, protein_g, carbs_g, sugars_g, fat_g, client_request_id
  ) values (
    (v ->> 'user_id')::uuid, (v ->> 'log_date')::date, v ->> 'meal', v ->> 'origin',
    coalesce(v ->> 'status', 'confirmed'), (v ->> 'food_id')::uuid, v ->> 'food_name', v ->> 'food_brand',
    v ->> 'reference_basis',
    (v ->> 'per100_energy_kcal')::numeric, (v ->> 'per100_protein_g')::numeric,
    (v ->> 'per100_carbs_g')::numeric, (v ->> 'per100_sugars_g')::numeric, (v ->> 'per100_fat_g')::numeric,
    (v ->> 'per100_saturated_fat_g')::numeric, (v ->> 'per100_fiber_g')::numeric,
    (v ->> 'per100_sodium_mg')::numeric,
    (v ->> 'quantity')::numeric, v ->> 'portion_name', (v ->> 'portion_quantity')::numeric,
    (v ->> 'portion_count')::numeric, v ->> 'quantity_text',
    (v ->> 'energy_kcal')::numeric, (v ->> 'protein_g')::numeric, (v ->> 'carbs_g')::numeric,
    (v ->> 'sugars_g')::numeric, (v ->> 'fat_g')::numeric, (v ->> 'client_request_id')::uuid
  ) returning id into new_id;
  return new_id;
end
$$;

-- restricciones de dominio ---------------------------------------------------------------------------------
select throws_ilike($$ select pg_temp.entry('{"meal":"brunch"}') $$, '%meal_entries_meal_check%', 'FR-008: solo las cinco comidas');
select lives_ok($$ select pg_temp.entry('{"meal":"extra"}') $$, 'la colación es válida');
select throws_ilike($$ select pg_temp.entry('{"origin":"invento"}') $$, '%meal_entries_origin_check%', 'FR-012: solo los orígenes definidos');
select throws_ilike($$ select pg_temp.entry('{"status":"quizas"}') $$, '%meal_entries_status_check%', 'solo los estados definidos');
select throws_ilike($$ select pg_temp.entry('{"status":"pending"}') $$, '%meal_entries_pending_check%', 'un ítem pendiente solo puede ser estimado');
select lives_ok(
  $$ select pg_temp.entry('{"origin":"estimated","status":"pending","food_id":null,"food_name":"Estimado","reference_basis":null,"per100_energy_kcal":null,"per100_protein_g":null,"per100_carbs_g":null,"per100_fat_g":null,"quantity":null,"energy_kcal":300}') $$,
  'el estado estimado y pendiente queda previsto para la spec 009'
);
select throws_ilike($$ select pg_temp.entry('{"log_date":"1999-12-31"}') $$, '%meal_entries_date_check%', 'no se admiten fechas anteriores al 2000');
select throws_ilike($$ select pg_temp.entry('{"food_name":""}') $$, '%meal_entries_name_check%', 'el nombre no puede estar vacío');
select throws_ilike($$ select pg_temp.entry('{"quantity":0}') $$, '%meal_entries_quantity_check%', 'FR-003: la cantidad debe ser mayor que 0');
select throws_ilike($$ select pg_temp.entry('{"quantity":5001}') $$, '%meal_entries_quantity_check%', 'FR-003: hasta 5000 g o ml');
select throws_ilike($$ select pg_temp.entry('{"portion_name":"taza","portion_quantity":158,"portion_count":0}') $$, '%meal_entries_portion_check%', 'FR-003: las porciones deben ser mayores que 0');
select throws_ilike($$ select pg_temp.entry('{"portion_name":"taza","portion_quantity":158,"portion_count":51}') $$, '%meal_entries_portion_check%', 'FR-003: hasta 50 porciones');
select throws_ilike($$ select pg_temp.entry('{"origin":"own","food_id":null}') $$, '%food_required%', 'un ítem del catálogo o propio exige el alimento al crearlo');
select throws_ilike($$ select pg_temp.entry('{"origin":"manual","food_id":null,"reference_basis":null,"per100_energy_kcal":null,"per100_protein_g":null,"per100_carbs_g":null,"per100_fat_g":null,"quantity":null}') $$, '%meal_entries_shape_check%', 'FR-006: un manual exige la energía');
select throws_ilike($$ select pg_temp.entry('{"origin":"manual","food_id":null,"energy_kcal":100}') $$, '%meal_entries_shape_check%', 'un manual no lleva la instantánea por 100 ni una cantidad en g o ml');
select throws_ilike(
  $$ select pg_temp.entry('{"origin":"manual","food_id":null,"reference_basis":null,"per100_energy_kcal":null,"per100_protein_g":null,"per100_carbs_g":null,"per100_fat_g":null,"quantity":null,"energy_kcal":100,"carbs_g":10,"sugars_g":20}') $$,
  '%meal_entries_sugars_check%', 'los azúcares no superan los carbohidratos'
);

-- cálculo de valores (FR-004, FR-005) ---------------------------------------------------------------------------
select pg_temp.entry() as e1 \gset
select is((select energy_kcal from public.meal_entries where id = :'e1'), 195.00, 'FR-004: 130 kcal por 100 g × 150 g = 195 kcal');
select is((select protein_g from public.meal_entries where id = :'e1'), 4.05, 'las proteínas se calculan igual');
select is((select fiber_g from public.meal_entries where id = :'e1'), null, 'FR-005: un valor que falta en el alimento queda null, no 0');
select pg_temp.entry('{"per100_protein_g":3.33,"quantity":33}') as e3 \gset
select is((select protein_g from public.meal_entries where id = :'e3'), 1.10, 'el cálculo redondea a 2 decimales');
select pg_temp.entry('{"portion_name":"1 taza","portion_quantity":158,"portion_count":1.5,"quantity":1}') as e2 \gset
select is((select quantity from public.meal_entries where id = :'e2'), 237.00, 'FR-002: con porciones, la cantidad es porción × número de porciones');

-- inmutabilidad y snapshot (FR-010, FR-011, FR-019) -------------------------------------------------------------------
update public.foods set energy_kcal = 400 where id = :'food_id';
select is((select energy_kcal from public.meal_entries where id = :'e1'), 195.00, 'FR-011: editar el alimento no cambia el ítem');
update public.meal_entries set quantity = 300 where id = :'e1';
select is((select energy_kcal from public.meal_entries where id = :'e1'), 390.00, 'FR-019: al cambiar la cantidad se recalcula desde la instantánea, no desde el alimento actual');
select throws_ilike(format($$ update public.meal_entries set origin = 'manual' where id = %L $$, :'e1'), '%entry_identity_immutable%', 'el origen no se puede cambiar');
select throws_ilike(format($$ update public.meal_entries set per100_energy_kcal = 1 where id = %L $$, :'e1'), '%entry_identity_immutable%', 'la instantánea no se puede cambiar');

-- eliminar el alimento no toca el ítem (FR-011, FR-013) --------------------------------------------------------------
delete from public.foods where id = :'food_id';
select is(
  (select coalesce(food_id::text, 'sin-alimento') || ':' || food_name || ':' || energy_kcal from public.meal_entries where id = :'e1'),
  'sin-alimento:Arroz propio:390.00',
  'FR-013: sin el alimento, el ítem conserva su nombre y sus valores (food_id pasa a nulo)'
);
select is(
  (select count(*) from pg_constraint where confrelid = 'public.foods'::regclass and conrelid = 'public.meal_entries'::regclass and contype = 'f' and confdeltype = 'n'),
  1::bigint,
  'Principio II: la referencia al alimento es on delete set null'
);

-- unicidad -----------------------------------------------------------------------------------------------------------------
select pg_temp.entry('{"client_request_id":"dddddddd-0000-0000-0000-000000000001","food_id":null,"origin":"estimated","reference_basis":null,"per100_energy_kcal":null,"per100_protein_g":null,"per100_carbs_g":null,"per100_fat_g":null,"quantity":null,"energy_kcal":10}');
select throws_ilike(
  $$ select pg_temp.entry('{"client_request_id":"dddddddd-0000-0000-0000-000000000001","food_id":null,"origin":"estimated","reference_basis":null,"per100_energy_kcal":null,"per100_protein_g":null,"per100_carbs_g":null,"per100_fat_g":null,"quantity":null,"energy_kcal":10}') $$,
  '%meal_entries_request_key%', 'FR-009: único (user_id, client_request_id)'
);

insert into public.meal_photos (user_id, log_date, meal, storage_path, width, height, bytes)
values (:'uid', '2026-10-19', 'dinner', :'uid' || '/a.jpg', 800, 600, 1000);
select throws_ilike(
  format($$ insert into public.meal_photos (user_id, log_date, meal, storage_path, width, height, bytes) values (%L, '2026-10-19', 'dinner', %L, 800, 600, 1000) $$, :'uid', :'uid' || '/b.jpg'),
  '%meal_photos_day_meal_key%', 'una foto por comida y día'
);
select throws_ilike(
  format($$ insert into public.meal_photos (user_id, log_date, meal, storage_path, width, height, bytes) values (%L, '2026-10-19', 'snack', %L, 800, 600, 4000000) $$, :'uid', :'uid' || '/c.jpg'),
  '%meal_photos_bytes_check%', 'FR-033: hasta 3 MiB almacenados'
);

insert into public.log_day_starts (user_id, log_date) values (:'uid', '2026-10-19');
select throws_ilike(format($$ insert into public.log_day_starts (user_id, log_date) values (%L, '2026-10-19') $$, :'uid'), '%log_day_starts_pkey%', 'el inicio del día es único por cuenta y fecha');

-- cascada con la cuenta: se borran los ítems (los archivos de fotos requieren el flujo de eliminación de cuenta)
delete from auth.users where id = :'uid2';
select pass('eliminar una cuenta sin registros no falla');
delete from auth.users where id = :'uid';
select is((select count(*) from public.meal_entries where user_id = :'uid'), 0::bigint, 'al eliminar la cuenta se borran sus ítems');
select is((select count(*) from public.meal_photos where user_id = :'uid'), 0::bigint, 'y los registros de sus fotos');

select * from finish();
rollback;

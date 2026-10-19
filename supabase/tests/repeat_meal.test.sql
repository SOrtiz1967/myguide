-- T051 (spec 003, FR-028, FR-029): repetir una comida de otro día.
begin;
select plan(29);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin alimentos.
delete from public.foods;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.set_profile_timezone(:'uid_a', 'UTC');
select tests.set_profile_timezone(:'uid_b', 'UTC');

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('repetir-comidas', 'Fuente de repetir', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');

select tests.create_catalog_food('repetir-comidas', 'R-1', 'Arroz', null, 130, '100g', 2.7, 28, 0.3) as rice \gset
insert into public.food_portions (food_id, name, quantity, position) values (:'rice', '1 taza', 158, 0);
select id as cup from public.food_portions where food_id = :'rice' \gset
select tests.create_food(:'uid_a', 'Mi pan', null, 250, '100g', 8, 50, 3) as bread \gset
select tests.create_food(:'uid_a', 'Pan viejo', null, 300, '100g', 9, 55, 4) as gone \gset

-- almuerzo del 17: arroz en gramos, arroz en porciones, pan propio, algo manual y algo de un alimento que se eliminó
select tests.authenticate_as(:'uid_a');
select public.add_meal_entry(format('{"log_date":"2026-10-17","meal":"lunch","food_id":"%s","quantity":100}', :'rice')::jsonb, gen_random_uuid()) as s1 \gset
select public.add_meal_entry(format('{"log_date":"2026-10-17","meal":"lunch","food_id":"%s","portion_id":"%s","portion_count":2}', :'rice', :'cup')::jsonb, gen_random_uuid()) as s2 \gset
select public.add_meal_entry(format('{"log_date":"2026-10-17","meal":"lunch","food_id":"%s","quantity":60}', :'bread')::jsonb, gen_random_uuid()) as s3 \gset
select public.add_meal_entry('{"log_date":"2026-10-17","meal":"lunch","origin":"manual","description":"Torta","quantity_text":"1 porción","energy_kcal":350,"protein_g":6}'::jsonb, gen_random_uuid()) as s4 \gset
select public.add_meal_entry(format('{"log_date":"2026-10-17","meal":"lunch","food_id":"%s","quantity":80}', :'gone')::jsonb, gen_random_uuid()) as s5 \gset
select tests.clear_authentication();
-- el arroz cambia en el catálogo y el pan viejo desaparece
update public.foods set energy_kcal = 200 where id = :'rice';
delete from public.foods where id = :'gone';
select tests.create_manual_entry(:'uid_b', '2026-10-17', 'lunch', 'Ítem de B', 100) as b1 \gset

select tests.authenticate_as(:'uid_a');

-- vista previa (FR-028) ------------------------------------------------------------------------------------------------
select is(
  (select total || ':' || recalculated || ':' || copied from public.preview_repeat_meal('2026-10-17', 'lunch')),
  '5:3:2', 'FR-028: 5 ítems, 3 se recalculan (alimento vigente) y 2 se copian (manual y alimento eliminado)'
);
select is(
  (select total from public.preview_repeat_meal('2026-10-17', 'dinner')), 0, 'una comida vacía tiene 0 ítems'
);

-- repetir ----------------------------------------------------------------------------------------------------------------
select is(
  (select created || ':' || recalculated || ':' || copied
   from public.repeat_meal('2026-10-17', 'lunch', '2026-10-18', 'dinner', '00000000-0000-0000-0000-0000000000a1')),
  '5:3:2', 'FR-029: crea un ítem por cada ítem de origen'
);
select is((select count(*) from public.meal_entries where log_date = '2026-10-18' and meal = 'dinner'), 5::bigint, 'quedan 5 ítems en el destino');
select is((select count(*) from public.meal_entries where log_date = '2026-10-17' and meal = 'lunch'), 5::bigint, 'el origen sigue con sus 5 ítems');

select is(
  (select energy_kcal from public.meal_entries where log_date = '2026-10-18' and food_name = 'Arroz' and portion_name is null),
  200.00, 'lo que viene de un alimento vigente se recalcula con una instantánea nueva (100 g × 200 kcal)'
);
select is(
  (select energy_kcal from public.meal_entries where id = :'s1'), 130.00, 'y el ítem de origen conserva la suya'
);
select is(
  (select portion_name || ':' || portion_count || ':' || quantity from public.meal_entries
   where log_date = '2026-10-18' and portion_name is not null),
  '1 taza:2.00:316.00', 'conserva la porción y su número'
);
select is(
  (select origin || ':' || energy_kcal || ':' || quantity_text from public.meal_entries
   where log_date = '2026-10-18' and food_name = 'Torta'),
  'manual:350.00:1 porción', 'un manual se copia tal cual'
);
select is(
  (select origin || ':' || coalesce(food_id::text, 'sin-alimento') || ':' || energy_kcal from public.meal_entries
   where log_date = '2026-10-18' and food_name = 'Pan viejo'),
  'own:sin-alimento:240.00', 'lo de un alimento que ya no existe se copia con su instantánea y sin alimento'
);
select is(
  (select count(*) from public.meal_entries where log_date = '2026-10-18' and meal = 'dinner' and status = 'confirmed'),
  5::bigint, 'los nuevos están confirmados'
);

-- idempotencia ---------------------------------------------------------------------------------------------------------
select is(
  (select created || ':' || recalculated || ':' || copied
   from public.repeat_meal('2026-10-17', 'lunch', '2026-10-18', 'dinner', '00000000-0000-0000-0000-0000000000a1')),
  '5:3:2', 'repetir con la misma solicitud devuelve lo mismo'
);
select is((select count(*) from public.meal_entries where log_date = '2026-10-18' and meal = 'dinner'), 5::bigint, 'y no duplica');
select lives_ok($$ select * from public.repeat_meal('2026-10-17', 'lunch', '2026-10-18', 'dinner', '00000000-0000-0000-0000-0000000000a2') $$, 'repetir con una solicitud nueva');
select is((select count(*) from public.meal_entries where log_date = '2026-10-18' and meal = 'dinner'), 10::bigint, 'otra solicitud sí repite (duplica a propósito)');

-- el destino puede ser la misma comida y un reintento no copia lo que ya se creó
select lives_ok($$ select * from public.repeat_meal('2026-10-17', 'lunch', '2026-10-17', 'lunch', '00000000-0000-0000-0000-0000000000a3') $$, 'repetir con una solicitud nueva');
select is((select count(*) from public.meal_entries where log_date = '2026-10-17' and meal = 'lunch'), 10::bigint, 'la misma comida queda duplicada a propósito');
select is(
  (select created from public.repeat_meal('2026-10-17', 'lunch', '2026-10-17', 'lunch', '00000000-0000-0000-0000-0000000000a3')),
  5, 'un reintento sobre la misma comida sigue viendo los 5 ítems de origen'
);
select is((select count(*) from public.meal_entries where log_date = '2026-10-17' and meal = 'lunch'), 10::bigint, 'y no vuelve a duplicar');

-- independencia -------------------------------------------------------------------------------------------------------
select public.update_meal_entry(
  (select id from public.meal_entries where log_date = '2026-10-18' and food_name = 'Mi pan' limit 1), '{"quantity":120}'
);
select is((select quantity from public.meal_entries where id = :'s3'), 60.00, 'editar un ítem nuevo no cambia el de origen');

-- comidas vacías, ajenas e inválidas ---------------------------------------------------------------------------------
select is(
  (select created from public.repeat_meal('2026-10-17', 'snack', '2026-10-18', 'snack', gen_random_uuid())),
  0, 'repetir una comida vacía crea 0 ítems'
);
select tests.authenticate_as(:'uid_b');
select is(
  (select created from public.repeat_meal('2026-10-17', 'lunch', '2026-10-18', 'lunch', gen_random_uuid())),
  1, 'cada cuenta repite solo sus ítems'
);
select is(
  (select count(*) from public.meal_entries where log_date = '2026-10-18'), 1::bigint,
  'y no ve los de la otra cuenta'
);
select tests.authenticate_as(:'uid_a');
select throws_ilike(
  $$ select * from public.repeat_meal('2026-10-17', 'brunch', '2026-10-18', 'lunch', gen_random_uuid()) $$,
  '%invalid_meal%', 'comida de origen inválida'
);
select throws_ilike(
  $$ select * from public.repeat_meal('2026-10-17', 'lunch', '2026-10-18', 'brunch', gen_random_uuid()) $$,
  '%invalid_meal%', 'comida de destino inválida'
);
select throws_ilike(
  $$ select * from public.repeat_meal('2026-10-17', 'lunch', '1999-01-01', 'lunch', gen_random_uuid()) $$,
  '%invalid_date%', 'día de destino fuera de rango'
);
select throws_ilike(
  $$ select * from public.preview_repeat_meal('2026-10-17', 'brunch') $$, '%invalid_meal%', 'la vista previa valida la comida'
);

-- seguridad --------------------------------------------------------------------------------------------------------------
select tests.clear_authentication();
select tests.authenticate_as_anon();
select throws_ilike(
  $$ select * from public.repeat_meal('2026-10-17', 'lunch', '2026-10-18', 'lunch', gen_random_uuid()) $$,
  'permission denied%', 'anon no puede repetir'
);
select tests.clear_authentication();
select throws_ilike(
  $$ insert into public.meal_entries (user_id, log_date, meal, origin, food_name, reference_basis, quantity, per100_energy_kcal)
     values (gen_random_uuid(), '2026-10-18', 'lunch', 'catalog', 'Sin alimento', '100g', 100, 100) $$,
  '%food_required%', 'fuera de repetir, un ítem del catálogo sin alimento sigue rechazándose'
);

select * from finish();
rollback;

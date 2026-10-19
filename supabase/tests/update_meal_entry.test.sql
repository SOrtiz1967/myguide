-- T041 (spec 003, FR-011, FR-013, FR-019 a FR-022, FR-026, SC-004): corregir, mover y eliminar ítems.
begin;
select plan(36);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin alimentos.
delete from public.foods;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.set_profile_timezone(:'uid_a', 'UTC');

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('edicion-comidas', 'Fuente de edición', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');

select tests.create_catalog_food('edicion-comidas', 'U-1', 'Arroz', null, 130, '100g', 2.7, 28, 0.3) as rice \gset
insert into public.food_portions (food_id, name, quantity, position) values
  (:'rice', '1 taza', 158, 0), (:'rice', '1 cucharada', 12, 1);
select id as cup from public.food_portions where food_id = :'rice' and name = '1 taza' \gset
select id as spoon from public.food_portions where food_id = :'rice' and name = '1 cucharada' \gset

select tests.authenticate_as(:'uid_a');
select public.add_meal_entry(format('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":100}', :'rice')::jsonb, gen_random_uuid()) as e1 \gset
select public.add_meal_entry(format('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","portion_id":"%s","portion_count":1}', :'rice', :'cup')::jsonb, gen_random_uuid()) as e2 \gset
select public.add_meal_entry('{"log_date":"2026-10-19","meal":"extra","origin":"manual","description":"Torta","quantity_text":"1 porción","energy_kcal":350,"protein_g":6,"carbs_g":48,"fat_g":15}'::jsonb, gen_random_uuid()) as m1 \gset
select tests.clear_authentication();
select tests.create_manual_entry(:'uid_b', '2026-10-19', 'lunch', 'Torta de B', 400) as b1 \gset

-- cambiar la cantidad recalcula desde la instantánea (FR-019) -----------------------------------------------------
update public.foods set energy_kcal = 800, name = 'Arroz cambiado' where id = :'rice';
select tests.authenticate_as(:'uid_a');
select is(public.update_meal_entry(:'e1', '{"quantity":200}'), :'e1'::uuid, 'update_meal_entry devuelve el ítem');
select is((select energy_kcal from public.meal_entries where id = :'e1'), 260.00, 'FR-019: 200 g × 130 kcal de la instantánea, no de los 800 kcal actuales');
select is((select food_name from public.meal_entries where id = :'e1'), 'Arroz', 'el nombre registrado no cambia');
select is((select quantity from public.meal_entries where id = :'e1'), 200.00, 'guarda la nueva cantidad');

-- porciones -----------------------------------------------------------------------------------------------------------------
select public.update_meal_entry(:'e2', '{"portion_count":2}');
select is((select quantity || ':' || portion_count from public.meal_entries where id = :'e2'), '316.00:2.00', 'cambiar el número de porciones recalcula la cantidad');
select public.update_meal_entry(:'e2', format('{"portion_id":"%s","portion_count":3}', :'spoon')::jsonb);
select is((select portion_name || ':' || quantity from public.meal_entries where id = :'e2'), '1 cucharada:36.00', 'se puede elegir otra porción del alimento');
select public.update_meal_entry(:'e2', '{"quantity":50}');
select is((select coalesce(portion_name, 'sin-porcion') || ':' || quantity from public.meal_entries where id = :'e2'), 'sin-porcion:50.00', 'pasar a gramos quita la porción');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"portion_count":2}') $$, :'e1'), '%invalid_portion%', 'un ítem sin porción no admite cambiar su número de porciones');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"portion_id":"%s","portion_count":0}') $$, :'e2', :'cup'), '%invalid_portion_count%', '0 porciones se rechaza');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"quantity":0}') $$, :'e1'), '%invalid_quantity%', 'cantidad 0');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"quantity":5001}') $$, :'e1'), '%invalid_quantity%', 'más de 5000');

-- mover de comida y de día (FR-020) ------------------------------------------------------------------------------------------
select public.update_meal_entry(:'e1', '{"meal":"dinner"}');
select is((select meal from public.meal_entries where id = :'e1'), 'dinner', 'FR-020: se mueve a otra comida');
select public.update_meal_entry(:'e1', '{"log_date":"2026-10-18"}');
select is((select log_date from public.meal_entries where id = :'e1'), date '2026-10-18', 'FR-020: se mueve a otro día');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"meal":"brunch"}') $$, :'e1'), '%invalid_meal%', 'comida inválida');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"log_date":"1999-01-01"}') $$, :'e1'), '%invalid_date%', 'día inválido');
select is((select energy_kcal from public.meal_entries where id = :'e1'), 260.00, 'mover no cambia los valores');

-- ítems manuales (FR-021) -----------------------------------------------------------------------------------------------------
select public.update_meal_entry(:'m1', '{"description":"Torta de chocolate","quantity_text":"2 porciones","energy_kcal":420,"protein_g":null}');
select is(
  (select food_name || '|' || quantity_text || '|' || energy_kcal || '|' || coalesce(protein_g::text, 'sin-dato') || '|' || carbs_g from public.meal_entries where id = :'m1'),
  'Torta de chocolate|2 porciones|420.00|sin-dato|48.00',
  'FR-021: edita descripción y valores; lo no mencionado queda igual y un valor borrado queda sin dato'
);
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"energy_kcal":null}') $$, :'m1'), '%energy_required%', 'la energía sigue siendo obligatoria');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"fat_g":-1}') $$, :'m1'), '%negative_value%', 'mismas validaciones que al crear');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"sugars_g":99}') $$, :'m1'), '%sugars_exceed_carbs%', 'azúcares no mayores que carbohidratos');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"description":"  "}') $$, :'m1'), '%description_required%', 'la descripción no puede quedar vacía');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"quantity":100}') $$, :'m1'), '%invalid_change%', 'un ítem manual no tiene cantidad en gramos');
select is((select energy_kcal from public.meal_entries where id = :'m1'), 420.00, 'un rechazo no deja el ítem a medias');

-- la identidad no se cambia -------------------------------------------------------------------------------------------------------
select public.update_meal_entry(:'e1', '{"origin":"manual","food_name":"Hackeado","per100_energy_kcal":1,"user_id":"00000000-0000-0000-0000-000000000000","quantity":150}');
select is((select origin || ':' || food_name || ':' || per100_energy_kcal from public.meal_entries where id = :'e1'), 'catalog:Arroz:130.00', 'el origen y la instantánea no se pueden cambiar desde el cliente');

-- lo ajeno ------------------------------------------------------------------------------------------------------------------------------
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"meal":"snack"}') $$, :'b1'), '%not_found%', 'el ítem de otra cuenta se comporta como inexistente');
select throws_ilike($$ select public.update_meal_entry(gen_random_uuid(), '{"meal":"snack"}') $$, '%not_found%', 'un ítem inexistente');
select tests.clear_authentication();
select is((select meal from public.meal_entries where id = :'b1'), 'lunch', 'y no cambió nada');

-- el alimento desaparece o se reimporta: el ítem sigue editable y no cambia (FR-011, FR-013, SC-004) ------------------------------
select public.import_foods(
  'edicion-comidas',
  '[{"source_item_id":"U-1","name":"Arroz reimportado","name_status":"original","brand":null,"reference_basis":"100g","energy_kcal":500,"protein_g":1,"carbs_g":1,"sugars_g":null,"fat_g":1,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":null,"portions":[]}]'::jsonb
);
select is((select food_name || ':' || per100_energy_kcal from public.meal_entries where id = :'e1'), 'Arroz:130.00', 'SC-004: reimportar el catálogo no cambia el ítem');
delete from public.foods where id = :'rice';
select is((select coalesce(food_id::text, 'sin-alimento') from public.meal_entries where id = :'e1'), 'sin-alimento', 'FR-013: sin el alimento, el ítem queda con food_id nulo');
select tests.authenticate_as(:'uid_a');
select public.update_meal_entry(:'e1', '{"quantity":300}');
select is((select energy_kcal from public.meal_entries where id = :'e1'), 390.00, 'FR-019: aun sin el alimento, cambiar la cantidad recalcula desde la instantánea');
select throws_ilike(format($$ select public.update_meal_entry(%L, '{"portion_id":"%s","portion_count":1}') $$, :'e1', :'cup'), '%not_found%', 'elegir otra porción exige que el alimento todavía exista');

-- eliminar (FR-022) ---------------------------------------------------------------------------------------------------------------------
select lives_ok(format($$ delete from public.meal_entries where id = %L $$, :'b1'), 'el intento de eliminar el ítem de otra cuenta no falla...');
select lives_ok(format($$ delete from public.meal_entries where id = %L $$, :'e1'), 'FR-022: el dueño elimina su ítem');
select tests.clear_authentication();
select is((select count(*) from public.meal_entries where id = :'e1'), 0::bigint, 'y desaparece');
select is((select count(*) from public.meal_entries where id = :'b1'), 1::bigint, 'el de la otra cuenta sigue ahí');

-- acceso -------------------------------------------------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ilike($$ select public.update_meal_entry(gen_random_uuid(), '{}') $$, 'permission denied%', 'una petición anónima no puede editar');
select tests.clear_authentication();

select * from finish();
rollback;

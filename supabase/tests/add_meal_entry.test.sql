-- T018 (spec 003, FR-001 a FR-005, FR-009, FR-010, FR-012, FR-024, FR-027): agregar un ítem desde un alimento.
begin;
select plan(38);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin alimentos.
delete from public.foods;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.set_profile_timezone(:'uid_a', 'UTC');

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('comidas-prueba', 'Fuente de comidas', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');

select tests.create_catalog_food('comidas-prueba', 'M-1', 'Arroz blanco', 'Gallo', 130, '100g', 2.7, 28, 0.3) as rice \gset
insert into public.food_portions (food_id, name, quantity, position) values (:'rice', '1 taza', 158, 0);
select id as cup from public.food_portions where food_id = :'rice' \gset
select tests.create_catalog_food('comidas-prueba', 'M-2', 'Leche', null, 61, '100ml', 3.2, 4.8, 3.3) as milk \gset
select tests.create_catalog_food('comidas-prueba', 'M-3', 'Sin energia', null, null, '100g') as noenergy \gset
select tests.create_food(:'uid_a', 'Mi pan', null, 250, '100g', 8, 50, 3) as own_a \gset
select tests.create_food(:'uid_b', 'Pan de B', null, 260, '100g', 9, 51, 3) as own_b \gset
insert into public.food_portions (food_id, name, quantity, position) values (:'milk', '1 vaso', 200, 0);
select id as other_cup from public.food_portions where food_id = :'milk' \gset

select tests.authenticate_as(:'uid_a');

-- agregar desde el catálogo (FR-001, FR-004, FR-010) -------------------------------------------------------------
select public.add_meal_entry(
  format('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":150}', :'rice')::jsonb,
  'eeeeeeee-0000-0000-0000-000000000001'
) as e1 \gset

select is((select origin from public.meal_entries where id = :'e1'), 'catalog', 'FR-012: un alimento importado da un ítem "del catálogo"');
select is((select user_id from public.meal_entries where id = :'e1'), :'uid_a'::uuid, 'el ítem es de quien lo registró');
select is((select status from public.meal_entries where id = :'e1'), 'confirmed', 'queda confirmado');
select is((select energy_kcal from public.meal_entries where id = :'e1'), 195.00, 'FR-004: 130 kcal por 100 g × 150 g');
select is((select protein_g from public.meal_entries where id = :'e1'), 4.05, 'las proteínas se calculan igual');
select is((select fiber_g from public.meal_entries where id = :'e1'), null, 'FR-005: lo que falta en el alimento queda null, no 0');
select is(
  (select food_name || '|' || food_brand || '|' || reference_basis || '|' || per100_energy_kcal from public.meal_entries where id = :'e1'),
  'Arroz blanco|Gallo|100g|130.00',
  'FR-010: guarda la instantánea del alimento (nombre, marca, base y valores por 100)'
);
select is((select food_id from public.meal_entries where id = :'e1'), :'rice'::uuid, 'y la referencia al alimento');

-- agregar desde un alimento propio, líquidos y alimentos sin energía -------------------------------------------------
select public.add_meal_entry(format('{"log_date":"2026-10-19","meal":"snack","food_id":"%s","quantity":80}', :'own_a')::jsonb, gen_random_uuid()) as e2 \gset
select is((select origin from public.meal_entries where id = :'e2'), 'own', 'FR-012: un alimento propio da un ítem "propio"');
select public.add_meal_entry(format('{"log_date":"2026-10-19","meal":"breakfast","food_id":"%s","quantity":200}', :'milk')::jsonb, gen_random_uuid()) as e3 \gset
select is((select reference_basis || ':' || energy_kcal from public.meal_entries where id = :'e3'), '100ml:122.00', 'un líquido se registra en ml');
select public.add_meal_entry(format('{"log_date":"2026-10-19","meal":"extra","food_id":"%s","quantity":100}', :'noenergy')::jsonb, gen_random_uuid()) as e4 \gset
select is((select energy_kcal from public.meal_entries where id = :'e4'), null, 'un alimento sin energía da un ítem con la energía sin dato');

-- porciones (FR-002) -------------------------------------------------------------------------------------------------------
select public.add_meal_entry(format('{"log_date":"2026-10-19","meal":"dinner","food_id":"%s","portion_id":"%s","portion_count":1.5}', :'rice', :'cup')::jsonb, gen_random_uuid()) as e5 \gset
select is((select quantity from public.meal_entries where id = :'e5'), 237.00, 'FR-002: 1,5 tazas de 158 g = 237 g');
select is((select portion_name || ':' || portion_quantity || ':' || portion_count from public.meal_entries where id = :'e5'), '1 taza:158.00:1.50', 'guarda la porción elegida');
select is((select energy_kcal from public.meal_entries where id = :'e5'), 308.10, 'los valores se calculan para la cantidad equivalente');
select throws_ilike(
  format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","portion_id":"%s","portion_count":1}'::jsonb, gen_random_uuid()) $$, :'rice', :'other_cup'),
  '%invalid_portion%', 'una porción de otro alimento se rechaza'
);
select throws_ilike(
  format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","portion_id":"%s","portion_count":0}'::jsonb, gen_random_uuid()) $$, :'rice', :'cup'),
  '%invalid_portion_count%', 'FR-003: 0 porciones se rechaza'
);
select throws_ilike(
  format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","portion_id":"%s","portion_count":51}'::jsonb, gen_random_uuid()) $$, :'rice', :'cup'),
  '%invalid_portion_count%', 'FR-003: más de 50 porciones se rechaza'
);

-- cantidades (FR-003) -------------------------------------------------------------------------------------------------------
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":0}'::jsonb, gen_random_uuid()) $$, :'rice'), '%invalid_quantity%', 'FR-003: cantidad 0');
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":-5}'::jsonb, gen_random_uuid()) $$, :'rice'), '%invalid_quantity%', 'FR-003: cantidad negativa');
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":5001}'::jsonb, gen_random_uuid()) $$, :'rice'), '%invalid_quantity%', 'FR-003: más de 5000');
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s"}'::jsonb, gen_random_uuid()) $$, :'rice'), '%invalid_quantity%', 'falta la cantidad');
select public.add_meal_entry(format('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":12.5}', :'rice')::jsonb, gen_random_uuid()) as e6 \gset
select is((select quantity from public.meal_entries where id = :'e6'), 12.50, 'una cantidad decimal se guarda tal cual');

-- idempotencia (FR-009) ----------------------------------------------------------------------------------------------------------
select is(
  public.add_meal_entry(format('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":150}', :'rice')::jsonb, 'eeeeeeee-0000-0000-0000-000000000001'),
  :'e1'::uuid,
  'FR-009: repetir el request_id devuelve el mismo ítem'
);
select is((select count(*) from public.meal_entries where client_request_id = 'eeeeeeee-0000-0000-0000-000000000001'), 1::bigint, 'y no crea otro');

-- alimentos ajenos o inexistentes --------------------------------------------------------------------------------------------------
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":100}'::jsonb, gen_random_uuid()) $$, :'own_b'), '%not_found%', 'el alimento propio de otra cuenta se comporta como inexistente');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"00000000-0000-0000-0000-00000000dead","quantity":100}'::jsonb, gen_random_uuid()) $$, '%not_found%', 'un alimento inexistente');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","quantity":100}'::jsonb, gen_random_uuid()) $$, '%food_required%', 'sin alimento ni modo manual');

-- comida y día (FR-008, FR-024, FR-027) -------------------------------------------------------------------------------------------
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"brunch","food_id":"%s","quantity":100}'::jsonb, gen_random_uuid()) $$, :'rice'), '%invalid_meal%', 'comida inválida');
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"19/10/2026","meal":"lunch","food_id":"%s","quantity":100}'::jsonb, gen_random_uuid()) $$, :'rice'), '%invalid_date%', 'fecha con formato inválido');
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"1999-12-31","meal":"lunch","food_id":"%s","quantity":100}'::jsonb, gen_random_uuid()) $$, :'rice'), '%invalid_date%', 'antes del 2000');
select throws_ilike(
  format($$ select public.add_meal_entry(jsonb_build_object('log_date', (now() at time zone 'UTC')::date + 8, 'meal', 'lunch', 'food_id', %L, 'quantity', 100), gen_random_uuid()) $$, :'rice'),
  '%invalid_date%', 'más de 7 días en el futuro, en la zona del perfil'
);
select lives_ok(
  format($$ select public.add_meal_entry(jsonb_build_object('log_date', (now() at time zone 'UTC')::date + 7, 'meal', 'lunch', 'food_id', %L, 'quantity', 100), gen_random_uuid()) $$, :'rice'),
  'hasta 7 días en el futuro se admite'
);
select lives_ok(
  format($$ select public.add_meal_entry(jsonb_build_object('log_date', '2020-01-15', 'meal', 'lunch', 'food_id', %L, 'quantity', 100), gen_random_uuid()) $$, :'rice'),
  'FR-027: se puede registrar en un día pasado'
);

-- el cliente no puede forzar la identidad ----------------------------------------------------------------------------------------
select public.add_meal_entry(
  format('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":100,"status":"pending","origin":"manual","user_id":"%s","energy_kcal":1}', :'rice', :'uid_b')::jsonb,
  gen_random_uuid()
) as forged \gset
select is(
  (select origin || ':' || status || ':' || (user_id = :'uid_a'::uuid)::text || ':' || energy_kcal from public.meal_entries where id = :'forged'),
  'catalog:confirmed:true:130.00',
  'el origen, el estado, el dueño y los valores salen del servidor, no de lo que mande el cliente'
);

select tests.clear_authentication();

-- el alimento cambia después: el ítem no (SC-004) ------------------------------------------------------------------------------------
update public.foods set name = 'Arroz editado', energy_kcal = 800 where id = :'rice';
select is((select food_name || ':' || energy_kcal from public.meal_entries where id = :'e1'), 'Arroz blanco:195.00', 'SC-004: editar el alimento no cambia el ítem registrado');

-- aislamiento y acceso ---------------------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.meal_entries), 0::bigint, 'FR-036: B no ve los ítems de A');
select tests.clear_authentication();
select tests.authenticate_as_anon();
select throws_ilike($$ select public.add_meal_entry('{}'::jsonb, gen_random_uuid()) $$, 'permission denied%', 'una petición anónima no puede registrar');
select tests.clear_authentication();
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select throws_ilike(format($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","food_id":"%s","quantity":100}'::jsonb, gen_random_uuid()) $$, :'rice'), '%session_expired%', 'con la sesión vencida no se registra');
select tests.clear_authentication();

select * from finish();
rollback;

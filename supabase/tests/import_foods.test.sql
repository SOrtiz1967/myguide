-- T042 (spec 002, FR-013, FR-026, FR-027, FR-028): funciones de carga del catálogo (solo service_role).
begin;
select plan(34);

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('carga-prueba', 'Fuente de carga', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');
select id as sid from public.food_sources where slug = 'carga-prueba' \gset

select tests.create_user('a@test.local') as uid_a \gset

-- primera carga ----------------------------------------------------------------------------------------
select public.import_foods('carga-prueba', '[
  {"source_item_id":"X1","name":"Arroz","name_status":"machine_translated","brand":null,"reference_basis":"100g","energy_kcal":130,"protein_g":2.7,"carbs_g":28,"sugars_g":null,"fat_g":0.3,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":1,
   "portions":[{"name":"1 taza","quantity":158},{"name":"1 cucharada","quantity":12}]},
  {"source_item_id":"X2","name":"Leche","name_status":"original","brand":"Marca","reference_basis":"100ml","energy_kcal":62,"protein_g":null,"carbs_g":null,"sugars_g":null,"fat_g":null,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":null,"portions":[]}
]'::jsonb) as r1 \gset

select is((:'r1'::jsonb ->> 'created')::int, 2, 'FR-025: la primera carga crea los alimentos');
select is((:'r1'::jsonb ->> 'skipped')::int, 0, 'no omite ninguno');
select is((select count(*) from public.foods where source_id = :'sid'), 2::bigint, 'quedan dos alimentos del catálogo');
select is(
  (select origin || ':' || coalesce(user_id::text, 'sin-dueno') from public.foods where source_item_id = 'X1'),
  'imported:sin-dueno',
  'son del catálogo y no tienen dueño'
);
select ok((select imported_at is not null from public.foods where source_item_id = 'X1'), 'FR-011: registra la fecha de importación');
select is((select name_status from public.foods where source_item_id = 'X1'), 'machine_translated', 'FR-014: conserva el estado del nombre');
select is((select protein_g from public.foods where source_item_id = 'X2'), null, 'FR-028: un dato ausente queda null, no 0');
select is((select count(*) from public.food_portions p join public.foods f on f.id = p.food_id where f.source_item_id = 'X1'), 2::bigint, 'FR-029: guarda las porciones aparte');
select is((select p.user_id from public.food_portions p join public.foods f on f.id = p.food_id where f.source_item_id = 'X1' limit 1), null, 'las porciones del catálogo tampoco tienen dueño');

-- un alimento propio con el mismo nombre y una copia basada en el importado
select id as imported_id from public.foods where source_item_id = 'X1' \gset
select tests.create_food(:'uid_a', 'Arroz', null, 800) as own_id \gset
insert into public.foods (user_id, origin, name, reference_basis, energy_kcal, based_on_food_id)
values (:'uid_a', 'own', 'Mi versión de arroz', '100g', 111, :'imported_id');

-- repetir la carga, con datos cambiados (FR-026) ---------------------------------------------------------
select public.import_foods('carga-prueba', '[
  {"source_item_id":"X1","name":"Arroz blanco","name_status":"reviewed","brand":null,"reference_basis":"100g","energy_kcal":135,"protein_g":2.7,"carbs_g":28,"sugars_g":null,"fat_g":0.3,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":1,
   "portions":[{"name":"1 taza","quantity":160}]},
  {"source_item_id":"X2","name":"Leche","name_status":"original","brand":"Marca","reference_basis":"100ml","energy_kcal":62,"protein_g":null,"carbs_g":null,"sugars_g":null,"fat_g":null,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":null,"portions":[]}
]'::jsonb) as r2 \gset

select is((:'r2'::jsonb ->> 'created')::int, 0, 'FR-026: repetir la carga no crea duplicados');
select is((:'r2'::jsonb ->> 'updated')::int, 2, 'FR-026: actualiza los alimentos existentes');
select is((select count(*) from public.foods where source_id = :'sid'), 2::bigint, 'siguen siendo dos');
select is((select id from public.foods where source_item_id = 'X1'), :'imported_id'::uuid, 'el alimento conserva su identificador');
select is((select name from public.foods where source_item_id = 'X1'), 'Arroz blanco', 'se actualizó el nombre');
select is((select energy_kcal from public.foods where source_item_id = 'X1'), 135.00, 'se actualizaron los valores');
select is((select name_status from public.foods where source_item_id = 'X1'), 'reviewed', 'se actualizó el estado del nombre');
select is((select count(*) from public.food_portions where food_id = :'imported_id'), 1::bigint, 'las porciones se reemplazan por las nuevas');

-- lo propio y las copias no se tocan (FR-027) ---------------------------------------------------------------
select is((select count(*) from public.foods where user_id = :'uid_a' and name = 'Arroz'), 1::bigint, 'FR-027: el alimento propio con el mismo nombre sigue existiendo');
select is((select origin from public.foods where id = :'own_id'), 'own', 'sigue siendo propio');
select is(
  (select energy_kcal from public.foods where name = 'Mi versión de arroz'),
  111.00,
  'FR-027: la copia conserva sus valores aunque el original cambió'
);
select is((select based_on_food_id from public.foods where name = 'Mi versión de arroz'), :'imported_id'::uuid, 'la copia sigue apuntando a su original');

-- registros inválidos: se omiten con su motivo y no frenan al resto (FR-028) --------------------------------
select public.import_foods('carga-prueba', '[
  {"source_item_id":"OK","name":"Valido","name_status":"original","brand":null,"reference_basis":"100g","energy_kcal":50,"protein_g":null,"carbs_g":null,"sugars_g":null,"fat_g":null,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":null,"portions":[]},
  {"source_item_id":"BAD1","name":"Proteina imposible","name_status":"original","brand":null,"reference_basis":"100g","energy_kcal":50,"protein_g":120,"carbs_g":null,"sugars_g":null,"fat_g":null,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":null,"portions":[]},
  {"source_item_id":"BAD2","name":"","name_status":"original","brand":null,"reference_basis":"100g","energy_kcal":50,"protein_g":null,"carbs_g":null,"sugars_g":null,"fat_g":null,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":null,"portions":[]},
  {"source_item_id":"BAD3","name":"Porcion imposible","name_status":"original","brand":null,"reference_basis":"100g","energy_kcal":50,"protein_g":null,"carbs_g":null,"sugars_g":null,"fat_g":null,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":null,"portions":[{"name":"x","quantity":-1}]},
  {"source_item_id":"BAD4","name":"Macros","name_status":"original","brand":null,"reference_basis":"100g","energy_kcal":50,"protein_g":60,"carbs_g":30,"sugars_g":null,"fat_g":20,"saturated_fat_g":null,"fiber_g":null,"sodium_mg":null,"portions":[]}
]'::jsonb) as r3 \gset

select is((:'r3'::jsonb ->> 'created')::int, 1, 'FR-028: crea el válido aunque haya inválidos');
select is((:'r3'::jsonb ->> 'skipped')::int, 4, 'FR-028: omite los cuatro inválidos');
select is((:'r3'::jsonb -> 'skipped_reasons' ->> 'macros_exceed_100')::int, 1, 'informa el motivo de cada omisión');
select is((select count(*) from public.foods where source_item_id like 'BAD%'), 0::bigint, 'ningún inválido queda cargado, ni a medias');

-- licencia (FR-013) --------------------------------------------------------------------------------------
select throws_ilike($$ select public.import_foods('no-existe', '[]'::jsonb) $$, '%source_not_found%', 'una fuente desconocida se rechaza');

alter table public.food_sources drop constraint food_sources_text_check;
update public.food_sources set license_name = '' where id = :'sid';
select throws_ilike($$ select public.import_foods('carga-prueba', '[]'::jsonb) $$, '%license_missing%', 'FR-013: una fuente sin licencia se rechaza');
update public.food_sources set license_name = 'CC0 1.0' where id = :'sid';

-- cierre de la carga ----------------------------------------------------------------------------------------
select public.finish_import('carga-prueba', '{"created":3,"updated":2,"skipped":4,"skipped_reasons":{"macros_exceed_100":1}}'::jsonb);
select is((select food_count from public.food_sources where id = :'sid'), 3, 'finish_import actualiza la cantidad de alimentos');
select ok((select last_imported_at is not null from public.food_sources where id = :'sid'), 'finish_import registra la fecha de la última importación');
select is((select created_count || '/' || updated_count || '/' || skipped_count from private.import_runs where source_id = :'sid'), '3/2/4', 'finish_import registra el informe');

-- permisos: solo service_role ---------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select throws_ilike($$ select public.import_foods('carga-prueba', '[]'::jsonb) $$, 'permission denied%', 'una cuenta con sesión no puede cargar el catálogo');
select throws_ilike($$ select public.finish_import('carga-prueba', '{}'::jsonb) $$, 'permission denied%', 'una cuenta con sesión no puede cerrar una carga');
select tests.clear_authentication();
select tests.authenticate_as_anon();
select throws_ilike($$ select public.import_foods('carga-prueba', '[]'::jsonb) $$, 'permission denied%', 'una petición anónima no puede cargar el catálogo');
select tests.clear_authentication();
set local role service_role;
select lives_ok($$ select public.import_foods('carga-prueba', '[]'::jsonb) $$, 'service_role sí puede cargar');
reset role;

select * from finish();
rollback;

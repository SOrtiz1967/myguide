-- T019 (spec 003, FR-040): los recientes de la persona al agregar a una comida.
begin;
select plan(19);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin alimentos.
delete from public.foods;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('recientes-prueba', 'Fuente de recientes', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');

select tests.create_catalog_food('recientes-prueba', 'R-1', 'Arroz', null, 130, '100g', 2.7, 28, 0.3) as rice \gset
insert into public.food_portions (food_id, name, quantity, position) values (:'rice', '1 taza', 158, 0);
select id as cup from public.food_portions where food_id = :'rice' \gset
select tests.create_food(:'uid_a', 'Mi pan', null, 250, '100g', 8, 50, 3) as bread \gset
select tests.create_food(:'uid_a', 'Fideos', null, 350, '100g', 12, 72, 1.5) as pasta \gset

-- historial de A, con instantes distintos (todo ocurre en una transacción)
select tests.create_meal_entry(:'uid_a', '2026-10-15', 'lunch', :'rice', 100) as r1 \gset
select tests.create_meal_entry(:'uid_a', '2026-10-16', 'lunch', :'rice', 180) as r2 \gset
select tests.create_meal_entry(:'uid_a', '2026-10-17', 'snack', :'bread', 60) as b1 \gset
select tests.create_manual_entry(:'uid_a', '2026-10-17', 'extra', 'Torta de cumpleaños', 350) as t1 \gset
select tests.create_manual_entry(:'uid_a', '2026-10-18', 'extra', 'TORTA DE CUMPLEAÑOS', 380) as t2 \gset
select tests.create_meal_entry(:'uid_a', '2026-10-18', 'dinner', :'pasta', 200) as p1 \gset
update public.meal_entries set created_at = '2026-10-15 12:00+00' where id = :'r1';
update public.meal_entries set created_at = '2026-10-16 12:00+00' where id = :'r2';
update public.meal_entries set created_at = '2026-10-17 12:00+00' where id = :'b1';
update public.meal_entries set created_at = '2026-10-17 13:00+00' where id = :'t1';
update public.meal_entries set created_at = '2026-10-18 13:00+00' where id = :'t2';
update public.meal_entries set created_at = '2026-10-18 20:00+00' where id = :'p1';
select tests.create_manual_entry(:'uid_b', '2026-10-18', 'lunch', 'Ítem de B', 100);

select tests.authenticate_as(:'uid_a');

select is(
  (select array_agg(lower(btrim(food_name)) order by last_logged_at desc) from public.recent_meal_items()),
  array['fideos', 'torta de cumpleaños', 'mi pan', 'arroz'],
  'FR-040: del más reciente al más viejo, un solo elemento por alimento'
);
select is((select count(*) from public.recent_meal_items() where food_name = 'Arroz'), 1::bigint, 'el mismo alimento registrado dos veces aparece una sola vez');
select is((select quantity from public.recent_meal_items() where food_name = 'Arroz'), 180.00, 'con la última cantidad usada');
select is((select count(*) from public.recent_meal_items() where lower(food_name) like 'torta%'), 1::bigint, 'los manuales se identifican por su descripción sin importar mayúsculas');
select is((select energy_kcal from public.recent_meal_items() where lower(food_name) like 'torta%'), 380.00, 'y se vuelven a registrar con los valores de la última vez');
select is((select origin from public.recent_meal_items() where food_name = 'Arroz'), 'catalog', 'el origen del catálogo se mantiene');
select is((select origin from public.recent_meal_items() where food_name = 'Mi pan'), 'own', 'y el propio también');
select is((select origin from public.recent_meal_items() where lower(food_name) like 'torta%'), 'manual', 'y el manual');
select is((select count(*) from public.recent_meal_items() where food_name = 'Ítem de B'), 0::bigint, 'no mezcla cuentas');
select is((select food_id from public.recent_meal_items() where food_name = 'Mi pan'), :'bread'::uuid, 'los que vienen de un alimento traen su identificador para volver a registrarlos');

-- los valores salen del alimento ACTUAL, porque al volver a registrarlo se toma una instantánea nueva
select tests.clear_authentication();
update public.foods set energy_kcal = 200, name = 'Arroz mejorado' where id = :'rice';
select tests.authenticate_as(:'uid_a');
select is((select energy_kcal from public.recent_meal_items() where food_id = :'rice'), 360.00, 'los valores se calculan con el alimento actual (200 kcal × 180 g)');
select is((select food_name from public.recent_meal_items() where food_id = :'rice'), 'Arroz mejorado', 'y el nombre también');

-- porciones
select tests.clear_authentication();
select tests.authenticate_as(:'uid_a');
select public.add_meal_entry(format('{"log_date":"2026-10-18","meal":"lunch","food_id":"%s","portion_id":"%s","portion_count":1.5}', :'rice', :'cup')::jsonb, gen_random_uuid()) as pe \gset
select tests.clear_authentication();
update public.meal_entries set created_at = '2026-10-19 12:00+00' where id = :'pe';
select tests.authenticate_as(:'uid_a');
select is(
  (select portion_id::text || ':' || portion_count || ':' || quantity from public.recent_meal_items() where food_id = :'rice'),
  :'cup' || ':1.50:237.00',
  'una porción se recuerda con su número y su cantidad equivalente'
);
select tests.clear_authentication();
update public.food_portions set name = '1 vaso' where id = :'cup';
select tests.authenticate_as(:'uid_a');
select is(
  (select coalesce(portion_id::text, 'sin-porcion') || ':' || quantity from public.recent_meal_items() where food_id = :'rice'),
  'sin-porcion:237.00',
  'si la porción ya no existe con ese nombre, queda la cantidad en gramos'
);

-- un alimento eliminado deja de aparecer
select tests.clear_authentication();
delete from public.foods where id = :'pasta';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.recent_meal_items() where food_name = 'Fideos'), 0::bigint, 'FR-040: un reciente cuyo alimento ya no existe no se muestra');

-- tope
select tests.clear_authentication();
insert into public.meal_entries (user_id, log_date, meal, origin, food_name, energy_kcal, created_at)
select :'uid_a', '2026-10-10', 'extra', 'manual', 'Manual ' || n, 10, '2026-10-01 00:00+00'::timestamptz + n * interval '1 minute'
from generate_series(1, 60) n;
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.recent_meal_items()), 20::bigint, 'por defecto devuelve hasta 20');
select is((select count(*) from public.recent_meal_items(5)), 5::bigint, 'el máximo se puede acotar');
select is((select count(*) from public.recent_meal_items(500)), 50::bigint, 'y nunca más de 50');
select tests.clear_authentication();

select tests.authenticate_as_anon();
select throws_ilike($$ select * from public.recent_meal_items() $$, 'permission denied%', 'una petición anónima no accede');
select tests.clear_authentication();

select * from finish();
rollback;

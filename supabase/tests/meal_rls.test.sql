-- T008 (spec 003, FR-036): ítems, inicios de día y fotos son privados de cada cuenta.
begin;
select plan(21);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin alimentos.
delete from public.foods;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_manual_entry(:'uid_a', '2026-10-19', 'lunch', 'Torta de A', 350) as a1 \gset
select tests.create_manual_entry(:'uid_b', '2026-10-19', 'lunch', 'Torta de B', 400) as b1 \gset
insert into public.log_day_starts (user_id, log_date) values (:'uid_a', '2026-10-19'), (:'uid_b', '2026-10-19');
insert into public.meal_photos (user_id, log_date, meal, storage_path, width, height, bytes) values
  (:'uid_a', '2026-10-19', 'lunch', :'uid_a' || '/a.jpg', 800, 600, 1000),
  (:'uid_b', '2026-10-19', 'lunch', :'uid_b' || '/b.jpg', 800, 600, 1000);

-- Cuenta A --------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');

select is((select count(*) from public.meal_entries where food_name = 'Torta de A'), 1::bigint, 'FR-036: A ve su ítem');
select is((select count(*) from public.meal_entries where food_name = 'Torta de B'), 0::bigint, 'FR-036: A no ve el ítem de B');
select is((select count(*) from public.log_day_starts), 1::bigint, 'A ve solo sus inicios de día');
select is((select count(*) from public.meal_photos), 1::bigint, 'A ve solo sus fotos');
select is((select storage_path from public.meal_photos), :'uid_a' || '/a.jpg', 'y es la suya');

-- el cliente no escribe directamente: los ítems nacen de las funciones, que toman la instantánea
select throws_ilike(
  format($$ insert into public.meal_entries (user_id, log_date, meal, origin, food_name, energy_kcal) values (%L, '2026-10-19', 'lunch', 'manual', 'Intento', 100) $$, :'uid_a'),
  'permission denied%', 'el cliente no puede insertar ítems directamente'
);
select throws_ilike(
  format($$ update public.meal_entries set energy_kcal = 1 where id = %L $$, :'a1'),
  'permission denied%', 'el cliente no puede modificar ítems directamente'
);
select throws_ilike(
  format($$ insert into public.log_day_starts (user_id, log_date) values (%L, '2026-10-20') $$, :'uid_a'),
  'permission denied%', 'el inicio del día se registra con la función'
);
select throws_ilike(
  format($$ insert into public.meal_photos (user_id, log_date, meal, storage_path, width, height, bytes) values (%L, '2026-10-20', 'lunch', 'x', 1, 1, 1) $$, :'uid_a'),
  'permission denied%', 'FR-031: una foto solo entra por la función que le quita los metadatos'
);
select throws_ilike(
  $$ delete from public.meal_photos $$,
  'permission denied%', 'una foto solo se elimina por la función, que también borra el archivo'
);

-- borrar lo propio sí; lo ajeno no afecta nada
select lives_ok($$ delete from public.meal_entries where food_name = 'Torta de B' $$, 'el intento de borrar lo de B no falla...');
select tests.clear_authentication();
select is((select count(*) from public.meal_entries where food_name = 'Torta de B'), 1::bigint, '...y no borra nada');
select tests.authenticate_as(:'uid_a');
select lives_ok(format($$ delete from public.meal_entries where id = %L $$, :'a1'), 'FR-022: A puede borrar su ítem');
select is((select count(*) from public.meal_entries where id = :'a1'), 0::bigint, 'y desaparece');
select tests.clear_authentication();

-- sesión vencida ------------------------------------------------------------------------------------------------
select tests.create_manual_entry(:'uid_a', '2026-10-19', 'dinner', 'Cena de A', 500) as a2 \gset
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.meal_entries), 0::bigint, 'FR-036: con la sesión vencida no ve ítems');
select is((select count(*) from public.meal_photos), 0::bigint, '...ni fotos');
select is((select count(*) from public.log_day_starts), 0::bigint, '...ni inicios de día');
select lives_ok(format($$ delete from public.meal_entries where id = %L $$, :'a2'), 'y borrar no afecta nada');
select tests.clear_authentication();
select is((select count(*) from public.meal_entries where id = :'a2'), 1::bigint, 'el ítem sigue ahí');

-- anónimo ------------------------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ilike($$ select * from public.meal_entries $$, 'permission denied%', 'una petición anónima no accede a los ítems');
select throws_ilike($$ select * from public.meal_photos $$, 'permission denied%', 'ni a las fotos');
select tests.clear_authentication();

select * from finish();
rollback;

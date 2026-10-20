-- T005 (spec 004, FR-023): el historial del objetivo es privado de cada cuenta y el cliente solo lo lee.
begin;
select plan(13);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_energy_goal(:'uid_a', '2026-10-01', 2000);
select tests.create_energy_goal(:'uid_b', '2026-10-01', 1500);
select id as a_row from public.energy_goals where user_id = :'uid_a' \gset

-- Cuenta A --------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');

select is((select count(*) from public.energy_goals), 1::bigint, 'FR-023: A ve solo su historial');
select is((select kcal from public.energy_goals), 2000, 'y es el suyo');

-- el cliente no escribe directamente: el objetivo entra por set_energy_goal
select throws_ilike(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '2026-10-19', 1800, gen_random_uuid()) $$, :'uid_a'),
  'permission denied%', 'el cliente no puede insertar directamente'
);
select throws_ilike(
  format($$ update public.energy_goals set kcal = 1800 where id = %L $$, :'a_row'),
  'permission denied%', 'el cliente no puede modificar una fila'
);
select throws_ilike(
  format($$ delete from public.energy_goals where id = %L $$, :'a_row'),
  'permission denied%', 'el cliente no puede borrar una fila (solo la cascada al eliminar la cuenta)'
);

-- Cuenta B no ve ni cambia lo de A ----------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.energy_goals), 1::bigint, 'B ve solo su historial');
select is((select kcal from public.energy_goals), 1500, 'y es el suyo');
select is((select count(*) from public.energy_goals where user_id = :'uid_a'), 0::bigint, 'B no ve nada de A');
select throws_ilike(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '2026-10-19', 1800, gen_random_uuid()) $$, :'uid_a'),
  'permission denied%', 'B no puede insertar filas a nombre de A'
);
select tests.clear_authentication();
select is((select count(*) from public.energy_goals where user_id = :'uid_a'), 1::bigint, 'el historial de A sigue intacto');

-- sesión vencida ------------------------------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.energy_goals), 0::bigint, 'FR-023: con la sesión vencida no ve nada');
select tests.clear_authentication();

-- anónimo ------------------------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ilike($$ select * from public.energy_goals $$, 'permission denied%', 'una petición anónima no accede al historial');
select throws_ilike(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '2026-10-19', 1800, gen_random_uuid()) $$, :'uid_a'),
  'permission denied%', 'ni escribe'
);
select tests.clear_authentication();

select * from finish();
rollback;

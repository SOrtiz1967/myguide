-- T006 (spec 006, FR-050): rutinas y sesiones privadas de cada cuenta; el cliente no escribe directamente.
begin;
select plan(34);

-- La base local puede tener datos: la prueba parte de una base sin rutinas ni sesiones (todo se deshace al final).
delete from public.workout_sessions;
delete from public.routines;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_exercise(:'uid_a', 'Press de A e2e', 'reps_weight') as ex_a \gset
select tests.create_exercise(:'uid_b', 'Press de B e2e', 'reps_weight') as ex_b \gset

-- datos de A: una rutina, una sesión con plan, un ejercicio realizado con una serie y un cambio de fecha
select tests.create_routine(:'uid_a', 'Rutina de A', array[:'ex_a'::uuid]) as r_a \gset
select tests.create_session(:'uid_a', date '2026-10-20', 'completed', :'r_a', true) as s_a \gset
select tests.add_session_exercise(:'s_a', :'ex_a') as x_a \gset
select tests.add_session_set(:'x_a', 8, 60) as set_a \gset
insert into public.session_date_changes (session_id, user_id, from_date, to_date)
values (:'s_a', :'uid_a', date '2026-10-19', date '2026-10-20');

-- datos de B
select tests.create_routine(:'uid_b', 'Rutina de B', array[:'ex_b'::uuid]) as r_b \gset
select tests.create_session(:'uid_b', date '2026-10-21', 'completed', :'r_b', true) as s_b \gset
select tests.add_session_exercise(:'s_b', :'ex_b') as x_b \gset
select tests.add_session_set(:'x_b', 10, 40) as set_b \gset

-- Cuenta A ve lo suyo y nada de B -------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');

select is((select count(*) from public.routines), 1::bigint, 'FR-050: A ve solo su rutina');
select is((select count(*) from public.routine_exercises), 1::bigint, 'A ve solo los ejercicios de su rutina');
select is((select count(*) from public.workout_sessions), 1::bigint, 'A ve solo su sesión');
select is((select count(*) from public.session_plan_items), 1::bigint, 'A ve solo el plan de su sesión');
select is((select count(*) from public.session_exercises), 1::bigint, 'A ve solo sus ejercicios realizados');
select is((select count(*) from public.session_sets), 1::bigint, 'A ve solo sus series');
select is((select count(*) from public.session_date_changes), 1::bigint, 'A ve solo su recorrido de fechas');
select is(
  (select count(*) from public.workout_sessions where id = :'s_b' or user_id = :'uid_b'), 0::bigint,
  'FR-050: la sesión de B es indistinguible de una inexistente'
);

-- el cliente no escribe directamente en ninguna tabla --------------------------------------------------------------------
select throws_ilike(format($$ insert into public.routines (user_id, name) values (%L, 'Nueva') $$, :'uid_a'), 'permission denied%', 'el cliente no inserta rutinas directamente');
select throws_ilike($$ update public.routines set name = 'Cambiada' $$, 'permission denied%', 'el cliente no actualiza rutinas directamente');
select throws_ilike(
  format($$ insert into public.routine_exercises (routine_id, user_id, position, exercise_name, measurement_type, sets) values (%L, %L, 5, 'X', 'duration', 3) $$, :'r_a', :'uid_a'),
  'permission denied%', 'el cliente no inserta ejercicios de rutina directamente'
);
select throws_ilike(
  format($$ insert into public.workout_sessions (user_id, session_date, original_date, status) values (%L, date '2026-10-30', date '2026-10-30', 'planned') $$, :'uid_a'),
  'permission denied%', 'el cliente no inserta sesiones directamente'
);
select throws_ilike($$ update public.workout_sessions set note = 'Hola' $$, 'permission denied%', 'el cliente no actualiza sesiones directamente');
select throws_ilike(
  format($$ insert into public.session_plan_items (session_id, user_id, position, exercise_name, measurement_type, sets) values (%L, %L, 9, 'X', 'duration', 3) $$, :'s_a', :'uid_a'),
  'permission denied%', 'el cliente no inserta ítems del plan directamente'
);
select throws_ilike($$ update public.session_plan_items set sets = 4 $$, 'permission denied%', 'el cliente no actualiza el plan directamente');
select throws_ilike(
  format($$ insert into public.session_exercises (session_id, user_id, position, exercise_name, measurement_type) values (%L, %L, 9, 'X', 'duration') $$, :'s_a', :'uid_a'),
  'permission denied%', 'el cliente no inserta ejercicios realizados directamente'
);
select throws_ilike($$ update public.session_exercises set effort = 5 $$, 'permission denied%', 'el cliente no actualiza ejercicios realizados directamente');
select throws_ilike(
  format($$ insert into public.session_sets (session_exercise_id, session_id, user_id, position, reps) values (%L, %L, %L, 9, 5) $$, :'x_a', :'s_a', :'uid_a'),
  'permission denied%', 'el cliente no inserta series directamente'
);
select throws_ilike($$ update public.session_sets set reps = 9 $$, 'permission denied%', 'el cliente no actualiza series directamente');
select throws_ilike(
  format($$ insert into public.session_date_changes (session_id, user_id, from_date, to_date) values (%L, %L, date '2026-10-20', date '2026-10-21') $$, :'s_a', :'uid_a'),
  'permission denied%', 'el cliente no inserta cambios de fecha directamente'
);

-- borrar: solo rutinas y sesiones, y solo lo propio ------------------------------------------------------------------------
select throws_ilike($$ delete from public.session_sets $$, 'permission denied%', 'el cliente no borra series directamente');
select throws_ilike($$ delete from public.session_exercises $$, 'permission denied%', 'el cliente no borra ejercicios realizados directamente');
select throws_ilike($$ delete from public.session_plan_items $$, 'permission denied%', 'el cliente no borra el plan directamente');
select throws_ilike($$ delete from public.routine_exercises $$, 'permission denied%', 'el cliente no borra ejercicios de rutina directamente');
select throws_ilike($$ delete from public.session_date_changes $$, 'permission denied%', 'el cliente no borra el recorrido de fechas');

select lives_ok(
  format($$ delete from public.workout_sessions where id = %L $$, :'s_b'), 'el intento de borrar la sesión de B no falla...'
);
select lives_ok(
  format($$ delete from public.routines where id = %L $$, :'r_b'), '...ni el de borrar la rutina de B (no afectan ninguna fila)'
);
select tests.clear_authentication();
select is(
  (select count(*) from public.workout_sessions where id = :'s_b') + (select count(*) from public.routines where id = :'r_b'),
  2::bigint, 'FR-050: la sesión y la rutina de B siguen ahí'
);

-- Cuenta B puede borrar lo suyo ----------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.workout_sessions), 1::bigint, 'B ve solo su sesión');
select lives_ok(format($$ delete from public.workout_sessions where id = %L $$, :'s_b'), 'B puede borrar su sesión');
select tests.clear_authentication();
select is((select count(*) from public.session_sets where user_id = :'uid_b'), 0::bigint, 'y sus series se borran con ella');

-- sesión vencida y sin sesión: nada es visible --------------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.routines) + (select count(*) from public.workout_sessions), 0::bigint, 'con la sesión vencida no se ve nada');
select tests.clear_authentication();
select tests.authenticate_as_anon();
select throws_ilike($$ select count(*) from public.routines $$, 'permission denied%', 'FR-050: anon no accede a las rutinas');
select throws_ilike($$ select count(*) from public.workout_sessions $$, 'permission denied%', 'FR-050: anon no accede a las sesiones');
select tests.clear_authentication();

select * from finish();
rollback;

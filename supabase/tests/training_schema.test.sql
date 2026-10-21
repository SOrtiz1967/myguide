-- T003 (spec 006, FR-001, FR-002, FR-008, FR-009, FR-028 a FR-036, FR-040, FR-054): integridad de rutinas y sesiones.
begin;
select plan(95);

-- La base local puede tener datos: la prueba parte de una base sin rutinas ni sesiones (todo se deshace al final).
delete from public.workout_sessions;
delete from public.routines;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- psql no interpola variables dentro de $$...$$: las que se usan ahí se leen de esta tabla temporal.
create temp table vars (k text primary key, v uuid);
grant all on vars to public;
insert into vars values ('uid_a', :'uid_a'), ('uid_b', :'uid_b');
create function pg_temp.id(p_key text) returns uuid language sql as $f$ select v from pg_temp.vars where k = p_key $f$;

-- ejercicios propios de A, uno por tipo de medición
select tests.create_exercise(:'uid_a', 'Press e2e', 'reps_weight') as ex_rw \gset
select tests.create_exercise(:'uid_a', 'Flexiones e2e', 'reps_bodyweight') as ex_bw \gset
select tests.create_exercise(:'uid_a', 'Plancha e2e', 'duration') as ex_d \gset
select tests.create_exercise(:'uid_a', 'Correr e2e', 'distance_duration') as ex_dd \gset

-- Atajos para insertar filas válidas con columnas extra ------------------------------------------------------------------
create function pg_temp.ins_routine(p_user uuid, p_name text, p_extra_cols text default '', p_extra_vals text default '')
returns void language plpgsql as $$
begin
  execute format('insert into public.routines (user_id, name%s) values (%L, %L%s)', p_extra_cols, p_user, p_name, p_extra_vals);
end $$;

create function pg_temp.ins_item(p_routine uuid, p_user uuid, p_pos int, p_exercise uuid, p_type text, p_cols text default '', p_vals text default '')
returns void language plpgsql as $$
begin
  execute format(
    'insert into public.routine_exercises (routine_id, user_id, position, exercise_id, exercise_name, measurement_type, sets%s) values (%L, %L, %s, %L, %L, %L, 3%s)',
    p_cols, p_routine, p_user, p_pos, p_exercise, 'Ejercicio ' || p_pos, p_type, p_vals);
end $$;

create function pg_temp.ins_session(p_user uuid, p_status text, p_cols text default '', p_vals text default '')
returns void language plpgsql as $$
begin
  execute format(
    'insert into public.workout_sessions (user_id, session_date, original_date, status%s) values (%L, date %L, date %L, %L%s)',
    p_cols, p_user, '2026-10-22', '2026-10-22', p_status, p_vals);
end $$;

-- rutinas ------------------------------------------------------------------------------------------------------------------
select lives_ok($$ select pg_temp.ins_routine(pg_temp.id('uid_a')::uuid, 'Torso A') $$, 'FR-001: una rutina válida');
select throws_ilike($$ select pg_temp.ins_routine(pg_temp.id('uid_a')::uuid, '') $$, '%violates check constraint%', 'FR-001: un nombre vacío se rechaza');
select throws_ilike(format($$ select pg_temp.ins_routine(%L::uuid, %L) $$, :'uid_a', repeat('a', 81)), '%violates check constraint%', 'FR-001: un nombre de 81 caracteres se rechaza');
select lives_ok(format($$ select pg_temp.ins_routine(%L::uuid, %L) $$, :'uid_a', repeat('a', 80)), 'FR-001: un nombre de 80 caracteres se acepta');
select throws_ilike($$ select pg_temp.ins_routine(pg_temp.id('uid_a')::uuid, ' con espacios') $$, '%violates check constraint%', 'un nombre con espacios en los extremos se rechaza');
select lives_ok($$ select pg_temp.ins_routine(pg_temp.id('uid_a')::uuid, 'Con solicitud', ', client_request_id', ', ''10000000-0000-0000-0000-000000000001''') $$, 'una rutina con identificador de solicitud');
select throws_ilike(
  $$ select pg_temp.ins_routine(pg_temp.id('uid_a')::uuid, 'Otra', ', client_request_id', ', ''10000000-0000-0000-0000-000000000001''') $$,
  '%unique%', 'FR-047: la misma solicitud de la misma cuenta se rechaza'
);
select lives_ok(
  $$ select pg_temp.ins_routine(pg_temp.id('uid_b')::uuid, 'De B', ', client_request_id', ', ''10000000-0000-0000-0000-000000000001''') $$,
  'y otra cuenta puede usar el mismo identificador'
);

select id as routine_a from public.routines where user_id = :'uid_a' and name = 'Torso A' \gset

-- ejercicios de la rutina --------------------------------------------------------------------------------------------------
select lives_ok(
  format($$ select pg_temp.ins_item(%L, %L, 1, %L, 'reps_weight', ', target_reps, target_weight_kg', ', 8, 60') $$, :'routine_a', :'uid_a', :'ex_rw'),
  'FR-002: un ejercicio de repeticiones con peso, con sus objetivos'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 1, %L, 'reps_weight') $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%unique%', 'la posición se repite dentro de la rutina → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 0, %L, 'reps_weight') $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'posición 0 → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 31, %L, 'reps_weight') $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'posición 31 → se rechaza (el tope es de 30 ejercicios)'
);
select throws_ilike(
  format($$ insert into public.routine_exercises (routine_id, user_id, position, exercise_id, exercise_name, measurement_type, sets) values (%L, %L, 2, %L, 'X', 'reps_weight', 0) $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'FR-002: 0 series → se rechaza'
);
select throws_ilike(
  format($$ insert into public.routine_exercises (routine_id, user_id, position, exercise_id, exercise_name, measurement_type, sets) values (%L, %L, 2, %L, 'X', 'reps_weight', 21) $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'FR-002: 21 series → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 2, %L, 'sets') $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'un tipo de medición inventado → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 2, %L, 'reps_weight', ', target_reps', ', 0') $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'objetivo de 0 repeticiones → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 2, %L, 'reps_weight', ', target_reps', ', 1000') $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'objetivo de 1.000 repeticiones → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 2, %L, 'reps_weight', ', target_weight_kg', ', -1') $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'un peso objetivo negativo → se rechaza'
);
select lives_ok(
  format($$ select pg_temp.ins_item(%L, %L, 2, %L, 'reps_weight', ', target_weight_kg', ', 0') $$, :'routine_a', :'uid_a', :'ex_rw'),
  'un peso objetivo de 0 es válido (y distinto de «sin objetivo»)'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 3, %L, 'reps_bodyweight', ', target_weight_kg', ', 10') $$, :'routine_a', :'uid_a', :'ex_bw'),
  '%violates check constraint%', 'un peso objetivo en un ejercicio sin peso → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 3, %L, 'duration', ', target_reps', ', 10') $$, :'routine_a', :'uid_a', :'ex_d'),
  '%violates check constraint%', 'repeticiones objetivo en un ejercicio de tiempo → se rechazan'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 3, %L, 'reps_weight', ', target_distance_km', ', 5') $$, :'routine_a', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'una distancia objetivo en un ejercicio con peso → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 3, %L, 'distance_duration', ', target_duration_s', ', 0') $$, :'routine_a', :'uid_a', :'ex_dd'),
  '%violates check constraint%', 'una duración objetivo de 0 → se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.ins_item(%L, %L, 3, %L, 'distance_duration', ', target_distance_km', ', 1000') $$, :'routine_a', :'uid_a', :'ex_dd'),
  '%violates check constraint%', 'una distancia objetivo de 1.000 km → se rechaza'
);
select lives_ok(
  format($$ select pg_temp.ins_item(%L, %L, 3, %L, 'distance_duration', ', target_distance_km, target_duration_s', ', 5.25, 1800') $$, :'routine_a', :'uid_a', :'ex_dd'),
  'distancia y duración objetivo en un ejercicio de distancia y tiempo'
);
select throws_ilike(
  format($$ update public.routine_exercises set exercise_name = 'Otro nombre' where routine_id = %L and position = 1 $$, :'routine_a'),
  '%training_snapshot_immutable%', 'FR-004: el nombre guardado de un ítem de rutina no cambia'
);
select throws_ilike(
  format($$ update public.routine_exercises set measurement_type = 'duration', target_reps = null, target_weight_kg = null where routine_id = %L and position = 1 $$, :'routine_a'),
  '%training_snapshot_immutable%', 'el tipo de medición guardado de un ítem de rutina no cambia'
);

-- sesiones: estados y coherencia -------------------------------------------------------------------------------------------
select lives_ok($$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'planned') $$, 'FR-008: una sesión planificada');
select throws_ilike($$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'moved') $$, '%violates check constraint%', 'un estado inventado se rechaza');
select throws_ilike($$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'in_progress') $$, '%violates check constraint%', 'en curso sin hora de inicio → se rechaza');
select throws_ilike(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'completed', ', started_at', ', now()') $$,
  '%violates check constraint%', 'realizada sin hora de fin → se rechaza'
);
select throws_ilike(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'planned', ', started_at', ', now()') $$,
  '%violates check constraint%', 'planificada con hora de inicio → se rechaza'
);
select lives_ok(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'in_progress', ', started_at', ', now()') $$,
  'FR-009: una sesión en curso con su hora de inicio'
);
select throws_ilike(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'in_progress', ', started_at', ', now()') $$,
  '%unique%', 'FR-009: una cuenta no puede tener dos sesiones en curso'
);
select lives_ok(
  $$ select pg_temp.ins_session(pg_temp.id('uid_b')::uuid, 'in_progress', ', started_at', ', now()') $$,
  'pero otra cuenta sí tiene la suya'
);
select throws_ilike(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'planned', ', modified', ', true') $$,
  '%violates check constraint%', 'la marca «modificada» no existe en una sesión planificada'
);
select throws_ilike(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'completed', ', started_at, finished_at, modified', ', now(), now(), true') $$,
  '%violates check constraint%', 'la marca «modificada» no existe sin plan'
);
select lives_ok(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'completed', ', started_at, finished_at, has_plan, modified', ', now(), now(), true, true') $$,
  'una sesión realizada con plan puede estar «modificada»'
);
select throws_ilike(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'planned', ', corrected_at', ', now()') $$,
  '%violates check constraint%', 'solo una sesión realizada se corrige'
);
select throws_ilike(
  format($$ insert into public.workout_sessions (user_id, session_date, original_date, status, note) values (%L, date '2026-10-22', date '2026-10-22', 'planned', %L) $$, :'uid_a', repeat('a', 1001)),
  '%violates check constraint%', 'FR-013: una nota de 1.001 caracteres se rechaza'
);
select throws_ilike(
  $$ insert into public.workout_sessions (user_id, session_date, original_date, status) values (pg_temp.id('uid_a'), date '1999-12-31', date '1999-12-31', 'planned') $$,
  '%violates check constraint%', 'una fecha anterior al 2000 se rechaza'
);
select throws_ilike(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'planned', ', rescheduled_count', ', -1') $$,
  '%violates check constraint%', 'un contador de reprogramaciones negativo se rechaza'
);
select lives_ok(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'planned', ', client_request_id', ', ''20000000-0000-0000-0000-000000000001''') $$,
  'una sesión con identificador de solicitud'
);
select throws_ilike(
  $$ select pg_temp.ins_session(pg_temp.id('uid_a')::uuid, 'planned', ', client_request_id', ', ''20000000-0000-0000-0000-000000000001''') $$,
  '%unique%', 'FR-047: la misma solicitud de la misma cuenta se rechaza'
);

-- identidad de la sesión ---------------------------------------------------------------------------------------------------
select tests.create_session(:'uid_a', date '2026-10-25', 'planned', :'routine_a', true) as s_plan \gset
select tests.create_session(:'uid_a', date '2026-10-20', 'completed') as s_done \gset

select throws_ilike(format($$ update public.workout_sessions set user_id = %L where id = %L $$, :'uid_b', :'s_plan'), '%training_identity_immutable%', 'el dueño de una sesión no cambia');
select throws_ilike(format($$ update public.workout_sessions set original_date = date '2026-11-01' where id = %L $$, :'s_plan'), '%training_identity_immutable%', 'la fecha original no cambia');
select throws_ilike(format($$ update public.workout_sessions set routine_name = 'Otra' where id = %L $$, :'s_plan'), '%training_identity_immutable%', 'el nombre de la rutina de origen no cambia');
select lives_ok(format($$ update public.workout_sessions set session_date = date '2026-10-26' where id = %L $$, :'s_plan'), 'la fecha de una sesión planificada sí se puede mover');
select throws_ilike(format($$ update public.workout_sessions set session_date = date '2026-10-26' where id = %L $$, :'s_done'), '%training_date_immutable%', 'FR-024: la fecha de una sesión realizada no cambia');

-- plan de la sesión -------------------------------------------------------------------------------------------------------
select is((select count(*) from public.session_plan_items where session_id = :'s_plan'), 3::bigint, 'el plan copia los ítems de la rutina (helper de pruebas)');
select throws_ilike(
  format($$ update public.session_plan_items set sets = 5 where session_id = %L and position = 1 $$, :'s_plan'),
  '%training_snapshot_immutable%', 'FR-015: el plan de una sesión no se actualiza'
);
select throws_ilike(
  format($$ insert into public.session_plan_items (session_id, user_id, position, exercise_id, exercise_name, measurement_type, sets, target_distance_km) values (%L, %L, 9, %L, 'X', 'reps_weight', 3, 2) $$, :'s_plan', :'uid_a', :'ex_rw'),
  '%violates check constraint%', 'los objetivos del plan siguen la misma regla por tipo de medición'
);
select throws_ilike(
  format($$ insert into public.session_plan_items (session_id, user_id, position, exercise_id, exercise_name, measurement_type, sets) values (%L, %L, 1, %L, 'X', 'reps_weight', 3) $$, :'s_plan', :'uid_a', :'ex_rw'),
  '%unique%', 'la posición se repite dentro del plan → se rechaza'
);

-- ejercicios realizados ---------------------------------------------------------------------------------------------------
select id as plan_1 from public.session_plan_items where session_id = :'s_plan' and position = 1 \gset
select tests.create_session(:'uid_a', date '2026-10-27', 'planned') as s_other \gset
select tests.add_plan_item(:'s_other', :'ex_bw') as other_plan \gset

select tests.create_session(:'uid_a', date '2026-10-19', 'completed') as s_x \gset
select tests.add_session_exercise(:'s_x', :'ex_rw') as x_rw \gset
select tests.add_session_exercise(:'s_x', :'ex_dd') as x_dd \gset
select tests.add_session_exercise(:'s_x', :'ex_d') as x_d \gset

select lives_ok(
  format($$ update public.session_exercises set effort = 7, note = 'Se sintió pesado' where id = %L $$, :'x_rw'),
  'FR-014 y FR-032: esfuerzo y nota de un ejercicio realizado'
);
select throws_ilike(format($$ update public.session_exercises set effort = 0 where id = %L $$, :'x_rw'), '%violates check constraint%', 'FR-014: esfuerzo 0 → se rechaza');
select throws_ilike(format($$ update public.session_exercises set effort = 11 where id = %L $$, :'x_rw'), '%violates check constraint%', 'FR-014: esfuerzo 11 → se rechaza');
select throws_ilike(format($$ update public.session_exercises set note = %L where id = %L $$, repeat('a', 501), :'x_rw'), '%violates check constraint%', 'FR-032: una nota de 501 caracteres se rechaza');
select throws_ilike(
  format($$ update public.session_exercises set exercise_name = 'Otro' where id = %L $$, :'x_rw'),
  '%training_snapshot_immutable%', 'FR-034: el nombre guardado de un ejercicio realizado no cambia'
);
select throws_ilike(
  format($$ update public.session_exercises set measurement_type = 'duration' where id = %L $$, :'x_rw'),
  '%training_snapshot_immutable%', 'FR-034: el tipo de medición guardado no cambia'
);
select throws_ilike(
  format($$ insert into public.session_exercises (session_id, user_id, position, exercise_id, exercise_name, measurement_type, is_substitute) values (%L, %L, 9, %L, 'X', 'reps_weight', true) $$, :'s_x', :'uid_a', :'ex_rw'),
  '%substitute_needs_plan_item%', 'un sustituto debe indicar a qué ítem del plan sustituye'
);
select throws_ilike(
  format($$ insert into public.session_exercises (session_id, user_id, position, exercise_id, exercise_name, measurement_type, plan_item_id) values (%L, %L, 9, %L, 'X', 'reps_weight', %L) $$, :'s_x', :'uid_a', :'ex_rw', :'other_plan'),
  '%violates foreign key constraint%', 'un ejercicio realizado solo se vincula a un ítem del plan de su misma sesión'
);
select tests.add_session_exercise(:'s_plan', :'ex_rw', :'plan_1') as p_done \gset
select throws_ilike(
  format($$ select tests.add_session_exercise(%L, %L, %L) $$, :'s_plan', :'ex_rw', :'plan_1'),
  '%unique%', 'un ítem del plan se cumple con un solo ejercicio realizado'
);
select throws_ilike(
  format($$ insert into public.session_exercises (session_id, user_id, position, exercise_id, exercise_name, measurement_type) values (%L, %L, 1, %L, 'X', 'reps_weight') $$, :'s_x', :'uid_a', :'ex_rw'),
  '%unique%', 'la posición se repite dentro de la sesión → se rechaza'
);

-- series ------------------------------------------------------------------------------------------------------------------
select lives_ok(format($$ select tests.add_session_set(%L, 8, 60, null, null) $$, :'x_rw'), 'FR-028: una serie de repeticiones y peso');
select lives_ok(format($$ select tests.add_session_set(%L, 8, null, null, null) $$, :'x_rw'), 'FR-030: una serie con el peso sin dato');
select lives_ok(format($$ select tests.add_session_set(%L, 8, 0, null, null) $$, :'x_rw'), 'FR-030: un peso de 0 es válido');
select lives_ok(format($$ select tests.add_session_set(%L, null, null, 90, null) $$, :'x_d'), 'una serie de tiempo');
select lives_ok(format($$ select tests.add_session_set(%L, null, null, 1800, 5.25) $$, :'x_dd'), 'una serie de distancia y tiempo');
select throws_ilike(format($$ select tests.add_session_set(%L, null, null, null, null) $$, :'x_rw'), '%violates check constraint%', 'FR-030: una serie sin ningún valor se rechaza');
select throws_ilike(format($$ select tests.add_session_set(%L, null, 60, 30, null) $$, :'x_rw'), '%set_shape_invalid%', 'una duración en un ejercicio con peso → se rechaza');
select throws_ilike(format($$ select tests.add_session_set(%L, 10, null, 90, null) $$, :'x_d'), '%set_shape_invalid%', 'repeticiones en un ejercicio de tiempo → se rechazan');
select throws_ilike(format($$ select tests.add_session_set(%L, 5, null, 1800, 5) $$, :'x_dd'), '%set_shape_invalid%', 'repeticiones en un ejercicio de distancia y tiempo → se rechazan');
select throws_ilike(format($$ select tests.add_session_set(%L, 0, 60, null, null) $$, :'x_rw'), '%violates check constraint%', 'FR-031: 0 repeticiones → se rechaza');
select throws_ilike(format($$ select tests.add_session_set(%L, 1000, 60, null, null) $$, :'x_rw'), '%violates check constraint%', 'FR-031: 1.000 repeticiones → se rechazan');
select throws_ilike(format($$ select tests.add_session_set(%L, 5, -1, null, null) $$, :'x_rw'), '%violates check constraint%', 'FR-031: un peso negativo → se rechaza');
select throws_ilike(format($$ select tests.add_session_set(%L, null, null, 0, null) $$, :'x_d'), '%violates check constraint%', 'FR-031: duración 0 → se rechaza');
select throws_ilike(format($$ select tests.add_session_set(%L, null, null, 90000, null) $$, :'x_d'), '%violates check constraint%', 'FR-031: más de 24 horas → se rechaza');
select throws_ilike(format($$ select tests.add_session_set(%L, null, null, 600, 0) $$, :'x_dd'), '%violates check constraint%', 'FR-031: distancia 0 → se rechaza');
select throws_ilike(
  format($$ insert into public.session_sets (session_exercise_id, session_id, user_id, position, reps) values (%L, %L, %L, 1, 5) $$, :'x_rw', :'s_x', :'uid_a'),
  '%unique%', 'la posición de una serie no se repite'
);
select throws_ilike(
  format($$ insert into public.session_sets (session_exercise_id, session_id, user_id, position, reps) values (%L, %L, %L, 21, 5) $$, :'x_rw', :'s_x', :'uid_a'),
  '%violates check constraint%', 'FR-028: la serie 21 → se rechaza (el tope es de 20)'
);
select throws_ilike(
  format($$ insert into public.session_sets (session_exercise_id, session_id, user_id, position, reps) values (%L, %L, %L, 9, 5) $$, :'x_rw', :'s_x', :'uid_b'),
  '%set_shape_invalid%', 'una serie no puede tener un dueño distinto del de su ejercicio'
);

-- recorrido de fechas -----------------------------------------------------------------------------------------------------
select lives_ok(
  format($$ insert into public.session_date_changes (session_id, user_id, from_date, to_date, client_request_id) values (%L, %L, date '2026-10-25', date '2026-10-26', '30000000-0000-0000-0000-000000000001') $$, :'s_plan', :'uid_a'),
  'un cambio de fecha'
);
select throws_ilike(
  format($$ insert into public.session_date_changes (session_id, user_id, from_date, to_date) values (%L, %L, date '2026-10-26', date '2026-10-26') $$, :'s_plan', :'uid_a'),
  '%violates check constraint%', 'un cambio de fecha a la misma fecha se rechaza'
);
select throws_ilike(
  format($$ insert into public.session_date_changes (session_id, user_id, from_date, to_date, client_request_id) values (%L, %L, date '2026-10-26', date '2026-10-27', '30000000-0000-0000-0000-000000000001') $$, :'s_plan', :'uid_a'),
  '%unique%', 'FR-047: un movimiento con la misma solicitud se rechaza'
);

-- el pasado no depende del catálogo (Principio II, FR-035, FR-036) ---------------------------------------------------------
select is(
  (select count(*) from pg_constraint
   where contype = 'f' and confrelid = 'public.exercises'::regclass and confdeltype = 'c'),
  0::bigint, 'guardián: ninguna clave foránea hacia exercises es on delete cascade'
);
select is(
  (select count(*) from pg_constraint
   where contype = 'f' and confrelid = 'public.exercises'::regclass and confdeltype = 'n'
     and conrelid in ('public.routine_exercises'::regclass, 'public.session_plan_items'::regclass, 'public.session_exercises'::regclass)),
  3::bigint, 'los ítems de rutina, de plan y realizados usan on delete set null hacia exercises'
);

delete from public.exercises where id = :'ex_rw';
select is(
  (select row(exercise_id, exercise_name, measurement_type)::text from public.session_exercises where id = :'x_rw'),
  '(,"Press e2e",reps_weight)', 'FR-036: al eliminar un ejercicio, el realizado conserva su nombre y su tipo (exercise_id nulo)'
);
select is(
  (select count(*) from public.session_sets where session_exercise_id = :'x_rw'), 3::bigint,
  'y sus series siguen ahí'
);
select is(
  (select exercise_id::text from public.session_plan_items where id = :'plan_1'), null,
  'el plan también conserva su ítem con exercise_id nulo'
);

delete from public.routines where id = :'routine_a';
select is(
  (select row(routine_id, routine_name)::text from public.workout_sessions where id = :'s_plan'),
  '(,"Torso A")', 'FR-005: al eliminar la rutina, la sesión queda con routine_id nulo y el nombre guardado'
);
select is((select count(*) from public.session_plan_items where session_id = :'s_plan'), 3::bigint, 'y su plan intacto');

delete from public.workout_sessions where id = :'s_plan';
select is(
  (select count(*) from public.session_plan_items where session_id = :'s_plan')
  + (select count(*) from public.session_exercises where session_id = :'s_plan')
  + (select count(*) from public.session_date_changes where session_id = :'s_plan'),
  0::bigint, 'FR-039: eliminar una sesión borra su plan, sus ejercicios y su recorrido de fechas'
);
select is((select count(*) from public.session_sets where session_id = :'s_x'), 5::bigint, 'y no toca los de otra sesión');

-- cuenta -----------------------------------------------------------------------------------------------------------------
select tests.create_session(:'uid_b', date '2026-10-18', 'completed') as s_b \gset
select tests.add_session_exercise(:'s_b', :'ex_bw') as b_ex \gset
select tests.add_session_set(:'b_ex', 10) as b_set \gset
select tests.create_routine(:'uid_b', 'Rutina de B', array[:'ex_bw'::uuid]) as r_b \gset

delete from auth.users where id = :'uid_b';
select is(
  (select count(*) from public.routines where user_id = :'uid_b')
  + (select count(*) from public.workout_sessions where user_id = :'uid_b')
  + (select count(*) from public.session_exercises where user_id = :'uid_b')
  + (select count(*) from public.session_sets where user_id = :'uid_b'),
  0::bigint, 'FR-054: al eliminar la cuenta se borran sus rutinas y sus sesiones'
);
select ok((select count(*) from public.workout_sessions where user_id = :'uid_a') > 0, 'y no se toca nada de otra cuenta');

select * from finish();
rollback;

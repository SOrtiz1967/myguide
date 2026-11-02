-- Spec 012 (FR-001, FR-005, FR-009, FR-017, FR-019): las series crudas para los gráficos de un ejercicio.
begin;
select plan(13);

delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_exercise(:'uid_a', 'Press e2e', 'reps_weight') as rw \gset
select tests.create_exercise(:'uid_a', 'Plancha e2e', 'duration') as d \gset

select tests.create_session(:'uid_a', date '2026-10-15', 'completed') as s3 \gset
select tests.create_session(:'uid_a', date '2026-10-01', 'completed') as s1 \gset
select tests.create_session(:'uid_a', date '2026-10-08', 'completed') as s2 \gset
select tests.create_session(:'uid_a', date '2026-10-20', 'in_progress') as s_open \gset
select tests.create_session(:'uid_a', date '2026-10-25', 'planned') as s_plan \gset

select tests.add_session_exercise(:'s1', :'rw') as x1 \gset
select tests.add_session_set(:'x1', 8, 60);
select tests.add_session_set(:'x1', 6, 62.5);
select tests.add_session_exercise(:'s2', :'rw') as x2 \gset
select tests.add_session_set(:'x2', 8, 65);
select tests.add_session_exercise(:'s3', :'rw') as x3 \gset
select tests.add_session_set(:'x3', 5, 70);
update public.session_exercises set effort = 7 where id = :'x3';
select tests.add_session_exercise(:'s_open', :'rw') as x_open \gset
select tests.add_session_set(:'x_open', 10, 50);
select tests.add_session_exercise(:'s_plan', :'rw') as x_plan \gset
select tests.add_session_exercise(:'s3', :'d') as x_d \gset

select tests.authenticate_as(:'uid_a');

select is(
  (select string_agg(session_date::text, ',' order by session_date) from public.exercise_progress(:'rw')),
  '2026-10-01,2026-10-08,2026-10-15', 'solo sesiones realizadas, en orden cronológico'
);
select is((select count(*) from public.exercise_progress(:'d')), 1::bigint, 'cada ejercicio tiene sus propias filas');
select is(
  (select sets::text from public.exercise_progress(:'rw') where session_id = :'s1'),
  '[{"reps": 8, "weight_kg": 60.00}, {"reps": 6, "weight_kg": 62.50}]', 'las series, ordenadas y con sus valores'
);
select is((select effort from public.exercise_progress(:'rw') where session_id = :'s3'), 7::smallint, 'el esfuerzo percibido');
select is((select effort from public.exercise_progress(:'rw') where session_id = :'s1'), null, 'sin esfuerzo indicado es nulo, no cero');

-- un dato faltante no aparece (no es cero) y una sesión sin series trae una lista vacía
select tests.clear_authentication();
select tests.add_session_set(:'x2', 12, null);
select tests.authenticate_as(:'uid_a');
select is(
  (select sets::text from public.exercise_progress(:'rw') where session_id = :'s2'),
  '[{"reps": 8, "weight_kg": 65.00}, {"reps": 12}]', 'las series sin peso no traen peso'
);

-- instantánea: renombrar o borrar el ejercicio no cambia lo guardado en la sesión
select tests.clear_authentication();
update public.exercises set name = 'Otro nombre' where id = :'rw';
select tests.authenticate_as(:'uid_a');
select is(
  (select exercise_name from public.exercise_progress(:'rw') where session_id = :'s1'),
  'Press e2e', 'FR-009: el nombre es el guardado en la sesión, aunque el ejercicio se renombre'
);
select is(
  (select measurement_type from public.exercise_progress(:'rw') where session_id = :'s1'),
  'reps_weight', 'y el tipo de medición también'
);

-- dos veces el mismo ejercicio en una sesión: dos filas
select tests.clear_authentication();
select tests.add_session_exercise(:'s1', :'rw') as x1b \gset
select tests.add_session_set(:'x1b', 3, 40);
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.exercise_progress(:'rw') where session_id = :'s1'), 2::bigint, 'dos veces el mismo ejercicio el mismo día son dos filas');

-- aislamiento y sesión
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.exercise_progress(:'rw')), 0::bigint, 'otra cuenta no ve nada');

select tests.clear_authentication();
select throws_ilike(format($$ select * from public.exercise_progress(%L) $$, :'rw'), 'session_expired%', 'sin sesión no lee nada');
select ok(
  not has_function_privilege('anon', 'public.exercise_progress(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.exercise_progress(uuid)', 'execute'),
  'solo una cuenta autenticada la ejecuta'
);
select is(
  (select count(*) from public.workout_sessions where status = 'completed'), 3::bigint,
  'FR-017: leer no modifica ninguna sesión'
);

select * from finish();
rollback;

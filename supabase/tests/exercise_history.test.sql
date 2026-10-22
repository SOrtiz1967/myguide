-- T062 (spec 006, FR-041 a FR-043, SC-009): la historia de un ejercicio.
begin;
select plan(19);

delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_exercise(:'uid_a', 'Press e2e', 'reps_weight') as rw \gset
select tests.create_exercise(:'uid_a', 'Plancha e2e', 'duration') as d \gset
select tests.create_exercise(:'uid_b', 'Press de B e2e', 'reps_weight') as bw \gset

-- tres sesiones realizadas con el press, una en curso y una planificada
select tests.create_session(:'uid_a', date '2026-10-01', 'completed') as s1 \gset
select tests.create_session(:'uid_a', date '2026-10-08', 'completed') as s2 \gset
select tests.create_session(:'uid_a', date '2026-10-15', 'completed') as s3 \gset
select tests.create_session(:'uid_a', date '2026-10-20', 'in_progress') as s_open \gset
select tests.create_session(:'uid_a', date '2026-10-25', 'planned') as s_plan \gset

select tests.add_session_exercise(:'s1', :'rw') as x1 \gset
select tests.add_session_set(:'x1', 8, 60);
select tests.add_session_set(:'x1', 6, 62.5);
select tests.add_session_exercise(:'s2', :'rw') as x2 \gset
select tests.add_session_set(:'x2', 8, 65);
select tests.add_session_exercise(:'s3', :'rw') as x3 \gset
select tests.add_session_set(:'x3', 5, 70);
update public.session_exercises set effort = 7, note = 'Buen día' where id = :'x3';
select tests.add_session_exercise(:'s_open', :'rw') as x_open \gset
select tests.add_session_set(:'x_open', 10, 50);
select tests.add_session_exercise(:'s3', :'d') as x_d \gset

select tests.authenticate_as(:'uid_a');

select is(
  (select string_agg(session_date::text, ',' order by session_date desc) from public.exercise_history(:'rw')),
  '2026-10-15,2026-10-08,2026-10-01', 'solo sesiones realizadas, de la más reciente a la más antigua'
);
select is((select count(*) from public.exercise_history(:'rw')), 3::bigint, 'ni la sesión en curso ni la planificada cuentan');
select is((select count(*) from public.exercise_history(:'d')), 1::bigint, 'cada ejercicio tiene su propia historia');

select is(
  (select sets::text from public.exercise_history(:'rw') where session_id = :'s1'),
  '[{"reps": 8, "weight_kg": 60.00}, {"reps": 6, "weight_kg": 62.50}]', 'las series, ordenadas y con sus valores'
);
select is(
  (select row(effort, note)::text from public.exercise_history(:'rw') where session_id = :'s3'),
  '(7,"Buen día")', 'el esfuerzo percibido y la nota'
);
select is(
  (select row(effort, note)::text from public.exercise_history(:'rw') where session_id = :'s2'),
  '(,)', 'lo que no se indicó queda en blanco, sin inventar valores'
);
select is(
  (select sets::text from public.exercise_history(:'d')), '[]', 'un ejercicio sin series registradas devuelve un arreglo vacío'
);

-- «la última vez» dentro de una sesión: se omite la sesión actual
select is(
  (select session_id from public.exercise_history(:'rw', :'s3', 1, 0)), :'s2'::uuid, 'exclude_session_id omite la sesión indicada'
);

-- paginado
select is((select count(*) from public.exercise_history(:'rw', null, 2, 0)), 2::bigint, 'page_size limita la tanda');
select is((select count(*) from public.exercise_history(:'rw', null, 2, 2)), 1::bigint, 'page_offset pasa a la tanda siguiente');
select is((select max(total_estimate) from public.exercise_history(:'rw', null, 2, 0)), 3::bigint, 'total_estimate cuenta todas las sesiones');
select is((select count(*) from public.exercise_history(:'rw', null, 1000, 0)), 3::bigint, 'el tope de 50 se aplica sin fallar');

-- el nombre guardado no cambia al renombrar o eliminar el ejercicio
select tests.clear_authentication();
update public.exercises set name = 'Press renombrado e2e' where id = :'rw';
select tests.authenticate_as(:'uid_a');
select is(
  (select min(exercise_name) from public.exercise_history(:'rw')), 'Press e2e', 'FR-042: el nombre es el guardado en cada sesión'
);

select tests.clear_authentication();
delete from public.exercises where id = :'d';
select tests.authenticate_as(:'uid_a');
select is(
  (select count(*) from public.workout_sessions where id = :'s3'), 1::bigint, 'un ejercicio eliminado deja sus sesiones visibles'
);
select is((select count(*) from public.exercise_history(:'d')), 0::bigint, 'y su historia ya no se consulta por un ejercicio que no existe');

-- aislamiento
select is((select count(*) from public.exercise_history(:'bw')), 0::bigint, 'el ejercicio de otra cuenta no devuelve historia');
select tests.clear_authentication();
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.exercise_history(:'rw')), 0::bigint, 'otra cuenta no ve la historia de A');
select tests.clear_authentication();

-- sesión vencida y anon
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_b';
select tests.authenticate_as(:'uid_b');
select throws_ilike(format($$ select * from public.exercise_history(%L) $$, :'bw'), '%session_expired%', 'con la sesión vencida no responde');
select tests.clear_authentication();
select ok(not has_function_privilege('anon', 'public.exercise_history(uuid, uuid, integer, integer)', 'execute'), 'anon no puede ejecutarla');

select * from finish();
rollback;

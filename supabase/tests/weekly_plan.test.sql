-- Spec 018: plan semanal (FR-001 a FR-005, FR-019) y «marcar como completado» (FR-008 a FR-010).
begin;
select plan(24);

delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.create_exercise(:'uid_a', 'Press plan', 'reps_weight') as ex1 \gset
select tests.create_exercise(:'uid_a', 'Remo plan', 'reps_weight') as ex2 \gset
select tests.create_exercise(:'uid_b', 'Ejercicio de B plan', 'reps_weight') as exb \gset

create temp table vars (k text primary key, v text);
grant all on vars to public;
insert into vars values ('uid_a', :'uid_a'), ('uid_b', :'uid_b'), ('ex1', :'ex1'), ('ex2', :'ex2'), ('exb', :'exb');

-- Rutinas: dos de A y una de B.
select tests.authenticate_as(:'uid_b');
select public.create_routine(
  format('{"name": "Rutina de B", "exercises": [{"exercise_id": "%s", "sets": 3}]}', :'exb')::jsonb,
  gen_random_uuid()
) as rb \gset

select tests.authenticate_as(:'uid_a');
select public.create_routine(
  format('{"name": "Pecho", "exercises": [{"exercise_id": "%s", "sets": 4, "target_reps": 8}, {"exercise_id": "%s", "sets": 3}]}', :'ex1', :'ex2')::jsonb,
  gen_random_uuid()
) as r1 \gset
select public.create_routine(
  format('{"name": "Espalda", "exercises": [{"exercise_id": "%s", "sets": 3}]}', :'ex2')::jsonb,
  gen_random_uuid()
) as r2 \gset

-- plan semanal -----------------------------------------------------------------------------------------------------
select lives_ok(format('select public.set_weekly_plan_day(1::smallint, %L::uuid)', :'r1'), 'FR-001: asigna una rutina al lunes');
select is(
  (select routine_name from public.weekly_plan_days where weekday = 1), 'Pecho',
  'el plan recuerda el nombre de la rutina'
);
select lives_ok(format('select public.set_weekly_plan_day(1::smallint, %L::uuid)', :'r2'), 'FR-003: cambia la rutina del lunes');
select is(
  (select routine_id::text from public.weekly_plan_days where weekday = 1), :'r2',
  'el lunes tiene una sola rutina: la nueva reemplaza a la anterior'
);
select is((select count(*) from public.weekly_plan_days), 1::bigint, 'un día no puede tener dos rutinas');

select throws_ok(
  format('select public.set_weekly_plan_day(8::smallint, %L::uuid)', :'r1'),
  '22023', null, 'el día de la semana va de 1 a 7'
);
select throws_ok(
  format('select public.set_weekly_plan_day(2::smallint, %L::uuid)', :'rb'),
  'P0002', null, 'no se puede asignar la rutina de otra cuenta'
);

select lives_ok('select public.set_weekly_plan_day(2::smallint, null)', 'quitar un día sin rutina no falla');
select public.set_weekly_plan_day(3::smallint, :'r1'::uuid);
select public.set_weekly_plan_day(3::smallint, null);
select is((select count(*) from public.weekly_plan_days where weekday = 3), 0::bigint, 'FR-003: quitar la rutina borra la asignación del día');

-- Renombrar y eliminar una rutina --------------------------------------------------------------------------------------
select public.update_routine(:'r2'::uuid, format('{"name": "Espalda y bíceps", "exercises": [{"exercise_id": "%s", "sets": 3}]}', :'ex2')::jsonb);
select is(
  (select routine_name from public.weekly_plan_days where weekday = 1), 'Espalda y bíceps',
  'renombrar la rutina actualiza el nombre que recuerda el plan'
);
delete from public.routines where id = :'r2';
select is(
  (select routine_id is null from public.weekly_plan_days where weekday = 1), true,
  'FR-005: eliminar la rutina deja el día sin rutina'
);
select is(
  (select routine_name from public.weekly_plan_days where weekday = 1), 'Espalda y bíceps',
  'FR-005: y conserva el último nombre para decirlo en texto neutral'
);

-- Aislamiento --------------------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.weekly_plan_days), 0::bigint, 'FR-019: otra cuenta no ve el plan');
select lives_ok(format('select public.set_weekly_plan_day(1::smallint, %L::uuid)', :'rb'), 'otra cuenta arma su propio plan');
select tests.authenticate_as(:'uid_a');
select is(
  (select routine_name from public.weekly_plan_days where weekday = 1), 'Espalda y bíceps',
  'el plan de A no cambia por lo que hace B'
);
select throws_ok(
  $$ update public.weekly_plan_days set routine_name = 'x' $$,
  '42501', null, 'el cliente no escribe el plan directamente'
);

-- marcar como completado -------------------------------------------------------------------------------------------------
select gen_random_uuid() as req1 \gset
select public.mark_workout_done(:'r1'::uuid, null, :'req1'::uuid, 'America/Argentina/Buenos_Aires') ->> 'id' as s1 \gset
select is(
  (select row(status, marked_complete, has_plan, modified, routine_name)::text from public.workout_sessions where id = :'s1'),
  '(completed,t,t,f,Pecho)',
  'FR-008: sesión realizada, marcada, con plan y sin «modificada»'
);
select is(
  (select count(*) from public.session_plan_items where session_id = :'s1'), 2::bigint,
  'FR-008: guarda el plan de la rutina (dos ejercicios)'
);
select is(
  (select count(*) from public.session_sets where session_id = :'s1'), 0::bigint,
  'FR-009: ninguna serie realizada: lo planificado no pasa por realizado'
);
select public.mark_workout_done(:'r1'::uuid, null, :'req1'::uuid, 'America/Argentina/Buenos_Aires');
select is(
  (select count(*) from public.workout_sessions where routine_name = 'Pecho'), 1::bigint,
  'FR-010: el reintento con la misma solicitud no duplica la sesión'
);
select throws_ok(
  format('select public.mark_workout_done(%L::uuid, current_date + 3, gen_random_uuid())', :'r1'),
  '22023', null, 'no se marca un día futuro'
);
select tests.authenticate_as(:'uid_b');
select throws_ok(
  format('select public.mark_workout_done(%L::uuid, null, gen_random_uuid())', :'r1'),
  'P0002', null, 'otra cuenta no puede marcar con la rutina de A'
);

-- cargar el detalle quita la marca ------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select (select revision from public.workout_sessions where id = :'s1') as rev \gset
select (select id from public.session_plan_items where session_id = :'s1' and position = 1) as pi1 \gset
select public.save_workout(
  :'s1'::uuid,
  format('{"exercises": [{"id": "%s", "exercise_id": "%s", "plan_item_id": "%s", "sets": [{"reps": 8, "weight_kg": 60}]}]}',
    gen_random_uuid(), :'ex1', :'pi1')::jsonb,
  :'rev'::int,
  false
);
select is(
  (select marked_complete from public.workout_sessions where id = :'s1'), false,
  'al cargar la primera serie la sesión deja de ser «sin detalle»'
);
select is(
  (select count(*) from public.session_sets where session_id = :'s1'), 1::bigint,
  'y la serie cargada queda como realizada'
);

select * from finish();
rollback;

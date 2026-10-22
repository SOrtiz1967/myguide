-- T041 (spec 006, FR-005, FR-015, FR-016, FR-017, FR-037, FR-047): empezar una sesión con el plan de una rutina.
begin;
select plan(26);

delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_exercise(:'uid_a', 'Press e2e', 'reps_weight') as rw \gset
select tests.create_exercise(:'uid_a', 'Flexiones e2e', 'reps_bodyweight') as bw \gset
select tests.create_exercise(:'uid_a', 'Plancha e2e', 'duration') as d \gset
select tests.create_exercise(:'uid_b', 'Ejercicio de B e2e', 'reps_weight') as bx \gset
select tests.create_routine(:'uid_b', 'Rutina de B', array[:'bx'::uuid]) as r_b \gset

-- La rutina de A: tres ejercicios con objetivos.
select tests.create_routine(:'uid_a', 'Torso A', array[:'rw'::uuid, :'bw'::uuid, :'d'::uuid], 4) as r \gset
update public.routine_exercises set target_reps = 8, target_weight_kg = 60 where routine_id = :'r' and position = 1;
update public.routine_exercises set target_reps = 12 where routine_id = :'r' and position = 2;
update public.routine_exercises set target_duration_s = 90 where routine_id = :'r' and position = 3;

-- Hora simulada: 2026-10-22 15:00 UTC (12:00 en Buenos Aires).
select (private.start_workout_from_routine_at(:'uid_a', :'r', null, '30000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 15:00:00+00', 'America/Argentina/Buenos_Aires')) ->> 'id' as s1 \gset

select is(
  (select row(status, session_date, has_plan, routine_id = :'r', routine_name, revision)::text from public.workout_sessions where id = :'s1'),
  '(in_progress,2026-10-22,t,t,"Torso A",1)', 'FR-015: la sesión nace en curso, con plan, con la rutina de origen y su nombre'
);
select is(
  (select string_agg(position || ':' || exercise_name || ':' || measurement_type || ':' || sets, ',' order by position) from public.session_plan_items where session_id = :'s1'),
  '1:Press e2e:reps_weight:4,2:Flexiones e2e:reps_bodyweight:4,3:Plancha e2e:duration:4', 'el plan copia los ítems de la rutina en orden'
);
select is(
  (select string_agg(coalesce(target_reps::text, '-') || '/' || coalesce(target_weight_kg::text, '-') || '/' || coalesce(target_duration_s::text, '-') || '/' || targets_dropped, ',' order by position)
   from public.session_plan_items where session_id = :'s1'),
  '8/60.00/-/false,12/-/-/false,-/-/90/false', 'con sus objetivos'
);
select is((select count(*) from public.session_exercises where session_id = :'s1'), 0::bigint, 'FR-016: lo realizado empieza vacío; el plan no se mezcla con lo hecho');

-- idempotencia
select is(
  (private.start_workout_from_routine_at(:'uid_a', :'r', null, '30000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 15:05:00+00', 'America/Argentina/Buenos_Aires')) ->> 'id',
  :'s1', 'FR-047: repetir la solicitud devuelve la misma sesión...'
);
select is((select count(*) from public.session_plan_items where session_id = :'s1'), 3::bigint, '...sin copiar el plan otra vez');

-- el plan no cambia si la rutina se edita o se elimina después (FR-005)
update public.session_plan_items set sets = sets where session_id = :'s1';
select tests.authenticate_as(:'uid_a');
select public.update_routine(:'r', ('{"name": "Cambiada", "exercises": [{"exercise_id": "' || :'rw' || '", "sets": 1}]}')::jsonb);
select tests.clear_authentication();
select is(
  (select row(count(*), min(exercise_name))::text from public.session_plan_items where session_id = :'s1' and position = 1),
  '(1,"Press e2e")', 'FR-005: editar la rutina no cambia el plan de la sesión'
);
select is((select count(*) from public.session_plan_items where session_id = :'s1'), 3::bigint, 'ni la cantidad de ítems');
select is((select routine_name from public.workout_sessions where id = :'s1'), 'Torso A', 'ni el nombre de la rutina de origen');

-- terminar la sesión para poder iniciar otras
update public.workout_sessions set status = 'completed', finished_at = now() where id = :'s1';

-- la instantánea se refresca desde el ejercicio vigente (FR-037)
select tests.create_routine(:'uid_a', 'Refresco', array[:'rw'::uuid, :'bw'::uuid, :'d'::uuid], 2) as r2 \gset
update public.routine_exercises set target_reps = 10, target_weight_kg = 50 where routine_id = :'r2' and position = 1;
update public.routine_exercises set target_reps = 15 where routine_id = :'r2' and position = 2;
update public.routine_exercises set target_duration_s = 60 where routine_id = :'r2' and position = 3;
update public.exercises set name = 'Press renombrado e2e' where id = :'rw';
-- Flexiones pasa a «tiempo»: sus repeticiones objetivo ya no corresponden
update public.exercises set measurement_type = 'duration' where id = :'bw';
-- Plancha pasa a «repeticiones y peso»: su duración objetivo ya no corresponde
update public.exercises set measurement_type = 'reps_weight' where id = :'d';

select (private.start_workout_from_routine_at(:'uid_a', :'r2', null, '30000000-0000-0000-0000-000000000002', timestamptz '2026-10-22 16:00:00+00', 'UTC')) ->> 'id' as s2 \gset
select is(
  (select string_agg(exercise_name || ':' || measurement_type, ',' order by position) from public.session_plan_items where session_id = :'s2'),
  'Press renombrado e2e:reps_weight,Flexiones e2e:duration,Plancha e2e:reps_weight',
  'FR-037: el plan toma el nombre y el tipo de medición vigentes del ejercicio'
);
select is(
  (select string_agg(coalesce(target_reps::text, '-') || '/' || coalesce(target_weight_kg::text, '-') || '/' || coalesce(target_duration_s::text, '-') || '/' || targets_dropped, ',' order by position)
   from public.session_plan_items where session_id = :'s2'),
  '10/50.00/-/false,-/-/-/true,-/-/-/true',
  'solo pasan los objetivos que corresponden al tipo vigente; los demás quedan marcados como no copiados'
);
update public.workout_sessions set status = 'completed', finished_at = now() where id = :'s2';

-- un ejercicio eliminado: el plan usa lo que guardó la rutina
select tests.create_routine(:'uid_a', 'Con faltante', array[:'rw'::uuid], 3) as r3 \gset
update public.routine_exercises set target_reps = 5 where routine_id = :'r3';
delete from public.exercises where id = :'rw';
select (private.start_workout_from_routine_at(:'uid_a', :'r3', null, '30000000-0000-0000-0000-000000000003', timestamptz '2026-10-22 17:00:00+00', 'UTC')) ->> 'id' as s3 \gset
select is(
  (select row(exercise_id is null, exercise_name, measurement_type, target_reps, targets_dropped)::text from public.session_plan_items where session_id = :'s3'),
  '(t,"Press renombrado e2e",reps_weight,5,f)', 'FR-037: si el ejercicio ya no existe, el plan usa el nombre y el tipo que guardó la rutina'
);
update public.workout_sessions set status = 'completed', finished_at = now() where id = :'s3';

-- borrar la rutina deja el plan
select tests.authenticate_as(:'uid_a');
delete from public.routines where id = :'r3';
select tests.clear_authentication();
select is(
  (select row(routine_id, routine_name, (select count(*) from public.session_plan_items where session_id = :'s3'))::text from public.workout_sessions where id = :'s3'),
  '(,"Con faltante",1)', 'FR-005: eliminar la rutina deja el plan y el nombre de la sesión'
);

-- errores
select throws_ilike(
  format($$ select private.start_workout_from_routine_at(%L, %L, null, gen_random_uuid(), timestamptz '2026-10-22 17:00:00+00', 'UTC') $$, :'uid_a', :'r_b'),
  '%not_found%', 'la rutina de otra cuenta se comporta como inexistente'
);
select throws_ilike(
  format($$ select private.start_workout_from_routine_at(%L, gen_random_uuid(), null, gen_random_uuid(), timestamptz '2026-10-22 17:00:00+00', 'UTC') $$, :'uid_a'),
  '%not_found%', 'una rutina inexistente → not_found'
);
select is((select count(*) from public.workout_sessions where user_id = :'uid_a' and status = 'in_progress'), 0::bigint, 'las solicitudes rechazadas no dejaron sesiones abiertas');
select throws_ilike(
  format($$ select private.start_workout_from_routine_at(%L, %L, date '2026-10-30', gen_random_uuid(), timestamptz '2026-10-22 17:00:00+00', 'UTC') $$, :'uid_a', :'r2'),
  '%invalid_date%', 'una fecha futura se rechaza'
);
select lives_ok(
  format($$ select private.start_workout_from_routine_at(%L, %L, date '2026-10-15', '30000000-0000-0000-0000-000000000009', timestamptz '2026-10-22 17:00:00+00', 'UTC') $$, :'uid_a', :'r2'),
  'FR-007: se puede registrar con la rutina una fecha pasada'
);
select throws_ilike(
  format($$ select private.start_workout_from_routine_at(%L, %L, null, gen_random_uuid(), timestamptz '2026-10-22 17:00:00+00', 'UTC') $$, :'uid_a', :'r2'),
  format('%%session_in_progress:%s%%', (select id from public.workout_sessions where user_id = :'uid_a' and status = 'in_progress')),
  'FR-009: con una sesión en curso responde session_in_progress con su id'
);
select throws_ilike(
  format($$ select private.start_workout_from_routine_at(%L, %L, null, null, timestamptz '2026-10-22 17:00:00+00', 'UTC') $$, :'uid_a', :'r2'),
  '%invalid_session:request_required%', 'sin identificador de solicitud se rechaza'
);

-- la función pública --------------------------------------------------------------------------------------------------------------
update public.workout_sessions set status = 'completed', finished_at = now() where user_id = :'uid_a' and status = 'in_progress';
select tests.authenticate_as(:'uid_a');
select is(
  (public.start_workout_from_routine(:'r2', null, '30000000-0000-0000-0000-000000000010', null)) ->> 'status', 'in_progress',
  'la función pública crea la sesión con el plan'
);
select tests.clear_authentication();
select tests.authenticate_as(:'uid_b');
select throws_ilike(
  format($$ select public.start_workout_from_routine(%L, null, gen_random_uuid(), null) $$, :'r2'),
  '%not_found%', 'otra cuenta no puede usar una rutina ajena'
);
select tests.clear_authentication();
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_b';
select tests.authenticate_as(:'uid_b');
select throws_ilike(format($$ select public.start_workout_from_routine(%L, null, gen_random_uuid(), null) $$, :'r_b'), '%session_expired%', 'con la sesión vencida no se inicia');
select tests.clear_authentication();
select throws_ilike(format($$ select public.start_workout_from_routine(%L, null, gen_random_uuid(), null) $$, :'r_b'), '%session_expired%', 'sin sesión no se inicia');
select ok(not has_function_privilege('anon', 'public.start_workout_from_routine(uuid, date, uuid, text)', 'execute'), 'anon no puede ejecutarla');
select ok(has_function_privilege('authenticated', 'public.start_workout_from_routine(uuid, date, uuid, text)', 'execute'), 'authenticated sí');

select * from finish();
rollback;

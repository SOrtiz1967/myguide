-- T052 (spec 006, FR-021 a FR-027a, FR-047, SC-003): planificar, cambiar la rutina, reprogramar, cancelar y empezar.
begin;
select plan(58);

delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_exercise(:'uid_a', 'Press e2e', 'reps_weight') as rw \gset
select tests.create_exercise(:'uid_a', 'Plancha e2e', 'duration') as d \gset
select tests.create_routine(:'uid_a', 'Torso A', array[:'rw'::uuid, :'d'::uuid], 4) as r1 \gset
select tests.create_routine(:'uid_a', 'Pierna A', array[:'rw'::uuid], 3) as r2 \gset
select tests.create_exercise(:'uid_b', 'Ejercicio de B e2e', 'reps_weight') as bx \gset
select tests.create_routine(:'uid_b', 'Rutina de B', array[:'bx'::uuid]) as r_b \gset

-- Hora simulada: 2026-10-22 15:00 UTC = 12:00 en Buenos Aires. «Hoy» es 2026-10-22.
-- plan_workout -----------------------------------------------------------------------------------------------------------
select private.plan_workout_at(:'uid_a', date '2026-10-25', :'r1', '40000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 15:00:00+00', 'America/Argentina/Buenos_Aires') as p1 \gset
select is(
  (select row(status, session_date, original_date, has_plan, routine_id = :'r1', routine_name, rescheduled_count, started_at is null)::text from public.workout_sessions where id = :'p1'),
  '(planned,2026-10-25,2026-10-25,t,t,"Torso A",0,t)', 'FR-021: una sesión planificada con la rutina elegida'
);
select is(
  (select string_agg(position || ':' || exercise_name || ':' || sets, ',' order by position) from public.session_plan_items where session_id = :'p1'),
  '1:Press e2e:4,2:Plancha e2e:4', 'FR-027a: copia el plan de la rutina'
);
select is(
  private.plan_workout_at(:'uid_a', date '2026-10-25', :'r1', '40000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 15:10:00+00', 'America/Argentina/Buenos_Aires'),
  :'p1'::uuid, 'FR-047: repetir la solicitud devuelve la misma sesión...'
);
select is((select count(*) from public.workout_sessions where user_id = :'uid_a'), 1::bigint, '...sin crear otra');
select is((select count(*) from public.session_plan_items where session_id = :'p1'), 2::bigint, '...ni copiar el plan otra vez');

select private.plan_workout_at(:'uid_a', date '2026-10-22', null, '40000000-0000-0000-0000-000000000002', timestamptz '2026-10-22 15:00:00+00', 'America/Argentina/Buenos_Aires') as p_empty \gset
select is(
  (select row(status, session_date, has_plan, routine_id, routine_name)::text from public.workout_sessions where id = :'p_empty'),
  '(planned,2026-10-22,f,,)', 'una sesión vacía, planificada para hoy'
);
select is((select count(*) from public.session_plan_items where session_id = :'p_empty'), 0::bigint, 'sin plan');

-- el mismo día en la zona del perfil: a las 01:00 UTC del 23 todavía es el 22 en Buenos Aires
select lives_ok(
  $$ select private.plan_workout_at((select id from auth.users where email = 'a@test.local'), date '2026-10-22', null, gen_random_uuid(), timestamptz '2026-10-23 01:00:00+00', 'America/Argentina/Buenos_Aires') $$,
  'el «hoy» sigue la zona horaria: a las 01:00 UTC del 23 todavía es 22 en Buenos Aires'
);
select throws_ilike(
  $$ select private.plan_workout_at((select id from auth.users where email = 'a@test.local'), date '2026-10-22', null, gen_random_uuid(), timestamptz '2026-10-23 01:00:00+00', 'UTC') $$,
  '%invalid_date%', 'con la zona UTC ese mismo momento ya es 23: el 22 es pasado'
);
select throws_ilike(
  format($$ select private.plan_workout_at(%L, date '2026-10-21', null, gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a'),
  '%invalid_date%', 'FR-022: no se planifica para una fecha pasada'
);
select throws_ilike(
  format($$ select private.plan_workout_at(%L, date '2026-10-25', %L, gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a', :'r_b'),
  '%not_found%', 'la rutina de otra cuenta se comporta como inexistente'
);
select throws_ilike(
  format($$ select private.plan_workout_at(%L, date '2026-10-25', null, null, timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a'),
  '%invalid_session:request_required%', 'sin identificador de solicitud se rechaza'
);

-- set_workout_routine (función pública) ----------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select is(public.set_workout_routine(:'p1', :'r2'), :'p1'::uuid, 'FR-027a: cambia la rutina de una sesión planificada');
select tests.clear_authentication();
select is(
  (select row(routine_name, has_plan, (select count(*) from public.session_plan_items where session_id = :'p1'), (select min(exercise_name) from public.session_plan_items where session_id = :'p1'))::text from public.workout_sessions where id = :'p1'),
  '("Pierna A",t,1,"Press e2e")', 'reemplaza el plan por el de la otra rutina'
);
select tests.authenticate_as(:'uid_a');
select public.set_workout_routine(:'p1', null);
select tests.clear_authentication();
select is(
  (select row(routine_id, routine_name, has_plan, (select count(*) from public.session_plan_items where session_id = :'p1'))::text from public.workout_sessions where id = :'p1'),
  '(,,f,0)', 'con rutina nula quita el plan'
);
select tests.authenticate_as(:'uid_a');
select public.set_workout_routine(:'p1', :'r1');
select throws_ilike(
  format($$ select public.set_workout_routine(%L, %L) $$, :'p1', :'r_b'),
  '%not_found%', 'una rutina ajena → not_found'
);
select tests.clear_authentication();
select is((select count(*) from public.session_plan_items where session_id = :'p1'), 2::bigint, 'el rechazo no tocó el plan');

-- reschedule_workout -----------------------------------------------------------------------------------------------------------
select is(
  (private.reschedule_workout_at(:'uid_a', :'p1', date '2026-10-27', '41000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 15:00:00+00', 'UTC')),
  jsonb_build_object('id', :'p1'::uuid, 'session_date', '2026-10-27', 'status', 'planned', 'rescheduled_count', 1),
  'FR-023: mueve la misma sesión y cuenta el movimiento'
);
select is(
  (select row(session_date, original_date, rescheduled_count)::text from public.workout_sessions where id = :'p1'),
  '(2026-10-27,2026-10-25,1)', 'conserva la fecha original'
);
select is(
  (select row(from_date, to_date)::text from public.session_date_changes where session_id = :'p1'),
  '(2026-10-25,2026-10-27)', 'FR-025: queda el recorrido de fechas'
);
select is((select count(*) from public.workout_sessions where user_id = :'uid_a' and routine_id = :'r1'), 1::bigint, 'FR-023: no se duplicó la sesión');
select is((select count(*) from public.session_plan_items where session_id = :'p1'), 2::bigint, 'el plan se conserva al mover');

select private.reschedule_workout_at(:'uid_a', :'p1', date '2026-10-29', '41000000-0000-0000-0000-000000000002', timestamptz '2026-10-22 15:00:00+00', 'UTC');
select is(
  (private.reschedule_workout_at(:'uid_a', :'p1', date '2026-10-27', '41000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 15:30:00+00', 'UTC')) ->> 'session_date',
  '2026-10-27', 'FR-047: repetir el primer movimiento devuelve ese movimiento, aunque después hubo otro...'
);
select is(
  (select row(session_date, rescheduled_count)::text from public.workout_sessions where id = :'p1'),
  '(2026-10-29,2)', '...sin volver a mover la sesión'
);
select is((select count(*) from public.session_date_changes where session_id = :'p1'), 2::bigint, '...ni repetir el registro del recorrido');

select is(
  (private.reschedule_workout_at(:'uid_a', :'p1', date '2026-10-29', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC')) ->> 'rescheduled_count',
  '2', 'mover al mismo día en que ya está no cambia nada'
);
select is((select count(*) from public.session_date_changes where session_id = :'p1'), 2::bigint, '...y no agrega recorrido');
select throws_ilike(
  format($$ select private.reschedule_workout_at(%L, %L, date '2026-10-21', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a', :'p1'),
  '%invalid_date%', 'no se reprograma a una fecha pasada'
);
select throws_ilike(
  format($$ select private.reschedule_workout_at(%L, %L, date '2026-10-30', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_b', :'p1'),
  '%not_found%', 'una sesión ajena → not_found'
);

-- cancel_workout y volver a planificar ------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select is((public.cancel_workout(:'p1')) ->> 'status', 'cancelled', 'FR-025: cancela una sesión planificada');
select is((public.cancel_workout(:'p1')) ->> 'status', 'cancelled', 'cancelar una cancelada no cambia nada');
select tests.clear_authentication();
select is(
  (select row(has_plan, (select count(*) from public.session_plan_items where session_id = :'p1'), session_date)::text from public.workout_sessions where id = :'p1'),
  '(t,2,2026-10-29)', 'cancelar conserva el plan y la fecha'
);
select is(
  (private.reschedule_workout_at(:'uid_a', :'p1', date '2026-11-02', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC')) ->> 'status',
  'planned', 'una cancelada vuelve a planificarse en otra fecha...'
);
select is((select count(*) from public.workout_sessions where user_id = :'uid_a' and routine_id = :'r1'), 1::bigint, '...siendo la misma sesión');
select tests.authenticate_as(:'uid_a');
select public.cancel_workout(:'p1');
select tests.clear_authentication();
select is(
  (private.reschedule_workout_at(:'uid_a', :'p1', date '2026-11-02', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC')) ->> 'status',
  'planned', 'una cancelada vuelve a planificarse en su misma fecha'
);

-- sesiones en curso o realizadas no se mueven ni se cancelan (FR-024) ---------------------------------------------------------------
select tests.create_session(:'uid_a', date '2026-10-10', 'completed', :'r1', true) as s_done \gset
select tests.create_session(:'uid_a', date '2026-10-22', 'in_progress') as s_open \gset
select throws_ilike(
  format($$ select private.reschedule_workout_at(%L, %L, date '2026-10-30', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a', :'s_done'),
  '%invalid_transition%', 'FR-024: una realizada no se mueve'
);
select throws_ilike(
  format($$ select private.reschedule_workout_at(%L, %L, date '2026-10-30', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a', :'s_open'),
  '%invalid_transition%', 'una en curso no se mueve'
);
select tests.authenticate_as(:'uid_a');
select throws_ilike(format($$ select public.cancel_workout(%L) $$, :'s_done'), '%invalid_transition%', 'una realizada no se cancela');
select throws_ilike(format($$ select public.set_workout_routine(%L, %L) $$, :'s_done', :'r2'), '%invalid_transition%', 'una realizada no cambia de rutina');
select tests.clear_authentication();
select is(
  (select row(session_date, rescheduled_count, (select count(*) from public.session_plan_items where session_id = :'s_done'))::text from public.workout_sessions where id = :'s_done'),
  '(2026-10-10,0,2)', 'SC-003: la sesión realizada quedó intacta tras mover otras'
);
update public.workout_sessions set status = 'completed', finished_at = now() where id = :'s_open';

-- start_planned_workout ----------------------------------------------------------------------------------------------------------
select tests.create_session(:'uid_a', date '2026-10-20', 'planned', :'r1', true) as p_past \gset
select tests.create_session(:'uid_a', date '2026-10-22', 'planned', :'r2', true) as p_today \gset
select (private.start_planned_workout_at(:'uid_a', :'p_past', null, '42000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 15:00:00+00', 'UTC')) ->> 'status' as started \gset
select is(:'started'::text, 'in_progress', 'FR-026: una planificada vencida se puede empezar');
select is(
  (select row(session_date, original_date, rescheduled_count, started_at is not null, has_plan, (select count(*) from public.session_plan_items where session_id = :'p_past'))::text from public.workout_sessions where id = :'p_past'),
  '(2026-10-22,2026-10-20,1,t,t,2)', 'pasa a hoy, conserva el plan y la fecha original'
);
select is(
  (select row(from_date, to_date)::text from public.session_date_changes where session_id = :'p_past'),
  '(2026-10-20,2026-10-22)', 'y deja el movimiento de fecha'
);
select is(
  (private.start_planned_workout_at(:'uid_a', :'p_past', null, '42000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 15:05:00+00', 'UTC')) ->> 'status',
  'in_progress', 'FR-047: repetir la solicitud devuelve el mismo estado...'
);
select is((select rescheduled_count from public.workout_sessions where id = :'p_past'), 1, '...sin mover otra vez');
select throws_ilike(
  format($$ select private.start_planned_workout_at(%L, %L, null, gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a', :'p_today'),
  format('%%session_in_progress:%s%%', :'p_past'), 'FR-009: con otra abierta responde session_in_progress con su id'
);
update public.workout_sessions set status = 'completed', finished_at = now() where id = :'p_past';
select (private.start_planned_workout_at(:'uid_a', :'p_today', null, gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC')) ->> 'status' as started2 \gset
select is(:'started2'::text, 'in_progress', 'una planificada para hoy empieza sin cambiar de fecha');
select is((select rescheduled_count from public.workout_sessions where id = :'p_today'), 0, '...y sin contar movimiento');
update public.workout_sessions set status = 'completed', finished_at = now() where id = :'p_today';

select tests.create_session(:'uid_a', date '2026-10-30', 'planned', :'r1', true) as p_future \gset
select throws_ilike(
  format($$ select private.start_planned_workout_at(%L, %L, null, gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a', :'p_future'),
  '%invalid_date%', 'una planificada futura no se empieza: primero hay que reprogramar'
);
select tests.create_session(:'uid_a', date '2026-10-21', 'planned') as p_other \gset
select throws_ilike(
  format($$ select private.start_planned_workout_at(%L, %L, date '2026-10-23', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_a', :'p_other'),
  '%invalid_date%', 'el día en que se hizo no puede ser futuro'
);
select is(
  (private.start_planned_workout_at(:'uid_a', :'p_other', date '2026-10-21', gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC')) ->> 'session_date',
  '2026-10-21', 'se puede indicar el día pasado en que se hizo; ahí queda'
);
select is((select count(*) from public.session_date_changes where session_id = :'p_other'), 0::bigint, 'sin cambio de día no hay movimiento registrado');
select throws_ilike(
  format($$ select private.start_planned_workout_at(%L, %L, null, gen_random_uuid(), timestamptz '2026-10-22 15:00:00+00', 'UTC') $$, :'uid_b', :'p_other'),
  '%not_found%', 'una sesión ajena → not_found'
);

-- permisos ---------------------------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select throws_ilike(format($$ select public.plan_workout(date '2026-10-30', %L, gen_random_uuid(), null) $$, :'r1'), '%not_found%', 'otra cuenta no puede usar una rutina ajena');
select tests.clear_authentication();
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_b';
select tests.authenticate_as(:'uid_b');
select throws_ilike(format($$ select public.cancel_workout(%L) $$, :'p1'), '%session_expired%', 'con la sesión vencida no se cancela');
select tests.clear_authentication();
select throws_ilike(format($$ select public.plan_workout(date '2026-10-30', null, gen_random_uuid(), null) $$), '%session_expired%', 'sin sesión no se planifica');
select ok(
  not has_function_privilege('anon', 'public.plan_workout(date, uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.reschedule_workout(uuid, date, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.start_planned_workout(uuid, date, uuid, text)', 'execute'),
  'anon no puede ejecutarlas'
);
select ok(
  has_function_privilege('authenticated', 'public.plan_workout(date, uuid, uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.set_workout_routine(uuid, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.cancel_workout(uuid)', 'execute'),
  'authenticated sí'
);

select * from finish();
rollback;

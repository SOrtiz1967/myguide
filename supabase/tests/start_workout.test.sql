-- T016 (spec 006, FR-007, FR-009 a FR-011, FR-047): iniciar una sesión vacía.
begin;
select plan(20);

-- La base local puede tener datos: la prueba parte de una base sin sesiones (todo se deshace al final).
delete from public.workout_sessions;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- Hora simulada: 2026-10-22 02:30 UTC es 2026-10-21 23:30 en Buenos Aires (todavía el 21) y 2026-10-22 03:30 UTC ya
-- es el 22 a las 00:30.
select (private.start_workout_at(:'uid_a', null, '10000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 02:30:00+00', 'America/Argentina/Buenos_Aires'))
  ->> 'id' as s1 \gset

select is(
  (select row(status, session_date, revision, started_at is not null, finished_at is null, has_plan, modified, user_id = :'uid_a')::text
   from public.workout_sessions where id = :'s1'),
  '(in_progress,2026-10-21,1,t,t,f,f,t)',
  'FR-007: una sesión vacía en curso para «hoy» en la zona de la persona (23:30 del 21)'
);
select is(
  (private.start_workout_at(:'uid_a', null, '10000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires')) ->> 'id',
  :'s1', 'FR-047: repetir la solicitud devuelve la misma sesión'
);
select is((select count(*) from public.workout_sessions where user_id = :'uid_a'), 1::bigint, 'y no crea otra');

-- una sesión abierta impide iniciar otra (FR-009)
select throws_ilike(
  format($$ select private.start_workout_at(%L, null, '10000000-0000-0000-0000-000000000002', timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires') $$, :'uid_a'),
  format('%%session_in_progress:%s%%', :'s1'), 'FR-009: con una sesión en curso, iniciar otra responde session_in_progress con el id de la abierta'
);
select is((select count(*) from public.workout_sessions where user_id = :'uid_a'), 1::bigint, 'y no deja una segunda sesión');

-- otra cuenta tiene la suya
select lives_ok(
  format($$ select private.start_workout_at(%L, null, '10000000-0000-0000-0000-000000000003', timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires') $$, :'uid_b'),
  'otra cuenta puede tener su propia sesión en curso'
);

-- un reintento tardío, con la sesión ya terminada, devuelve la misma y no «session_in_progress»
update public.workout_sessions set status = 'completed', finished_at = now() where id = :'s1';
select is(
  (private.start_workout_at(:'uid_a', null, '10000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires')) ->> 'id',
  :'s1', 'FR-047: un reintento tardío (la sesión ya terminó) devuelve la misma sesión'
);

-- fechas: «hoy» a las 00:30 del 22; una pasada; una futura; una anterior al 2000
select is(
  (select (private.start_workout_at(:'uid_a', null, '10000000-0000-0000-0000-000000000004', timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires')) ->> 'session_date'),
  '2026-10-22', 'pasada la medianoche, «hoy» es el 22'
);
update public.workout_sessions set status = 'completed', finished_at = now() where user_id = :'uid_a' and status = 'in_progress';
select is(
  (select (private.start_workout_at(:'uid_a', date '2026-10-15', '10000000-0000-0000-0000-000000000005', timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires')) ->> 'session_date'),
  '2026-10-15', 'FR-007: se puede registrar una sesión de una fecha pasada'
);
update public.workout_sessions set status = 'completed', finished_at = now() where user_id = :'uid_a' and status = 'in_progress';
select throws_ilike(
  format($$ select private.start_workout_at(%L, date '2026-10-23', '10000000-0000-0000-0000-000000000006', timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires') $$, :'uid_a'),
  '%invalid_date%', 'una fecha futura se rechaza'
);
select throws_ilike(
  format($$ select private.start_workout_at(%L, date '1999-12-31', '10000000-0000-0000-0000-000000000007', timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires') $$, :'uid_a'),
  '%invalid_date%', 'una fecha anterior al 2000 se rechaza'
);
select is(
  (select count(*) from public.workout_sessions where user_id = :'uid_a' and status = 'in_progress'), 0::bigint,
  'las solicitudes rechazadas no dejaron sesiones abiertas'
);

-- sin identificador de solicitud
select throws_ilike(
  format($$ select private.start_workout_at(%L, null, null, timestamptz '2026-10-22 03:30:00+00', 'America/Argentina/Buenos_Aires') $$, :'uid_a'),
  '%invalid_session:request_required:request_id%', 'sin identificador de solicitud se rechaza'
);

-- la función pública --------------------------------------------------------------------------------------------------------
select tests.set_profile_timezone(:'uid_a', 'Pacific/Auckland');
select tests.authenticate_as(:'uid_a');
select is(
  (public.start_workout(null, '10000000-0000-0000-0000-000000000008', null)) ->> 'session_date',
  ((now() at time zone 'Pacific/Auckland')::date)::text,
  'la función pública usa la zona horaria del perfil'
);
select is(
  (public.start_workout(null, '10000000-0000-0000-0000-000000000008', null)) ->> 'status', 'in_progress',
  'y es idempotente por la misma solicitud'
);
select tests.clear_authentication();

-- sesión vencida, sin sesión y permisos ---------------------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_b';
select tests.authenticate_as(:'uid_b');
select throws_ilike($$ select public.start_workout(null, gen_random_uuid(), null) $$, '%session_expired%', 'con la sesión vencida no se inicia');
select tests.clear_authentication();
select throws_ilike($$ select public.start_workout(null, gen_random_uuid(), null) $$, '%session_expired%', 'sin sesión no se inicia');
select ok(not has_function_privilege('anon', 'public.start_workout(date, uuid, text)', 'execute'), 'anon no puede ejecutarla');
select ok(has_function_privilege('authenticated', 'public.start_workout(date, uuid, text)', 'execute'), 'authenticated sí');
select ok(not has_function_privilege('authenticated', 'private.start_workout_at(uuid, date, uuid, timestamptz, text)', 'execute'), 'la función privada con hora simulada no la ejecuta el cliente');

select * from finish();
rollback;

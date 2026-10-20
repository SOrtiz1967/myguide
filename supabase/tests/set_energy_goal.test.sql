-- T016 (spec 004, FR-001, FR-003 a FR-006, FR-023, FR-024): fijar, cambiar y quitar el objetivo.
begin;
select plan(28);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.set_profile_timezone(:'uid_a', 'America/Argentina/Buenos_Aires');

-- 2026-10-19 12:00 UTC: en Buenos Aires (UTC-3) es el 19; en Auckland (UTC+13) ya es el 20.
select is(
  (select effective_from from private.set_energy_goal_at(:'uid_a', 2000, '10000000-0000-0000-0000-000000000001', '2026-10-19 12:00+00', 'America/Argentina/Buenos_Aires')),
  '2026-10-19'::date, 'fija el objetivo desde el "hoy" de la persona'
);
select is(
  (select kcal from public.energy_goals where user_id = :'uid_a' and client_request_id = '10000000-0000-0000-0000-000000000001'),
  2000, 'y guarda el valor'
);

-- rango y solicitud (FR-004, FR-024) ---------------------------------------------------------------------------
select throws_ilike(
  format($$ select * from private.set_energy_goal_at(%L, 999, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_goal:out_of_range:kcal%', 'FR-024: 999 kcal se rechaza en el servidor'
);
select throws_ilike(
  format($$ select * from private.set_energy_goal_at(%L, 6001, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_goal:out_of_range:kcal%', 'FR-024: 6001 kcal se rechaza'
);
select throws_ilike(
  format($$ select * from private.set_energy_goal_at(%L, 2000, null, now(), 'UTC') $$, :'uid_a'),
  '%invalid_goal:request_required:request_id%', 'sin identificador de solicitud se rechaza'
);
select lives_ok(
  format($$ select * from private.set_energy_goal_at(%L, 1000, gen_random_uuid(), now(), 'UTC') a, private.set_energy_goal_at(%L, 6000, gen_random_uuid(), now(), 'UTC') b, private.set_energy_goal_at(%L, null, gen_random_uuid(), now(), 'UTC') c $$, :'uid_b', :'uid_b', :'uid_b'),
  'FR-004: 1000, 6000 y nulo (quitar) se aceptan'
);
select is((select count(*) from public.energy_goals where user_id = :'uid_b'), 3::bigint, 'y cada uno agrega una fila');

-- idempotencia (FR-006) ------------------------------------------------------------------------------------------
select is(
  (select kcal from private.set_energy_goal_at(:'uid_a', 1500, '10000000-0000-0000-0000-000000000001', '2026-10-20 12:00+00', 'America/Argentina/Buenos_Aires')),
  2000, 'FR-006: repetir la solicitud devuelve la fila original, con su valor'
);
select is(
  (select effective_from from private.set_energy_goal_at(:'uid_a', 1500, '10000000-0000-0000-0000-000000000001', '2026-10-25 12:00+00', 'America/Argentina/Buenos_Aires')),
  '2026-10-19'::date, 'y con su fecha original, aunque pasen los días'
);
select is(
  (select count(*) from public.energy_goals where user_id = :'uid_a' and client_request_id = '10000000-0000-0000-0000-000000000001'),
  1::bigint, 'SC-006: sigue habiendo una sola fila'
);

-- reintento tardío: otro cambio en el medio, después el reintento del primero
select kcal from private.set_energy_goal_at(:'uid_a', 1800, '10000000-0000-0000-0000-000000000002', '2026-10-21 12:00+00', 'America/Argentina/Buenos_Aires');
select kcal from private.set_energy_goal_at(:'uid_a', 2000, '10000000-0000-0000-0000-000000000001', '2026-10-21 12:05+00', 'America/Argentina/Buenos_Aires');
select is((select count(*) from public.energy_goals where user_id = :'uid_a'), 2::bigint, 'un reintento tardío no agrega filas');
select is(
  (select kcal from public.energy_goals where user_id = :'uid_a' order by created_at desc limit 1),
  1800, 'y no pisa el cambio posterior: el último guardado sigue siendo 1800'
);

-- la zona que manda -----------------------------------------------------------------------------------------------
select is(
  (select effective_from from private.set_energy_goal_at(:'uid_b', 1700, gen_random_uuid(), '2026-10-19 12:00+00', private.effective_timezone(:'uid_b', 'Pacific/Auckland'))),
  '2026-10-20'::date, 'sin zona en el perfil usa la del dispositivo'
);
select is(
  (select effective_from from private.set_energy_goal_at(:'uid_a', 1700, gen_random_uuid(), '2026-10-19 12:00+00', private.effective_timezone(:'uid_a', 'Pacific/Auckland'))),
  '2026-10-19'::date, 'con zona en el perfil ignora la del dispositivo'
);
select is(
  (select effective_from from private.set_energy_goal_at(:'uid_b', 1700, gen_random_uuid(), '2026-10-19 23:30+00', private.effective_timezone(:'uid_b', 'zona/inexistente'))),
  '2026-10-19'::date, 'con una zona inválida usa UTC'
);

-- la versión pública --------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select is(
  (public.set_energy_goal(1900, '20000000-0000-0000-0000-000000000001', 'UTC') ->> 'kcal')::integer,
  1900, 'la persona fija su objetivo'
);
select is(
  (public.set_energy_goal(1500, '20000000-0000-0000-0000-000000000001', 'UTC') ->> 'kcal')::integer,
  1900, 'y repetir la solicitud devuelve el original'
);
select is(
  (select count(*) from public.energy_goals where client_request_id = '20000000-0000-0000-0000-000000000001'),
  1::bigint, 'una sola fila (doble clic)'
);
select throws_ilike(
  $$ select * from public.set_energy_goal(500, gen_random_uuid(), 'UTC') $$,
  '%invalid_goal:out_of_range:kcal%', 'FR-024: la función pública también rechaza el rango'
);
select throws_ilike(
  $$ select * from public.set_energy_goal(2000, null, 'UTC') $$,
  '%invalid_goal:request_required:request_id%', 'y exige la solicitud'
);
select lives_ok(
  $$ select * from public.set_energy_goal(null, gen_random_uuid(), 'UTC') $$,
  'FR-001: se puede quitar el objetivo (nulo)'
);
select tests.clear_authentication();
select is((select count(*) from public.energy_goals where user_id = :'uid_b'), 5::bigint, 'FR-023: lo que hizo A no tocó el historial de B');

-- sesión vencida y sin sesión ---------------------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select throws_ilike(
  $$ select * from public.set_energy_goal(2000, gen_random_uuid(), 'UTC') $$,
  '%session_expired%', 'con la sesión vencida no se guarda'
);
select tests.clear_authentication();
select throws_ilike(
  $$ select * from public.set_energy_goal(2000, gen_random_uuid(), 'UTC') $$,
  '%session_expired%', 'sin sesión no se guarda'
);

-- permisos --------------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.set_energy_goal(integer, uuid, text)', 'execute'), 'anon no puede ejecutarla');
select ok(has_function_privilege('authenticated', 'public.set_energy_goal(integer, uuid, text)', 'execute'), 'authenticated sí');
select ok(
  not has_function_privilege('authenticated', 'private.set_energy_goal_at(uuid, integer, uuid, timestamptz, text)', 'execute'),
  'la versión con la hora como parámetro no es ejecutable por el cliente'
);
select ok(
  not has_function_privilege('anon', 'private.set_energy_goal_at(uuid, integer, uuid, timestamptz, text)', 'execute'),
  '...ni por anon'
);

select * from finish();
rollback;

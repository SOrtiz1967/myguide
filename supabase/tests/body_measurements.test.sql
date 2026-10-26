-- Spec 008 (versión mínima): peso y medidas — validación, un valor por día, idempotencia, corrección y aislamiento.
begin;
select plan(31);

delete from public.body_measurements;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- Hora simulada: 2026-10-26 15:00 UTC = 12:00 en Buenos Aires. «Hoy» es 2026-10-26.
select (private.save_measurement_at(:'uid_a', 'weight', 72.4, date '2026-10-26', 'En ayunas', '50000000-0000-0000-0000-000000000001', timestamptz '2026-10-26 15:00:00+00', 'America/Argentina/Buenos_Aires')) ->> 'id' as m1 \gset

select is(
  (select row(kind, value, measured_on, note)::text from public.body_measurements where id = :'m1'),
  '(weight,72.4,2026-10-26,"En ayunas")', 'guarda el peso con su fecha y su nota'
);

-- idempotencia
select is(
  (private.save_measurement_at(:'uid_a', 'weight', 99.9, date '2026-10-26', null, '50000000-0000-0000-0000-000000000001', timestamptz '2026-10-26 15:05:00+00', 'UTC')) ->> 'id',
  :'m1', 'repetir la solicitud devuelve el mismo registro...'
);
select is((select count(*) from public.body_measurements where user_id = :'uid_a'), 1::bigint, '...sin crear otro');
select is((select value from public.body_measurements where id = :'m1'), 72.4, '...ni cambiar el valor');

-- un valor por medida y día: el segundo reemplaza al primero
select is(
  (private.save_measurement_at(:'uid_a', 'weight', 72.1, date '2026-10-26', null, '50000000-0000-0000-0000-000000000002', timestamptz '2026-10-26 15:10:00+00', 'UTC')) ->> 'id',
  :'m1', 'otro valor el mismo día reemplaza al anterior'
);
select is((select count(*) from public.body_measurements where user_id = :'uid_a' and kind = 'weight'), 1::bigint, 'y queda un solo valor de ese día');
select is((select row(value, note)::text from public.body_measurements where id = :'m1'), '(72.1,)', 'con el último valor y sin la nota anterior');

-- otras medidas y otros días conviven
select lives_ok(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'waist', 84, date '2026-10-26', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'UTC') $$,
  'una cintura el mismo día'
);
select lives_ok(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', 73.0, date '2026-10-23', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'UTC') $$,
  'un peso de un día pasado'
);
select is((select count(*) from public.body_measurements where user_id = :'uid_a'), 3::bigint, 'tres registros en total');

-- validaciones
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', 19.9, date '2026-10-26', null, gen_random_uuid(), now(), 'UTC') $$,
  '%invalid_measurement:out_of_range:value%', 'un peso menor a 20 kg se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', 500.1, date '2026-10-26', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'un peso mayor a 500 kg se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'waist', 9.9, date '2026-10-26', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'una medida menor a 10 cm se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'waist', 301, date '2026-10-26', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'una medida mayor a 300 cm se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', 72.45, date '2026-10-26', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'más de un decimal se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', null, date '2026-10-26', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'un valor vacío se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'peso', 70, date '2026-10-26', null, gen_random_uuid(), now(), 'UTC') $$,
  '%kind_invalid%', 'una medida desconocida se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', 70, date '2026-10-27', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'America/Argentina/Buenos_Aires') $$,
  '%date_future%', 'una fecha futura se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', 70, date '2026-10-26', null, gen_random_uuid(), timestamptz '2026-10-26 01:00:00+00', 'America/Argentina/Buenos_Aires') $$,
  '%date_future%', 'el «hoy» sigue la zona: a las 01:00 UTC del 26 todavía es 25 en Buenos Aires'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', 70, date '1999-12-31', null, gen_random_uuid(), now(), 'UTC') $$,
  '%date_invalid%', 'una fecha anterior al año 2000 se rechaza'
);
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'weight', 70, date '2026-10-26', null, null, now(), 'UTC') $$,
  '%request_required%', 'sin identificador de solicitud se rechaza'
);

-- corregir
select is(
  (private.update_measurement_at(:'uid_a', :'m1', 72.0, date '2026-10-25', 'Corregido', timestamptz '2026-10-26 15:00:00+00', 'UTC')) ->> 'measured_on',
  '2026-10-25', 'corregir cambia el valor y la fecha'
);
select throws_ilike(
  format($$ select private.update_measurement_at(%L, %L, 72.0, date '2026-10-23', null, timestamptz '2026-10-26 15:00:00+00', 'UTC') $$, :'uid_a', :'m1'),
  '%date_taken%', 'corregir hacia un día que ya tiene valor avisa y no lo pisa'
);
select throws_ilike(
  format($$ select private.update_measurement_at(%L, %L, 72.0, date '2026-10-30', null, timestamptz '2026-10-26 15:00:00+00', 'UTC') $$, :'uid_a', :'m1'),
  '%date_future%', 'corregir hacia el futuro se rechaza'
);
select throws_ilike(
  format($$ select private.update_measurement_at(%L, %L, 72.0, date '2026-10-25', null, timestamptz '2026-10-26 15:00:00+00', 'UTC') $$, :'uid_b', :'m1'),
  '%not_found%', 'un registro ajeno se comporta como inexistente'
);

-- permisos y aislamiento
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.body_measurements), 0::bigint, 'la cuenta B no ve los registros de A');
select throws_ilike(
  $$ insert into public.body_measurements (user_id, kind, value, measured_on, client_request_id) values (auth.uid(), 'weight', 70, current_date, gen_random_uuid()) $$,
  '%permission denied%', 'el cliente no inserta directamente'
);
delete from public.body_measurements where id = :'m1';
select tests.clear_authentication();
select is((select count(*) from public.body_measurements where id = :'m1'), 1::bigint, 'B no borra registros de A');

select tests.authenticate_as(:'uid_a');
delete from public.body_measurements where id = :'m1';
select tests.clear_authentication();
select is((select count(*) from public.body_measurements where id = :'m1'), 0::bigint, 'A borra un registro propio');

update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_b';
select tests.authenticate_as(:'uid_b');
select throws_ilike(
  $$ select public.save_measurement('weight', 70, current_date, null, gen_random_uuid(), null) $$,
  '%session_expired%', 'con la sesión vencida no se guarda'
);
select tests.clear_authentication();
select ok(
  not has_function_privilege('anon', 'public.save_measurement(text, numeric, date, text, uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.save_measurement(text, numeric, date, text, uuid, text)', 'execute'),
  'anon no puede guardar y authenticated sí'
);

select * from finish();
rollback;

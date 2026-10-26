-- Spec 007: sueño, pasos y actividad — validación, un valor por día y fuente, idempotencia, corrección y aislamiento.
begin;
select plan(25);

delete from public.daily_activity;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- Hora simulada: 2026-10-26 15:00 UTC = 12:00 en Buenos Aires.
select (private.save_activity_at(:'uid_a', 'sleep', 450, date '2026-10-26', 'Sin despertares', '60000000-0000-0000-0000-000000000001', timestamptz '2026-10-26 15:00:00+00', 'America/Argentina/Buenos_Aires')) ->> 'id' as a1 \gset

select is(
  (select row(kind, value, activity_date, source, note)::text from public.daily_activity where id = :'a1'),
  '(sleep,450,2026-10-26,manual,"Sin despertares")', 'guarda el sueño en minutos, con fecha, fuente y nota'
);
select is(
  (private.save_activity_at(:'uid_a', 'sleep', 100, date '2026-10-26', null, '60000000-0000-0000-0000-000000000001', timestamptz '2026-10-26 15:05:00+00', 'UTC')) ->> 'id',
  :'a1', 'repetir la solicitud devuelve el mismo registro...'
);
select is((select value from public.daily_activity where id = :'a1'), 450, '...sin cambiar el valor');
select is(
  (private.save_activity_at(:'uid_a', 'sleep', 480, date '2026-10-26', null, '60000000-0000-0000-0000-000000000002', timestamptz '2026-10-26 15:10:00+00', 'UTC')) ->> 'id',
  :'a1', 'otro valor el mismo día reemplaza al anterior'
);
select is((select count(*) from public.daily_activity where user_id = :'uid_a' and kind = 'sleep'), 1::bigint, 'y queda uno solo');

select lives_ok(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'steps', 8500, date '2026-10-26', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'UTC') $$,
  'pasos el mismo día'
);
select lives_ok(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'active_minutes', 0, date '2026-10-26', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'UTC') $$,
  '0 minutos de actividad es un dato válido'
);
select lives_ok(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'steps', 0, date '2026-10-25', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'UTC') $$,
  '0 pasos es un dato válido (distinto de «sin dato»)'
);

select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'sleep', 0, date '2026-10-25', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', '0 minutos de sueño se rechaza'
);
select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'sleep', 1441, date '2026-10-25', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'más de 24 horas de sueño se rechaza'
);
select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'steps', 200001, date '2026-10-25', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'más de 200.000 pasos se rechaza'
);
select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'steps', -1, date '2026-10-25', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'pasos negativos se rechazan'
);
select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'active_minutes', 1441, date '2026-10-25', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'más de 1.440 minutos de actividad se rechaza'
);
select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'sleep', null, date '2026-10-25', null, gen_random_uuid(), now(), 'UTC') $$,
  '%out_of_range%', 'un valor vacío se rechaza'
);
select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'sueno', 400, date '2026-10-25', null, gen_random_uuid(), now(), 'UTC') $$,
  '%kind_invalid%', 'un tipo desconocido se rechaza'
);
select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'sleep', 400, date '2026-10-27', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'America/Argentina/Buenos_Aires') $$,
  '%date_future%', 'una fecha futura se rechaza'
);
select throws_ilike(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'sleep', 400, date '2026-10-25', null, null, now(), 'UTC') $$,
  '%request_required%', 'sin identificador de solicitud se rechaza'
);

-- corregir
select is(
  (private.update_activity_at(:'uid_a', :'a1', 420, date '2026-10-24', 'Corregido', timestamptz '2026-10-26 15:00:00+00', 'UTC')) ->> 'activity_date',
  '2026-10-24', 'corregir cambia el valor y la fecha'
);
select lives_ok(
  $$ select private.save_activity_at((select id from auth.users where email = 'a@test.local'), 'sleep', 400, date '2026-10-23', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'UTC') $$,
  'otro sueño en otro día'
);
select throws_ilike(
  format($$ select private.update_activity_at(%L, %L, 420, date '2026-10-23', null, timestamptz '2026-10-26 15:00:00+00', 'UTC') $$, :'uid_a', :'a1'),
  '%date_taken%', 'corregir hacia un día ocupado avisa'
);
select throws_ilike(
  format($$ select private.update_activity_at(%L, %L, 420, date '2026-10-24', null, timestamptz '2026-10-26 15:00:00+00', 'UTC') $$, :'uid_b', :'a1'),
  '%not_found%', 'un registro ajeno se comporta como inexistente'
);

-- aislamiento y permisos
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.daily_activity), 0::bigint, 'la cuenta B no ve los registros de A');
select throws_ilike(
  $$ insert into public.daily_activity (user_id, kind, value, activity_date, client_request_id) values (auth.uid(), 'steps', 1, current_date, gen_random_uuid()) $$,
  '%permission denied%', 'el cliente no inserta directamente'
);
delete from public.daily_activity where id = :'a1';
select tests.clear_authentication();
select is((select count(*) from public.daily_activity where id = :'a1'), 1::bigint, 'B no borra registros de A');
select tests.authenticate_as(:'uid_a');
delete from public.daily_activity where id = :'a1';
select tests.clear_authentication();
select is((select count(*) from public.daily_activity where id = :'a1'), 0::bigint, 'A borra un registro propio');

select * from finish();
rollback;

-- T046 (spec 003, FR-024 a FR-027): la regla del día, con una hora simulada.
begin;
select plan(23);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.set_profile_timezone(:'uid_a', 'America/Argentina/Buenos_Aires');

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('dia-prueba', 'Fuente del día', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');
select tests.create_catalog_food('dia-prueba', 'D-1', 'Arroz', null, 130, '100g', 2.7, 28, 0.3) as rice \gset

-- 2026-10-19 01:00 en Buenos Aires (UTC-3) = 04:00 UTC
select is(
  (select today from private.log_day_status_at(:'uid_a', '2026-10-19 04:00+00', 'America/Argentina/Buenos_Aires')),
  '2026-10-19'::date, '"hoy" se calcula con la zona dada'
);
select is(
  (select today from private.log_day_status_at(:'uid_a', '2026-10-19 04:00+00', 'UTC')),
  '2026-10-19'::date, 'a las 04:00 UTC sigue siendo el 19'
);
select is(
  (select today from private.log_day_status_at(:'uid_a', '2026-10-19 02:00+00', 'America/Argentina/Buenos_Aires')),
  '2026-10-18'::date, 'a las 23:00 en Buenos Aires todavía es el 18'
);

-- sin ítems en ningún lado: nada que cerrar
select is(
  (select closing from private.log_day_status_at(:'uid_a', '2026-10-19 04:00+00', 'America/Argentina/Buenos_Aires')),
  false, 'sin ítems ayer no hay día que cerrar'
);

-- ítem ayer, nada hoy, sin marca
select tests.create_meal_entry(:'uid_a', '2026-10-18', 'dinner', :'rice', 100) as e1 \gset
select is(
  (select closing from private.log_day_status_at(:'uid_a', '2026-10-19 04:00+00', 'America/Argentina/Buenos_Aires')),
  true, 'FR-025: a la 01:00, con ítems ayer, sin ítems hoy y sin marca, se propone ayer'
);
select is(
  (select proposed_date from private.log_day_status_at(:'uid_a', '2026-10-19 04:00+00', 'America/Argentina/Buenos_Aires')),
  '2026-10-18'::date, 'la fecha propuesta es ayer'
);
select is(
  (select proposed_date from private.log_day_status_at(:'uid_a', '2026-10-19 14:00+00', 'America/Argentina/Buenos_Aires')),
  '2026-10-18'::date, 'sin límite de hora: a las 11:00 también se propone ayer'
);
select is(
  (select closing from private.log_day_status_at(:'uid_a', '2026-10-19 23:30+00', 'America/Argentina/Buenos_Aires')),
  true, 'y a las 20:30 también, mientras no haya empezado el día nuevo'
);

-- otra cuenta no ve ni afecta a la anterior
select is(
  (select closing from private.log_day_status_at(:'uid_b', '2026-10-19 04:00+00', 'UTC')),
  false, 'los ítems de otra cuenta no cuentan'
);

-- un ítem hoy cierra la propuesta
select tests.create_meal_entry(:'uid_a', '2026-10-19', 'breakfast', :'rice', 50) as e2 \gset
select is(
  (select proposed_date from private.log_day_status_at(:'uid_a', '2026-10-19 14:00+00', 'America/Argentina/Buenos_Aires')),
  '2026-10-19'::date, 'con un ítem hoy se propone hoy'
);
delete from public.meal_entries where id = :'e2';

-- la marca de inicio también cierra la propuesta
insert into public.log_day_starts (user_id, log_date) values (:'uid_a', '2026-10-19');
select is(
  (select closing from private.log_day_status_at(:'uid_a', '2026-10-19 04:00+00', 'America/Argentina/Buenos_Aires')),
  false, 'FR-025: con la marca de hoy ya no se propone ayer'
);
delete from public.log_day_starts where user_id = :'uid_a';

-- el cambio de horario de verano no altera el resultado (Madrid adelanta el reloj el 2027-03-28 a la 01:00 UTC)
select tests.create_user('c@test.local') as uid_c \gset
select tests.set_profile_timezone(:'uid_c', 'Europe/Madrid');
select tests.create_meal_entry(:'uid_c', '2027-03-27', 'dinner', :'rice', 100) as e3 \gset
select is(
  (select proposed_date from private.log_day_status_at(:'uid_c', '2027-03-28 00:30+00', 'Europe/Madrid')),
  '2027-03-27'::date, 'antes del cambio de horario (01:30 locales) se propone el día anterior'
);
select is(
  (select proposed_date from private.log_day_status_at(:'uid_c', '2027-03-28 01:30+00', 'Europe/Madrid')),
  '2027-03-27'::date, 'después del cambio (03:30 locales) también'
);
select is(
  (select today from private.log_day_status_at(:'uid_c', '2027-03-28 01:30+00', 'Europe/Madrid')),
  '2027-03-28'::date, 'y el día sigue siendo el 28'
);

-- cambiar la zona del perfil no mueve ítems ya guardados (FR-027)
select tests.set_profile_timezone(:'uid_a', 'Asia/Tokyo');
select is(
  (select log_date from public.meal_entries where id = :'e1'), '2026-10-18'::date,
  'FR-027: cambiar la zona horaria no mueve los ítems guardados'
);
select tests.set_profile_timezone(:'uid_a', 'America/Argentina/Buenos_Aires');

-- la función pública: zona del perfil, zona del dispositivo y marca de inicio
select tests.authenticate_as(:'uid_a');
select is(
  (select today from public.log_day_status()), (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  'log_day_status usa la zona del perfil'
);
select is(
  (select today from public.log_day_status('Pacific/Auckland')), (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  'la zona del dispositivo se ignora si el perfil tiene una'
);
select lives_ok($$ select public.start_log_day((select today from public.log_day_status())) $$, 'start_log_day acepta el hoy de la persona');
select lives_ok($$ select public.start_log_day((select today from public.log_day_status())) $$, 'y es idempotente');
select is((select count(*) from public.log_day_starts), 1::bigint, 'queda una sola marca');
select throws_ilike(
  $$ select public.start_log_day((select today - 1 from public.log_day_status())) $$, 'invalid_day%',
  'no se puede empezar un día que no es hoy'
);
select throws_ilike($$ select * from private.log_day_status_at('00000000-0000-0000-0000-000000000000', now(), 'UTC') $$, 'permission denied%', 'el cliente no ejecuta la función con hora simulada');

select tests.authenticate_as(:'uid_b');
select is(
  (select today from public.log_day_status('Pacific/Auckland')), (now() at time zone 'Pacific/Auckland')::date,
  'sin zona en el perfil se usa la del dispositivo'
);
select tests.clear_authentication();

select * from finish();
rollback;

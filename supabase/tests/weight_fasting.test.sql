-- Spec 020: peso en ayunas opcional (FR-002 a FR-004).
begin;
select plan(12);

select tests.create_user('a@test.local') as uid_a \gset

-- por omisión (llamadas de la spec 008) el peso queda «sin indicar»
select is(
  (private.save_measurement_at(:'uid_a', 'weight', 72.4, date '2026-10-26', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'UTC') ->> 'fasting'),
  'false', 'sin el parámetro el peso no queda marcado'
);

-- con la marca
select (private.save_measurement_at(:'uid_a', 'weight', 72.1, date '2026-10-25', null, '60000000-0000-0000-0000-000000000001', timestamptz '2026-10-26 15:00:00+00', 'UTC', true)) ->> 'id' as w1 \gset
select is((select fasting from public.body_measurements where id = :'w1'), true, 'se guarda la marca de ayunas');
select is(
  (private.save_measurement_at(:'uid_a', 'weight', 99.9, date '2026-10-25', null, '60000000-0000-0000-0000-000000000001', timestamptz '2026-10-26 15:05:00+00', 'UTC', false) ->> 'fasting'),
  'true', 'un reintento con el mismo identificador devuelve lo ya guardado'
);

-- guardar de nuevo el mismo día reemplaza también la marca
select private.save_measurement_at(:'uid_a', 'weight', 72.0, date '2026-10-25', null, gen_random_uuid(), timestamptz '2026-10-26 15:10:00+00', 'UTC', false);
select is((select fasting from public.body_measurements where id = :'w1'), false, 'reemplazar el día reemplaza la marca');

-- solo el peso admite la marca
select throws_ilike(
  $$ select private.save_measurement_at((select id from auth.users where email = 'a@test.local'), 'waist', 84, date '2026-10-26', null, gen_random_uuid(), timestamptz '2026-10-26 15:00:00+00', 'UTC', true) $$,
  'invalid_measurement:fasting_invalid:fasting%', 'una cintura no puede marcarse en ayunas'
);
select throws_ilike(
  format($$ update public.body_measurements set kind = 'waist', value = 84, fasting = true where id = %L $$, :'w1'),
  '%body_measurements_fasting_check%', 'la restricción de la tabla lo impide también'
);

-- corregir
select private.update_measurement_at(:'uid_a', :'w1'::uuid, 72.2, date '2026-10-25', null, timestamptz '2026-10-26 15:00:00+00', 'UTC', true);
select is((select fasting from public.body_measurements where id = :'w1'), true, 'corregir puede poner la marca');
select private.update_measurement_at(:'uid_a', :'w1'::uuid, 72.2, date '2026-10-25', null, timestamptz '2026-10-26 15:00:00+00', 'UTC');
select is((select fasting from public.body_measurements where id = :'w1'), false, 'y corregir sin el parámetro la quita');

-- vía pública, con sesión
select tests.authenticate_as(:'uid_a');
select is(
  (public.save_measurement('weight', 71.9, date '2026-10-24', null, gen_random_uuid(), 'UTC', true) ->> 'fasting'),
  'true', 'la función pública acepta la marca'
);
select is(
  (public.save_measurement('weight', 71.8, date '2026-10-23', null, gen_random_uuid(), 'UTC') ->> 'fasting'),
  'false', 'y sigue aceptando la llamada anterior sin ella'
);
select is(
  (select count(*) from public.body_measurements where fasting), 1::bigint, 'el cliente lee la marca de lo propio'
);
select tests.clear_authentication();

-- el cliente no puede escribir la marca directamente
select tests.authenticate_as(:'uid_a');
select throws_ilike(
  $$ update public.body_measurements set fasting = true $$, '%permission denied%', 'el cliente no actualiza filas directamente'
);
select tests.clear_authentication();

select * from finish();
rollback;

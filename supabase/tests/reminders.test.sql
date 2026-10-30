-- Spec 021: recordatorios configurables (FR-001 a FR-006, FR-014).
begin;
select plan(25);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- configurar ---------------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select is((public.set_reminder('weight', true, 'daily') ->> 'frequency'), 'daily', 'recordatorio diario de peso');
select is(
  (public.set_reminder('photos', true, 'every_n_days', 14) ->> 'every_n'), '14', 'fotos cada 14 días'
);
select is(
  (select weekdays from public.reminders where kind = 'photos'), null, 'sin días de la semana en «cada tantos días»'
);
select is(
  (public.set_reminder('supplements', true, 'weekdays', null, array[3, 1, 3, 5]) -> 'weekdays')::text, '[1, 3, 5]',
  'los días de la semana se guardan sin repetidos y ordenados'
);
select is((select count(*) from public.reminders), 3::bigint, 'uno por tipo');

-- reemplazar quita el «más tarde» y no duplica
select public.snooze_reminder('weight', 'UTC');
select is(
  (select snoozed_until from public.reminders where kind = 'weight'), (now() at time zone 'UTC')::date + 1,
  '«más tarde» oculta hasta mañana'
);
select is((select enabled from public.reminders where kind = 'weight'), true, 'y no cambia la configuración');
select public.set_reminder('weight', false, 'daily');
select is((select count(*) from public.reminders where kind = 'weight'), 1::bigint, 'configurar de nuevo reemplaza, no duplica');
select is((select snoozed_until from public.reminders where kind = 'weight'), null, 'cambiar la configuración quita el «más tarde»');
select is((select enabled from public.reminders where kind = 'weight'), false, 'se puede desactivar');
select is(
  (select every_n from public.reminders where kind = 'photos'), 14::smallint, 'lo demás queda como estaba'
);

-- validaciones -------------------------------------------------------------------------------------------------------
select throws_ilike($$ select public.set_reminder('agua', true, 'daily') $$, 'invalid_reminder:kind_invalid:kind%', 'tipo inválido');
select throws_ilike($$ select public.set_reminder('weight', true, 'hourly') $$, 'invalid_reminder:frequency_invalid:frequency%', 'frecuencia inválida');
select throws_ilike(
  $$ select public.set_reminder('supplements', true, 'every_n_days', 3) $$,
  'invalid_reminder:frequency_invalid:frequency%', 'los suplementos no admiten «cada tantos días»'
);
select throws_ilike($$ select public.set_reminder('weight', true, 'every_n_days', 1) $$, 'invalid_reminder:every_n_invalid:every_n%', 'cada 1 día no es «cada tantos días»');
select throws_ilike($$ select public.set_reminder('weight', true, 'every_n_days', 31) $$, 'invalid_reminder:every_n_invalid:every_n%', 'hasta cada 30 días');
select throws_ilike($$ select public.set_reminder('weight', true, 'every_n_days') $$, 'invalid_reminder:every_n_invalid:every_n%', 'falta el número de días');
select throws_ilike($$ select public.set_reminder('weight', true, 'weekdays', null, array[]::integer[]) $$, 'invalid_reminder:weekdays_invalid:weekdays%', 'faltan los días de la semana');
select throws_ilike($$ select public.set_reminder('weight', true, 'weekdays', null, array[0, 8]) $$, 'invalid_reminder:weekdays_invalid:weekdays%', 'días fuera de 1 a 7');
select throws_ilike($$ select public.snooze_reminder('agua') $$, 'not_found%', 'no se pospone lo que no existe');

-- permisos y aislamiento ---------------------------------------------------------------------------------------------
select throws_ilike(
  $$ insert into public.reminders (user_id, kind, frequency) values (auth.uid(), 'weight', 'daily') $$,
  '%permission denied%', 'el cliente no inserta directamente'
);
select throws_ilike($$ update public.reminders set enabled = true $$, '%permission denied%', 'ni actualiza directamente');
select tests.clear_authentication();

select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.reminders), 0::bigint, 'otra cuenta no ve los recordatorios de A');
select throws_ilike($$ select public.snooze_reminder('weight', 'UTC') $$, 'not_found%', 'ni los pospone');
select tests.clear_authentication();

-- sesión vencida
update public.profiles set last_active_at = now() - interval '40 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.reminders), 0::bigint, 'con la sesión vencida no lee nada');
select tests.clear_authentication();

select * from finish();
rollback;

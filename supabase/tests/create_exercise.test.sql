-- T028 (spec 005, FR-022 a FR-025, FR-029, FR-040): crear un ejercicio propio.
begin;
select plan(35);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin ejercicios (todo se deshace al final).
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.authenticate_as(:'uid_a');

-- crear con lo obligatorio y completo -------------------------------------------------------------------------
select lives_ok(
  $$ select public.create_exercise('{"name": "Plancha lateral", "measurement_type": "duration"}'::jsonb, '10000000-0000-0000-0000-000000000001') $$,
  'FR-022: se crea con solo nombre y tipo de medición'
);
select is(
  (select row(origin, user_id = auth.uid(), name_status, primary_muscles, secondary_muscles, equipment, description, description_status, aliases)::text
   from public.exercises where name = 'Plancha lateral'),
  '(own,t,original,{},{},,,,{})',
  'es propio, del dueño de la sesión, con textos originales y todo lo opcional vacío (sin dato)'
);
select lives_ok(
  $$ select public.create_exercise('{
        "name": "  Remo con banda  ", "measurement_type": "reps_weight",
        "primary_muscles": ["lats", "middle back", "lats"], "secondary_muscles": ["biceps"],
        "equipment": "bands", "description": "  1. Sujeta la banda.\n2. Tira.  ",
        "aliases": ["Remo elástico", "  Remo con goma ", "remo elastico", "Remo con banda", ""]
      }'::jsonb, '10000000-0000-0000-0000-000000000002') $$,
  'FR-022: se crea completo'
);
select is(
  (select name from public.exercises where client_request_id = '10000000-0000-0000-0000-000000000002'),
  'Remo con banda', 'el nombre se recorta'
);
select is(
  (select primary_muscles from public.exercises where client_request_id = '10000000-0000-0000-0000-000000000002'),
  array['lats', 'middle back'], 'los músculos repetidos se descartan'
);
select is(
  (select aliases from public.exercises where client_request_id = '10000000-0000-0000-0000-000000000002'),
  array['Remo elástico', 'Remo con goma'],
  'los alias se recortan y se descartan los vacíos, los repetidos (sin importar acentos) y el igual al nombre'
);
select is(
  (select description from public.exercises where client_request_id = '10000000-0000-0000-0000-000000000002'),
  E'1. Sujeta la banda.\n2. Tira.', 'la descripción se recorta y su estado es original'
);
select is(
  (select description_status from public.exercises where client_request_id = '10000000-0000-0000-0000-000000000002'),
  'original', 'el estado de la descripción propia es original'
);
select lives_ok(
  $$ select public.create_exercise('{"name": "Sin descripción", "measurement_type": "duration", "description": "   "}'::jsonb, gen_random_uuid()) $$,
  'una descripción en blanco se acepta...'
);
select is(
  (select description_status from public.exercises where name = 'Sin descripción'), null,
  '...y queda como «sin descripción», sin estado'
);

-- idempotencia (FR-029) ---------------------------------------------------------------------------------------------
select is(
  public.create_exercise('{"name": "Otro nombre", "measurement_type": "duration"}'::jsonb, '10000000-0000-0000-0000-000000000001'),
  (select id from public.exercises where name = 'Plancha lateral'),
  'FR-029: repetir la solicitud devuelve el ejercicio existente'
);
select is((select count(*) from public.exercises where user_id = auth.uid() and client_request_id = '10000000-0000-0000-0000-000000000001'), 1::bigint, 'y no crea otro');
select is((select count(*) from public.exercises where name = 'Otro nombre'), 0::bigint, 'ni cambia el existente');

-- validaciones (FR-025) ------------------------------------------------------------------------------------------
select throws_ilike($$ select public.create_exercise('{"measurement_type": "duration"}'::jsonb, gen_random_uuid()) $$, '%invalid_exercise:name_required:name%', 'sin nombre se rechaza');
select throws_ilike($$ select public.create_exercise('{"name": "   ", "measurement_type": "duration"}'::jsonb, gen_random_uuid()) $$, '%invalid_exercise:name_required:name%', 'un nombre en blanco se rechaza');
select throws_ilike(
  format($$ select public.create_exercise('{"name": "%s", "measurement_type": "duration"}'::jsonb, gen_random_uuid()) $$, repeat('a', 121)),
  '%invalid_exercise:name_too_long:name%', 'un nombre de más de 120 caracteres se rechaza'
);
select throws_ilike($$ select public.create_exercise('{"name": "X"}'::jsonb, gen_random_uuid()) $$, '%invalid_exercise:measurement_required:measurement_type%', 'sin tipo de medición se rechaza');
select throws_ilike($$ select public.create_exercise('{"name": "X", "measurement_type": "sets"}'::jsonb, gen_random_uuid()) $$, '%invalid_exercise:invalid_measurement:measurement_type%', 'un tipo inválido se rechaza');
select throws_ilike($$ select public.create_exercise('{"name": "X", "measurement_type": "duration", "primary_muscles": ["pecho"]}'::jsonb, gen_random_uuid()) $$, '%invalid_exercise:invalid_muscle:primary_muscles%', 'un músculo fuera de la lista se rechaza');
select throws_ilike(
  $$ select public.create_exercise('{"name": "X", "measurement_type": "duration", "primary_muscles": ["chest","lats","traps","neck","calves","biceps"]}'::jsonb, gen_random_uuid()) $$,
  '%invalid_exercise:too_many_muscles:primary_muscles%', 'más de 5 músculos principales se rechazan'
);
select throws_ilike(
  $$ select public.create_exercise('{"name": "X", "measurement_type": "duration", "secondary_muscles": ["chest","lats","traps","neck","calves","biceps","triceps","glutes","forearms","abdominals","quadriceps"]}'::jsonb, gen_random_uuid()) $$,
  '%invalid_exercise:too_many_muscles:secondary_muscles%', 'más de 10 músculos secundarios se rechazan'
);
select throws_ilike(
  $$ select public.create_exercise('{"name": "X", "measurement_type": "duration", "primary_muscles": ["chest"], "secondary_muscles": ["chest"]}'::jsonb, gen_random_uuid()) $$,
  '%invalid_exercise:muscle_repeated:secondary_muscles%', 'un músculo principal y secundario a la vez se rechaza'
);
select throws_ilike($$ select public.create_exercise('{"name": "X", "measurement_type": "duration", "equipment": "pesas"}'::jsonb, gen_random_uuid()) $$, '%invalid_exercise:invalid_equipment:equipment%', 'un equipamiento fuera de la lista se rechaza');
select throws_ilike(
  format($$ select public.create_exercise('{"name": "X", "measurement_type": "duration", "description": "%s"}'::jsonb, gen_random_uuid()) $$, repeat('a', 4001)),
  '%invalid_exercise:description_too_long:description%', 'una descripción de más de 4.000 caracteres se rechaza'
);
select throws_ilike(
  $$ select public.create_exercise('{"name": "X", "measurement_type": "duration", "aliases": ["a1","a2","a3","a4","a5","a6","a7","a8","a9","a10","a11"]}'::jsonb, gen_random_uuid()) $$,
  '%invalid_exercise:too_many_aliases:aliases%', 'más de 10 alias se rechazan'
);
select throws_ilike(
  format($$ select public.create_exercise('{"name": "X", "measurement_type": "duration", "aliases": ["%s"]}'::jsonb, gen_random_uuid()) $$, repeat('a', 81)),
  '%invalid_exercise:alias_too_long:aliases%', 'un alias de más de 80 caracteres se rechaza'
);
select throws_ilike($$ select public.create_exercise('{"name": "X", "measurement_type": "duration"}'::jsonb, null) $$, '%invalid_exercise:request_required:request_id%', 'sin identificador de solicitud se rechaza');
select is((select count(*) from public.exercises where name = 'X'), 0::bigint, 'ninguna solicitud inválida dejó filas');

-- aislamiento (FR-023) -----------------------------------------------------------------------------------------------
select tests.clear_authentication();
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.exercises), 0::bigint, 'la cuenta B no ve los ejercicios de A');
select lives_ok(
  $$ select public.create_exercise('{"name": "Plancha lateral", "measurement_type": "duration"}'::jsonb, '10000000-0000-0000-0000-000000000001') $$,
  'B puede usar el mismo identificador de solicitud y el mismo nombre'
);
select is((select count(*) from public.exercises where user_id = auth.uid()), 1::bigint, 'y crea el suyo, independiente');
select tests.clear_authentication();

-- sesión vencida, sin sesión y permisos ------------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select throws_ilike($$ select public.create_exercise('{"name": "Z", "measurement_type": "duration"}'::jsonb, gen_random_uuid()) $$, '%session_expired%', 'con la sesión vencida no se guarda');
select tests.clear_authentication();
select throws_ilike($$ select public.create_exercise('{"name": "Z", "measurement_type": "duration"}'::jsonb, gen_random_uuid()) $$, '%session_expired%', 'sin sesión no se guarda');
select ok(not has_function_privilege('anon', 'public.create_exercise(jsonb, uuid)', 'execute'), 'anon no puede ejecutarla');
select ok(has_function_privilege('authenticated', 'public.create_exercise(jsonb, uuid)', 'execute'), 'authenticated sí');

select * from finish();
rollback;

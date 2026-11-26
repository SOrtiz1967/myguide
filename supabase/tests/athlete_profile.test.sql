-- Spec 025 (perfil de atleta): esquema, RLS, rangos, idempotencia, vigencia y exportación.
begin;
select plan(38);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.create_exercise(:'uid_a', 'Press atleta', 'reps_weight') as ex_a \gset
select tests.create_exercise(:'uid_a', 'Remo atleta', 'reps_weight') as ex_a2 \gset
select tests.create_exercise(:'uid_b', 'Ejercicio de B', 'reps_weight') as ex_b \gset
select tests.create_food(:'uid_a', 'Alimento de A', null, 100, '100g') as food_a \gset

-- esquema y permisos ----------------------------------------------------------------------------------------------------
select has_table('public', 'athlete_goals', 'existe athlete_goals');
select has_table('public', 'athlete_availability', 'existe athlete_availability');
select has_table('public', 'athlete_preferences', 'existe athlete_preferences');
select has_table('public', 'athlete_item_preferences', 'existe athlete_item_preferences');
select ok(
  not has_table_privilege('authenticated', 'public.athlete_goals', 'insert')
  and not has_table_privilege('authenticated', 'public.athlete_availability', 'update')
  and not has_table_privilege('authenticated', 'public.athlete_preferences', 'delete')
  and not has_table_privilege('authenticated', 'public.athlete_item_preferences', 'insert'),
  'el cliente no escribe directamente en ninguna tabla'
);
select ok(
  not has_function_privilege('authenticated', 'private.save_athlete_goals_at(uuid, jsonb, date, boolean, uuid, timestamptz, text)', 'execute'),
  'la versión con la hora como parámetro no es ejecutable por el cliente'
);
select ok(
  not has_function_privilege('anon', 'public.save_athlete_goals(jsonb, date, boolean, uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.save_athlete_goals(jsonb, date, boolean, uuid, text)', 'execute'),
  'anon no puede ejecutar las funciones públicas y authenticated sí'
);

-- objetivos: validación -------------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ select * from private.save_athlete_goals_at(%L, '[]'::jsonb, null, false, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_athlete:count:goals%', 'una lista vacía de objetivos se rechaza'
);
select throws_ilike(
  format($$ select * from private.save_athlete_goals_at(%L, '[{"kind":"hypertrophy","priority":1},{"kind":"strength","priority":1}]'::jsonb, null, false, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_athlete:priority_repeated:goals%', 'dos objetivos con la misma prioridad se rechazan'
);
select throws_ilike(
  format($$ select * from private.save_athlete_goals_at(%L, '[{"kind":"custom","priority":1}]'::jsonb, null, false, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_athlete:label:goals%', 'un objetivo personalizado sin texto se rechaza'
);
select throws_ilike(
  format($$ select * from private.save_athlete_goals_at(%L, '[{"kind":"custom","priority":1,"label":"%s"}]'::jsonb, null, false, gen_random_uuid(), now(), 'UTC') $$, :'uid_a', repeat('x', 61)),
  '%invalid_athlete:label:goals%', 'y con más de 60 caracteres también'
);
select throws_ilike(
  format($$ select * from private.save_athlete_goals_at(%L, '[{"kind":"volar","priority":1}]'::jsonb, null, false, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_athlete:kind:goals%', 'un tipo de objetivo desconocido se rechaza'
);
select throws_ilike(
  format($$ select * from private.save_athlete_goals_at(%L, '[{"kind":"strength","priority":1}]'::jsonb, null, false, null, now(), 'UTC') $$, :'uid_a'),
  '%invalid_athlete:request_required:request_id%', 'sin identificador de solicitud se rechaza'
);

-- objetivos: vigencia, idempotencia y mapeo al perfil ----------------------------------------------------------------
select is(
  (select effective_from from private.save_athlete_goals_at(:'uid_a', '[{"kind":"hypertrophy","priority":1},{"kind":"custom","priority":2,"label":"Correr 10 km"}]'::jsonb, null, true, '10000000-0000-0000-0000-000000000001', '2026-11-26 12:00+00', 'America/Argentina/Buenos_Aires')),
  '2026-11-26'::date, 'los objetivos rigen desde el "hoy" de la persona'
);
select is(
  (select goal_type from public.profiles where user_id = :'uid_a'),
  'muscle_gain', 'con la confirmación, hipertrofia pasa a ser el objetivo del perfil (spec 014)'
);
select is(
  (select goals from private.save_athlete_goals_at(:'uid_a', '[{"kind":"strength","priority":1}]'::jsonb, null, false, '10000000-0000-0000-0000-000000000001', '2026-11-28 12:00+00', 'UTC')) -> 0 ->> 'kind',
  'hypertrophy', 'repetir la solicitud devuelve la fila original'
);
select is((select count(*) from public.athlete_goals where user_id = :'uid_a'), 1::bigint, 'y sigue habiendo una sola fila');
select throws_ilike(
  format($$ select * from private.save_athlete_goals_at(%L, '[{"kind":"strength","priority":1}]'::jsonb, '2026-11-20', false, gen_random_uuid(), '2026-11-26 12:00+00', 'UTC') $$, :'uid_a'),
  '%invalid_athlete:before_last:effective_from%', 'la vigencia no puede ser anterior a la última guardada'
);
select lives_ok(
  format($$ select * from private.save_athlete_goals_at(%L, '[{"kind":"strength","priority":1}]'::jsonb, null, true, gen_random_uuid(), '2026-12-01 12:00+00', 'UTC') $$, :'uid_a'),
  'un cambio posterior agrega otra fila'
);
select is((select count(*) from public.athlete_goals where user_id = :'uid_a'), 2::bigint, 'el historial conserva el valor anterior');
select is(
  (select goal_type from public.profiles where user_id = :'uid_a'),
  'muscle_gain', 'un objetivo sin equivalente en la spec 014 no cambia el objetivo del perfil'
);

-- disponibilidad ------------------------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ select * from private.save_athlete_availability_at(%L, 8::smallint, null, null, null, null, null, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_athlete:out_of_range:days_per_week%', 'más días de los que tiene la semana se rechaza'
);
select throws_ilike(
  format($$ select * from private.save_athlete_availability_at(%L, 3::smallint, 10::smallint, null, null, null, null, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_athlete:out_of_range:session_minutes%', 'la duración fuera de 15 a 240 minutos se rechaza'
);
select throws_ilike(
  format($$ select * from private.save_athlete_availability_at(%L, 3::smallint, 60::smallint, null, null, array['lanzacohetes'], null, gen_random_uuid(), now(), 'UTC') $$, :'uid_a'),
  '%invalid_athlete:invalid_value:equipment%', 'el equipamiento fuera de la lista cerrada se rechaza'
);
select is(
  (select days_per_week from private.save_athlete_availability_at(:'uid_a', 3::smallint, 60::smallint, 'evening', 'gym', array['barbell','rack'], null, '30000000-0000-0000-0000-000000000001', '2026-11-26 12:00+00', 'UTC')),
  3::smallint, 'se guarda la disponibilidad'
);
select is(
  (select days_per_week from private.save_athlete_availability_at(:'uid_a', 5::smallint, null, null, null, null, null, '30000000-0000-0000-0000-000000000001', '2026-11-27 12:00+00', 'UTC')),
  3::smallint, 'repetir la solicitud devuelve la fila original'
);

-- preferencias ----------------------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select lives_ok(
  format($$ select public.save_athlete_preferences(jsonb_build_object('priority_muscles', array['chest','lats'], 'meals_per_day', 4, 'effort_scale', 'rpe', 'items', jsonb_build_array(jsonb_build_object('kind','exercise_favorite','exercise_id',%L), jsonb_build_object('kind','food_avoided','food_id',%L))), '40000000-0000-0000-0000-000000000001') $$, :'ex_a', :'food_a'),
  'se guardan las preferencias con ejercicios y alimentos del catálogo propio'
);
select is((select effort_scale from public.athlete_preferences where user_id = :'uid_a'), 'rpe', 'la escala de esfuerzo preferida se conserva');
select is((select usual_sleep_minutes from public.athlete_preferences where user_id = :'uid_a'), null::integer, 'un dato no indicado queda sin valor, no en cero');
select is((select count(*) from public.athlete_item_preferences where user_id = :'uid_a'), 2::bigint, 'se guardan las dos preferencias por ítem');
select throws_ilike(
  format($$ select public.save_athlete_preferences(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('kind','exercise_favorite','exercise_id',%L), jsonb_build_object('kind','exercise_avoided','exercise_id',%L))), gen_random_uuid()) $$, :'ex_a', :'ex_a'),
  '%invalid_athlete:conflict:items%', 'un ejercicio no puede ser favorito y evitado a la vez'
);
select throws_ilike(
  format($$ select public.save_athlete_preferences(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('kind','exercise_favorite','exercise_id',%L))), gen_random_uuid()) $$, :'ex_b'),
  '%invalid_athlete:item:items%', 'no se puede elegir el ejercicio propio de otra cuenta'
);
select throws_ilike(
  $$ select public.save_athlete_preferences(jsonb_build_object('priority_muscles', array['chest','lats','biceps','triceps','quadriceps','calves']), gen_random_uuid()) $$,
  '%invalid_athlete:too_many:priority_muscles%', 'más de 5 músculos prioritarios se rechaza'
);
select throws_ilike(
  $$ select public.save_athlete_preferences(jsonb_build_object('perceived_recovery', 6), gen_random_uuid()) $$,
  '%invalid_athlete:out_of_range:perceived_recovery%', 'la recuperación percibida fuera de 1 a 5 se rechaza'
);
select is(
  (select (public.save_athlete_preferences(jsonb_build_object('effort_scale', 'rir'), '40000000-0000-0000-0000-000000000001')) ->> 'repeated'),
  'true', 'repetir la solicitud no vuelve a escribir'
);
select tests.clear_authentication();

-- aislamiento y exportación ---------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.athlete_goals), 0::bigint, 'B no ve los objetivos de A');
select is((select count(*) from public.athlete_item_preferences), 0::bigint, 'ni sus preferencias');
select tests.clear_authentication();

select tests.authenticate_as(:'uid_a');
select ok(
  (public.export_my_data() -> 'tables') ?& array['athlete_goals', 'athlete_availability', 'athlete_preferences', 'athlete_item_preferences'],
  'SC-004: la exportación incluye las cuatro tablas'
);
select tests.clear_authentication();

select * from finish();
rollback;

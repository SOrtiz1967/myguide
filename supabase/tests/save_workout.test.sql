-- T017 (spec 006, FR-010, FR-012 a FR-014, FR-028 a FR-035, FR-038, FR-045, FR-047): guardar el contenido de una sesión.
begin;
select plan(69);

-- La base local puede tener datos: la prueba parte de una base sin rutinas ni sesiones (todo se deshace al final).
delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_exercise(:'uid_a', 'Press e2e', 'reps_weight') as rw \gset
select tests.create_exercise(:'uid_a', 'Flexiones e2e', 'reps_bodyweight') as bw \gset
select tests.create_exercise(:'uid_a', 'Plancha e2e', 'duration') as d \gset
select tests.create_exercise(:'uid_a', 'Correr e2e', 'distance_duration') as dd \gset
select tests.create_exercise(:'uid_b', 'Ejercicio de B e2e', 'reps_weight') as bx \gset
select tests.create_catalog_exercise('free-exercise-db', 'SV-1', 'Remo del catálogo e2e', 'reps_weight') as cat \gset

-- La sesión en curso de A.
select (private.start_workout_at(:'uid_a', null, '10000000-0000-0000-0000-000000000001', now(), 'UTC')) ->> 'id' as sess \gset

-- Variables para usar dentro de $$...$$ (psql no las interpola ahí) -----------------------------------------------------------
create temp table vars (k text primary key, v text);
grant all on vars to public;
insert into vars values
  ('uid_a', :'uid_a'), ('uid_b', :'uid_b'), ('rw', :'rw'), ('bw', :'bw'), ('d', :'d'), ('dd', :'dd'),
  ('bx', :'bx'), ('cat', :'cat'), ('sess', :'sess'),
  ('ex1', '11111111-1111-4111-8111-111111111111'), ('ex2', '22222222-2222-4222-8222-222222222222'),
  ('ex3', '33333333-3333-4333-8333-333333333333'), ('ex4', '44444444-4444-4444-8444-444444444444'),
  ('ex5', '55555555-5555-4555-8555-555555555555'), ('ex6', '66666666-6666-4666-8666-666666666666');

create function pg_temp.fill(p text) returns text language plpgsql as $$
declare r record; s text := p;
begin
  for r in select k, v from pg_temp.vars loop s := replace(s, '{' || r.k || '}', r.v); end loop;
  return s;
end $$;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select v::uuid from pg_temp.vars where k = p_key $$;
create function pg_temp.rev(p_key text default 'sess') returns integer language sql as $$
  select revision from public.workout_sessions where id = pg_temp.v(p_key) $$;
-- Guarda con la revisión actual (o la que se indique).
create function pg_temp.save(p text, p_finish boolean default false, p_key text default 'sess') returns jsonb language plpgsql as $$
begin return public.save_workout(pg_temp.v(p_key), pg_temp.fill(p)::jsonb, pg_temp.rev(p_key), p_finish); end $$;
create function pg_temp.save_rev(p text, p_rev integer, p_finish boolean default false) returns jsonb language plpgsql as $$
begin return public.save_workout(pg_temp.v('sess'), pg_temp.fill(p)::jsonb, p_rev, p_finish); end $$;

select tests.authenticate_as(:'uid_a');

-- guardar ejercicios y series ------------------------------------------------------------------------------------------------
select is(
  (pg_temp.save($j$ {
    "note": "  Buena sesión  ",
    "exercises": [
      {"id": "{ex1}", "exercise_id": "{rw}", "effort": 7, "note": " pesado ",
       "sets": [{"reps": 8, "weight_kg": 60}, {"reps": 6, "weight_kg": 62.5}, {}, {"reps": null}]},
      {"id": "{ex2}", "exercise_id": "{d}", "sets": [{"duration_s": 90}]}
    ]} $j$)) ->> 'revision',
  '2', 'FR-045: guardar devuelve la revisión nueva'
);
select is(
  (select row(note, revision, status, modified)::text from public.workout_sessions where id = pg_temp.v('sess')),
  '("Buena sesión",2,in_progress,f)', 'FR-013: la nota se recorta y la sesión sigue en curso, sin marca de «modificada»'
);
select is(
  (select string_agg(position || ':' || exercise_name || ':' || measurement_type || ':' || coalesce(effort::text, '-'), ',' order by position)
   from public.session_exercises where session_id = pg_temp.v('sess')),
  '1:Press e2e:reps_weight:7,2:Plancha e2e:duration:-',
  'FR-034: cada ejercicio nuevo toma el nombre y el tipo de medición del ejercicio, en el orden del payload'
);
select is(
  (select string_agg(position || ':' || coalesce(reps::text, '-') || '/' || coalesce(weight_kg::text, '-'), ',' order by position)
   from public.session_sets where session_exercise_id = pg_temp.v('ex1')),
  '1:8/60.00,2:6/62.50', 'FR-030: las series vacías se descartan y se guardan los valores presentes'
);
select is(
  (select note from public.session_exercises where id = pg_temp.v('ex1')), 'pesado', 'FR-032: la nota del ejercicio se recorta'
);

-- ejercicios del catálogo, ajenos e inexistentes ---------------------------------------------------------------------------------
select is(
  (pg_temp.save($j$ {"exercises": [
      {"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 8, "weight_kg": 60}]},
      {"id": "{ex2}", "exercise_id": "{d}", "sets": [{"duration_s": 90}]},
      {"id": "{ex3}", "exercise_id": "{cat}", "sets": [{"reps": 10, "weight_kg": 40}]}]} $j$)) ->> 'revision',
  '3', 'un ejercicio del catálogo se puede agregar'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex4}", "exercise_id": "{bx}", "sets": []}]}') $j$,
  '%invalid_session:exercise_not_found%', 'un ejercicio propio de otra cuenta se comporta como inexistente'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex4}", "exercise_id": "99999999-9999-4999-8999-999999999999", "sets": []}]}') $j$,
  '%invalid_session:exercise_not_found%', 'un ejercicio inexistente se rechaza'
);
select is(pg_temp.rev(), 3, 'las solicitudes rechazadas no cambian la revisión');

-- forma de las series según el tipo de medición ---------------------------------------------------------------------------------
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex2}", "exercise_id": "{d}", "sets": [{"reps": 10, "duration_s": 60}]}]}') $j$,
  '%invalid_session:invalid_set%', 'FR-028: repeticiones en un ejercicio de tiempo → se rechazan'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 8, "duration_s": 60}]}]}') $j$,
  '%invalid_session:invalid_set%', 'FR-028: una duración en un ejercicio con peso → se rechaza'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex4}", "exercise_id": "{bw}", "sets": [{"reps": 8, "weight_kg": 10}]}]}') $j$,
  '%invalid_session:invalid_set%', 'un ejercicio nuevo de repeticiones sin peso no admite peso'
);

-- rangos (FR-031) ------------------------------------------------------------------------------------------------------------------
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 0}]}]}') $j$, '%invalid_session:invalid_set%', 'FR-031: 0 repeticiones');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 1000}]}]}') $j$, '%invalid_session:invalid_set%', 'FR-031: 1.000 repeticiones');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 5, "weight_kg": -1}]}]}') $j$, '%invalid_session:invalid_set%', 'FR-031: peso negativo');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 5, "weight_kg": 1000}]}]}') $j$, '%invalid_session:invalid_set%', 'FR-031: 1.000 kg');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex2}", "exercise_id": "{d}", "sets": [{"duration_s": 0}]}]}') $j$, '%invalid_session:invalid_set%', 'FR-031: duración 0');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex2}", "exercise_id": "{d}", "sets": [{"duration_s": 86401}]}]}') $j$, '%invalid_session:invalid_set%', 'FR-031: más de 24 horas');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{dd}", "sets": [{"distance_km": 0, "duration_s": 600}]}]}') $j$, '%invalid_session:invalid_set%', 'FR-031: distancia 0');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{dd}", "sets": [{"distance_km": 1000}]}]}') $j$, '%invalid_session:invalid_set%', 'FR-031: 1.000 km');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": "ocho"}]}]}') $j$, '%invalid_session:invalid_set%', 'un valor que no es número');
select lives_ok($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 5, "weight_kg": 0}]}]}') $j$, 'FR-030: un peso de 0 es válido');

-- esfuerzo, notas y topes ---------------------------------------------------------------------------------------------------------
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "effort": 0, "sets": []}]}') $j$, '%invalid_session:invalid_effort%', 'FR-014: esfuerzo 0');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "effort": 11, "sets": []}]}') $j$, '%invalid_session:invalid_effort%', 'FR-014: esfuerzo 11');
select throws_ilike($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "effort": "alto", "sets": []}]}') $j$, '%invalid_session:invalid_effort%', 'FR-014: esfuerzo que no es número');
select lives_ok($j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "effort": 10, "sets": []}]}') $j$, 'FR-014: esfuerzo 10 es válido y un ejercicio con cero series también');
select throws_ilike(format($$ select pg_temp.save(%L) $$, '{"note": "' || repeat('a', 1001) || '", "exercises": []}'), '%invalid_session:note_too_long%', 'FR-013: nota de sesión de 1.001 caracteres');
select throws_ilike(format($$ select pg_temp.save(%L) $$, '{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "note": "' || repeat('a', 501) || '", "sets": []}]}'), '%invalid_session:note_too_long%', 'FR-032: nota de ejercicio de 501 caracteres');
select throws_ilike(
  $j$ select public.save_workout(pg_temp.v('sess'),
        jsonb_build_object('exercises', (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'exercise_id', pg_temp.v('rw'), 'sets', '[]'::jsonb)) from generate_series(1, 31))),
        pg_temp.rev(), false) $j$,
  '%invalid_session:too_many_exercises%', 'FR-033: más de 30 ejercicios'
);
select throws_ilike(
  $j$ select public.save_workout(pg_temp.v('sess'),
        jsonb_build_object('exercises', jsonb_build_array(jsonb_build_object('id', pg_temp.v('ex1'), 'exercise_id', pg_temp.v('rw'),
          'sets', (select jsonb_agg(jsonb_build_object('reps', 5)) from generate_series(1, 21))))),
        pg_temp.rev(), false) $j$,
  '%invalid_session:too_many_sets%', 'FR-028: más de 20 series'
);
select lives_ok(
  $j$ select public.save_workout(pg_temp.v('sess'),
        jsonb_build_object('exercises', (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'exercise_id', pg_temp.v('rw'),
          'sets', (select jsonb_agg(jsonb_build_object('reps', 5)) from generate_series(1, 20)))) from generate_series(1, 30))),
        pg_temp.rev(), false) $j$,
  '30 ejercicios con 20 series cada uno se guardan'
);
select is((select count(*) from public.session_sets where session_id = pg_temp.v('sess')), 600::bigint, 'y quedan sus 600 series');

-- reemplazo completo, orden y errores sin datos a medias ------------------------------------------------------------------------------
select pg_temp.save($j$ {"exercises": [
    {"id": "{ex2}", "exercise_id": "{d}", "sets": [{"duration_s": 120}]},
    {"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 8, "weight_kg": 60}]}]} $j$);
select is(
  (select string_agg(position || ':' || exercise_name, ',' order by position) from public.session_exercises where session_id = pg_temp.v('sess')),
  '1:Plancha e2e,2:Press e2e', 'FR-033: el orden del payload es el orden guardado y lo que no está se elimina'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 9}]}, {"id": "{ex2}", "exercise_id": "{d}", "sets": [{"reps": 9}]}]}') $j$,
  '%invalid_session:invalid_set%', 'un error en el segundo ejercicio...'
);
select is(
  (select string_agg(exercise_name || '=' || (select count(*)::text from public.session_sets s where s.session_exercise_id = e.id), ',' order by position)
   from public.session_exercises e where session_id = pg_temp.v('sess')),
  'Plancha e2e=1,Press e2e=1', '...no deja datos a medias: todo sigue como antes'
);

-- la instantánea se conserva (FR-034 a FR-036) -----------------------------------------------------------------------------------------
reset role;
update public.exercises set name = 'Press renombrado e2e' where id = :'rw';
delete from public.exercises where id = :'d';
select tests.authenticate_as(:'uid_a');
select pg_temp.save($j$ {"exercises": [
    {"id": "{ex2}", "exercise_id": "{d}", "sets": [{"duration_s": 120}]},
    {"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 8, "weight_kg": 60}]},
    {"id": "{ex4}", "exercise_id": "{rw}", "sets": [{"reps": 5}]}]} $j$);
select is(
  (select string_agg(exercise_name, ',' order by position) from public.session_exercises where session_id = pg_temp.v('sess')),
  'Plancha e2e,Press e2e,Press renombrado e2e',
  'FR-035: un ejercicio que ya estaba conserva su nombre aunque se haya renombrado; uno nuevo toma el nombre vigente'
);
select is(
  (select exercise_id::text from public.session_exercises where id = pg_temp.v('ex2')), null,
  'FR-036: al eliminar el ejercicio, la sesión sigue guardándose con exercise_id nulo'
);

-- revisión y reintentos (FR-045, FR-047) ----------------------------------------------------------------------------------------------------
select throws_ilike(
  $j$ select pg_temp.save_rev('{"exercises": []}', 1) $j$, '%stale_revision%', 'una revisión vieja se rechaza (otro dispositivo guardó antes)'
);
select is((select count(*) from public.session_exercises where session_id = pg_temp.v('sess')), 3::bigint, 'y no cambia nada');
select pg_temp.rev() as rev_before \gset
select is(
  (pg_temp.save($j$ {"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 12}]}]} $j$)) ->> 'revision',
  (:'rev_before'::int + 1)::text, 'un guardado nuevo sube la revisión'
);
select is(
  (pg_temp.save_rev($j$ {"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 12}]}]} $j$, :'rev_before'::int)) ->> 'revision',
  (:'rev_before'::int + 1)::text, 'FR-047: repetir el mismo guardado con la revisión anterior (se perdió la respuesta) devuelve el estado actual'
);
select is(pg_temp.rev(), :'rev_before'::int + 1, 'y no sube la revisión ni duplica nada');
select throws_ilike(
  $j$ select pg_temp.save_rev('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 13}]}]}', pg_temp.rev() - 1) $j$,
  '%stale_revision%', 'pero otro contenido con una revisión vieja sí se rechaza'
);

-- identificadores de ejercicio (FR-047) --------------------------------------------------------------------------------------------------
reset role;
select tests.create_session(:'uid_a', date '2026-10-10', 'completed') as other_a \gset
select tests.add_session_exercise(:'other_a', :'rw') as other_a_ex \gset
select tests.create_session(:'uid_b', date '2026-10-10', 'completed') as other_b \gset
select tests.add_session_exercise(:'other_b', :'bx') as other_b_ex \gset
insert into vars values ('other_a_ex', :'other_a_ex'), ('other_b_ex', :'other_b_ex'), ('other_b', :'other_b');
select tests.authenticate_as(:'uid_a');
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{other_a_ex}", "exercise_id": "{rw}", "sets": []}]}') $j$,
  '%invalid_session:duplicate_id%', 'un id que ya existe en otra sesión propia → duplicate_id'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{other_b_ex}", "exercise_id": "{rw}", "sets": []}]}') $j$,
  '%invalid_session:duplicate_id%', 'un id que existe en otra cuenta → duplicate_id, sin revelar nada'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": []}, {"id": "{ex1}", "exercise_id": "{rw}", "sets": []}]}') $j$,
  '%invalid_session:duplicate_id%', 'el mismo id dos veces en el payload → duplicate_id'
);

-- cargas mal formadas y sesiones ajenas -----------------------------------------------------------------------------------------------------
select throws_ilike($j$ select public.save_workout(pg_temp.v('sess'), '[]'::jsonb, pg_temp.rev(), false) $j$, '%invalid_session:invalid_payload%', 'un payload que no es un objeto se rechaza');
select throws_ilike($j$ select public.save_workout(pg_temp.v('sess'), '{"exercises": 5}'::jsonb, pg_temp.rev(), false) $j$, '%invalid_session:invalid_payload%', 'ejercicios que no son una lista se rechazan');
select throws_ilike($j$ select public.save_workout(pg_temp.v('other_b'), '{}'::jsonb, 1, false) $j$, '%not_found%', 'una sesión ajena se comporta como inexistente');
select throws_ilike($j$ select public.save_workout(gen_random_uuid(), '{}'::jsonb, 1, false) $j$, '%not_found%', 'una sesión inexistente → not_found');

-- terminar y corregir ---------------------------------------------------------------------------------------------------------------------------
select pg_temp.rev() as rev_finish \gset
select is(
  (pg_temp.save($j$ {"note": "Fin", "exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 12}]}]} $j$, true)) ->> 'status',
  'completed', 'FR-012: terminar pasa la sesión a «realizada»'
);
select is(
  (select row(status, finished_at is not null, modified, corrected_at is null, revision = :'rev_finish'::int + 1)::text
   from public.workout_sessions where id = pg_temp.v('sess')),
  '(completed,t,f,t,t)', 'con su hora de fin, sin «modificada» (no tiene plan) y sin marca de corrección'
);
select is(
  (select session_date::text from public.workout_sessions where id = pg_temp.v('sess')), (current_date)::text,
  'la fecha de la sesión no cambió al terminarla'
);
select is(
  (pg_temp.save($j$ {"note": "Corregida", "exercises": [{"id": "{ex1}", "exercise_id": "{rw}", "sets": [{"reps": 14}]}]} $j$, true)) ->> 'status',
  'completed', 'FR-038: guardar una sesión realizada es una corrección y sigue realizada'
);
select is(
  (select row(corrected_at is not null, note)::text from public.workout_sessions where id = pg_temp.v('sess')),
  '(t,Corregida)', 'la corrección deja su marca y su fecha'
);
select is(
  (select exercise_name from public.session_exercises where id = pg_temp.v('ex1')), 'Press e2e',
  'y conserva la instantánea del ejercicio'
);

-- planificadas y canceladas no se guardan; con plan -----------------------------------------------------------------------------------------
reset role;
select tests.create_session(:'uid_a', date '2026-12-01', 'planned') as planned_s \gset
select tests.create_session(:'uid_a', date '2026-12-02', 'cancelled') as cancelled_s \gset
insert into vars values ('planned_s', :'planned_s'), ('cancelled_s', :'cancelled_s');
select tests.authenticate_as(:'uid_a');
select throws_ilike($j$ select public.save_workout(pg_temp.v('planned_s'), '{}'::jsonb, 1, false) $j$, '%invalid_transition%', 'una sesión planificada no se guarda sin iniciarla');
select throws_ilike($j$ select public.save_workout(pg_temp.v('cancelled_s'), '{}'::jsonb, 1, false) $j$, '%invalid_transition%', 'una sesión cancelada tampoco');

reset role;
select tests.create_routine(:'uid_a', 'Rutina e2e', array[:'rw'::uuid, :'bw'::uuid]) as r \gset
select tests.create_session(:'uid_a', date '2026-10-20', 'in_progress', :'r', true) as plan_s \gset
select tests.create_session(:'uid_a', date '2026-12-03', 'planned', :'r', true) as plan_other \gset
select id as p1 from public.session_plan_items where session_id = :'plan_s' and position = 1 \gset
select id as p2 from public.session_plan_items where session_id = :'plan_s' and position = 2 \gset
select id as po from public.session_plan_items where session_id = :'plan_other' and position = 1 \gset
insert into vars values ('plan_s', :'plan_s'), ('p1', :'p1'), ('p2', :'p2'), ('po', :'po');
select tests.authenticate_as(:'uid_a');

select is(
  (pg_temp.save($j$ {"exercises": [
      {"id": "{ex5}", "exercise_id": "{rw}", "plan_item_id": "{p1}", "sets": [{"reps": 8, "weight_kg": 60}]},
      {"id": "{ex6}", "exercise_id": "{dd}", "plan_item_id": "{p2}", "is_substitute": true, "sets": [{"distance_km": 5, "duration_s": 1800}]}]} $j$, false, 'plan_s')) ->> 'revision',
  '2', 'un ejercicio realizado se vincula a un ítem del plan de su sesión, y un sustituto también'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex5}", "exercise_id": "{rw}", "plan_item_id": "{po}", "sets": []}]}', false, 'plan_s') $j$,
  '%invalid_session:invalid_plan_item%', 'un ítem del plan de otra sesión → invalid_plan_item'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex5}", "exercise_id": "{rw}", "is_substitute": true, "sets": []}]}', false, 'plan_s') $j$,
  '%invalid_session:invalid_plan_item%', 'un sustituto sin ítem del plan → invalid_plan_item'
);
select throws_ilike(
  $j$ select pg_temp.save('{"exercises": [{"id": "{ex5}", "exercise_id": "{rw}", "plan_item_id": "{p1}", "sets": []}, {"id": "{ex6}", "exercise_id": "{bw}", "plan_item_id": "{p1}", "sets": []}]}', false, 'plan_s') $j$,
  '%invalid_session:invalid_plan_item%', 'dos ejercicios realizados para el mismo ítem del plan → invalid_plan_item'
);
select is(
  (select count(*) from public.session_plan_items where session_id = pg_temp.v('plan_s')), 2::bigint,
  'guardar lo realizado no toca el plan (FR-016)'
);

-- una sesión que cruza la medianoche conserva el día en que empezó (FR-010) ----------------------------------------------------------------
reset role;
select (private.start_workout_at(:'uid_b', null, '20000000-0000-0000-0000-000000000001', timestamptz '2026-10-22 02:30:00+00', 'America/Argentina/Buenos_Aires')) ->> 'id' as b_sess \gset
insert into vars values ('b_sess', :'b_sess');
select tests.authenticate_as(:'uid_b');
select is(
  (public.save_workout(pg_temp.v('b_sess'), '{"exercises": []}'::jsonb, 1, true)) ->> 'status', 'completed',
  'B termina su sesión, iniciada antes de la medianoche, mucho después'
);
select is(
  (select session_date::text from public.workout_sessions where id = pg_temp.v('b_sess')), '2026-10-21',
  'FR-010: la sesión conserva el día en que empezó'
);
select tests.clear_authentication();

-- sesión vencida, sin sesión y permisos -------------------------------------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select throws_ilike($j$ select public.save_workout(pg_temp.v('sess'), '{}'::jsonb, 1, false) $j$, '%session_expired%', 'con la sesión vencida no se guarda');
select tests.clear_authentication();
select throws_ilike($j$ select public.save_workout(pg_temp.v('sess'), '{}'::jsonb, 1, false) $j$, '%session_expired%', 'sin sesión no se guarda');
select ok(not has_function_privilege('anon', 'public.save_workout(uuid, jsonb, integer, boolean)', 'execute'), 'anon no puede ejecutarla');
select ok(has_function_privilege('authenticated', 'public.save_workout(uuid, jsonb, integer, boolean)', 'execute'), 'authenticated sí');

select * from finish();
rollback;

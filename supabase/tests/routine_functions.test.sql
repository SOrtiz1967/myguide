-- T032 (spec 006, FR-001 a FR-006, FR-047): crear, editar, duplicar y eliminar rutinas.
begin;
select plan(60);

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
select tests.create_catalog_exercise('free-exercise-db', 'RT-1', 'Remo del catálogo e2e', 'reps_weight') as cat \gset

create temp table vars (k text primary key, v text);
grant all on vars to public;
insert into vars values ('uid_a', :'uid_a'), ('uid_b', :'uid_b'), ('rw', :'rw'), ('bw', :'bw'), ('d', :'d'), ('dd', :'dd'), ('bx', :'bx'), ('cat', :'cat');

create function pg_temp.fill(p text) returns text language plpgsql as $$
declare r record; s text := p;
begin
  for r in select k, v from pg_temp.vars loop s := replace(s, '{' || r.k || '}', r.v); end loop;
  return s;
end $$;
create function pg_temp.v(p_key text) returns uuid language sql as $$ select v::uuid from pg_temp.vars where k = p_key $$;
-- Crea con un identificador de solicitud nuevo.
create function pg_temp.mk(p text) returns uuid language plpgsql as $$
begin return public.create_routine(pg_temp.fill(p)::jsonb, gen_random_uuid()); end $$;
create function pg_temp.upd(p_key text, p text) returns uuid language plpgsql as $$
begin return public.update_routine(pg_temp.v(p_key), pg_temp.fill(p)::jsonb); end $$;

select tests.authenticate_as(:'uid_a');

-- crear -----------------------------------------------------------------------------------------------------------------------
select lives_ok(
  $j$ select pg_temp.mk('{"name": "  Torso A  ", "exercises": [
        {"exercise_id": "{rw}", "sets": 4, "target_reps": 8, "target_weight_kg": 60.5},
        {"exercise_id": "{bw}", "sets": 3, "target_reps": 12},
        {"exercise_id": "{d}", "sets": 2, "target_duration_s": 90},
        {"exercise_id": "{dd}", "sets": 1, "target_distance_km": 5.25, "target_duration_s": 1800},
        {"exercise_id": "{cat}", "sets": 3}]}') $j$,
  'FR-001: una rutina con un ejercicio de cada tipo y uno del catálogo'
);
select id as r1 from public.routines where name = 'Torso A' \gset
insert into vars values ('r1', :'r1');
select is((select name from public.routines where id = :'r1'), 'Torso A', 'el nombre se recorta');
select is(
  (select string_agg(position || ':' || exercise_name || ':' || measurement_type || ':' || sets, ',' order by position)
   from public.routine_exercises where routine_id = :'r1'),
  '1:Press e2e:reps_weight:4,2:Flexiones e2e:reps_bodyweight:3,3:Plancha e2e:duration:2,4:Correr e2e:distance_duration:1,5:Remo del catálogo e2e:reps_weight:3',
  'FR-004: cada ítem guarda la instantánea del ejercicio, en el orden elegido'
);
select is(
  (select row(target_reps, target_weight_kg, target_duration_s, target_distance_km)::text
   from public.routine_exercises where routine_id = :'r1' and position = 1),
  '(8,60.50,,)', 'FR-002: los objetivos se guardan; los que faltan quedan sin dato'
);
select is(
  (select row(target_reps, target_weight_kg, target_duration_s, target_distance_km)::text
   from public.routine_exercises where routine_id = :'r1' and position = 4),
  '(,,1800,5.250)', 'distancia y duración objetivo'
);
select is(
  (select user_id::text from public.routines where id = :'r1'), :'uid_a', 'la rutina es del dueño de la sesión'
);

-- validaciones (FR-001, FR-002) ---------------------------------------------------------------------------------------------------
select throws_ilike($j$ select pg_temp.mk('{"exercises": [{"exercise_id": "{rw}", "sets": 3}]}') $j$, '%invalid_routine:name_required%', 'sin nombre');
select throws_ilike($j$ select pg_temp.mk('{"name": "   ", "exercises": [{"exercise_id": "{rw}", "sets": 3}]}') $j$, '%invalid_routine:name_required%', 'un nombre en blanco');
select throws_ilike(format($$ select pg_temp.mk(%L) $$, '{"name": "' || repeat('a', 81) || '", "exercises": [{"exercise_id": "{rw}", "sets": 3}]}'), '%invalid_routine:name_too_long%', 'un nombre de 81 caracteres');
select lives_ok(format($$ select pg_temp.mk(%L) $$, '{"name": "' || repeat('b', 80) || '", "exercises": [{"exercise_id": "{rw}", "sets": 3}]}'), 'un nombre de 80 caracteres');
select throws_ilike($j$ select pg_temp.mk('{"name": "X"}') $j$, '%invalid_routine:exercises_required%', 'sin ejercicios');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": []}') $j$, '%invalid_routine:exercises_required%', 'con una lista de ejercicios vacía');
select throws_ilike(
  $j$ select public.create_routine(jsonb_build_object('name', 'X', 'exercises', (select jsonb_agg(jsonb_build_object('exercise_id', pg_temp.v('rw'), 'sets', 3)) from generate_series(1, 31))), gen_random_uuid()) $j$,
  '%invalid_routine:too_many_exercises%', 'más de 30 ejercicios'
);
select lives_ok(
  $j$ select public.create_routine(jsonb_build_object('name', 'Treinta', 'exercises', (select jsonb_agg(jsonb_build_object('exercise_id', pg_temp.v('rw'), 'sets', 3)) from generate_series(1, 30))), gen_random_uuid()) $j$,
  'exactamente 30 ejercicios'
);
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{bx}", "sets": 3}]}') $j$, '%invalid_routine:exercise_not_found%', 'un ejercicio propio de otra cuenta se comporta como inexistente');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "99999999-9999-4999-8999-999999999999", "sets": 3}]}') $j$, '%invalid_routine:exercise_not_found%', 'un ejercicio inexistente');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "no-es-un-uuid", "sets": 3}]}') $j$, '%invalid_routine:exercise_not_found%', 'un identificador mal formado');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{rw}", "sets": 0}]}') $j$, '%invalid_routine:invalid_sets%', '0 series');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{rw}", "sets": 21}]}') $j$, '%invalid_routine:invalid_sets%', '21 series');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{rw}", "sets": 2.5}]}') $j$, '%invalid_routine:invalid_sets%', 'series con decimales');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{rw}"}]}') $j$, '%invalid_routine:invalid_sets%', 'sin series');
select lives_ok($j$ select pg_temp.mk('{"name": "Veinte", "exercises": [{"exercise_id": "{rw}", "sets": 20}]}') $j$, '20 series');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{d}", "sets": 3, "target_reps": 10}]}') $j$, '%invalid_routine:invalid_target%', 'repeticiones objetivo en un ejercicio de tiempo');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{rw}", "sets": 3, "target_duration_s": 60}]}') $j$, '%invalid_routine:invalid_target%', 'duración objetivo en un ejercicio con peso');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{bw}", "sets": 3, "target_weight_kg": 10}]}') $j$, '%invalid_routine:invalid_target%', 'peso objetivo en un ejercicio sin peso');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{rw}", "sets": 3, "target_reps": 0}]}') $j$, '%invalid_routine:invalid_target%', 'objetivo de 0 repeticiones');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{rw}", "sets": 3, "target_weight_kg": 1000}]}') $j$, '%invalid_routine:invalid_target%', 'objetivo de 1.000 kg');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{dd}", "sets": 3, "target_distance_km": 0}]}') $j$, '%invalid_routine:invalid_target%', 'objetivo de distancia 0');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{d}", "sets": 3, "target_duration_s": 86401}]}') $j$, '%invalid_routine:invalid_target%', 'objetivo de más de 24 horas');
select lives_ok($j$ select pg_temp.mk('{"name": "Cero", "exercises": [{"exercise_id": "{rw}", "sets": 3, "target_weight_kg": 0}]}') $j$, 'un peso objetivo de 0 es válido');
select is((select count(*) from public.routines where name = 'X'), 0::bigint, 'las solicitudes rechazadas no dejaron rutinas');

-- idempotencia (FR-047) ------------------------------------------------------------------------------------------------------------------
select public.create_routine(('{"name": "Idem", "exercises": [{"exercise_id": "' || :'rw' || '", "sets": 3}]}')::jsonb, '10000000-0000-0000-0000-000000000001') as idem1 \gset
select is(
  public.create_routine(('{"name": "Otro nombre", "exercises": [{"exercise_id": "' || :'bw' || '", "sets": 1}]}')::jsonb, '10000000-0000-0000-0000-000000000001')::text,
  :'idem1', 'FR-047: repetir la solicitud devuelve la misma rutina'
);
select is((select count(*) from public.routines where client_request_id = '10000000-0000-0000-0000-000000000001'), 1::bigint, 'y no crea otra');
select throws_ilike($j$ select public.create_routine('{"name": "X", "exercises": []}'::jsonb, null) $j$, '%invalid_routine:request_required%', 'sin identificador de solicitud');

-- editar ----------------------------------------------------------------------------------------------------------------------------------------
reset role;
select tests.create_session(:'uid_a', date '2026-10-20', 'completed', :'r1', true) as s_plan \gset
insert into vars values ('s_plan', :'s_plan');
select tests.authenticate_as(:'uid_a');

select is(
  pg_temp.upd('r1', '{"name": "Torso B", "exercises": [
      {"exercise_id": "{dd}", "sets": 2, "target_distance_km": 3},
      {"exercise_id": "{rw}", "sets": 5, "target_reps": 5, "target_weight_kg": 80}]}')::text,
  :'r1', 'FR-003: editar devuelve la misma rutina'
);
select is(
  (select r.name || '=' || (select string_agg(x.position || ':' || x.exercise_name || ':' || x.sets, ',' order by x.position) from public.routine_exercises x where x.routine_id = r.id)
   from public.routines r where r.id = :'r1'),
  'Torso B=1:Correr e2e:2,2:Press e2e:5', 'reemplaza el nombre y todos los ítems, con su orden'
);
select is(
  (select count(*) from public.session_plan_items where session_id = :'s_plan'), 5::bigint,
  'FR-005: la sesión creada antes conserva su plan completo'
);
reset role;
update public.exercises set name = 'Press renombrado e2e' where id = :'rw';
select tests.authenticate_as(:'uid_a');
select pg_temp.upd('r1', '{"name": "Torso B", "exercises": [{"exercise_id": "{rw}", "sets": 5}]}');
select is(
  (select exercise_name from public.routine_exercises where routine_id = :'r1'), 'Press renombrado e2e',
  'al guardar la rutina se vuelve a tomar el nombre vigente del ejercicio'
);
select throws_ilike($j$ select pg_temp.upd('r1', '{"name": "", "exercises": [{"exercise_id": "{rw}", "sets": 5}]}') $j$, '%invalid_routine:name_required%', 'la edición valida igual que la creación');
select throws_ilike($j$ select pg_temp.upd('r1', '{"name": "Roto", "exercises": [{"exercise_id": "{rw}", "sets": 5}, {"exercise_id": "{rw}", "sets": 99}]}') $j$, '%invalid_routine:invalid_sets%', 'un error en el segundo ítem...');
select is(
  (select name || '|' || (select count(*) from public.routine_exercises x where x.routine_id = r.id) from public.routines r where r.id = :'r1'),
  'Torso B|1', '...no deja la rutina a medias'
);
select throws_ilike($j$ select public.update_routine(gen_random_uuid(), ('{"name": "X", "exercises": [{"exercise_id": "' || pg_temp.v('rw') || '", "sets": 1}]}')::jsonb) $j$, '%not_found%', 'una rutina inexistente → not_found');

-- duplicar ------------------------------------------------------------------------------------------------------------------------------------------
select public.duplicate_routine(:'r1', '20000000-0000-0000-0000-000000000001') as dup \gset
select is((select name from public.routines where id = :'dup'), 'Torso B (copia)', 'FR-003: la copia se llama «… (copia)»');
select is(
  (select count(*) from public.routine_exercises where routine_id = :'dup'), 1::bigint, 'con el mismo contenido'
);
select is(
  public.duplicate_routine(:'r1', '20000000-0000-0000-0000-000000000001')::text, :'dup', 'duplicar es idempotente por solicitud'
);
select pg_temp.mk(format('{"name": "%s", "exercises": [{"exercise_id": "{rw}", "sets": 3}]}', repeat('n', 80))) as long_r \gset
select public.duplicate_routine(:'long_r', gen_random_uuid()) as dup_long \gset
select is(
  (select char_length(name) from public.routines where id = :'dup_long'), 80,
  'el nombre de la copia se recorta a 80 caracteres'
);
select pg_temp.upd('r1', '{"name": "Cambiada", "exercises": [{"exercise_id": "{rw}", "sets": 1}]}');
select is((select name from public.routines where id = :'dup'), 'Torso B (copia)', 'la copia es independiente de la original');

-- eliminar (borrado directo) ---------------------------------------------------------------------------------------------------------------------------
delete from public.routines where id = :'r1';
select is((select count(*) from public.routines where id = :'r1'), 0::bigint, 'FR-003: una rutina propia se elimina');
select is((select count(*) from public.routine_exercises where routine_id = :'r1'), 0::bigint, 'con sus ejercicios');
select is(
  (select row(routine_id, routine_name)::text from public.workout_sessions where id = :'s_plan'), '(,"Torso A")',
  'FR-005: la sesión creada con ella conserva su plan y el nombre'
);
select is((select count(*) from public.session_plan_items where session_id = :'s_plan'), 5::bigint, 'y los cinco ítems');

-- ajenas, sesión vencida y permisos ------------------------------------------------------------------------------------------------------------------
select tests.clear_authentication();
select tests.authenticate_as(:'uid_b');
select throws_ilike(format($$ select public.update_routine(%L, '{"name": "Robada", "exercises": [{"exercise_id": "%s", "sets": 1}]}'::jsonb) $$, :'dup', :'bx'), '%not_found%', 'una rutina ajena no se edita');
select throws_ilike(format($$ select public.duplicate_routine(%L, gen_random_uuid()) $$, :'dup'), '%not_found%', 'ni se duplica');
select is((select count(*) from public.routines), 0::bigint, 'B no ve las rutinas de A');
select tests.clear_authentication();

update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select throws_ilike($j$ select pg_temp.mk('{"name": "X", "exercises": [{"exercise_id": "{rw}", "sets": 1}]}') $j$, '%session_expired%', 'con la sesión vencida no se guarda');
select tests.clear_authentication();
select throws_ilike($j$ select public.create_routine('{}'::jsonb, gen_random_uuid()) $j$, '%session_expired%', 'sin sesión no se guarda');
select ok(not has_function_privilege('anon', 'public.create_routine(jsonb, uuid)', 'execute'), 'anon no puede crear');
select ok(not has_function_privilege('anon', 'public.update_routine(uuid, jsonb)', 'execute'), 'anon no puede editar');
select ok(not has_function_privilege('anon', 'public.duplicate_routine(uuid, uuid)', 'execute'), 'anon no puede duplicar');
select ok(has_function_privilege('authenticated', 'public.create_routine(jsonb, uuid)', 'execute'), 'authenticated sí');

select * from finish();
rollback;

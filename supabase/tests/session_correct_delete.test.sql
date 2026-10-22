-- T069 (spec 006, FR-035, FR-038, FR-039, SC-004): corregir una sesión realizada y eliminar una sesión.
begin;
select plan(18);

delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_exercise(:'uid_a', 'Press e2e', 'reps_weight') as rw \gset
select tests.create_exercise(:'uid_a', 'Plancha e2e', 'duration') as d \gset
select tests.create_routine(:'uid_a', 'Torso A', array[:'rw'::uuid, :'d'::uuid], 2) as r \gset

-- Una sesión realizada con plan: Press (2 series) y Plancha (2 series), todo según el plan.
select tests.create_session(:'uid_a', date '2026-10-10', 'completed', :'r', true) as s \gset
select id as p1 from public.session_plan_items where session_id = :'s' and position = 1 \gset
select id as p2 from public.session_plan_items where session_id = :'s' and position = 2 \gset
select tests.add_session_exercise(:'s', :'rw', :'p1') as x1 \gset
select tests.add_session_set(:'x1', 8, 60);
select tests.add_session_set(:'x1', 8, 60);
select tests.add_session_exercise(:'s', :'d', :'p2') as x2 \gset
select tests.add_session_set(:'x2', null, null, 60);
select tests.add_session_set(:'x2', null, null, 60);
select tests.create_session(:'uid_a', date '2026-10-11', 'completed') as s_other \gset
select tests.create_session(:'uid_b', date '2026-10-11', 'completed') as s_b \gset

create temp table vars (k text primary key, v text);
grant all on vars to public;
insert into vars values ('s', :'s'), ('x1', :'x1'), ('x2', :'x2'), ('p1', :'p1'), ('p2', :'p2'), ('s_b', :'s_b');
create function pg_temp.fill(p text) returns text language plpgsql as $$
declare r record; out text := p;
begin
  for r in select k, v from pg_temp.vars loop out := replace(out, '{' || r.k || '}', r.v); end loop;
  return out;
end $$;
grant all on function pg_temp.fill(text) to public;

select is((select modified from public.workout_sessions where id = :'s'), false, 'la sesión parte sin «modificada»');

-- el ejercicio se renombra, cambia de tipo o se elimina después
update public.exercises set name = 'Press renombrado e2e' where id = :'rw';
update public.exercises set measurement_type = 'reps_bodyweight' where id = :'rw';
delete from public.exercises where id = :'d';

select tests.authenticate_as(:'uid_a');

-- corregir: una serie y una nota
select is(
  (public.save_workout(:'s', pg_temp.fill('{"note": "Corregida", "exercises": [
    {"id": "{x1}", "plan_item_id": "{p1}", "is_substitute": false, "sets": [{"reps": 10, "weight_kg": 60}, {"reps": 8, "weight_kg": 60}]},
    {"id": "{x2}", "plan_item_id": "{p2}", "is_substitute": false, "sets": [{"duration_s": 60}, {"duration_s": 60}]}]}')::jsonb, 1, false)) ->> 'status',
  'completed', 'FR-038: corregir deja la sesión realizada'
);
select tests.clear_authentication();
select is(
  (select row(corrected_at is not null, revision, note, modified)::text from public.workout_sessions where id = :'s'),
  '(t,2,Corregida,f)', 'fija corrected_at, sube la revisión y recalcula «modificada»'
);
select is(
  (select string_agg(exercise_name || ':' || measurement_type, ',' order by position) from public.session_exercises where session_id = :'s'),
  'Press e2e:reps_weight,Plancha e2e:duration', 'FR-035: conserva el nombre y el tipo de medición guardados, aunque cambiaron o se eliminó el ejercicio'
);
select is(
  (select string_agg(reps::text, ',' order by position) from public.session_sets where session_exercise_id = :'x1'),
  '10,8', 'el valor corregido quedó guardado'
);

-- agregar y quitar series, y recalcular «modificada»
select tests.authenticate_as(:'uid_a');
select public.save_workout(:'s', pg_temp.fill('{"exercises": [
    {"id": "{x1}", "plan_item_id": "{p1}", "is_substitute": false, "sets": [{"reps": 10, "weight_kg": 60}, {"reps": 8, "weight_kg": 60}, {"reps": 6, "weight_kg": 60}]},
    {"id": "{x2}", "plan_item_id": "{p2}", "is_substitute": false, "sets": [{"duration_s": 60}, {"duration_s": 60}]}]}')::jsonb, 2, false);
select tests.clear_authentication();
select is(
  (select row(modified, revision, (select count(*) from public.session_sets where session_exercise_id = :'x1'))::text from public.workout_sessions where id = :'s'),
  '(t,3,3)', 'agregar una serie respecto del plan marca «modificada» y sube la revisión'
);
select tests.authenticate_as(:'uid_a');
select public.save_workout(:'s', pg_temp.fill('{"exercises": [
    {"id": "{x1}", "plan_item_id": "{p1}", "is_substitute": false, "sets": [{"reps": 8, "weight_kg": 60}, {"reps": 10, "weight_kg": 60}]},
    {"id": "{x2}", "plan_item_id": "{p2}", "is_substitute": false, "sets": [{"duration_s": 60}, {"duration_s": 60}]}]}')::jsonb, 3, false);
select tests.clear_authentication();
select is(
  (select row(modified, (select string_agg(reps::text, ',' order by position) from public.session_sets where session_exercise_id = :'x1'))::text from public.workout_sessions where id = :'s'),
  '(f,"8,10")', 'volver a la cantidad planificada quita «modificada»; las series se reordenan'
);

-- revisión vieja: stale_revision, sin cambios
select tests.authenticate_as(:'uid_a');
select throws_ilike(
  pg_temp.fill($$ select public.save_workout('{s}', '{"exercises": []}'::jsonb, 1, false) $$),
  '%stale_revision%', 'también en una corrección se rechaza una revisión vieja'
);
select tests.clear_authentication();
select is((select count(*) from public.session_exercises where session_id = :'s'), 2::bigint, 'el rechazo no cambió nada');

-- el catálogo y otras sesiones no cambian al corregir
select is((select count(*) from public.routines where id = :'r'), 1::bigint, 'SC-004: la rutina sigue igual');
select is((select count(*) from public.workout_sessions where id = :'s_other'), 1::bigint, 'y las demás sesiones también');

-- eliminar ---------------------------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
delete from public.workout_sessions where id = :'s';
select tests.clear_authentication();
select is((select count(*) from public.workout_sessions where id = :'s'), 1::bigint, 'otra cuenta no elimina una sesión ajena');

select tests.authenticate_as(:'uid_a');
delete from public.workout_sessions where id = :'s';
select tests.clear_authentication();
select is((select count(*) from public.workout_sessions where id = :'s'), 0::bigint, 'FR-039: eliminar una sesión propia la quita');
select is(
  (select (select count(*) from public.session_exercises where session_id = :'s') + (select count(*) from public.session_sets where session_exercise_id = :'x1')
    + (select count(*) from public.session_plan_items where session_id = :'s')),
  0::bigint, 'y borra sus ejercicios, series y plan'
);
select is((select count(*) from public.routines where id = :'r'), 1::bigint, 'SC-004: la rutina no cambia al eliminar la sesión');
select is((select count(*) from public.workout_sessions where id = :'s_other'), 1::bigint, 'ni las otras sesiones');
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.exercise_history(:'rw')), 0::bigint, 'la sesión eliminada desaparece de la historia');
select tests.clear_authentication();
select is((select count(*) from public.workout_sessions where id = :'s_b'), 1::bigint, 'la sesión de otra cuenta sigue ahí');

select * from finish();
rollback;

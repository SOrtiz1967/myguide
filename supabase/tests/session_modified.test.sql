-- T042 (spec 006, FR-018, FR-019, FR-020): la regla de «modificada». Se calcula en el servidor al terminar y al corregir.
begin;
select plan(14);

delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_exercise(:'uid_a', 'Press e2e', 'reps_weight') as rw \gset
select tests.create_exercise(:'uid_a', 'Plancha e2e', 'duration') as d \gset
select tests.create_exercise(:'uid_a', 'Remo e2e', 'reps_weight') as extra \gset

-- Rutina con dos ítems de 3 series cada uno (objetivos: 8 repeticiones con 60 kg, y 90 s).
select tests.create_routine(:'uid_a', 'Rutina e2e', array[:'rw'::uuid, :'d'::uuid], 3) as r \gset
update public.routine_exercises set target_reps = 8, target_weight_kg = 60 where routine_id = :'r' and position = 1;
update public.routine_exercises set target_duration_s = 90 where routine_id = :'r' and position = 2;

-- Una sesión realizada con ese plan (se arma con los ayudantes, sin pasar por las funciones del cliente).
create function pg_temp.new_session() returns uuid language sql as $$
  select tests.create_session(current_setting('t.uid')::uuid, current_date, 'completed', current_setting('t.r')::uuid, true)
$$;
select set_config('t.uid', :'uid_a', false), set_config('t.r', :'r', false);
create function pg_temp.plan_item(p_session uuid, p_position int) returns uuid language sql as $$
  select id from public.session_plan_items where session_id = p_session and position = p_position
$$;
create function pg_temp.sets(p_exercise uuid, p_count int, p_kind text) returns void language plpgsql as $$
declare i int;
begin
  for i in 1..p_count loop
    if p_kind = 'rw' then perform tests.add_session_set(p_exercise, 20 + i, 10 * i);
    else perform tests.add_session_set(p_exercise, null, null, 30 + i, null);
    end if;
  end loop;
end $$;

-- idéntica al plan: lo mismo que se planificó, con otros valores ------------------------------------------------------------------
select pg_temp.new_session() as s_ok \gset
select tests.add_session_exercise(:'s_ok', :'rw', pg_temp.plan_item(:'s_ok', 1)) as ok_rw \gset
select tests.add_session_exercise(:'s_ok', :'d', pg_temp.plan_item(:'s_ok', 2)) as ok_d \gset
select pg_temp.sets(:'ok_rw', 3, 'rw'); select pg_temp.sets(:'ok_d', 3, 'd');
select is(private.compute_session_modified(:'s_ok'), false, 'FR-019: lo planificado, con otras repeticiones, pesos y tiempos, no es «modificada»');

-- un ítem sin ejercicio realizado: «no realizado» (FR-020)
select pg_temp.new_session() as s_skip \gset
select tests.add_session_exercise(:'s_skip', :'rw', pg_temp.plan_item(:'s_skip', 1)) as skip_rw \gset
select pg_temp.sets(:'skip_rw', 3, 'rw');
select is(private.compute_session_modified(:'s_skip'), true, 'un ítem del plan sin hacer → modificada');

-- un ejercicio realizado con cero series equivale a no realizado
select pg_temp.new_session() as s_zero \gset
select tests.add_session_exercise(:'s_zero', :'rw', pg_temp.plan_item(:'s_zero', 1)) as zero_rw \gset
select tests.add_session_exercise(:'s_zero', :'d', pg_temp.plan_item(:'s_zero', 2)) as zero_d \gset
select pg_temp.sets(:'zero_rw', 3, 'rw');
select is(private.compute_session_modified(:'s_zero'), true, 'un ejercicio planificado con cero series → modificada');

-- sustituido por otro
select pg_temp.new_session() as s_sub \gset
select tests.add_session_exercise(:'s_sub', :'extra', pg_temp.plan_item(:'s_sub', 1), true) as sub_x \gset
select tests.add_session_exercise(:'s_sub', :'d', pg_temp.plan_item(:'s_sub', 2)) as sub_d \gset
select pg_temp.sets(:'sub_x', 3, 'rw'); select pg_temp.sets(:'sub_d', 3, 'd');
select is(private.compute_session_modified(:'s_sub'), true, 'un ejercicio sustituido → modificada');

-- agregado: con series sí cuenta; sin series no
select pg_temp.new_session() as s_add \gset
select tests.add_session_exercise(:'s_add', :'rw', pg_temp.plan_item(:'s_add', 1)) as add_rw \gset
select tests.add_session_exercise(:'s_add', :'d', pg_temp.plan_item(:'s_add', 2)) as add_d \gset
select tests.add_session_exercise(:'s_add', :'extra') as add_x \gset
select pg_temp.sets(:'add_rw', 3, 'rw'); select pg_temp.sets(:'add_d', 3, 'd');
select is(private.compute_session_modified(:'s_add'), false, 'un ejercicio agregado sin series no cuenta');
select pg_temp.sets(:'add_x', 2, 'rw');
select is(private.compute_session_modified(:'s_add'), true, 'un ejercicio agregado con series → modificada');

-- cantidad de series distinta
select pg_temp.new_session() as s_less \gset
select tests.add_session_exercise(:'s_less', :'rw', pg_temp.plan_item(:'s_less', 1)) as less_rw \gset
select tests.add_session_exercise(:'s_less', :'d', pg_temp.plan_item(:'s_less', 2)) as less_d \gset
select pg_temp.sets(:'less_rw', 2, 'rw'); select pg_temp.sets(:'less_d', 3, 'd');
select is(private.compute_session_modified(:'s_less'), true, 'menos series que las planificadas → modificada');
select pg_temp.new_session() as s_more \gset
select tests.add_session_exercise(:'s_more', :'rw', pg_temp.plan_item(:'s_more', 1)) as more_rw \gset
select tests.add_session_exercise(:'s_more', :'d', pg_temp.plan_item(:'s_more', 2)) as more_d \gset
select pg_temp.sets(:'more_rw', 4, 'rw'); select pg_temp.sets(:'more_d', 3, 'd');
select is(private.compute_session_modified(:'s_more'), true, 'más series que las planificadas → modificada');

-- sin plan nunca
select tests.create_session(:'uid_a', current_date, 'completed') as s_free \gset
select tests.add_session_exercise(:'s_free', :'rw') as free_rw \gset
select pg_temp.sets(:'free_rw', 3, 'rw');
select is(private.compute_session_modified(:'s_free'), false, 'FR-017: una sesión sin plan nunca es «modificada»');
select is(private.compute_session_modified(gen_random_uuid()), false, 'una sesión inexistente no es «modificada»');

-- de punta a punta: terminar y corregir recalculan la marca ----------------------------------------------------------------------
update public.workout_sessions set status = 'completed' where false;
select tests.authenticate_as(:'uid_a');
select (public.start_workout_from_routine(:'r', null, '40000000-0000-0000-0000-000000000001', 'UTC')) ->> 'id' as e2e \gset
select p.id as pl1 from public.session_plan_items p where p.session_id = :'e2e' and p.position = 1 \gset
select p.id as pl2 from public.session_plan_items p where p.session_id = :'e2e' and p.position = 2 \gset

select is(
  (public.save_workout(:'e2e', ('{"exercises": [
      {"id": "50000000-0000-4000-8000-000000000001", "exercise_id": "' || :'rw' || '", "plan_item_id": "' || :'pl1' || '", "sets": [{"reps": 8, "weight_kg": 60}, {"reps": 8, "weight_kg": 60}, {"reps": 8, "weight_kg": 60}]},
      {"id": "50000000-0000-4000-8000-000000000002", "exercise_id": "' || :'d' || '", "plan_item_id": "' || :'pl2' || '", "sets": [{"duration_s": 90}, {"duration_s": 90}, {"duration_s": 90}]}]}')::jsonb, 1, true)) ->> 'modified',
  'false', 'terminar una sesión igual al plan: «Realizada», sin marca'
);
select is(
  (public.save_workout(:'e2e', ('{"exercises": [
      {"id": "50000000-0000-4000-8000-000000000001", "exercise_id": "' || :'rw' || '", "plan_item_id": "' || :'pl1' || '", "sets": [{"reps": 8, "weight_kg": 60}]}]}')::jsonb, 2, false)) ->> 'modified',
  'true', 'corregirla quitando un ejercicio y series la marca como «modificada»'
);
select is(
  (public.save_workout(:'e2e', ('{"exercises": [
      {"id": "50000000-0000-4000-8000-000000000001", "exercise_id": "' || :'rw' || '", "plan_item_id": "' || :'pl1' || '", "sets": [{"reps": 8}, {"reps": 8}, {"reps": 8}]},
      {"id": "50000000-0000-4000-8000-000000000002", "exercise_id": "' || :'d' || '", "plan_item_id": "' || :'pl2' || '", "sets": [{"duration_s": 60}, {"duration_s": 60}, {"duration_s": 60}]}]}')::jsonb, 3, false)) ->> 'modified',
  'false', 'y volver a lo planificado quita la marca'
);
select is(
  (select count(*) from public.session_plan_items where session_id = :'e2e'), 2::bigint, 'FR-016: nada de esto toca el plan'
);
select tests.clear_authentication();

select * from finish();
rollback;

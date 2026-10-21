-- T054 (spec 005, FR-025, FR-027, FR-028, FR-030, SC-008): editar y eliminar ejercicios propios.
begin;
select plan(35);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin ejercicios (todo se deshace al final).
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_catalog_exercise('free-exercise-db', 'UP-1', 'Remo con barra', 'reps_weight', 'Bent Over Barbell Row',
  array['Remo inclinado'], array['middle back'], array['biceps'], 'barbell', 'Tira.', 'reviewed', 'reviewed') as cat_id \gset
select tests.create_exercise(:'uid_a', 'Mi plancha', 'duration', array['abdominals'], 'body only', 'Aguanta.') as own_a_id \gset
select tests.create_exercise(:'uid_b', 'Secreto de B', 'duration') as own_b_id \gset

select tests.authenticate_as(:'uid_a');

-- editar lo propio -----------------------------------------------------------------------------------------------------
select is(
  public.update_exercise(:'own_a_id', '{
    "name": "  Plancha larga  ", "measurement_type": "reps_bodyweight",
    "primary_muscles": ["abdominals", "lower back", "abdominals"], "secondary_muscles": ["shoulders"],
    "equipment": "exercise ball", "description": "  1. Apoya los codos.\n2. Aguanta.  ",
    "aliases": ["Plank", "  Tabla ", "plank", "Plancha larga"]
  }'::jsonb),
  :'own_a_id'::uuid, 'FR-027: devuelve el id del ejercicio editado'
);
select is(
  (select row(name, measurement_type, primary_muscles, secondary_muscles, equipment, aliases)::text from public.exercises where id = :'own_a_id'),
  '("Plancha larga",reps_bodyweight,"{abdominals,""lower back""}",{shoulders},"exercise ball","{Plank,Tabla}")',
  'se actualizan todos los campos, incluido el tipo de medición, con la misma limpieza que al crear'
);
select is(
  (select row(description, description_status, name_status)::text from public.exercises where id = :'own_a_id'),
  E'("1. Apoya los codos.\n2. Aguanta.",original,original)',
  'la descripción se recorta y los textos quedan como «original»'
);
select is(
  (select search_text from public.exercises where id = :'own_a_id'),
  'plancha larga plank tabla', 'los campos de búsqueda se recalculan'
);
select is(
  (select row(origin, user_id = auth.uid(), source_id, source_item_id, imported_at)::text from public.exercises where id = :'own_a_id'),
  '(own,t,,,)', 'no cambian el origen ni el dueño ni la procedencia'
);

-- vaciar lo opcional ----------------------------------------------------------------------------------------------------
select lives_ok(
  format($$ select public.update_exercise(%L, '{"name": "Plancha larga", "measurement_type": "duration", "equipment": "", "description": "  ", "aliases": []}'::jsonb) $$, :'own_a_id'),
  'se puede vaciar lo opcional'
);
select is(
  (select row(equipment, description, description_status, primary_muscles, aliases)::text from public.exercises where id = :'own_a_id'),
  '(,,,{},{})', 'queda «sin dato», sin estado de descripción'
);

-- la fecha de modificación avanza, la de creación no -----------------------------------------------------------------
select ok(
  (select updated_at >= created_at from public.exercises where id = :'own_a_id'), 'updated_at no es anterior a created_at'
);

-- validaciones (FR-025) ---------------------------------------------------------------------------------------------
select throws_ilike(format($$ select public.update_exercise(%L, '{"measurement_type": "duration"}'::jsonb) $$, :'own_a_id'), '%invalid_exercise:name_required:name%', 'sin nombre se rechaza');
select throws_ilike(format($$ select public.update_exercise(%L, '{"name": "X"}'::jsonb) $$, :'own_a_id'), '%invalid_exercise:measurement_required:measurement_type%', 'sin tipo de medición se rechaza');
select throws_ilike(format($$ select public.update_exercise(%L, '{"name": "X", "measurement_type": "duration", "primary_muscles": ["pecho"]}'::jsonb) $$, :'own_a_id'), '%invalid_exercise:invalid_muscle:primary_muscles%', 'un músculo fuera de la lista se rechaza');
select throws_ilike(format($$ select public.update_exercise(%L, '{"name": "X", "measurement_type": "duration", "equipment": "pesas"}'::jsonb) $$, :'own_a_id'), '%invalid_exercise:invalid_equipment:equipment%', 'un equipamiento fuera de la lista se rechaza');
select throws_ilike(
  format($$ select public.update_exercise(%L, '{"name": "X", "measurement_type": "duration", "description": "%s"}'::jsonb) $$, :'own_a_id', repeat('a', 4001)),
  '%invalid_exercise:description_too_long:description%', 'una descripción de más de 4.000 caracteres se rechaza'
);
select is(
  (select name from public.exercises where id = :'own_a_id'), 'Plancha larga', 'una edición rechazada no deja el ejercicio a medias'
);

-- lo ajeno y el catálogo son de solo lectura (FR-028) ----------------------------------------------------------------
select throws_ilike(
  format($$ select public.update_exercise(%L, '{"name": "Hackeado", "measurement_type": "duration"}'::jsonb) $$, :'cat_id'),
  '%not_found%', 'un ejercicio del catálogo no se puede editar'
);
select throws_ilike(
  format($$ select public.update_exercise(%L, '{"name": "Hackeado", "measurement_type": "duration"}'::jsonb) $$, :'own_b_id'),
  '%not_found%', 'un ejercicio ajeno no se puede editar'
);
select throws_ilike(
  $$ select public.update_exercise(gen_random_uuid(), '{"name": "X", "measurement_type": "duration"}'::jsonb) $$,
  '%not_found%', 'un ejercicio inexistente devuelve not_found'
);
select is(
  (select name from public.exercises where id = :'cat_id'), 'Remo con barra', 'el catálogo no cambió'
);
select is(
  (select count(*) from public.exercises where name = 'Hackeado'), 0::bigint, 'ninguna edición rechazada dejó cambios'
);

-- borrar (FR-027, FR-028) -------------------------------------------------------------------------------------------
select tests.clear_authentication();
select tests.authenticate_as(:'uid_b');
select is(
  (select count(*) from public.exercises where name = 'Plancha larga'), 0::bigint, 'B no ve el ejercicio editado por A'
);
select tests.clear_authentication();

select tests.authenticate_as(:'uid_a');
with deleted as (delete from public.exercises where id = :'cat_id' returning id)
select is((select count(*) from deleted), 0::bigint, 'borrar un ejercicio del catálogo no afecta ninguna fila');
with deleted as (delete from public.exercises where id = :'own_b_id' returning id)
select is((select count(*) from deleted), 0::bigint, 'borrar un ejercicio ajeno no afecta ninguna fila');
select is(
  (select count(*) from public.exercises where id in (:'cat_id', :'own_b_id')), 1::bigint,
  'el catálogo sigue ahí (lo ajeno no se ve)'
);

-- una copia sobrevive a la eliminación de su original (propio) ---------------------------------------------------------
select public.copy_exercise(:'own_a_id', '30000000-0000-0000-0000-000000000001') as copy_id \gset
select public.copy_exercise(:'cat_id', '30000000-0000-0000-0000-000000000002') as copy_cat_id \gset

with deleted as (delete from public.exercises where id = :'own_a_id' returning id)
select is((select count(*) from deleted), 1::bigint, 'se puede borrar un ejercicio propio');
select is((select count(*) from public.exercises where id = :'own_a_id'), 0::bigint, 'y desaparece');
select is(
  (select row(name, based_on_exercise_id)::text from public.exercises where id = :'copy_id'),
  '("Plancha larga",)', 'la copia queda intacta y sin referencia al original eliminado'
);
select lives_ok(
  format($$ select public.update_exercise(%L, '{"name": "Mi copia", "measurement_type": "duration"}'::jsonb) $$, :'copy_id'),
  'la copia se puede editar aunque su original ya no exista'
);
select lives_ok(
  format($$ select public.update_exercise(%L, '{"name": "Mi versión del remo", "measurement_type": "reps_weight"}'::jsonb) $$, :'copy_cat_id'),
  'una copia del catálogo se puede editar'
);
select is(
  (select name from public.exercises where id = :'cat_id'), 'Remo con barra', 'y el original del catálogo no cambia (SC-008)'
);
select is(
  (select based_on_exercise_id from public.exercises where id = :'copy_cat_id'), :'cat_id'::uuid,
  'la copia sigue diciendo en qué se basa'
);
select tests.clear_authentication();

-- sesión vencida, sin sesión y permisos ----------------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select throws_ilike(
  format($$ select public.update_exercise(%L, '{"name": "Z", "measurement_type": "duration"}'::jsonb) $$, :'copy_id'),
  '%session_expired%', 'con la sesión vencida no se edita'
);
select tests.clear_authentication();
select throws_ilike(
  format($$ select public.update_exercise(%L, '{"name": "Z", "measurement_type": "duration"}'::jsonb) $$, :'copy_id'),
  '%session_expired%', 'sin sesión no se edita'
);
select ok(not has_function_privilege('anon', 'public.update_exercise(uuid, jsonb)', 'execute'), 'anon no puede ejecutarla');
select ok(has_function_privilege('authenticated', 'public.update_exercise(uuid, jsonb)', 'execute'), 'authenticated sí');
select ok(not has_table_privilege('authenticated', 'public.exercises', 'update'), 'el cliente no puede actualizar la tabla directamente');

select * from finish();
rollback;

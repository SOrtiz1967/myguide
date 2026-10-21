-- T049 (spec 005, FR-026, FR-033, SC-008): copia propia y editable de un ejercicio visible.
begin;
select plan(28);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin ejercicios (todo se deshace al final).
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.create_catalog_exercise('free-exercise-db', 'CP-1', 'Remo con barra', 'reps_weight', 'Bent Over Barbell Row',
  array['Remo inclinado'], array['middle back', 'lats'], array['biceps'], 'barbell',
  E'1. Inclínate.\n2. Tira de la barra.', 'reviewed', 'reviewed') as cat_id \gset
select tests.create_catalog_exercise('free-exercise-db', 'CP-2', 'Sin datos', 'duration') as cat_empty_id \gset
select tests.create_exercise(:'uid_a', 'Mi plancha', 'duration', array['abdominals'], 'body only', 'Aguanta.') as own_a_id \gset
select tests.create_exercise(:'uid_b', 'Secreto de B') as own_b_id \gset

select tests.authenticate_as(:'uid_a');

-- copia de un ejercicio del catálogo -----------------------------------------------------------------------------
select lives_ok(
  format($$ select public.copy_exercise(%L, '20000000-0000-0000-0000-000000000001') $$, :'cat_id'),
  'FR-026: se copia un ejercicio del catálogo'
);
select is(
  (select row(origin, user_id = auth.uid(), source_id, source_item_id, imported_at, original_name, based_on_exercise_id = :'cat_id')::text
   from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000001'),
  '(own,t,,,,,t)',
  'la copia es propia, del dueño de la sesión, sin fuente ni fecha de importación ni nombre original, y dice en qué se basa'
);
select is(
  (select row(name, measurement_type, primary_muscles, secondary_muscles, equipment, aliases, description)::text
   from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000001'),
  (select row(name, measurement_type, primary_muscles, secondary_muscles, equipment, aliases, description)::text
   from public.exercises where id = :'cat_id'),
  'conserva el nombre, el tipo de medición, los músculos, el equipamiento, los otros nombres y la descripción'
);
select is(
  (select row(name_status, description_status)::text from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000001'),
  '(original,original)',
  'los textos de la copia pasan a «original», aunque el original estuviera revisado'
);

-- un original sin datos opcionales se copia sin inventar nada ---------------------------------------------------
select lives_ok(
  format($$ select public.copy_exercise(%L, '20000000-0000-0000-0000-000000000002') $$, :'cat_empty_id'),
  'se copia un ejercicio sin descripción ni músculos'
);
select is(
  (select row(equipment, description, description_status, primary_muscles)::text
   from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000002'),
  '(,,,{})',
  'lo que faltaba sigue faltando: no se completa con supuestos'
);

-- copia de un ejercicio propio ---------------------------------------------------------------------------------
select lives_ok(
  format($$ select public.copy_exercise(%L, '20000000-0000-0000-0000-000000000003') $$, :'own_a_id'),
  'se copia un ejercicio propio'
);
select is(
  (select based_on_exercise_id from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000003'),
  :'own_a_id'::uuid, 'la copia de lo propio dice en qué se basa'
);

-- idempotencia y copias independientes ----------------------------------------------------------------------------
select is(
  public.copy_exercise(:'cat_id', '20000000-0000-0000-0000-000000000001'),
  (select id from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000001'),
  'repetir la solicitud devuelve la misma copia'
);
select is(
  (select count(*) from public.exercises where user_id = auth.uid() and based_on_exercise_id = :'cat_id'),
  1::bigint, 'y no crea otra'
);
select lives_ok(
  format($$ select public.copy_exercise(%L, '20000000-0000-0000-0000-000000000004') $$, :'cat_id'),
  'con otro identificador de solicitud se puede copiar de nuevo'
);
select is(
  (select count(distinct id) from public.exercises where user_id = auth.uid() and based_on_exercise_id = :'cat_id'),
  2::bigint, 'y quedan dos copias independientes'
);

-- el original no cambia ------------------------------------------------------------------------------------------
select is(
  (select row(name, name_status, description, description_status, user_id)::text from public.exercises where id = :'cat_id'),
  E'("Remo con barra",reviewed,"1. Inclínate.\n2. Tira de la barra.",reviewed,)',
  'el original del catálogo no cambió'
);

-- ajenos e inexistentes -------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ select public.copy_exercise(%L, gen_random_uuid()) $$, :'own_b_id'),
  '%not_found%', 'un ejercicio ajeno se comporta como inexistente'
);
select throws_ilike(
  $$ select public.copy_exercise(gen_random_uuid(), gen_random_uuid()) $$,
  '%not_found%', 'un ejercicio inexistente devuelve not_found'
);
select throws_ilike(
  format($$ select public.copy_exercise(%L, null) $$, :'cat_id'),
  '%invalid_exercise:request_required:request_id%', 'sin identificador de solicitud se rechaza'
);
select is(
  (select count(*) from public.exercises where based_on_exercise_id = :'own_b_id'), 0::bigint,
  'ninguna solicitud inválida dejó filas'
);

-- aislamiento: la copia de A no la ve B ---------------------------------------------------------------------------
select tests.clear_authentication();
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.exercises where based_on_exercise_id = :'cat_id'), 0::bigint, 'la cuenta B no ve las copias de A');
select is(
  (select name from public.exercises where id = :'cat_id'), 'Remo con barra', 'B sigue viendo el original sin cambios'
);
select lives_ok(
  format($$ select public.copy_exercise(%L, '20000000-0000-0000-0000-000000000001') $$, :'cat_id'),
  'B puede usar el mismo identificador de solicitud que A'
);
select is((select count(*) from public.exercises where user_id = auth.uid() and based_on_exercise_id = :'cat_id'), 1::bigint, 'y crea la suya, independiente');
select tests.clear_authentication();

-- una nueva importación no toca la copia (FR-033) y eliminar el original la deja intacta --------------------------
select tests.authenticate_as(:'uid_a');
select is(
  (select name from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000001'),
  'Remo con barra', 'antes de importar, la copia tiene su nombre'
);
select tests.clear_authentication();
update public.exercises set name = 'Remo con barra (v2)' where id = :'cat_id';
select tests.authenticate_as(:'uid_a');
select is(
  (select name from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000001'),
  'Remo con barra', 'una actualización del catálogo no cambia la copia'
);
select tests.clear_authentication();
delete from public.exercises where id = :'cat_id';
select tests.authenticate_as(:'uid_a');
select is(
  (select row(name, based_on_exercise_id)::text from public.exercises where client_request_id = '20000000-0000-0000-0000-000000000001'),
  '("Remo con barra",)', 'si se elimina el original, la copia queda intacta y sin referencia'
);
select tests.clear_authentication();

-- sesión vencida, sin sesión y permisos ----------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select throws_ilike(
  format($$ select public.copy_exercise(%L, gen_random_uuid()) $$, :'cat_empty_id'),
  '%session_expired%', 'con la sesión vencida no se copia'
);
select tests.clear_authentication();
select throws_ilike(
  format($$ select public.copy_exercise(%L, gen_random_uuid()) $$, :'cat_empty_id'),
  '%session_expired%', 'sin sesión no se copia'
);
select ok(not has_function_privilege('anon', 'public.copy_exercise(uuid, uuid)', 'execute'), 'anon no puede ejecutarla');
select ok(has_function_privilege('authenticated', 'public.copy_exercise(uuid, uuid)', 'execute'), 'authenticated sí');

select * from finish();
rollback;

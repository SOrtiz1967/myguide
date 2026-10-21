-- T004 (spec 005, FR-014 a FR-017, FR-022 a FR-025, FR-029, FR-030, FR-041): integridad del catálogo de ejercicios.
begin;
select plan(49);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin ejercicios (todo se deshace al final).
delete from public.exercises;

select tests.create_user('dueno@test.local') as uid \gset
select tests.create_user('otro@test.local') as uid2 \gset

insert into public.exercise_sources (slug, name, license_name, license_url, attribution, source_url)
values ('fuente-prueba', 'Fuente de prueba', 'CC0 1.0', 'https://ej.test/licencia', 'Atribucion', 'https://ej.test')
returning id as sid \gset

-- Atajo: inserta un ejercicio propio con las columnas que se indican, completando las obligatorias.
create function pg_temp.own(p_user uuid, p_extra_cols text default '', p_extra_vals text default '') returns void
language plpgsql as $$
begin
  execute format(
    'insert into public.exercises (origin, user_id, name, measurement_type%s) values (%L, %L, %L, %L%s)',
    case when p_extra_cols = '' then '' else ', ' || p_extra_cols end,
    'own', p_user, 'Ejercicio ' || gen_random_uuid(), 'reps_weight',
    case when p_extra_vals = '' then '' else ', ' || p_extra_vals end
  );
end
$$;

-- coherencia entre origen y propiedad ----------------------------------------------------------------------
select lives_ok(
  format($$ insert into public.exercises (origin, source_id, source_item_id, name, measurement_type, name_status)
            values ('imported', %L, 'A-1', 'Sentadilla con barra', 'reps_weight', 'machine_translated') $$, :'sid'),
  'FR-017: un ejercicio importado válido (sin dueño, con fuente e identificador)'
);
select throws_ilike(
  $$ insert into public.exercises (origin, user_id, name, measurement_type) values ('own', null, 'X', 'duration') $$,
  '%violates check constraint%', 'un ejercicio propio sin dueño se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, source_id, source_item_id, name, measurement_type)
            values ('imported', %L, %L, 'A-2', 'X', 'duration') $$, :'uid', :'sid'),
  '%violates check constraint%', 'un ejercicio importado con dueño se rechaza'
);
select throws_ilike(
  $$ insert into public.exercises (origin, name, measurement_type) values ('imported', 'X', 'duration') $$,
  '%violates check constraint%', 'un ejercicio importado sin fuente se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, source_id, name, measurement_type)
            values ('own', %L, %L, 'X', 'duration') $$, :'uid', :'sid'),
  '%violates check constraint%', 'un ejercicio propio con fuente se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, original_name)
            values ('own', %L, 'X', 'duration', 'Squat') $$, :'uid'),
  '%violates check constraint%', 'un ejercicio propio no tiene nombre original'
);

-- unicidad e idempotencia ----------------------------------------------------------------------------------
select throws_ilike(
  format($$ insert into public.exercises (origin, source_id, source_item_id, name, measurement_type)
            values ('imported', %L, 'A-1', 'Duplicado', 'duration') $$, :'sid'),
  '%duplicate key%', 'FR-032: (fuente, identificador de origen) es único'
);
select lives_ok(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, client_request_id)
            values ('own', %L, 'Mío', 'duration', '11111111-1111-1111-1111-111111111111') $$, :'uid'),
  'un ejercicio propio con clave de idempotencia'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, client_request_id)
            values ('own', %L, 'Mío otra vez', 'duration', '11111111-1111-1111-1111-111111111111') $$, :'uid'),
  '%duplicate key%', 'FR-029: la misma clave de idempotencia no crea otro ejercicio'
);
select lives_ok(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, client_request_id)
            values ('own', %L, 'De otro', 'duration', '11111111-1111-1111-1111-111111111111') $$, :'uid2'),
  'la misma clave en otra cuenta es independiente'
);

-- tipo de medición (FR-014) ---------------------------------------------------------------------------------
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type) values ('own', %L, 'X', 'sets') $$, :'uid'),
  '%violates check constraint%', 'FR-014: un tipo de medición inventado se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name) values ('own', %L, 'X') $$, :'uid'),
  '%null value%', 'FR-014: el tipo de medición es obligatorio'
);
select lives_ok(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type)
            select 'own', %L, 'Tipo ' || t, t from unnest(array['reps_weight', 'reps_bodyweight', 'duration', 'distance_duration']) t $$, :'uid'),
  'FR-014: los cuatro tipos de medición se aceptan'
);

-- estados de los textos ---------------------------------------------------------------------------------------
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, name_status) values ('own', %L, 'X', 'duration', 'dudoso') $$, :'uid'),
  '%violates check constraint%', 'un estado de nombre inventado se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, description, description_status) values ('own', %L, 'X', 'duration', 'texto', 'dudoso') $$, :'uid'),
  '%violates check constraint%', 'un estado de descripción inventado se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, description) values ('own', %L, 'X', 'duration', 'texto') $$, :'uid'),
  '%violates check constraint%', 'una descripción sin estado se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, description_status) values ('own', %L, 'X', 'duration', 'original') $$, :'uid'),
  '%violates check constraint%', 'un estado de descripción sin descripción se rechaza'
);

-- listas cerradas de músculos y equipamiento (FR-024) -------------------------------------------------------
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, primary_muscles) values ('own', %L, 'X', 'duration', array['pecho']) $$, :'uid'),
  '%violates check constraint%', 'FR-024: un músculo inventado se rechaza'
);
select lives_ok(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, primary_muscles)
            select 'own', %L, 'Músculo ' || m, 'duration', array[m]
            from unnest(array['abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
                              'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps', 'full_body']) m $$, :'uid'),
  'FR-024: los 18 músculos de la lista se aceptan'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, equipment) values ('own', %L, 'X', 'duration', 'pesas') $$, :'uid'),
  '%violates check constraint%', 'FR-024: un equipamiento inventado se rechaza'
);
select lives_ok(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, equipment)
            select 'own', %L, 'Equipo ' || e, 'duration', e
            from unnest(array['body only', 'barbell', 'dumbbell', 'cable', 'machine', 'e-z curl bar', 'kettlebells', 'bands',
                              'medicine ball', 'exercise ball', 'foam roll', 'other']) e $$, :'uid'),
  'FR-024: los 12 equipamientos de la lista se aceptan'
);
select lives_ok(
  format($$ select pg_temp.own(%L) $$, :'uid'),
  'un ejercicio sin músculos ni equipamiento es válido'
);
select is(
  (select primary_muscles from public.exercises where name = 'Tipo reps_weight'),
  '{}'::text[], 'sin músculos queda vacío (sin dato), nunca completado'
);
select is((select equipment from public.exercises where name = 'Tipo reps_weight'), null, 'sin equipamiento queda nulo (sin dato)');
select throws_ilike(
  format($$ select pg_temp.own(%L, 'primary_muscles', %L) $$, :'uid', $q$array['chest','lats','traps','neck','calves','biceps']$q$),
  '%violates check constraint%', 'más de 5 músculos principales se rechazan'
);
select throws_ilike(
  format($$ select pg_temp.own(%L, 'secondary_muscles', %L) $$, :'uid', $q$array['chest','lats','traps','neck','calves','biceps','triceps','glutes','forearms','abdominals','quadriceps']$q$),
  '%violates check constraint%', 'más de 10 músculos secundarios se rechazan'
);
select throws_ilike(
  format($$ select pg_temp.own(%L, 'primary_muscles, secondary_muscles', %L) $$, :'uid', $q$array['chest'], array['chest','triceps']$q$),
  '%violates check constraint%', 'un músculo no puede ser principal y secundario a la vez'
);

-- nombre, descripción y alias --------------------------------------------------------------------------------
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type) values ('own', %L, '', 'duration') $$, :'uid'),
  '%violates check constraint%', 'un nombre vacío se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type) values ('own', %L, ' con espacios ', 'duration') $$, :'uid'),
  '%violates check constraint%', 'un nombre con espacios en los extremos se rechaza'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type) values ('own', %L, repeat('a', 121), 'duration') $$, :'uid'),
  '%violates check constraint%', 'un nombre de más de 120 caracteres se rechaza'
);
select lives_ok(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, description, description_status)
            values ('own', %L, 'Descripción larga', 'duration', repeat('a', 4000), 'original') $$, :'uid'),
  'una descripción de 4.000 caracteres se acepta'
);
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type, description, description_status)
            values ('own', %L, 'Descripción enorme', 'duration', repeat('a', 4001), 'original') $$, :'uid'),
  '%violates check constraint%', 'una descripción de más de 4.000 caracteres se rechaza'
);
select lives_ok(
  format($$ select pg_temp.own(%L, 'aliases', %L) $$, :'uid', $q$(select array_agg('alias ' || g) from generate_series(1, 10) g)$q$),
  'hasta 10 alias se aceptan'
);
select throws_ilike(
  format($$ select pg_temp.own(%L, 'aliases', %L) $$, :'uid', $q$(select array_agg('alias ' || g) from generate_series(1, 11) g)$q$),
  '%violates check constraint%', 'más de 10 alias se rechazan'
);
select throws_ilike(
  format($$ select pg_temp.own(%L, 'aliases', %L) $$, :'uid', $q$array[repeat('a', 81)]$q$),
  '%violates check constraint%', 'un alias de más de 80 caracteres se rechaza'
);
select throws_ilike(
  format($$ select pg_temp.own(%L, 'aliases', %L) $$, :'uid', $q$array['']$q$),
  '%violates check constraint%', 'un alias vacío se rechaza'
);

-- campos de búsqueda (los calcula un disparador) ---------------------------------------------------------------
insert into public.exercises (origin, source_id, source_item_id, name, measurement_type, original_name, aliases)
values ('imported', :'sid', 'B-1', 'Elevación Lateral', 'reps_weight', 'Side Lateral Raise', array['Vuelos Laterales', 'Pájaros']);
select is(
  (select search_text from public.exercises where source_item_id = 'B-1'),
  'elevacion lateral side lateral raise vuelos laterales pajaros',
  'FR-013: search_text junta nombre, nombre original y alias, sin acentos y en minúsculas'
);
select is((select name_norm from public.exercises where source_item_id = 'B-1'), 'elevacion lateral', 'name_norm es solo el nombre, sin acentos');
update public.exercises set name = 'Elevación Frontal', aliases = array['Vuelos Frontales'] where source_item_id = 'B-1';
select is(
  (select search_text from public.exercises where source_item_id = 'B-1'),
  'elevacion frontal side lateral raise vuelos frontales',
  'al actualizar se recalculan los campos de búsqueda'
);

-- la identidad no cambia nunca -------------------------------------------------------------------------------
select throws_ilike(
  format($$ update public.exercises set user_id = %L where source_item_id = 'B-1' $$, :'uid'),
  '%exercise_identity_immutable%', 'no se puede cambiar el dueño'
);
select throws_ilike(
  $$ update public.exercises set source_item_id = 'otro' where source_item_id = 'B-1' $$,
  '%exercise_identity_immutable%', 'no se puede cambiar el identificador de origen'
);
select throws_ilike(
  $$ update public.exercises set origin = 'own' where source_item_id = 'B-1' $$,
  '%exercise_identity_immutable%', 'no se puede cambiar el origen'
);

-- copias: eliminar el original no borra la copia ---------------------------------------------------------------
select id as orig from public.exercises where source_item_id = 'A-1' \gset
insert into public.exercises (origin, user_id, name, measurement_type, based_on_exercise_id)
values ('own', :'uid', 'Mi versión', 'reps_weight', :'orig');
delete from public.exercises where id = :'orig';
select is(
  (select based_on_exercise_id from public.exercises where name = 'Mi versión'), null,
  'FR-026: eliminar el original deja la copia intacta, sin la referencia'
);
select is((select count(*) from public.exercises where name = 'Mi versión'), 1::bigint, 'y la copia sigue existiendo');

-- claves foráneas: eliminar un ejercicio nunca borra historial (FR-030, Principio II) -----------------------
select is(
  (select count(*) from pg_constraint
   where confrelid = 'public.exercises'::regclass and contype = 'f' and confdeltype = 'c'),
  0::bigint,
  'FR-030: ninguna clave foránea hacia exercises usa on delete cascade'
);

-- eliminar la cuenta borra sus ejercicios propios (FR-041) -------------------------------------------------------
select is((select count(*) from public.exercises where user_id = :'uid2'), 1::bigint, 'la otra cuenta tiene su ejercicio');
delete from auth.users where id = :'uid';
select is((select count(*) from public.exercises where user_id = :'uid'), 0::bigint, 'FR-041: eliminar la cuenta borra sus ejercicios propios');
select is((select count(*) from public.exercises where user_id = :'uid2'), 1::bigint, '...y deja intacto lo de otra cuenta');
select is((select count(*) from public.exercises where origin = 'imported' and source_item_id = 'B-1'), 1::bigint, '...y el catálogo importado');

select * from finish();
rollback;

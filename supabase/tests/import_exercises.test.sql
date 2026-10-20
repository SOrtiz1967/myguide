-- T035 (spec 005, FR-019, FR-031 a FR-035, SC-009): funciones de carga del catálogo de ejercicios (solo service_role).
begin;
select plan(44);

insert into public.exercise_sources (slug, name, license_name, license_url, attribution, source_url)
values ('carga-ej', 'Fuente de carga', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test'),
       ('carga-ej-2', 'Otra fuente', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');
select id as sid from public.exercise_sources where slug = 'carga-ej' \gset
select id as sid2 from public.exercise_sources where slug = 'carga-ej-2' \gset

select tests.create_user('a@test.local') as uid_a \gset

-- primera carga ---------------------------------------------------------------------------------------------------
select public.import_exercises('carga-ej', '[
  {"source_item_id":"X1","name":"Sentadilla con barra","name_status":"machine_translated","original_name":"Barbell Squat",
   "aliases":["Cuclillas con barra"],"measurement_type":"reps_weight","primary_muscles":["quadriceps"],
   "secondary_muscles":["glutes","hamstrings"],"equipment":"barbell",
   "description":"1. Apoya la barra.\n2. Baja.\n3. Sube.","description_status":"machine_translated"},
  {"source_item_id":"X2","name":"Plancha","name_status":"machine_translated","original_name":"Plank","aliases":[],
   "measurement_type":"duration","primary_muscles":["abdominals"],"secondary_muscles":[],"equipment":null,
   "description":null,"description_status":null},
  {"source_item_id":"X3","name":"Caminar","name_status":"original","original_name":null,"aliases":["Caminata"],
   "measurement_type":"distance_duration","primary_muscles":[],"secondary_muscles":[],"equipment":"body only",
   "description":"Caminata cómoda.","description_status":"original"}
]'::jsonb) as r1 \gset

select is((:'r1'::jsonb ->> 'created')::int, 3, 'FR-031: la primera carga crea los ejercicios');
select is((:'r1'::jsonb ->> 'skipped')::int, 0, 'no omite ninguno');
select is((select count(*) from public.exercises where source_id = :'sid'), 3::bigint, 'quedan tres ejercicios del catálogo');
select is(
  (select origin || ':' || coalesce(user_id::text, 'sin-dueno') from public.exercises where source_item_id = 'X1'),
  'imported:sin-dueno', 'son del catálogo y no tienen dueño'
);
select ok((select imported_at is not null from public.exercises where source_item_id = 'X1'), 'FR-017: registra la fecha de importación');
select is((select name_status from public.exercises where source_item_id = 'X1'), 'machine_translated', 'FR-020: conserva el estado del nombre');
select is((select original_name from public.exercises where source_item_id = 'X1'), 'Barbell Squat', 'FR-013: guarda el nombre original');
select is((select aliases from public.exercises where source_item_id = 'X1'), array['Cuclillas con barra'], 'y los alias');
select is((select equipment from public.exercises where source_item_id = 'X2'), null, 'FR-034: el equipamiento ausente queda null, no «peso corporal»');
select is((select description from public.exercises where source_item_id = 'X2'), null, 'una descripción ausente queda null...');
select is((select description_status from public.exercises where source_item_id = 'X2'), null, '...y sin estado');
select is((select primary_muscles from public.exercises where source_item_id = 'X3'), '{}'::text[], 'sin músculos queda vacío (sin dato)');
select is(
  (select search_text from public.exercises where source_item_id = 'X1'),
  'sentadilla con barra barbell squat cuclillas con barra', 'los campos de búsqueda se calculan al importar'
);

-- un ejercicio propio, una copia basada en un importado y otra fuente con el mismo identificador -----------------
select id as imported_id from public.exercises where source_item_id = 'X1' \gset
select tests.create_exercise(:'uid_a', 'Sentadilla con barra', 'reps_weight') as own_id \gset
insert into public.exercises (user_id, origin, name, measurement_type, based_on_exercise_id)
values (:'uid_a', 'own', 'Mi versión de sentadilla', 'reps_weight', :'imported_id');
select md5(string_agg(e::text, '|' order by e.id)) as own_fingerprint from public.exercises e where e.user_id = :'uid_a' \gset

-- repetir la carga, con datos cambiados (FR-032) -----------------------------------------------------------------
select public.import_exercises('carga-ej', '[
  {"source_item_id":"X1","name":"Sentadilla trasera","name_status":"machine_translated","original_name":"Barbell Squat",
   "aliases":["Cuclillas con barra"],"measurement_type":"reps_weight","primary_muscles":["quadriceps","glutes"],
   "secondary_muscles":["hamstrings"],"equipment":"barbell",
   "description":"1. Apoya la barra.\n2. Baja.","description_status":"machine_translated"},
  {"source_item_id":"X2","name":"Plancha","name_status":"machine_translated","original_name":"Plank","aliases":[],
   "measurement_type":"duration","primary_muscles":["abdominals"],"secondary_muscles":[],"equipment":null,
   "description":null,"description_status":null},
  {"source_item_id":"X3","name":"Caminar","name_status":"original","original_name":null,"aliases":["Caminata"],
   "measurement_type":"distance_duration","primary_muscles":[],"secondary_muscles":[],"equipment":"body only",
   "description":"Caminata cómoda.","description_status":"original"}
]'::jsonb) as r2 \gset

select is((:'r2'::jsonb ->> 'created')::int, 0, 'FR-032: repetir la carga no crea duplicados');
select is((:'r2'::jsonb ->> 'updated')::int, 3, 'actualiza los ejercicios existentes');
select is((select count(*) from public.exercises where source_id = :'sid'), 3::bigint, 'siguen siendo tres');
select is((select id from public.exercises where source_item_id = 'X1'), :'imported_id'::uuid, 'el ejercicio conserva su identificador estable');
select is((select name from public.exercises where source_item_id = 'X1'), 'Sentadilla trasera', 'se actualizó el nombre traducido sin revisar');
select is((select primary_muscles from public.exercises where source_item_id = 'X1'), array['quadriceps', 'glutes'], 'se actualizaron los músculos');
select is(
  (select search_text from public.exercises where source_item_id = 'X1'),
  'sentadilla trasera barbell squat cuclillas con barra', 'y los campos de búsqueda'
);

-- propios y copias no cambian (FR-033) -----------------------------------------------------------------------------
select is(
  (select md5(string_agg(e::text, '|' order by e.id)) from public.exercises e where e.user_id = :'uid_a'),
  :'own_fingerprint', 'FR-033: los ejercicios propios y las copias quedan idénticos'
);

-- lo revisado no se pisa (FR-021, SC-009) ---------------------------------------------------------------------------
update public.exercises
set name = 'Sentadilla revisada', name_status = 'reviewed', aliases = array['Alias revisado'],
    description = '1. Texto revisado.', description_status = 'reviewed'
where source_item_id = 'X1';
select public.import_exercises('carga-ej', '[
  {"source_item_id":"X1","name":"Otra traducción automática","name_status":"machine_translated","original_name":"Barbell Squat",
   "aliases":["Otro alias"],"measurement_type":"reps_bodyweight","primary_muscles":["chest"],
   "secondary_muscles":[],"equipment":"dumbbell",
   "description":"1. Texto automático nuevo.","description_status":"machine_translated"}
]'::jsonb);
select is((select name from public.exercises where source_item_id = 'X1'), 'Sentadilla revisada', 'FR-021: el nombre revisado no se pisa con uno automático');
select is((select name_status from public.exercises where source_item_id = 'X1'), 'reviewed', '...y sigue revisado');
select is((select aliases from public.exercises where source_item_id = 'X1'), array['Alias revisado'], '...también sus alias');
select is((select description from public.exercises where source_item_id = 'X1'), '1. Texto revisado.', '...y la descripción revisada');
select is((select measurement_type from public.exercises where source_item_id = 'X1'), 'reps_bodyweight', 'pero los datos de la fuente (tipo, músculos, equipamiento) sí se actualizan');
select is((select equipment from public.exercises where source_item_id = 'X1'), 'dumbbell', '...incluido el equipamiento');

select public.import_exercises('carga-ej', '[
  {"source_item_id":"X1","name":"Nueva revisión","name_status":"reviewed","original_name":"Barbell Squat",
   "aliases":[],"measurement_type":"reps_bodyweight","primary_muscles":["chest"],"secondary_muscles":[],"equipment":"dumbbell",
   "description":"1. Revisión nueva.","description_status":"reviewed"}
]'::jsonb);
select is((select name from public.exercises where source_item_id = 'X1'), 'Nueva revisión', 'una traducción revisada nueva sí reemplaza a la anterior');

-- --sin-descripcion (drop_descriptions) ------------------------------------------------------------------------------
select public.import_exercises('carga-ej', '[
  {"source_item_id":"X1","name":"Nueva revisión","name_status":"reviewed","original_name":"Barbell Squat",
   "aliases":[],"measurement_type":"reps_bodyweight","primary_muscles":["chest"],"secondary_muscles":[],"equipment":"dumbbell",
   "description":"1. No debería quedar.","description_status":"reviewed"}
]'::jsonb, true);
select is((select description from public.exercises where source_item_id = 'X1'), null, 'retirar las descripciones las quita, aunque estén revisadas');
select is((select description_status from public.exercises where source_item_id = 'X1'), null, '...y su estado');

-- registros inválidos se omiten con motivo y no detienen el resto -----------------------------------------------------
select public.import_exercises('carga-ej', format('[
  {"source_item_id":"B1","name":"","name_status":"original","aliases":[],"measurement_type":"duration","primary_muscles":[],"secondary_muscles":[],"equipment":null,"description":null,"description_status":null},
  {"source_item_id":"B2","name":"Tipo malo","name_status":"original","aliases":[],"measurement_type":"sets","primary_muscles":[],"secondary_muscles":[],"equipment":null,"description":null,"description_status":null},
  {"source_item_id":"B3","name":"Músculo malo","name_status":"original","aliases":[],"measurement_type":"duration","primary_muscles":["pecho"],"secondary_muscles":[],"equipment":null,"description":null,"description_status":null},
  {"source_item_id":"B4","name":"Equipo malo","name_status":"original","aliases":[],"measurement_type":"duration","primary_muscles":[],"secondary_muscles":[],"equipment":"pesas","description":null,"description_status":null},
  {"source_item_id":"B5","name":"Descripción enorme","name_status":"original","aliases":[],"measurement_type":"duration","primary_muscles":[],"secondary_muscles":[],"equipment":null,"description":"%s","description_status":"original"},
  {"source_item_id":"B6","name":"Bueno","name_status":"original","aliases":[],"measurement_type":"duration","primary_muscles":[],"secondary_muscles":[],"equipment":null,"description":null,"description_status":null}
]', repeat('a', 4001))::jsonb) as r3 \gset
select is((:'r3'::jsonb ->> 'skipped')::int, 5, 'cinco registros inválidos se omiten');
select is((:'r3'::jsonb ->> 'created')::int, 1, '...y el válido se carga igual');
select is(
  (select array_agg(key order by key) from jsonb_object_keys((:'r3'::jsonb) -> 'skipped_reasons') key),
  array['description_too_long', 'invalid_equipment', 'invalid_measurement', 'invalid_muscle', 'invalid_name'],
  'cada omisión trae su motivo'
);

-- otra fuente con el mismo identificador no se mezcla ---------------------------------------------------------------
select public.import_exercises('carga-ej-2', '[
  {"source_item_id":"X2","name":"Plancha de otra fuente","name_status":"original","aliases":[],"measurement_type":"duration",
   "primary_muscles":[],"secondary_muscles":[],"equipment":null,"description":null,"description_status":null}
]'::jsonb);
select is((select name from public.exercises where source_id = :'sid' and source_item_id = 'X2'), 'Plancha', 'el ejercicio de la primera fuente no cambia');
select is((select count(*) from public.exercises where source_item_id = 'X2'), 2::bigint, 'cada fuente tiene el suyo');

-- licencia (FR-019) y fuente inexistente -------------------------------------------------------------------------------
select throws_ilike($$ select public.import_exercises('no-existe', '[]'::jsonb) $$, '%source_not_found%', 'una fuente inexistente se rechaza');
alter table public.exercise_sources drop constraint exercise_sources_text_check;
update public.exercise_sources set attribution = '' where slug = 'carga-ej-2';
select throws_ilike(
  $$ select public.import_exercises('carga-ej-2', '[{"source_item_id":"Z","name":"Z","measurement_type":"duration"}]'::jsonb) $$,
  '%license_missing%', 'FR-019: una fuente sin licencia o atribución registradas se rechaza'
);

-- informe de la carga --------------------------------------------------------------------------------------------------
select public.finish_exercise_import('carga-ej', '{"created": 3, "updated": 2, "skipped": 1, "skipped_reasons": {"no_translation": 1}}'::jsonb) as run_id \gset
select is((select exercise_count from public.exercise_sources where slug = 'carga-ej'), 4, 'exercise_count cuenta los ejercicios importados de la fuente');
select ok((select last_imported_at is not null from public.exercise_sources where slug = 'carga-ej'), 'se registra la última importación');
select is(
  (select created_count || '/' || updated_count || '/' || skipped_count || '/' || (skipped_reasons ->> 'no_translation')
   from private.exercise_import_runs where id = :'run_id'),
  '3/2/1/1', 'el informe guarda creados, actualizados y omitidos con sus motivos'
);

-- permisos -------------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.import_exercises(text, jsonb, boolean)', 'execute'), 'anon no puede importar');
select ok(not has_function_privilege('authenticated', 'public.import_exercises(text, jsonb, boolean)', 'execute'), 'authenticated no puede importar');
select ok(has_function_privilege('service_role', 'public.import_exercises(text, jsonb, boolean)', 'execute'), 'service_role sí');
select ok(not has_function_privilege('authenticated', 'public.finish_exercise_import(text, jsonb)', 'execute'), 'authenticated no puede cerrar una carga');

select * from finish();
rollback;

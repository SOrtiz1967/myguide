-- T019 (spec 005, FR-001 a FR-005, FR-011 a FR-013): búsqueda de ejercicios.
begin;
select plan(36);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin ejercicios (todo se deshace al final).
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- propios
select tests.create_exercise(:'uid_a', 'Remo propio', 'reps_weight', array['lats'], 'cable', null);
select tests.create_exercise(:'uid_b', 'Secreto de B', 'duration', array['chest'], null, null);
-- 60 ejercicios propios de A para paginar
select tests.create_exercise(:'uid_a', 'Ejercicio ' || lpad(n::text, 2, '0'))
from generate_series(1, 60) n;

-- catálogo (fuente free-exercise-db, sembrada por la migración)
select tests.create_catalog_exercise('free-exercise-db', 'C-1', 'Sentadilla con barra', 'reps_weight', 'Barbell Squat',
  array['Cuclillas con barra'], array['quadriceps'], array['glutes', 'hamstrings'], 'barbell');
select tests.create_catalog_exercise('free-exercise-db', 'C-2', 'Sentadilla goblet', 'reps_weight', 'Goblet Squat',
  array['Sentadilla copa'], array['quadriceps'], array['glutes'], 'kettlebells');
select tests.create_catalog_exercise('free-exercise-db', 'C-3', 'Press de banca', 'reps_weight', 'Bench Press',
  array['Press plano'], array['chest'], array['shoulders', 'triceps'], 'barbell');
select tests.create_catalog_exercise('free-exercise-db', 'C-4', 'Elevación lateral', 'reps_weight', 'Side Lateral Raise',
  array['Vuelos laterales'], array['shoulders'], array[]::text[], 'dumbbell');
select tests.create_catalog_exercise('free-exercise-db', 'C-5', 'Plancha', 'duration', 'Plank', array[]::text[],
  array['abdominals'], array[]::text[], 'body only');
select tests.create_catalog_exercise('free-exercise-db', 'C-6', 'Sin datos', 'duration');
select tests.create_catalog_exercise('free-exercise-db', 'C-7', 'Press con mancuernas', 'reps_weight', 'Dumbbell Press',
  array[]::text[], array['chest'], array['triceps'], 'dumbbell');
select tests.create_catalog_exercise('free-exercise-db', 'C-8', 'Plancha lateral', 'duration', 'Side Plank',
  array[]::text[], array['abdominals'], array[]::text[], 'body only');
-- un ejercicio cuyo NOMBRE es el alias de otro (no se fusionan)
select tests.create_catalog_exercise('free-exercise-db', 'C-9', 'Cuclillas con barra', 'reps_weight', 'Back Squat Variation');
-- un ejercicio que solo coincide con "press" por un alias
select tests.create_catalog_exercise('free-exercise-db', 'C-10', 'Fondos', 'reps_bodyweight', 'Dips',
  array['Press de tríceps'], array['triceps'], array[]::text[], 'other');

select tests.authenticate_as(:'uid_a');

-- acentos, mayúsculas y coincidencias parciales (FR-002) --------------------------------------------------------
select is((select count(*) from public.search_exercises('elevacion lateral') where name = 'Elevación lateral'), 1::bigint, 'encuentra sin escribir la tilde');
select is((select count(*) from public.search_exercises('ELEVACIÓN LATERAL') where name = 'Elevación lateral'), 1::bigint, 'ignora mayúsculas y tildes en la consulta');
select is((select count(*) from public.search_exercises('elev lat') where name = 'Elevación lateral'), 1::bigint, 'coincidencias parciales de varias palabras');

-- nombre original y alias (FR-013) --------------------------------------------------------------------------------------
select is(
  (select name from public.search_exercises('barbell squat') where name = 'Sentadilla con barra'), 'Sentadilla con barra',
  'FR-013: encuentra por el nombre original en inglés y muestra el nombre en español'
);
select is((select count(*) from public.search_exercises('squat') where name in ('Sentadilla con barra', 'Sentadilla goblet')), 2::bigint, 'el nombre original coincide con varios ejercicios');
select is((select count(*) from public.search_exercises('vuelos laterales') where name = 'Elevación lateral'), 1::bigint, 'FR-013: encuentra por un alias');
select is(
  (select count(*) from public.search_exercises('cuclillas con barra') where name in ('Sentadilla con barra', 'Cuclillas con barra')), 2::bigint,
  'un alias que es el nombre de otro ejercicio no los fusiona: aparecen los dos'
);
select is(
  (select count(*) from public.search_exercises('cuclillas con barra') where name = 'Sentadilla con barra'), 1::bigint,
  'el ejercicio encontrado por alias se muestra con su nombre en español'
);

-- orden por relevancia (FR-003) -------------------------------------------------------------------------------------------
select is((select name from public.search_exercises('plancha') limit 1), 'Plancha', 'primero el nombre exacto');
select is((select name from public.search_exercises('plancha') offset 1 limit 1), 'Plancha lateral', 'después el que empieza con la consulta');
select is(
  (select name from (select name, row_number() over () rn from public.search_exercises('press')) r order by rn desc limit 1), 'Fondos',
  'lo que solo coincide por un alias va al final'
);

-- origen (FR-012) ----------------------------------------------------------------------------------------------------------
select is((select count(*) from public.search_exercises('sentadilla', 'catalog')), 2::bigint, 'scope catalog: solo el catálogo');
select is((select count(*) from public.search_exercises('sentadilla', 'own')), 0::bigint, 'scope own: no hay propios con ese nombre');
select is((select count(*) from public.search_exercises('remo', 'own') where origin = 'own'), 1::bigint, 'scope own: encuentra lo propio');
select is((select count(*) from public.search_exercises('remo', 'catalog')), 0::bigint, 'scope catalog: no incluye lo propio');
select is((select count(*) from public.search_exercises('secreto')), 0::bigint, 'FR-023: el ejercicio propio de B no aparece');

-- filtros por músculo y equipamiento (FR-005) ----------------------------------------------------------------------
select is(
  (select array_agg(name order by name) from public.search_exercises(null, 'catalog', 'quadriceps')),
  array['Sentadilla con barra', 'Sentadilla goblet'], 'músculo principal, sin texto'
);
select is(
  (select array_agg(name order by name) from public.search_exercises(null, 'catalog', 'glutes')),
  array['Sentadilla con barra', 'Sentadilla goblet'], 'FR-005: un músculo secundario también coincide'
);
select is(
  (select array_agg(name order by name) from public.search_exercises(null, 'catalog', 'shoulders')),
  array['Elevación lateral', 'Press de banca'], 'principal en uno y secundario en otro'
);
select is(
  (select array_agg(name order by name) from public.search_exercises(null, 'catalog', null, 'barbell')),
  array['Press de banca', 'Sentadilla con barra'], 'equipamiento, sin texto'
);
select is(
  (select array_agg(name) from public.search_exercises(null, 'catalog', 'chest', 'dumbbell')),
  array['Press con mancuernas'], 'músculo y equipamiento a la vez'
);
select is(
  (select array_agg(name) from public.search_exercises('press', 'all', 'chest', 'barbell')),
  array['Press de banca'], 'texto, músculo y equipamiento a la vez'
);
select is(
  (select array_agg(name) from public.search_exercises(null, 'own', 'lats')),
  array['Remo propio'], 'el filtro de músculo se combina con el origen'
);
select is((select count(*) from public.search_exercises(null, 'catalog', 'neck')), 0::bigint, 'un filtro sin coincidencias devuelve vacío');
select is((select count(*) from public.search_exercises('   ', 'catalog', 'quadriceps')), 2::bigint, 'un texto en blanco con filtro explora el catálogo');

-- errores ---------------------------------------------------------------------------------------------------------------------
select throws_ilike($$ select * from public.search_exercises() $$, '%query_required%', 'sin texto ni filtros no hay búsqueda');
select throws_ilike($$ select * from public.search_exercises('   ') $$, '%query_required%', 'un texto en blanco sin filtros tampoco');
select throws_ilike($$ select * from public.search_exercises('a') $$, '%query_too_short%', 'FR-011: un solo carácter se rechaza');
select throws_ilike($$ select * from public.search_exercises('a', 'all', 'chest') $$, '%query_too_short%', '...también con un filtro');
select throws_ilike($$ select * from public.search_exercises('plancha', 'todos') $$, '%invalid_scope%', 'un origen inválido se rechaza');
select throws_ilike($$ select * from public.search_exercises(null, 'all', 'pecho') $$, '%invalid_filter%', 'un músculo fuera de la lista se rechaza');
select throws_ilike($$ select * from public.search_exercises(null, 'all', null, 'pesas') $$, '%invalid_filter%', 'un equipamiento fuera de la lista se rechaza');
select is((select count(*) from public.search_exercises('%%')), 0::bigint, 'los comodines no se interpretan como patrón');

-- paginación y forma del resultado ---------------------------------------------------------------------------------------
select is(
  (select count(distinct id) from (
     select id from public.search_exercises('ejercicio', 'own', null, null, 20, 0)
     union all select id from public.search_exercises('ejercicio', 'own', null, null, 20, 20)
     union all select id from public.search_exercises('ejercicio', 'own', null, null, 20, 40)
   ) p),
  60::bigint, 'FR-003: tres tandas de 20 recorren los 60 ejercicios sin repetir'
);
select is((select count(*) from public.search_exercises('ejercicio', 'own', null, null, 100, 0)), 50::bigint, 'el tamaño de la tanda tiene tope de 50');
select is(
  (select source_name from public.search_exercises('plancha lateral') limit 1), 'free-exercise-db',
  'un ejercicio del catálogo trae el nombre de su fuente'
);

select * from finish();
rollback;

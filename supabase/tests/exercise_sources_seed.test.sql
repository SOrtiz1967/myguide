-- T009 (spec 005, FR-019, Principio X): las fuentes del catálogo de ejercicios traen licencia y atribución documentadas.
begin;
select plan(9);

select is((select count(*) from public.exercise_sources where slug in ('free-exercise-db', 'myguide-base')), 2::bigint, 'existen las dos fuentes de ejercicios');

select is((select license_name from public.exercise_sources where slug = 'free-exercise-db'), 'Unlicense', 'free-exercise-db: licencia Unlicense');
select is((select license_name from public.exercise_sources where slug = 'myguide-base'), 'CC0 1.0', 'myguide-base: licencia CC0 1.0');

select is(
  (select count(*) from public.exercise_sources
   where btrim(license_name) = '' or btrim(license_url) = '' or btrim(attribution) = '' or btrim(source_url) = ''),
  0::bigint,
  'FR-019: ninguna fuente tiene licencia, enlace, atribución o dirección vacíos'
);

select matches(
  (select attribution from public.exercise_sources where slug = 'free-exercise-db'),
  'free-exercise-db',
  'la atribución de free-exercise-db nombra a la fuente'
);
select matches(
  (select attribution from public.exercise_sources where slug = 'free-exercise-db'),
  'Unlicense',
  'la atribución de free-exercise-db menciona la licencia'
);
select is(
  (select source_version from public.exercise_sources where slug = 'free-exercise-db'),
  'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5',
  'free-exercise-db: queda registrada la versión fijada (commit)'
);
select matches(
  (select license_url from public.exercise_sources where slug = 'myguide-base'),
  '^https://creativecommons\.org/publicdomain/zero/1\.0/',
  'myguide-base: el enlace de la licencia es el de CC0 1.0'
);
select is(
  (select count(*) from public.exercise_sources where last_imported_at is null and exercise_count <> 0),
  0::bigint,
  'una fuente sin importar tiene 0 ejercicios'
);

select * from finish();
rollback;

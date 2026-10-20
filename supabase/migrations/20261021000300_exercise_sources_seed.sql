-- T010 (spec 005, FR-019, Principio X): fuentes del catálogo de ejercicios con licencia y atribución.
-- El texto debe coincidir con Documentacion/fuentes-datos.md. La carga rechaza una fuente sin estos datos.

insert into public.exercise_sources (slug, name, license_name, license_url, attribution, source_url, source_version)
values
  (
    'free-exercise-db',
    'free-exercise-db',
    'Unlicense',
    'https://unlicense.org/',
    'Datos de ejercicios de free-exercise-db (github.com/yuhonas/free-exercise-db), de dominio público (Unlicense). Los nombres y los pasos se tradujeron al español para MyGuide.',
    'https://github.com/yuhonas/free-exercise-db',
    'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
  ),
  (
    'myguide-base',
    'MyGuide, ejercicios base',
    'CC0 1.0',
    'https://creativecommons.org/publicdomain/zero/1.0/',
    'Ejercicios de resistencia, deporte y movilidad escritos para MyGuide, dedicados al dominio público (CC0 1.0).',
    'https://github.com/SOrtiz1967/myguide',
    null
  );

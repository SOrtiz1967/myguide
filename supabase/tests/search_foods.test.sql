-- T019 (spec 002, FR-001 a FR-004, FR-032, FR-033): búsqueda de alimentos.
begin;
select plan(31);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('busqueda-prueba', 'Fuente de búsqueda', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');

-- propios de A
select tests.create_food(:'uid_a', 'Leche', null, 60);
select tests.create_food(:'uid_a', 'Postre', 'La Lechera', 120);
-- propio de B
select tests.create_food(:'uid_b', 'Leche de B secreta', null, 70);
-- catálogo
select tests.create_catalog_food('busqueda-prueba', 'C-1', 'Leche descremada', 'SanCor', 35);
select tests.create_catalog_food('busqueda-prueba', 'C-2', 'Yogur con leche', null, 70);
select tests.create_catalog_food('busqueda-prueba', 'C-3', 'Dulce de Leche', 'La Serenísima', 300);
select tests.create_catalog_food('busqueda-prueba', 'C-4', 'Café', null, 2);
select tests.create_catalog_food('busqueda-prueba', 'C-5', 'Arroz xx', null, 130);
select tests.create_catalog_food('busqueda-prueba', 'C-6', 'Arroz yy', null, 130, '100g', 2.7, 28, 0.3);
select tests.create_catalog_food('busqueda-prueba', 'C-7', 'Sin energía', null, null);
-- 60 alimentos propios de A para paginar
select tests.create_food(:'uid_a', 'Pan ' || lpad(n::text, 2, '0'), null, 250)
from generate_series(1, 60) n;

select tests.authenticate_as(:'uid_a');

-- acentos, mayúsculas y coincidencias parciales (FR-002)
select is((select count(*) from public.search_foods('dulce de leche') where name = 'Dulce de Leche'), 1::bigint, 'ignora mayúsculas y minúsculas');
select is((select count(*) from public.search_foods('DULCE DE LECHE') where name = 'Dulce de Leche'), 1::bigint, 'ignora mayúsculas en la consulta');
select is((select count(*) from public.search_foods('dulce de léche') where name = 'Dulce de Leche'), 1::bigint, 'ignora acentos en la consulta');
select is((select count(*) from public.search_foods('cafe') where name = 'Café'), 1::bigint, 'encuentra "Café" sin escribir la tilde');
select is((select count(*) from public.search_foods('café') where name = 'Café'), 1::bigint, 'y también con la tilde');
select is((select count(*) from public.search_foods('serenisima') where name = 'Dulce de Leche'), 1::bigint, 'busca también por marca');
select is((select count(*) from public.search_foods('dulc lec') where name = 'Dulce de Leche'), 1::bigint, 'coincidencias parciales de varias palabras');
select is((select count(*) from public.search_foods('dulce flan')), 0::bigint, 'todas las palabras deben coincidir');

-- orden por relevancia (FR-003)
select is(
  (array(select name from public.search_foods('leche')))[1:2],
  array['Leche', 'Leche descremada'],
  'primero el nombre exacto y luego el que empieza con lo buscado'
);
select is(
  (array(select name from public.search_foods('leche')))[5],
  'Postre',
  'lo que solo coincide por la marca va después de los nombres'
);
select is(
  (array(select name from public.search_foods('arroz')))[1],
  'Arroz yy',
  'a igual relevancia, primero el más completo'
);

-- filtro de origen (FR-033)
select is((select count(*) from public.search_foods('leche', 'catalog') where origin <> 'imported'), 0::bigint, 'scope catalog solo devuelve el catálogo');
select ok((select count(*) from public.search_foods('leche', 'catalog')) > 0, 'scope catalog encuentra alimentos');
select is((select count(*) from public.search_foods('leche', 'own') where origin <> 'own'), 0::bigint, 'scope own solo devuelve alimentos propios');
select is((select count(*) from public.search_foods('leche', 'own')), 2::bigint, 'scope own devuelve los propios de A');
select is((select count(*) from public.search_foods('leche', 'all')), 5::bigint, 'scope all devuelve catálogo y propios (sin los de B)');

-- privacidad
select is((select count(*) from public.search_foods('secreta')), 0::bigint, 'FR-016: A no encuentra los alimentos de B');

-- validaciones (FR-032)
select throws_ilike($$ select * from public.search_foods('a') $$, '%query_too_short%', 'una letra: query_too_short');
select throws_ilike($$ select * from public.search_foods('  a  ') $$, '%query_too_short%', 'se recorta antes de contar los caracteres');
select throws_ilike($$ select * from public.search_foods('leche', 'todos') $$, '%invalid_scope%', 'scope inválido: invalid_scope');

-- paginación
select is((select count(*) from public.search_foods('pan')), 20::bigint, 'la tanda por defecto es de 20');
select is((select count(*) from public.search_foods('pan', 'all', 1000)), 50::bigint, 'el máximo de una tanda es 50');
select is(
  (select count(distinct id) from (
    select id from public.search_foods('pan', 'all', 10, 0)
    union all
    select id from public.search_foods('pan', 'all', 10, 10)
  ) t),
  20::bigint,
  'dos tandas seguidas no repiten ni saltean alimentos'
);
select is((select count(*) from public.search_foods('pan', 'all', 50, 55)), 5::bigint, 'la última tanda trae el resto');

-- sin coincidencias, comodines y faltantes
select is((select count(*) from public.search_foods('xyzzy')), 0::bigint, 'sin coincidencias devuelve vacío');
select is((select count(*) from public.search_foods('%%')), 0::bigint, 'los comodines no se interpretan');
select is((select count(*) from public.search_foods('p_n')), 0::bigint, 'el guion bajo no actúa como comodín');
select is((select energy_kcal from public.search_foods('sin energia')), null, 'FR-006: un valor faltante llega null, no 0');

-- procedencia en el resultado (FR-011)
select is(
  (select source_name from public.search_foods('dulce de leche') where name = 'Dulce de Leche'),
  'Fuente de búsqueda',
  'un alimento del catálogo informa su fuente'
);
select tests.clear_authentication();

-- cuentas sin acceso
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.search_foods('leche')), 0::bigint, 'FR-003 (spec 001): con la sesión vencida no devuelve nada');
select tests.clear_authentication();
select tests.authenticate_as_anon();
select throws_ilike($$ select * from public.search_foods('leche') $$, 'permission denied%', 'una petición anónima no puede buscar');
select tests.clear_authentication();

select * from finish();
rollback;

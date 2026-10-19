-- T011 (spec 002, FR-013, Principio X): las fuentes del catálogo traen licencia y atribución documentadas.
begin;
select plan(8);

-- La base local puede tener cargas hechas: se parte de fuentes sin importar (todo se deshace al final).
update public.food_sources set last_imported_at = null, food_count = 0;

select is((select count(*) from public.food_sources where slug in ('open-food-facts', 'usda-fdc')), 2::bigint, 'existen las dos fuentes del catálogo');

select is((select license_name from public.food_sources where slug = 'open-food-facts'), 'ODbL 1.0', 'Open Food Facts: licencia ODbL 1.0');
select is((select license_name from public.food_sources where slug = 'usda-fdc'), 'CC0 1.0', 'USDA: licencia CC0 1.0');

select is(
  (select count(*) from public.food_sources
   where btrim(license_name) = '' or btrim(license_url) = '' or btrim(attribution) = '' or btrim(source_url) = ''),
  0::bigint,
  'FR-013: ninguna fuente tiene licencia, enlace, atribución o dirección vacíos'
);

select matches(
  (select attribution from public.food_sources where slug = 'open-food-facts'),
  'Open Food Facts',
  'la atribución de Open Food Facts nombra a Open Food Facts'
);
select matches(
  (select attribution from public.food_sources where slug = 'open-food-facts'),
  'ODbL',
  'la atribución de Open Food Facts menciona la licencia'
);
select matches(
  (select license_url from public.food_sources where slug = 'open-food-facts'),
  '^https://',
  'el enlace de la licencia es seguro (https)'
);
select is(
  (select count(*) from public.food_sources where last_imported_at is not null or food_count <> 0),
  0::bigint,
  'antes de cualquier carga no hay fecha de importación ni alimentos contados'
);

select * from finish();
rollback;

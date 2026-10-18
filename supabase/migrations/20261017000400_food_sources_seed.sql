-- T012 (spec 002, FR-013, Principio X): fuentes del catalogo con licencia y atribucion.
-- El texto debe coincidir con Documentacion/fuentes-datos.md. La carga rechaza una fuente sin estos datos.

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values
  (
    'open-food-facts',
    'Open Food Facts',
    'ODbL 1.0',
    'https://opendatacommons.org/licenses/odbl/1-0/',
    'Datos de productos de Open Food Facts (openfoodfacts.org), disponibles bajo la licencia ODbL 1.0. Los contenidos individuales están bajo la DbCL 1.0.',
    'https://world.openfoodfacts.org'
  ),
  (
    'usda-fdc',
    'USDA FoodData Central',
    'CC0 1.0',
    'https://creativecommons.org/publicdomain/zero/1.0/',
    'Datos de composición de alimentos de USDA FoodData Central (fdc.nal.usda.gov), de dominio público (CC0 1.0).',
    'https://fdc.nal.usda.gov'
  );

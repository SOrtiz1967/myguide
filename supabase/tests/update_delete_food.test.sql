-- T059 (spec 002, FR-015, FR-021, FR-022, FR-024): editar y eliminar alimentos propios.
begin;
select plan(23);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin alimentos.
delete from public.foods;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('edicion-prueba', 'Fuente de edición', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');

select tests.create_catalog_food('edicion-prueba', 'E-1', 'Catalogo intocable', null, 100) as cat_id \gset
select tests.create_catalog_food('edicion-prueba', 'E-2', 'Catalogo sin energia', null, null) as noenergy_id \gset
select tests.create_food(:'uid_a', 'Mi alimento', 'Marca vieja', 200, '100g', 5, 20, 3) as own_id \gset
insert into public.food_portions (food_id, name, quantity, position) values
  (:'own_id', 'porcion vieja 1', 10, 0), (:'own_id', 'porcion vieja 2', 20, 1);
select tests.create_food(:'uid_b', 'Alimento de B', null, 50) as other_id \gset

select tests.authenticate_as(:'uid_a');

-- editar ------------------------------------------------------------------------------------------------
select is(
  public.update_food(
    :'own_id',
    '{"name":"  Nombre nuevo ","brand":"","reference_basis":"100ml","energy_kcal":150,"protein_g":6,"carbs_g":null,"fat_g":2}'::jsonb,
    '[{"name":"nueva","quantity":33}]'::jsonb
  ),
  :'own_id'::uuid,
  'FR-021: update_food devuelve el alimento editado'
);
select is((select name from public.foods where id = :'own_id'), 'Nombre nuevo', 'cambia el nombre (recortado)');
select is((select brand from public.foods where id = :'own_id'), null, 'una marca vacía queda sin marca');
select is((select reference_basis || ':' || energy_kcal || ':' || protein_g from public.foods where id = :'own_id'), '100ml:150.00:6.00', 'cambia la base y los valores');
select is((select carbs_g from public.foods where id = :'own_id'), null, 'un valor borrado queda sin dato (null, no 0)');
select is(
  (select string_agg(name, ',' order by position) from public.food_portions where food_id = :'own_id'),
  'nueva',
  'reemplaza las porciones por las nuevas'
);

-- validación, igual que al crear, y atomicidad ------------------------------------------------------------------
select throws_ilike(
  format($$ select public.update_food(%L, '{"name":"X","reference_basis":"100g","energy_kcal":10,"protein_g":-1}'::jsonb, '[]'::jsonb) $$, :'own_id'),
  '%negative_value%', 'un valor negativo se rechaza'
);
select throws_ilike(
  format($$ select public.update_food(%L, '{"name":"Cambio parcial","reference_basis":"100g","energy_kcal":10}'::jsonb, '[{"name":"mala","quantity":0}]'::jsonb) $$, :'own_id'),
  '%invalid_portion%', 'una porción inválida se rechaza'
);
select is((select name from public.foods where id = :'own_id'), 'Nombre nuevo', 'un rechazo no deja el alimento a medias');
select is((select count(*) from public.food_portions where food_id = :'own_id'), 1::bigint, 'ni pierde sus porciones');

-- no se puede editar lo que no es propio (FR-022) ---------------------------------------------------------------------
select throws_ilike(
  format($$ select public.update_food(%L, '{"name":"Hackeado","reference_basis":"100g","energy_kcal":1}'::jsonb, '[]'::jsonb) $$, :'cat_id'),
  '%not_found%', 'FR-022: un alimento del catálogo no se puede editar'
);
select throws_ilike(
  format($$ select public.update_food(%L, '{"name":"Hackeado","reference_basis":"100g","energy_kcal":1}'::jsonb, '[]'::jsonb) $$, :'other_id'),
  '%not_found%', 'FR-016: el alimento de otra cuenta se comporta como inexistente'
);

-- la identidad no se cambia desde el cliente
select public.update_food(:'own_id', '{"name":"Sigue propio","reference_basis":"100g","energy_kcal":10,"origin":"imported"}'::jsonb, '[]'::jsonb);
select is((select origin from public.foods where id = :'own_id'), 'own', 'no se puede convertir un alimento propio en del catálogo');

-- una copia sin energía exige completarla para guardar -----------------------------------------------------------------
select public.copy_food(:'noenergy_id', gen_random_uuid()) as copy_id \gset
select throws_ilike(
  format($$ select public.update_food(%L, '{"name":"Copia","reference_basis":"100g"}'::jsonb, '[]'::jsonb) $$, :'copy_id'),
  '%energy_required%', 'guardar la copia sin energía se rechaza hasta completarla'
);
select lives_ok(
  format($$ select public.update_food(%L, '{"name":"Copia completa","reference_basis":"100g","energy_kcal":90}'::jsonb, '[]'::jsonb) $$, :'copy_id'),
  'con la energía completa se guarda'
);

-- eliminar (FR-021, FR-024) --------------------------------------------------------------------------------------------
select public.copy_food(:'own_id', gen_random_uuid()) as copy_of_own \gset
select lives_ok(format($$ delete from public.foods where id = %L $$, :'cat_id'), 'el intento de eliminar el catálogo no falla...');
select is((select count(*) from public.foods where id = :'cat_id'), 1::bigint, 'FR-022: ...pero no elimina nada');
select lives_ok(format($$ delete from public.foods where id = %L $$, :'other_id'), 'el intento de eliminar lo de otra cuenta no falla...');
select tests.clear_authentication();
select is((select count(*) from public.foods where id = :'other_id'), 1::bigint, '...y tampoco elimina nada');

select tests.authenticate_as(:'uid_a');
delete from public.foods where id = :'own_id';
select is((select count(*) from public.foods where id = :'own_id'), 0::bigint, 'FR-021: elimina el alimento propio');
select is((select count(*) from public.food_portions where food_id = :'own_id'), 0::bigint, 'y también sus porciones');
select is(
  (select coalesce(based_on_food_id::text, 'sin-original') || ':' || energy_kcal from public.foods where id = :'copy_of_own'),
  'sin-original:10.00',
  'FR-024: la copia que se basaba en él conserva sus valores'
);
select tests.clear_authentication();

select tests.authenticate_as_anon();
select throws_ilike($$ select public.update_food(gen_random_uuid(), '{}'::jsonb, '[]'::jsonb) $$, 'permission denied%', 'una petición anónima no puede editar');
select tests.clear_authentication();

select * from finish();
rollback;

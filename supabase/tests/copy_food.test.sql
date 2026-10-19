-- T054 (spec 002, FR-020, FR-024, FR-027): crear una copia propia y editable de un alimento visible.
begin;
select plan(23);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin alimentos.
delete from public.foods;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('copia-prueba', 'Fuente de copia', 'CC0 1.0', 'https://ej.test/l', 'Atribución', 'https://ej.test');

select tests.create_catalog_food('copia-prueba', 'K-1', 'Catalogo original', 'Marca', 120, '100g', 5, 20, 2) as cat_id \gset
insert into public.food_portions (food_id, name, quantity, position) values
  (:'cat_id', '1 taza', 150, 0), (:'cat_id', '1 cucharada', 12, 1);
select tests.create_catalog_food('copia-prueba', 'K-2', 'Catalogo sin energia', null, null, '100ml') as noenergy_id \gset
select tests.create_food(:'uid_a', 'Propio de A', null, 80, '100g', 3, 10, 1) as own_id \gset
insert into public.food_portions (food_id, name, quantity, position) values (:'own_id', 'unidad', 30, 0);
select tests.create_food(:'uid_b', 'Propio de B', null, 90) as other_id \gset

select tests.authenticate_as(:'uid_a');

-- copia de un alimento del catálogo ------------------------------------------------------------------
select public.copy_food(:'cat_id', 'cccccccc-0000-0000-0000-000000000001') as copy_id \gset

select is((select origin from public.foods where id = :'copy_id'), 'own', 'FR-020: la copia es un alimento propio');
select is((select user_id from public.foods where id = :'copy_id'), :'uid_a'::uuid, 'pertenece a quien la creó');
select is((select based_on_food_id from public.foods where id = :'copy_id'), :'cat_id'::uuid, 'dice de qué alimento se basa');
select is(
  (select name || '|' || brand || '|' || energy_kcal || '|' || protein_g || '|' || carbs_g || '|' || fat_g || '|' || reference_basis from public.foods where id = :'copy_id'),
  'Catalogo original|Marca|120.00|5.00|20.00|2.00|100g',
  'la copia tiene los mismos datos que el original'
);
select is((select fiber_g from public.foods where id = :'copy_id'), null, 'un valor que faltaba sigue faltando (null, no 0)');
select is((select count(*) from public.food_portions where food_id = :'copy_id'), 2::bigint, 'copia también las porciones');
select is(
  (select string_agg(name || ':' || quantity, ',' order by position) from public.food_portions where food_id = :'copy_id'),
  '1 taza:150.00,1 cucharada:12.00',
  'las porciones conservan nombre, cantidad y orden'
);
select is((select source_id from public.foods where id = :'copy_id'), null, 'la copia no tiene fuente: no es del catálogo');

-- el original no cambia (FR-020) -----------------------------------------------------------------------
select is((select origin || ':' || energy_kcal from public.foods where id = :'cat_id'), 'imported:120.00', 'el original sigue intacto');
select is((select count(*) from public.food_portions where food_id = :'cat_id'), 2::bigint, 'y conserva sus porciones');

-- idempotencia e independencia -----------------------------------------------------------------------------
select is(public.copy_food(:'cat_id', 'cccccccc-0000-0000-0000-000000000001'), :'copy_id'::uuid, 'FR-023: repetir el request_id devuelve la misma copia');
select is((select count(*) from public.foods where based_on_food_id = :'cat_id'), 1::bigint, 'no se crea una segunda copia');
select public.copy_food(:'cat_id', 'cccccccc-0000-0000-0000-000000000002') as copy2_id \gset
select isnt(:'copy2_id'::uuid, :'copy_id'::uuid, 'otro request_id crea otra copia');
update public.foods set energy_kcal = 130 where id = :'copy_id';
select is((select energy_kcal from public.foods where id = :'copy2_id'), 120.00, 'las dos copias son independientes');
select is((select energy_kcal from public.foods where id = :'cat_id'), 120.00, 'editar la copia no toca el original');

-- copia de un alimento propio y de uno sin energía -----------------------------------------------------------
select public.copy_food(:'own_id', gen_random_uuid()) as own_copy_id \gset
select is((select based_on_food_id from public.foods where id = :'own_copy_id'), :'own_id'::uuid, 'también se puede copiar un alimento propio');
select public.copy_food(:'noenergy_id', gen_random_uuid()) as noenergy_copy_id \gset
select is((select energy_kcal from public.foods where id = :'noenergy_copy_id'), null, 'copiar un alimento sin energía crea la copia, fiel al original');

-- lo ajeno no se puede copiar ------------------------------------------------------------------------------------
select throws_ilike(
  format($$ select public.copy_food(%L, gen_random_uuid()) $$, :'other_id'),
  '%not_found%', 'no se puede copiar el alimento propio de otra cuenta'
);
select throws_ilike(
  $$ select public.copy_food(gen_random_uuid(), gen_random_uuid()) $$,
  '%not_found%', 'un alimento inexistente da not_found'
);
select tests.clear_authentication();

-- una nueva importación o la baja del original no alteran la copia (FR-027, FR-024) ----------------------------------
update public.foods set energy_kcal = 500, name = 'Original actualizado' where id = :'cat_id';
select is((select energy_kcal from public.foods where id = :'copy2_id'), 120.00, 'FR-027: si el original cambia, la copia conserva sus valores');
delete from public.foods where id = :'cat_id';
select is(
  (select coalesce(based_on_food_id::text, 'sin-original') || ':' || energy_kcal from public.foods where id = :'copy2_id'),
  'sin-original:120.00',
  'FR-024: si el original desaparece, la copia sigue con sus valores'
);

-- otra cuenta y acceso anónimo -----------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.foods where based_on_food_id is not null or name = 'Catalogo original'), 0::bigint, 'otra cuenta no ve las copias de A');
select tests.clear_authentication();
select tests.authenticate_as_anon();
select throws_ilike($$ select public.copy_food(gen_random_uuid(), gen_random_uuid()) $$, 'permission denied%', 'una petición anónima no puede copiar');
select tests.clear_authentication();

select * from finish();
rollback;

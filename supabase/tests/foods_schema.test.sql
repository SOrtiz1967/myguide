-- T007 (spec 002): integridad del esquema de alimentos, aplicada en la base de datos.
begin;
select plan(38);

select tests.create_user('dueno@test.local') as uid \gset
select tests.create_user('otro@test.local') as uid2 \gset

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('fuente-prueba', 'Fuente de prueba', 'CC0 1.0', 'https://ej.test/licencia', 'Atribucion', 'https://ej.test')
returning id as sid \gset

-- coherencia entre origen y propiedad ----------------------------------------------------------
select lives_ok(
  format($$ insert into public.foods (origin, source_id, source_item_id, name, reference_basis, energy_kcal)
            values ('imported', %L, 'A-1', 'Leche entera', '100ml', 62) $$, :'sid'),
  'FR-011: un alimento importado valido (sin dueño, con fuente e identificador)'
);
select throws_ilike(
  format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', null, 'X', '100g', 10) $$),
  '%violates check constraint%', 'un alimento propio sin dueño se rechaza'
);
select throws_ilike(
  format($$ insert into public.foods (origin, user_id, source_id, source_item_id, name, reference_basis, energy_kcal)
            values ('imported', %L, %L, 'A-2', 'X', '100g', 10) $$, :'uid', :'sid'),
  '%violates check constraint%', 'un alimento importado con dueño se rechaza'
);
select throws_ilike(
  $$ insert into public.foods (origin, name, reference_basis, energy_kcal) values ('imported', 'X', '100g', 10) $$,
  '%violates check constraint%', 'un alimento importado sin fuente se rechaza'
);
select throws_ilike(
  format($$ insert into public.foods (origin, user_id, source_id, name, reference_basis, energy_kcal)
            values ('own', %L, %L, 'X', '100g', 10) $$, :'uid', :'sid'),
  '%violates check constraint%', 'un alimento propio con fuente se rechaza'
);

-- unicidad e idempotencia -------------------------------------------------------------------------
select throws_ilike(
  format($$ insert into public.foods (origin, source_id, source_item_id, name, reference_basis, energy_kcal)
            values ('imported', %L, 'A-1', 'Duplicado', '100ml', 62) $$, :'sid'),
  '%duplicate key%', 'FR-026: (fuente, identificador de origen) es unico'
);
select lives_ok(
  format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, client_request_id)
            values ('own', %L, 'Mio', '100g', 100, '11111111-1111-1111-1111-111111111111') $$, :'uid'),
  'un alimento propio con clave de idempotencia'
);
select throws_ilike(
  format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, client_request_id)
            values ('own', %L, 'Mio otra vez', '100g', 100, '11111111-1111-1111-1111-111111111111') $$, :'uid'),
  '%duplicate key%', 'FR-023: la misma clave de idempotencia no crea otro alimento'
);
select lives_ok(
  format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, client_request_id)
            values ('own', %L, 'De otro', '100g', 100, '11111111-1111-1111-1111-111111111111') $$, :'uid2'),
  'la misma clave en otra cuenta es independiente'
);
select lives_ok(
  format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, 'Sin clave 1', '100g', 1), ('own', %L, 'Sin clave 2', '100g', 1) $$, :'uid', :'uid'),
  'sin clave de idempotencia se pueden crear varios'
);

-- rangos y coherencia de nutrientes ---------------------------------------------------------------
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, 'R', '100g', 900.01) $$, :'uid'), '%violates check constraint%', 'FR-017: energía mayor a 900 kcal por 100 se rechaza');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, 'R', '100g', -1) $$, :'uid'), '%violates check constraint%', 'FR-017: energía negativa se rechaza');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, protein_g) values ('own', %L, 'R', '100g', 10, 100.01) $$, :'uid'), '%violates check constraint%', 'FR-017: más de 100 g de un nutriente por 100 se rechaza');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, sodium_mg) values ('own', %L, 'R', '100g', 10, 40000.01) $$, :'uid'), '%violates check constraint%', 'FR-017: sodio mayor a 40.000 mg se rechaza');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, protein_g, carbs_g, fat_g) values ('own', %L, 'R', '100g', 10, 50, 40, 10.01) $$, :'uid'), '%violates check constraint%', 'FR-017: proteínas + carbohidratos + grasas mayor a 100 se rechaza');
select lives_ok(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, protein_g, carbs_g, fat_g) values ('own', %L, 'Justo 100', '100g', 10, 50, 40, 10) $$, :'uid'), 'FR-017: la suma exacta de 100 g se acepta');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, carbs_g, sugars_g) values ('own', %L, 'R', '100g', 10, 10, 10.5) $$, :'uid'), '%violates check constraint%', 'FR-017: azúcares mayores que carbohidratos se rechaza');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, fat_g, saturated_fat_g) values ('own', %L, 'R', '100g', 10, 5, 5.5) $$, :'uid'), '%violates check constraint%', 'FR-017: saturadas mayores que grasas se rechaza');

-- nombre y base de referencia ------------------------------------------------------------------------
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, '', '100g', 10) $$, :'uid'), '%violates check constraint%', 'un nombre vacío se rechaza');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, repeat('a', 201), '100g', 10) $$, :'uid'), '%violates check constraint%', 'un nombre de más de 200 caracteres se rechaza');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, ' con espacios ', '100g', 10) $$, :'uid'), '%violates check constraint%', 'un nombre con espacios en los extremos se rechaza');
select throws_ilike(format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, 'Base mala', '1kg', 10) $$, :'uid'), '%violates check constraint%', 'la base de referencia solo puede ser 100g o 100ml');

-- identidad inmutable ------------------------------------------------------------------------------------
select throws_ilike(format($$ update public.foods set origin = 'imported' where name = 'Mio' and user_id = %L $$, :'uid'), '%food_identity_immutable%', 'no se puede cambiar el origen');
select throws_ilike(format($$ update public.foods set user_id = %L where name = 'Mio' and user_id = %L $$, :'uid2', :'uid'), '%food_identity_immutable%', 'no se puede cambiar el dueño');
select throws_ilike(format($$ update public.foods set source_item_id = 'otro' where source_item_id = 'A-1' $$), '%food_identity_immutable%', 'no se puede cambiar el identificador de origen');
select lives_ok(format($$ update public.foods set name = 'Mío editado', energy_kcal = 101 where name = 'Mio' and user_id = %L $$, :'uid'), 'sí se pueden editar nombre y nutrientes');

-- texto de búsqueda y completitud ---------------------------------------------------------------------
insert into public.foods (origin, user_id, name, brand, reference_basis, energy_kcal)
values ('own', :'uid', 'Leche ENTERA', 'La Serenísima', '100ml', 62);
select is((select search_text from public.foods where name = 'Leche ENTERA'), 'leche entera la serenisima', 'FR-002: el texto de búsqueda no tiene acentos ni mayúsculas');
select is((select name_norm from public.foods where name = 'Leche ENTERA'), 'leche entera', 'el nombre normalizado no tiene acentos ni mayúsculas');
select is((select completeness from public.foods where name = 'Leche ENTERA'), 1::smallint, 'completeness cuenta solo la energía informada');
insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg)
values ('own', :'uid', 'Completo', '100g', 100, 5, 10, 2, 3, 1, 2, 300);
select is((select completeness from public.foods where name = 'Completo'), 8::smallint, 'completeness es 8 con todos los nutrientes');
select is((select protein_g from public.foods where name = 'Leche ENTERA'), null, 'FR-006: un nutriente que no se informó queda null, nunca 0');

-- porciones --------------------------------------------------------------------------------------------------
select id as fid from public.foods where name = 'Completo' \gset
select lives_ok(format($$ insert into public.food_portions (food_id, name, quantity, position) values (%L, '1 vaso', 200, 0) $$, :'fid'), 'una porción válida');
select is((select user_id from public.food_portions where name = '1 vaso'), :'uid'::uuid, 'la porción hereda el dueño del alimento');
select throws_ilike(format($$ insert into public.food_portions (food_id, name, quantity) values (%L, 'cero', 0) $$, :'fid'), '%violates check constraint%', 'una cantidad 0 se rechaza');
select throws_ilike(format($$ insert into public.food_portions (food_id, name, quantity) values (%L, 'enorme', 5000.01) $$, :'fid'), '%violates check constraint%', 'una cantidad mayor a 5000 se rechaza');
select throws_ilike(format($$ insert into public.food_portions (food_id, name, quantity) values (%L, '1 vaso', 100) $$, :'fid'), '%duplicate key%', 'dos porciones con el mismo nombre se rechazan');
select throws_ilike(
  format($$ insert into public.food_portions (food_id, name, quantity) select %L, 'p' || g, 10 from generate_series(1, 20) g $$, :'fid'),
  '%too_many_portions%', 'más de 20 porciones por alimento se rechaza'
);

-- claves foráneas: eliminar un alimento nunca borra historial (FR-024, Principio II) ----------------
select is(
  (select count(*) from pg_constraint
   where confrelid = 'public.foods'::regclass and contype = 'f' and confdeltype = 'c'
     and conrelid <> 'public.food_portions'::regclass),
  0::bigint,
  'FR-024: ninguna tabla que referencie foods usa on delete cascade, salvo food_portions'
);

select * from finish();
rollback;

-- T030 (spec 002, FR-015 a FR-019, FR-023): crear un alimento propio de forma atómica e idempotente.
begin;
select plan(29);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.authenticate_as(:'uid_a');

-- creación completa ---------------------------------------------------------------------------------
select public.create_food(
  '{"name":"  Mi galletita  ","brand":"  Casera ","reference_basis":"100g","energy_kcal":450,"protein_g":6.5,"carbs_g":70,"sugars_g":20,"fat_g":15,"saturated_fat_g":5,"fiber_g":3,"sodium_mg":300}'::jsonb,
  '[{"name":"Unidad","quantity":12},{"name":"Paquete","quantity":120}]'::jsonb,
  'aaaaaaaa-0000-0000-0000-000000000001'
) as food_id \gset

select is((select count(*) from public.foods where id = :'food_id'), 1::bigint, 'FR-015: crea el alimento');
select is((select name from public.foods where id = :'food_id'), 'Mi galletita', 'recorta los espacios del nombre');
select is((select brand from public.foods where id = :'food_id'), 'Casera', 'recorta los espacios de la marca');
select is((select origin from public.foods where id = :'food_id'), 'own', 'el alimento creado es propio');
select is((select user_id from public.foods where id = :'food_id'), :'uid_a'::uuid, 'pertenece a quien lo creó');
select is((select protein_g from public.foods where id = :'food_id'), 6.5, 'FR-019: guarda los decimales');
select is((select count(*) from public.food_portions where food_id = :'food_id'), 2::bigint, 'FR-015: crea las porciones en la misma operación');

-- un mínimo válido: solo nombre, base y energía; el resto queda sin dato (null, nunca 0)
select public.create_food(
  '{"name":"Solo energia","reference_basis":"100ml","energy_kcal":42}'::jsonb, '[]'::jsonb,
  'aaaaaaaa-0000-0000-0000-000000000002'
) as min_id \gset
select is((select protein_g from public.foods where id = :'min_id'), null, 'FR-006: un nutriente no informado queda null, no 0');
select is((select brand from public.foods where id = :'min_id'), null, 'sin marca queda null');
select is((select count(*) from public.food_portions where food_id = :'min_id'), 0::bigint, 'un alimento sin porciones es válido');

-- idempotencia (FR-023)
select is(
  public.create_food('{"name":"Mi galletita","reference_basis":"100g","energy_kcal":450}'::jsonb, '[]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001'),
  :'food_id'::uuid,
  'FR-023: repetir el mismo request_id devuelve el mismo alimento'
);
select is((select count(*) from public.foods where name = 'Mi galletita'), 1::bigint, 'FR-023: no se crea un segundo alimento');
select isnt(
  public.create_food('{"name":"Mi galletita","reference_basis":"100g","energy_kcal":450}'::jsonb, '[]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000003'),
  :'food_id'::uuid,
  'otro request_id crea otro alimento'
);

-- validaciones (FR-017)
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g"}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  '%energy_required%', 'la energía es obligatoria'
);
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":10,"protein_g":-1}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  '%negative_value%protein_g%', 'un valor negativo se rechaza e indica el campo'
);
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":1000}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  '%out_of_range%energy_kcal%', 'una energía imposible se rechaza'
);
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":10,"protein_g":50,"carbs_g":40,"fat_g":20}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  '%macros_exceed_100%', 'proteínas + carbohidratos + grasas no pueden superar 100 g'
);
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":10,"carbs_g":10,"sugars_g":20}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  '%sugars_exceed_carbs%', 'los azúcares no pueden superar los carbohidratos'
);
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":10,"fat_g":10,"saturated_fat_g":20}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  '%saturated_exceeds_fat%', 'las saturadas no pueden superar las grasas'
);
select throws_ilike(
  $$ select public.create_food('{"name":"   ","reference_basis":"100g","energy_kcal":10}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  '%name_required%', 'el nombre es obligatorio'
);
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100kg","energy_kcal":10}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  '%invalid_basis%', 'la base solo puede ser 100 g o 100 ml'
);
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":10}'::jsonb, '[{"name":"Mala","quantity":0}]'::jsonb, gen_random_uuid()) $$,
  '%invalid_portion%', 'una porción con cantidad cero se rechaza'
);
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":10}'::jsonb, '[{"name":"A","quantity":1},{"name":"A","quantity":2}]'::jsonb, gen_random_uuid()) $$,
  '%invalid_portion%', 'dos porciones con el mismo nombre se rechazan'
);
select throws_ilike(
  format($$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":10}'::jsonb, %L::jsonb, gen_random_uuid()) $$,
    (select jsonb_agg(jsonb_build_object('name', 'P' || n, 'quantity', 1))::text from generate_series(1, 21) n)),
  '%too_many_portions%', 'más de 20 porciones se rechaza'
);

-- atomicidad: con una porción inválida no queda nada
select throws_ilike(
  $$ select public.create_food('{"name":"Atomico","reference_basis":"100g","energy_kcal":10}'::jsonb, '[{"name":"Ok","quantity":1},{"name":"Mala","quantity":-5}]'::jsonb, gen_random_uuid()) $$,
  '%invalid_portion%', 'la porción inválida hace fallar la operación'
);
select is((select count(*) from public.foods where name = 'Atomico'), 0::bigint, 'no queda ningún alimento a medias');

-- la identidad no se puede forzar desde el cliente
select public.create_food(
  format('{"name":"Intento","reference_basis":"100g","energy_kcal":10,"origin":"imported","user_id":"%s"}', :'uid_b')::jsonb,
  '[]'::jsonb, gen_random_uuid()
) as forced_id \gset
select is(
  (select origin || ':' || (user_id = :'uid_a'::uuid)::text from public.foods where id = :'forced_id'),
  'own:true',
  'FR-022: no se puede crear un alimento del catálogo ni a nombre de otra cuenta'
);

-- privacidad (FR-016)
select tests.clear_authentication();
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.foods where name = 'Mi galletita'), 0::bigint, 'FR-016: otra cuenta no ve el alimento');
select tests.clear_authentication();

-- sin acceso
select tests.authenticate_as_anon();
select throws_ilike(
  $$ select public.create_food('{"name":"X","reference_basis":"100g","energy_kcal":10}'::jsonb, '[]'::jsonb, gen_random_uuid()) $$,
  'permission denied%', 'una petición anónima no puede crear alimentos'
);
select tests.clear_authentication();

select * from finish();
rollback;

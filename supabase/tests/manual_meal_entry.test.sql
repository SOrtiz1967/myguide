-- T036 (spec 003, FR-006, FR-007, FR-012): ítems manuales, escritos por la persona.
begin;
select plan(20);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.set_profile_timezone(:'uid_a', 'UTC');

select tests.authenticate_as(:'uid_a');

-- solo con descripción y energía -----------------------------------------------------------------------------------
select public.add_meal_entry(
  '{"log_date":"2026-10-19","meal":"extra","origin":"manual","description":"  Torta de cumpleaños  ","quantity_text":"1 porción","energy_kcal":350}'::jsonb,
  'ffffffff-0000-0000-0000-000000000001'
) as m1 \gset

select is((select origin from public.meal_entries where id = :'m1'), 'manual', 'FR-012: un ítem escrito a mano es "manual"');
select is((select food_name from public.meal_entries where id = :'m1'), 'Torta de cumpleaños', 'recorta la descripción');
select is((select quantity_text from public.meal_entries where id = :'m1'), '1 porción', 'guarda la cantidad descriptiva');
select is((select energy_kcal from public.meal_entries where id = :'m1'), 350.00, 'guarda la energía');
select is((select protein_g from public.meal_entries where id = :'m1'), null, 'FR-006: lo no informado queda null, no 0');
select is((select food_id from public.meal_entries where id = :'m1'), null, 'sin alimento de origen');
select is((select quantity from public.meal_entries where id = :'m1'), null, 'sin cantidad en g o ml');
select is((select status from public.meal_entries where id = :'m1'), 'confirmed', 'queda confirmado');

-- con macronutrientes ---------------------------------------------------------------------------------------------------
select public.add_meal_entry(
  '{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"Guiso","energy_kcal":420,"protein_g":22.5,"carbs_g":40,"sugars_g":5,"fat_g":18,"saturated_fat_g":6,"fiber_g":7,"sodium_mg":900}'::jsonb,
  gen_random_uuid()
) as m2 \gset
select is(
  (select protein_g || '|' || carbs_g || '|' || fat_g || '|' || sodium_mg from public.meal_entries where id = :'m2'),
  '22.50|40.00|18.00|900.00',
  'guarda los macronutrientes informados'
);

-- validaciones -------------------------------------------------------------------------------------------------------------
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"  ","energy_kcal":10}'::jsonb, gen_random_uuid()) $$, '%description_required%', 'la descripción es obligatoria');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"X"}'::jsonb, gen_random_uuid()) $$, '%energy_required%', 'FR-006: la energía es obligatoria');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"X","energy_kcal":-1}'::jsonb, gen_random_uuid()) $$, '%negative_value%energy_kcal%', 'una energía negativa se rechaza');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"X","energy_kcal":5001}'::jsonb, gen_random_uuid()) $$, '%out_of_range%energy_kcal%', 'más de 5000 kcal se rechaza');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"X","energy_kcal":10,"protein_g":1001}'::jsonb, gen_random_uuid()) $$, '%out_of_range%protein_g%', 'más de 1000 g se rechaza');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"X","energy_kcal":10,"sodium_mg":50001}'::jsonb, gen_random_uuid()) $$, '%out_of_range%sodium_mg%', 'más de 50.000 mg de sodio se rechaza');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"X","energy_kcal":10,"carbs_g":10,"sugars_g":20}'::jsonb, gen_random_uuid()) $$, '%sugars_exceed_carbs%', 'los azúcares no superan los carbohidratos');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"X","energy_kcal":10,"fat_g":5,"saturated_fat_g":6}'::jsonb, gen_random_uuid()) $$, '%saturated_exceeds_fat%', 'las saturadas no superan las grasas');
select throws_ilike($$ select public.add_meal_entry('{"log_date":"2026-10-19","meal":"lunch","origin":"manual","description":"X","energy_kcal":"mucho"}'::jsonb, gen_random_uuid()) $$, '%invalid_number%', 'un valor que no es número se rechaza');

-- idempotencia y aislamiento -------------------------------------------------------------------------------------------
select is(
  public.add_meal_entry('{"log_date":"2026-10-19","meal":"extra","origin":"manual","description":"Torta de cumpleaños","energy_kcal":350}'::jsonb, 'ffffffff-0000-0000-0000-000000000001'),
  :'m1'::uuid,
  'idempotente por request_id'
);
select tests.clear_authentication();
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.meal_entries), 0::bigint, 'B no ve los ítems manuales de A');
select tests.clear_authentication();

select * from finish();
rollback;

-- Spec 009: ítems estimados por IA que la persona confirma (FR-005, FR-015, contrato estimate-meal.md).
begin;
select plan(21);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- tabla de resultados: solo el rol de servicio ------------------------------------------------------------------------
select ok(
  not has_table_privilege('authenticated', 'public.ai_estimates', 'select')
    and not has_table_privilege('anon', 'public.ai_estimates', 'select')
    and has_table_privilege('service_role', 'public.ai_estimates', 'insert'),
  'ai_estimates solo la usa el rol de servicio'
);
select ok(
  not has_function_privilege('anon', 'public.add_estimated_entries(jsonb, uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.add_estimated_entries(jsonb, uuid)', 'execute'),
  'add_estimated_entries la ejecuta solo una cuenta autenticada'
);

-- confirmar ------------------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select public.add_estimated_entries(
  jsonb_build_object(
    'log_date', to_char(now(), 'YYYY-MM-DD'),
    'meal', 'lunch',
    'items', jsonb_build_array(
      jsonb_build_object('description', '  Milanesa al horno ', 'quantity_text', '2 unidades', 'energy_kcal', 520, 'protein_g', 44, 'carbs_g', 30, 'fat_g', 24),
      jsonb_build_object('description', 'Puré', 'energy_kcal', 180)
    )
  ),
  '90000000-0000-0000-0000-000000000001'
) as ids \gset
select is(array_length(:'ids'::uuid[], 1), 2, 'devuelve un identificador por ítem');
select is((select count(*) from public.meal_entries), 2::bigint, 'guarda los dos ítems');
select is(
  (select count(*) from public.meal_entries where origin = 'estimated' and status = 'confirmed'),
  2::bigint, 'con origen estimado y estado confirmado'
);
select is((select food_name from public.meal_entries where energy_kcal = 520), 'Milanesa al horno', 'el nombre se guarda recortado');
select is((select quantity_text from public.meal_entries where energy_kcal = 180), null, 'sin cantidad queda sin cantidad');
select is((select protein_g from public.meal_entries where energy_kcal = 180), null, 'lo que no se indicó queda vacío, no cero');

-- idempotencia ---------------------------------------------------------------------------------------------------------
select is(
  public.add_estimated_entries(
    jsonb_build_object(
      'log_date', to_char(now(), 'YYYY-MM-DD'), 'meal', 'lunch',
      'items', jsonb_build_array(
        jsonb_build_object('description', 'Milanesa al horno', 'energy_kcal', 520),
        jsonb_build_object('description', 'Puré', 'energy_kcal', 180)
      )
    ),
    '90000000-0000-0000-0000-000000000001'
  ),
  :'ids'::uuid[], 'repetir con el mismo identificador devuelve los mismos ítems'
);
select is((select count(*) from public.meal_entries), 2::bigint, 'y no duplica');

-- validación -----------------------------------------------------------------------------------------------------------
select throws_ilike(
  $$ select public.add_estimated_entries('{"log_date":"2026-11-01","meal":"brunch","items":[{"description":"a","energy_kcal":1}]}'::jsonb, gen_random_uuid()) $$,
  'invalid_entry:invalid_meal:meal%', 'rechaza una comida inválida'
);
select throws_ilike(
  format($$ select public.add_estimated_entries(jsonb_build_object('log_date', %L, 'meal', 'lunch', 'items', '[]'::jsonb), gen_random_uuid()) $$, to_char(now(), 'YYYY-MM-DD')),
  'invalid_entry:invalid_items:items%', 'rechaza una lista vacía'
);
select throws_ilike(
  format(
    $$ select public.add_estimated_entries(jsonb_build_object('log_date', %L, 'meal', 'lunch', 'items', (select jsonb_agg(jsonb_build_object('description', 'x' || g, 'energy_kcal', 1)) from generate_series(1, 13) g)), gen_random_uuid()) $$,
    to_char(now(), 'YYYY-MM-DD')
  ),
  'invalid_entry:invalid_items:items%', 'rechaza más de 12 ítems'
);
select throws_ilike(
  format($$ select public.add_estimated_entries(jsonb_build_object('log_date', %L, 'meal', 'lunch', 'items', jsonb_build_array(jsonb_build_object('description', '  ', 'energy_kcal', 1))), gen_random_uuid()) $$, to_char(now(), 'YYYY-MM-DD')),
  'invalid_entry:description_required:description%', 'el nombre es obligatorio'
);
select throws_ilike(
  format($$ select public.add_estimated_entries(jsonb_build_object('log_date', %L, 'meal', 'lunch', 'items', jsonb_build_array(jsonb_build_object('description', 'a', 'energy_kcal', 5001))), gen_random_uuid()) $$, to_char(now(), 'YYYY-MM-DD')),
  'invalid_entry:out_of_range:energy_kcal%', 'la energía tiene el mismo máximo que a mano'
);
select throws_ilike(
  format($$ select public.add_estimated_entries(jsonb_build_object('log_date', %L, 'meal', 'lunch', 'items', jsonb_build_array(jsonb_build_object('description', 'a'))), gen_random_uuid()) $$, to_char(now(), 'YYYY-MM-DD')),
  'invalid_entry:energy_required:energy_kcal%', 'la energía es obligatoria'
);
select throws_ilike(
  $$ select public.add_estimated_entries('{"log_date":"1999-01-01","meal":"lunch","items":[{"description":"a","energy_kcal":1}]}'::jsonb, gen_random_uuid()) $$,
  'invalid_entry:invalid_date:log_date%', 'rechaza un día fuera de rango'
);

-- todo o nada: un ítem inválido no deja ninguno guardado ------------------------------------------------------------
select throws_ilike(
  format($$ select public.add_estimated_entries(jsonb_build_object('log_date', %L, 'meal', 'dinner', 'items', jsonb_build_array(jsonb_build_object('description', 'bien', 'energy_kcal', 10), jsonb_build_object('description', 'mal', 'energy_kcal', -1))), gen_random_uuid()) $$, to_char(now(), 'YYYY-MM-DD')),
  'invalid_entry:negative_value:energy_kcal%', 'un ítem inválido rechaza la operación'
);
select is((select count(*) from public.meal_entries where meal = 'dinner'), 0::bigint, 'y no queda ninguno a medias');

-- aislamiento y sesión -------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.meal_entries), 0::bigint, 'otra cuenta no ve los ítems de la primera');

select tests.clear_authentication();
select throws_ilike(
  $$ select public.add_estimated_entries('{"log_date":"2026-11-01","meal":"lunch","items":[{"description":"a","energy_kcal":1}]}'::jsonb, gen_random_uuid()) $$,
  'session_expired%', 'sin sesión no se guarda nada'
);

select * from finish();
rollback;

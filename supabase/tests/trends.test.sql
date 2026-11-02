-- Spec 010 (FR-003, FR-005, FR-017 a FR-019, FR-023, FR-025): las lecturas agregadas de Tendencias.
begin;
select plan(16);

delete from public.workout_sessions;
delete from public.routines;
delete from public.exercises;
delete from public.meal_entries;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- comidas: 2026-10-05 con dos entradas (una sin proteína), 2026-10-06 solo una pendiente, 2026-10-07 una sola
insert into public.meal_entries (user_id, log_date, meal, origin, food_name, energy_kcal, protein_g, carbs_g, fat_g)
values (:'uid_a', date '2026-10-05', 'lunch', 'manual', 'Almuerzo', 600, 30, 50, 20);
select tests.create_manual_entry(:'uid_a', date '2026-10-05', 'dinner', 'Cena', 400);
select tests.create_manual_entry(:'uid_a', date '2026-10-07', 'lunch', 'Otro día', 1000);
insert into public.meal_entries (user_id, log_date, meal, origin, status, food_name, energy_kcal)
values (:'uid_a', date '2026-10-06', 'snack', 'estimated', 'pending', 'Estimado', 300);
select tests.create_manual_entry(:'uid_b', date '2026-10-05', 'lunch', 'De otra cuenta', 999);

-- sesiones: pecho y tríceps (press), sin músculo (libre) y un ejercicio que luego se borra del catálogo
select tests.create_exercise(:'uid_a', 'Press', 'reps_weight', array['chest', 'triceps']) as ex_press \gset
select tests.create_exercise(:'uid_a', 'Libre', 'reps_weight', array[]::text[]) as ex_free \gset
select tests.create_exercise(:'uid_a', 'Borrado', 'reps_weight', array['lats']) as ex_gone \gset

-- semana del lunes 2026-10-05: martes y viernes; semana del 2026-10-12: una sesión
select tests.create_session(:'uid_a', date '2026-10-06', 'completed') as s1 \gset
select tests.create_session(:'uid_a', date '2026-10-09', 'completed') as s2 \gset
select tests.create_session(:'uid_a', date '2026-10-13', 'completed') as s3 \gset
select tests.create_session(:'uid_a', date '2026-10-08', 'in_progress') as s_open \gset

select tests.add_session_exercise(:'s1', :'ex_press') as x1 \gset
select tests.add_session_set(:'x1', 8, 60);
select tests.add_session_set(:'x1', 8, 60);
select tests.add_session_exercise(:'s1', :'ex_free') as x2 \gset
select tests.add_session_set(:'x2', 10, 20);
select tests.add_session_exercise(:'s2', :'ex_gone') as x3 \gset
select tests.add_session_set(:'x3', 5, 50);
select tests.add_session_exercise(:'s3', :'ex_press') as x4 \gset
select tests.add_session_set(:'x4', 6, 70);
select tests.add_session_exercise(:'s_open', :'ex_press') as x5 \gset
select tests.add_session_set(:'x5', 9, 40);

-- el ejercicio se borra del catálogo: la sesión conserva su serie, ahora sin grupo
delete from public.exercises where id = :'ex_gone';

select tests.authenticate_as(:'uid_a');

-- nutrición
select is(
  (select string_agg(log_date::text, ',' order by log_date) from public.trends_nutrition(date '2026-10-01', date '2026-10-31')),
  '2026-10-05,2026-10-07', 'solo días con entradas confirmadas; la pendiente no cuenta'
);
select is(
  (select energy_kcal from public.trends_nutrition(date '2026-10-01', date '2026-10-31') where log_date = '2026-10-05'),
  1000::numeric, 'la suma de calorías del día'
);
select is(
  (select entries from public.trends_nutrition(date '2026-10-01', date '2026-10-31') where log_date = '2026-10-05'),
  2, 'cuántas entradas tiene el día'
);
select results_eq(
  $$ select protein_g, protein_count, carbs_g, carbs_count from public.trends_nutrition(date '2026-10-01', date '2026-10-31') where log_date = '2026-10-05' $$,
  $$ values (30.00::numeric, 1, 50.00::numeric, 1) $$,
  'el nutriente informado por una sola entrada suma solo lo informado y dice cuántas'
);
select results_eq(
  $$ select protein_g, protein_count from public.trends_nutrition(date '2026-10-01', date '2026-10-31') where log_date = '2026-10-07' $$,
  $$ values (null::numeric, 0) $$,
  'si ninguna entrada informa el nutriente queda nulo, no cero'
);
select is(
  (select count(*) from public.trends_nutrition(date '2026-10-06', date '2026-10-06')), 0::bigint,
  'el rango limita los días'
);

-- entrenamiento
select is(
  (select string_agg(week_start::text, ',' order by week_start) from public.trends_training_sets(date '2026-10-01', date '2026-10-31')),
  '2026-10-05,2026-10-12', 'una fila por semana, que empieza en lunes'
);
select is(
  (select total_sets from public.trends_training_sets(date '2026-10-01', date '2026-10-31') where week_start = '2026-10-05'),
  4, 'cada serie cuenta una vez en el total (la sesión en curso no)'
);
select is(
  (select by_muscle from public.trends_training_sets(date '2026-10-01', date '2026-10-31') where week_start = '2026-10-05'),
  '{"chest": 2, "triceps": 2, "sin_grupo": 2}'::jsonb,
  'una serie cuenta en cada músculo principal; sin músculo o sin catálogo, en sin_grupo'
);
select is(
  (select by_muscle from public.trends_training_sets(date '2026-10-01', date '2026-10-31') where week_start = '2026-10-12'),
  '{"chest": 1, "triceps": 1}'::jsonb, 'la semana siguiente'
);

-- validación
select throws_ilike(
  $$ select * from public.trends_nutrition(date '2026-10-31', date '2026-10-01') $$, 'invalid_trends:range%', 'rango invertido'
);
select throws_ilike(
  $$ select * from public.trends_training_sets(date '2024-01-01', date '2026-10-01') $$, 'invalid_trends:range%', 'rango de más de 400 días'
);

-- aislamiento y sesión
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.trends_nutrition(date '2026-10-01', date '2026-10-31')), 1::bigint, 'otra cuenta solo ve lo suyo');
select is((select count(*) from public.trends_training_sets(date '2026-10-01', date '2026-10-31')), 0::bigint, 'otra cuenta no ve sesiones ajenas');

select tests.clear_authentication();
select throws_ilike(
  $$ select * from public.trends_nutrition(date '2026-10-01', date '2026-10-31') $$, 'session_expired%', 'sin sesión no lee nada'
);
select ok(
  not has_function_privilege('anon', 'public.trends_nutrition(date, date)', 'execute')
    and not has_function_privilege('anon', 'public.trends_training_sets(date, date)', 'execute')
    and has_function_privilege('authenticated', 'public.trends_nutrition(date, date)', 'execute')
    and has_function_privilege('authenticated', 'public.trends_training_sets(date, date)', 'execute'),
  'solo una cuenta autenticada las ejecuta'
);

select * from finish();
rollback;

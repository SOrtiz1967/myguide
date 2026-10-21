-- T065: tiempo de public.search_exercises sobre :target filas (reales + sinteticas). Todo se deshace al final.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
begin;

select tests.create_user('bench@test.local') as uid \gset
select count(*) as have from public.exercises \gset
select id as src from public.exercise_sources where slug = 'muestra-desarrollo-ejercicios' \gset

insert into public.exercises (
  origin, source_id, source_item_id, imported_at, name, name_status, original_name, aliases,
  measurement_type, primary_muscles, secondary_muscles, equipment, description, description_status
)
select
  'imported', :'src', 'BENCH-' || n, now(),
  w1 || ' ' || w2 || ' ' || w3 || case when n > 2250 then ' v' || (n / 2250) else '' end,
  'machine_translated',
  'Synthetic exercise ' || n,
  array['Alias de ' || lower(w1) || ' ' || n % 97],
  (array['reps_weight', 'reps_bodyweight', 'duration', 'distance_duration'])[1 + n % 4],
  array[m1],
  case when m2 <> m1 then array[m2] else '{}'::text[] end,
  e1,
  '1. ' || repeat('Paso de ejemplo con texto de relleno para el benchmark. ', 8) || E'\n2. Vuelve a la posición inicial.',
  'machine_translated'
from (
  select
    n,
    (array['Press','Sentadilla','Remo','Curl','Elevación','Extensión','Peso muerto','Zancada','Plancha','Flexión','Jalón','Fondos','Encogimiento','Puente','Patada'])[1 + n % 15] as w1,
    (array['con barra','con mancuernas','en polea','en máquina','con banda','con pesa rusa','con peso corporal','sentado','de pie','inclinado','declinado','alterno','unilateral','en suspensión','con pausa'])[1 + (n / 15) % 15] as w2,
    (array['frontal','lateral','posterior','invertido','cerrado','amplio','explosivo','lento','isométrico','a una pierna'])[1 + (n / 225) % 10] as w3,
    (array['abdominals','abductors','adductors','biceps','calves','chest','forearms','glutes','hamstrings','lats','lower back','middle back','neck','quadriceps','shoulders','traps','triceps','full_body'])[1 + n % 18] as m1,
    (array['abdominals','abductors','adductors','biceps','calves','chest','forearms','glutes','hamstrings','lats','lower back','middle back','neck','quadriceps','shoulders','traps','triceps','full_body'])[1 + (n * 7) % 18] as m2,
    (array['body only','barbell','dumbbell','cable','machine','e-z curl bar','kettlebells','bands','medicine ball','exercise ball','foam roll','other'])[1 + n % 12] as e1
  from generate_series(1, greatest(:target - :have, 0)) n
) g;

-- Algunos ejercicios propios de la cuenta de prueba (escenario real: catalogo + lo propio).
insert into public.exercises (origin, user_id, name, measurement_type, primary_muscles, equipment, description, description_status)
select 'own', :'uid', 'Propio ' || n || ' press mio', 'reps_weight', array['chest'], 'barbell', 'Mi descripcion', 'original'
from generate_series(1, 30) n;

analyze public.exercises;
select 'filas en total: ' || count(*) from public.exercises;
select 'tamano tabla+indices: ' || pg_size_pretty(pg_total_relation_size('public.exercises'));

select tests.authenticate_as(:'uid');

do $bench$
declare
  v_cases jsonb := '[
    {"k":"texto","q":"sentadilla","s":"all"},
    {"k":"texto","q":"press banca","s":"all"},
    {"k":"texto","q":"remo","s":"all"},
    {"k":"texto","q":"curl","s":"all"},
    {"k":"texto","q":"cur","s":"all"},
    {"k":"texto","q":"plancha lateral","s":"all"},
    {"k":"texto","q":"elevacion","s":"all"},
    {"k":"texto","q":"mancuernas","s":"all"},
    {"k":"texto","q":"zan","s":"all"},
    {"k":"texto","q":"flexion","s":"all"},
    {"k":"texto","q":"jalon","s":"all"},
    {"k":"texto","q":"peso muerto","s":"all"},
    {"k":"texto","q":"extencion","s":"all"},
    {"k":"texto","q":"xyzzy","s":"all"},
    {"k":"texto","q":"press","s":"catalog"},
    {"k":"texto","q":"press mio","s":"own"},
    {"k":"filtros","m":"chest","s":"all"},
    {"k":"filtros","m":"quadriceps","s":"all"},
    {"k":"filtros","e":"barbell","s":"all"},
    {"k":"filtros","e":"dumbbell","s":"catalog"},
    {"k":"filtros","m":"lats","e":"cable","s":"all"},
    {"k":"ambos","q":"press","m":"chest","e":"barbell","s":"all"},
    {"k":"ambos","q":"sentadilla","m":"quadriceps","s":"all"},
    {"k":"ambos","q":"remo","e":"cable","s":"all"},
    {"k":"ambos","q":"curl","m":"biceps","e":"dumbbell","s":"catalog"},
    {"k":"ambos","q":"plancha","m":"abdominals","s":"all"}
  ]';
  v_case jsonb;
  v_kind text;
  v_times_ms numeric[];
  v_start timestamptz;
  v_n int;
  v_ms numeric;
  v_all numeric[] := '{}';
  v_runs int := 5;
  i int;
begin
  for v_kind in select unnest(array['texto', 'filtros', 'ambos']) loop
    v_times_ms := '{}';
    for v_case in select * from jsonb_array_elements(v_cases) loop
      continue when v_case ->> 'k' <> v_kind;
      -- una pasada de calentamiento y varias medidas
      select count(*) into v_n from public.search_exercises(v_case ->> 'q', v_case ->> 's', v_case ->> 'm', v_case ->> 'e', 20, 0);
      for i in 1..v_runs loop
        v_start := clock_timestamp();
        select count(*) into v_n from public.search_exercises(v_case ->> 'q', v_case ->> 's', v_case ->> 'm', v_case ->> 'e', 20, 0);
        v_ms := extract(epoch from clock_timestamp() - v_start) * 1000;
        v_times_ms := v_times_ms || v_ms;
        v_all := v_all || v_ms;
      end loop;
    end loop;
    raise notice '% -> n=% p50=% ms p95=% ms max=% ms', rpad(v_kind, 8), cardinality(v_times_ms),
      round((select percentile_cont(0.5) within group (order by t) from unnest(v_times_ms) t)::numeric, 1),
      round((select percentile_cont(0.95) within group (order by t) from unnest(v_times_ms) t)::numeric, 1),
      round((select max(t) from unnest(v_times_ms) t)::numeric, 1);
  end loop;
  raise notice 'TODAS    -> n=% p50=% ms p95=% ms max=% ms', cardinality(v_all),
    round((select percentile_cont(0.5) within group (order by t) from unnest(v_all) t)::numeric, 1),
    round((select percentile_cont(0.95) within group (order by t) from unnest(v_all) t)::numeric, 1),
    round((select max(t) from unnest(v_all) t)::numeric, 1);
end
$bench$;

rollback;

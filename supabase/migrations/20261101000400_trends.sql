-- Spec 010: tendencias. Dos lecturas agregadas para acotar el tamaño de la respuesta (el servidor corta en 1.000 filas).
--
-- Solo leen: no modifican ni completan ningún registro. Los promedios, el rango de ±10 %, la proteína por kilo y el
-- mantenimiento los calcula la aplicación sobre estos datos para poder probarlos contra valores calculados a mano.
-- Un nutriente que ninguna entrada informa queda nulo (nunca cero) y cada suma trae cuántas entradas la informan.

create function public.trends_nutrition(from_date date, to_date date)
returns table (
  log_date date,
  entries integer,
  energy_kcal numeric,
  energy_count integer,
  protein_g numeric,
  protein_count integer,
  carbs_g numeric,
  carbs_count integer,
  fat_g numeric,
  fat_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if from_date is null or to_date is null or from_date > to_date or to_date - from_date > 400 then
    raise exception 'invalid_trends:range:from_date' using errcode = '22023';
  end if;

  return query
  select
    m.log_date,
    count(*)::integer,
    sum(m.energy_kcal),
    count(m.energy_kcal)::integer,
    sum(m.protein_g),
    count(m.protein_g)::integer,
    sum(m.carbs_g),
    count(m.carbs_g)::integer,
    sum(m.fat_g),
    count(m.fat_g)::integer
  from public.meal_entries m
  where m.user_id = v_user
    and m.status = 'confirmed'
    and m.log_date between from_date and to_date
  group by m.log_date
  order by m.log_date;
end
$$;

revoke all on function public.trends_nutrition(date, date) from public, anon;
grant execute on function public.trends_nutrition(date, date) to authenticated;

-- Series por semana (lunes a domingo) y grupo muscular principal, solo de sesiones realizadas.
-- Una serie cuenta una vez por cada músculo principal de su ejercicio actual en el catálogo; las de un ejercicio sin
-- músculo principal o ya sin catálogo cuentan en `sin_grupo`. `total_sets` cuenta cada serie una sola vez.
create function public.trends_training_sets(from_date date, to_date date)
returns table (
  week_start date,
  total_sets integer,
  by_muscle jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if from_date is null or to_date is null or from_date > to_date or to_date - from_date > 400 then
    raise exception 'invalid_trends:range:from_date' using errcode = '22023';
  end if;

  return query
  with sets as (
    select
      date_trunc('week', s.session_date)::date as wk,
      case
        when coalesce(cardinality(e.primary_muscles), 0) = 0 then array['sin_grupo']::text[]
        else e.primary_muscles
      end as muscles
    from public.session_sets t
    join public.session_exercises x on x.id = t.session_exercise_id
    join public.workout_sessions s on s.id = t.session_id
    left join public.exercises e on e.id = x.exercise_id
    where t.user_id = v_user
      and s.user_id = v_user
      and s.status = 'completed'
      and s.session_date between from_date and to_date
  ),
  per_muscle as (
    select sets.wk, u.muscle, count(*)::integer as n
    from sets, unnest(sets.muscles) as u(muscle)
    group by sets.wk, u.muscle
  ),
  totals as (
    select sets.wk, count(*)::integer as n from sets group by sets.wk
  )
  select
    totals.wk,
    totals.n,
    (select jsonb_object_agg(p.muscle, p.n) from per_muscle p where p.wk = totals.wk)
  from totals
  order by totals.wk;
end
$$;

revoke all on function public.trends_training_sets(date, date) from public, anon;
grant execute on function public.trends_training_sets(date, date) to authenticated;

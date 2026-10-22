-- T066 (spec 006, FR-041 a FR-043, SC-009): la historia de un ejercicio — las últimas veces que se hizo, con sus series.
--
-- Solo cuentan las sesiones realizadas de la propia cuenta. El nombre es el guardado en cada sesión (renombrar o
-- eliminar el ejercicio después no lo cambia). No hay comparaciones, metas ni recomendaciones (FR-044).
-- Es `security definer` como el resto de las funciones de entrenamiento: verifica la sesión vigente y filtra por la
-- cuenta autenticada de forma explícita.

create function public.exercise_history(
  exercise_id uuid,
  exclude_session_id uuid default null,
  page_size integer default 10,
  page_offset integer default 0
)
returns table (
  session_id uuid,
  session_date date,
  exercise_name text,
  measurement_type text,
  effort smallint,
  note text,
  sets jsonb,
  total_estimate bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_size integer := least(greatest(coalesce(page_size, 10), 1), 50);
  v_offset integer := greatest(coalesce(page_offset, 0), 0);
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.session_date,
    x.exercise_name,
    x.measurement_type,
    x.effort,
    x.note,
    coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'reps', t.reps,
        'weight_kg', t.weight_kg,
        'duration_s', t.duration_s,
        'distance_km', t.distance_km
      )) order by t.position)
      from public.session_sets t
      where t.session_exercise_id = x.id
    ), '[]'::jsonb),
    count(*) over ()
  from public.session_exercises x
  join public.workout_sessions s on s.id = x.session_id
  where x.user_id = v_user
    and s.user_id = v_user
    and s.status = 'completed'
    and x.exercise_id = exercise_history.exercise_id
    and (exclude_session_id is null or s.id <> exclude_session_id)
  order by s.session_date desc, s.finished_at desc nulls last, s.id desc, x.position
  limit v_size offset v_offset;
end
$$;

revoke all on function public.exercise_history(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.exercise_history(uuid, uuid, integer, integer) to authenticated;

-- Spec 012: gráficos de progreso de entrenamiento. Lectura de las series crudas de las sesiones realizadas de un ejercicio.
--
-- Solo lee: no modifica ni completa ninguna sesión. Devuelve una fila por ejercicio de sesión, en orden cronológico, con
-- el nombre y el tipo de medición con que quedó guardado en esa sesión (instantánea) y las series sin los datos faltantes
-- (`jsonb_strip_nulls`: un dato que falta no aparece, nunca es cero). Los cálculos (medidas, períodos, comparación) los
-- hace la aplicación sobre estos datos para poder probarlos contra valores calculados a mano.
-- Tope: las 2.000 sesiones más recientes, para acotar el tamaño de la respuesta.

create function public.exercise_progress(exercise_id uuid)
returns table (
  session_id uuid,
  session_date date,
  exercise_name text,
  measurement_type text,
  effort smallint,
  sets jsonb
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

  return query
  select r.session_id, r.session_date, r.exercise_name, r.measurement_type, r.effort, r.sets
  from (
    select
      s.id as session_id,
      s.session_date,
      x.exercise_name,
      x.measurement_type,
      x.effort,
      coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'reps', t.reps,
          'weight_kg', t.weight_kg,
          'duration_s', t.duration_s,
          'distance_km', t.distance_km
        )) order by t.position)
        from public.session_sets t
        where t.session_exercise_id = x.id
      ), '[]'::jsonb) as sets,
      s.finished_at,
      x.position
    from public.session_exercises x
    join public.workout_sessions s on s.id = x.session_id
    where x.user_id = v_user
      and s.user_id = v_user
      and s.status = 'completed'
      and x.exercise_id = exercise_progress.exercise_id
    order by s.session_date desc, s.finished_at desc nulls last, s.id desc, x.position
    limit 2000
  ) r
  order by r.session_date, r.finished_at nulls first, r.session_id, r.position;
end
$$;

revoke all on function public.exercise_progress(uuid) from public, anon;
grant execute on function public.exercise_progress(uuid) to authenticated;

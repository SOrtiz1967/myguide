-- T047 (spec 006, FR-015, FR-017 a FR-020, FR-037, FR-047): empezar una sesión con el plan de una rutina y la regla
-- de «modificada».
--
-- El plan es una COPIA de los ítems de la rutina en el momento de crear la sesión (research.md, Decisión 9): editar
-- o eliminar la rutina después no lo cambia. El nombre y el tipo de medición se toman del ejercicio vigente; si el
-- ejercicio ya no existe se usa lo que guardó la rutina. Si el tipo vigente no admite un objetivo, ese objetivo no
-- se copia y el ítem queda marcado (`targets_dropped`), así que no se descarta en silencio.

create function private.copy_routine_plan(p_session uuid, p_user uuid, p_routine uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_snapshot record;
  v_name text;
  v_type text;
  v_exercise uuid;
  v_position integer := 0;
  v_reps integer;
  v_weight numeric;
  v_duration integer;
  v_distance numeric;
begin
  for v_item in
    select x.* from public.routine_exercises x where x.routine_id = p_routine order by x.position
  loop
    v_position := v_position + 1;
    select * into v_snapshot from private.snapshot_exercise(p_user, v_item.exercise_id);
    if found then
      v_exercise := v_item.exercise_id;
      v_name := v_snapshot.exercise_name;
      v_type := v_snapshot.measurement_type;
    else
      v_exercise := null;
      v_name := v_item.exercise_name;
      v_type := v_item.measurement_type;
    end if;

    -- Solo pasan los objetivos que el tipo vigente admite (los mismos campos que una serie).
    v_reps := case when v_type in ('reps_weight', 'reps_bodyweight') then v_item.target_reps end;
    v_weight := case when v_type = 'reps_weight' then v_item.target_weight_kg end;
    v_duration := case when v_type in ('duration', 'distance_duration') then v_item.target_duration_s end;
    v_distance := case when v_type = 'distance_duration' then v_item.target_distance_km end;

    insert into public.session_plan_items (
      session_id, user_id, position, exercise_id, exercise_name, measurement_type, sets,
      target_reps, target_weight_kg, target_duration_s, target_distance_km, targets_dropped
    )
    values (
      p_session, p_user, v_position, v_exercise, v_name, v_type, v_item.sets,
      v_reps, v_weight, v_duration, v_distance,
      (v_item.target_reps is not null and v_reps is null)
        or (v_item.target_weight_kg is not null and v_weight is null)
        or (v_item.target_duration_s is not null and v_duration is null)
        or (v_item.target_distance_km is not null and v_distance is null)
    );
  end loop;
end
$$;

revoke all on function private.copy_routine_plan(uuid, uuid, uuid) from public, anon, authenticated;

create function private.start_workout_from_routine_at(
  p_user uuid,
  p_routine uuid,
  p_date date,
  p_request uuid,
  p_now timestamptz,
  p_zone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_date date;
  v_open uuid;
  v_routine public.routines;
  v_row public.workout_sessions;
begin
  if p_request is null then
    raise exception 'invalid_session:request_required:request_id' using errcode = '22023';
  end if;

  -- Idempotencia: la solicitud ya se guardó (también si es un reintento tardío o la rutina ya se eliminó).
  select * into v_row from public.workout_sessions s where s.user_id = p_user and s.client_request_id = p_request;
  if found then
    return private.session_brief(v_row);
  end if;

  select * into v_routine from public.routines r where r.id = p_routine and r.user_id = p_user;
  if not found then
    raise exception 'not_found: la rutina no existe' using errcode = 'P0002';
  end if;

  v_today := (p_now at time zone p_zone)::date;
  v_date := coalesce(p_date, v_today);
  if v_date > v_today or v_date < date '2000-01-01' then
    raise exception 'invalid_date: la fecha no es valida para registrar una sesion' using errcode = '22023';
  end if;

  select s.id into v_open from public.workout_sessions s where s.user_id = p_user and s.status = 'in_progress';
  if found then
    raise exception 'session_in_progress:%: ya hay una sesion en curso', v_open using errcode = '55006';
  end if;

  begin
    insert into public.workout_sessions (
      user_id, session_date, original_date, status, started_at, client_request_id, routine_id, routine_name, has_plan
    )
    values (p_user, v_date, v_date, 'in_progress', p_now, p_request, v_routine.id, v_routine.name, true)
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.workout_sessions s where s.user_id = p_user and s.client_request_id = p_request;
    if found then
      return private.session_brief(v_row);
    end if;
    select s.id into v_open from public.workout_sessions s where s.user_id = p_user and s.status = 'in_progress';
    if found then
      raise exception 'session_in_progress:%: ya hay una sesion en curso', v_open using errcode = '55006';
    end if;
    raise;
  end;

  perform private.copy_routine_plan(v_row.id, p_user, v_routine.id);
  return private.session_brief(v_row);
end
$$;

revoke all on function private.start_workout_from_routine_at(uuid, uuid, date, uuid, timestamptz, text)
  from public, anon, authenticated;

-- Devuelve { id, session_date, status, revision }.
create function public.start_workout_from_routine(
  routine_id uuid,
  session_date date default null,
  request_id uuid default null,
  client_timezone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  return private.start_workout_from_routine_at(
    v_user, routine_id, session_date, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.start_workout_from_routine(uuid, date, uuid, text) from public, anon;
grant execute on function public.start_workout_from_routine(uuid, date, uuid, text) to authenticated;

-- «Modificada» (FR-019): la regla completa de data-model.md. Una sesión con plan es «modificada» si:
--   1. algún ítem del plan no tiene un ejercicio realizado propio con al menos una serie (no realizado o sustituido);
--   2. hay un ejercicio realizado con series que no está en el plan (agregado);
--   3. un ejercicio realizado propio de un ítem tiene una cantidad de series distinta de la planificada.
-- Las diferencias de repeticiones, peso, duración o distancia frente a los objetivos NO cuentan.
create or replace function private.compute_session_modified(p_session uuid) returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
  select coalesce(s.has_plan, false) and (
    exists (
      select 1 from public.session_plan_items p
      where p.session_id = s.id
        and not exists (
          select 1 from public.session_exercises x
          where x.plan_item_id = p.id and not x.is_substitute
            and exists (select 1 from public.session_sets t where t.session_exercise_id = x.id)
        )
    )
    or exists (
      select 1 from public.session_exercises x
      where x.session_id = s.id and x.plan_item_id is null
        and exists (select 1 from public.session_sets t where t.session_exercise_id = x.id)
    )
    or exists (
      select 1 from public.session_exercises x
      join public.session_plan_items p on p.id = x.plan_item_id
      where x.session_id = s.id and not x.is_substitute
        and (select count(*) from public.session_sets t where t.session_exercise_id = x.id) <> p.sets
    )
  )
  from public.workout_sessions s
  where s.id = p_session
  ), false)
$$;

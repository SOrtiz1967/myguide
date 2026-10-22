-- T057 (spec 006, FR-021 a FR-027a, FR-047): planificar sesiones en el calendario, cambiar su rutina, reprogramarlas,
-- cancelarlas y empezar una sesión planificada.
--
-- Una sesión planificada es la MISMA fila durante toda su vida: reprogramar cambia `session_date`, suma uno a
-- `rescheduled_count` y deja una fila en `session_date_changes`; nunca se duplica ni se pierde su historial. La fecha de
-- una sesión en curso o realizada no cambia (FR-024). «Hoy» lo calcula el servidor con la zona del perfil.

-- Cambiar la rutina de una sesión planificada reemplaza su plan; el disparador de identidad lo permite solo cuando la
-- función lo avisa dentro de su propia transacción.
create or replace function private.protect_session_identity() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.original_date is distinct from old.original_date then
    raise exception 'training_identity_immutable: el dueno y la fecha original no se pueden cambiar'
      using errcode = '42501';
  end if;
  if (new.routine_name is distinct from old.routine_name
      or (new.routine_id is distinct from old.routine_id and new.routine_id is not null))
     and coalesce(current_setting('private.plan_change', true), '') <> 'on' then
    raise exception 'training_identity_immutable: la rutina de origen no se puede cambiar'
      using errcode = '42501';
  end if;
  if old.status in ('in_progress', 'completed') and new.session_date is distinct from old.session_date then
    raise exception 'training_date_immutable: la fecha de una sesion en curso o realizada no cambia'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- El resultado de un movimiento: { id, session_date, status, rescheduled_count }.
create function private.session_move_result(p_session public.workout_sessions) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_session.id,
    'session_date', p_session.session_date,
    'status', p_session.status,
    'rescheduled_count', p_session.rescheduled_count
  )
$$;

revoke all on function private.session_move_result(public.workout_sessions) from public, anon, authenticated;

-- Planificar --------------------------------------------------------------------------------------------------------------
create function private.plan_workout_at(
  p_user uuid,
  p_date date,
  p_routine uuid,
  p_request uuid,
  p_now timestamptz,
  p_zone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_routine public.routines;
  v_row public.workout_sessions;
begin
  if p_request is null then
    raise exception 'invalid_session:request_required:request_id' using errcode = '22023';
  end if;

  select * into v_row from public.workout_sessions s where s.user_id = p_user and s.client_request_id = p_request;
  if found then
    return v_row.id;
  end if;

  if p_date is null or p_date < (p_now at time zone p_zone)::date or p_date < date '2000-01-01' then
    raise exception 'invalid_date: solo se puede planificar para hoy o un dia futuro' using errcode = '22023';
  end if;

  if p_routine is not null then
    select * into v_routine from public.routines r where r.id = p_routine and r.user_id = p_user;
    if not found then
      raise exception 'not_found: la rutina no existe' using errcode = 'P0002';
    end if;
  end if;

  begin
    insert into public.workout_sessions (
      user_id, session_date, original_date, status, client_request_id, routine_id, routine_name, has_plan
    )
    values (p_user, p_date, p_date, 'planned', p_request, v_routine.id, v_routine.name, p_routine is not null)
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.workout_sessions s where s.user_id = p_user and s.client_request_id = p_request;
    if found then
      return v_row.id;
    end if;
    raise;
  end;

  if p_routine is not null then
    perform private.copy_routine_plan(v_row.id, p_user, p_routine);
  end if;
  return v_row.id;
end
$$;

revoke all on function private.plan_workout_at(uuid, date, uuid, uuid, timestamptz, text)
  from public, anon, authenticated;

create function public.plan_workout(
  session_date date,
  routine_id uuid default null,
  request_id uuid default null,
  client_timezone text default null
)
returns uuid
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
  return private.plan_workout_at(
    v_user, session_date, routine_id, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.plan_workout(date, uuid, uuid, text) from public, anon;
grant execute on function public.plan_workout(date, uuid, uuid, text) to authenticated;

-- Cambiar o quitar la rutina de una sesión planificada ---------------------------------------------------------------------
create function public.set_workout_routine(id uuid, routine_id uuid default null) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.workout_sessions;
  v_routine public.routines;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  select * into v_session from public.workout_sessions s where s.id = set_workout_routine.id and s.user_id = v_user
    for update;
  if not found then
    raise exception 'not_found: la sesion no existe' using errcode = 'P0002';
  end if;
  if v_session.status <> 'planned' then
    raise exception 'invalid_transition: solo se cambia la rutina de una sesion planificada' using errcode = '22023';
  end if;

  if set_workout_routine.routine_id is not null then
    select * into v_routine from public.routines r
      where r.id = set_workout_routine.routine_id and r.user_id = v_user;
    if not found then
      raise exception 'not_found: la rutina no existe' using errcode = 'P0002';
    end if;
  end if;

  delete from public.session_plan_items p where p.session_id = v_session.id;
  perform set_config('private.plan_change', 'on', true);
  update public.workout_sessions s
    set routine_id = v_routine.id, routine_name = v_routine.name, has_plan = v_routine.id is not null
    where s.id = v_session.id;
  perform set_config('private.plan_change', 'off', true);

  if v_routine.id is not null then
    perform private.copy_routine_plan(v_session.id, v_user, v_routine.id);
  end if;
  return v_session.id;
end
$$;

revoke all on function public.set_workout_routine(uuid, uuid) from public, anon;
grant execute on function public.set_workout_routine(uuid, uuid) to authenticated;

-- Reprogramar -------------------------------------------------------------------------------------------------------------
create function private.reschedule_workout_at(
  p_user uuid,
  p_id uuid,
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
  v_row public.workout_sessions;
  v_change public.session_date_changes;
begin
  if p_request is null then
    raise exception 'invalid_session:request_required:request_id' using errcode = '22023';
  end if;

  -- Idempotencia: el movimiento ya se hizo (también si después hubo otro): se devuelve ese movimiento.
  select * into v_change from public.session_date_changes c where c.user_id = p_user and c.client_request_id = p_request;
  if found then
    select * into v_row from public.workout_sessions s where s.id = v_change.session_id;
    return jsonb_build_object(
      'id', v_row.id,
      'session_date', v_change.to_date,
      'status', 'planned',
      'rescheduled_count', (
        select count(*) from public.session_date_changes c
        where c.session_id = v_row.id and (c.created_at, c.id) <= (v_change.created_at, v_change.id)
      )
    );
  end if;

  select * into v_row from public.workout_sessions s where s.id = p_id and s.user_id = p_user for update;
  if not found then
    raise exception 'not_found: la sesion no existe' using errcode = 'P0002';
  end if;
  if v_row.status in ('in_progress', 'completed') then
    raise exception 'invalid_transition: la fecha de una sesion en curso o realizada no cambia' using errcode = '22023';
  end if;
  if p_date is null or p_date < (p_now at time zone p_zone)::date or p_date < date '2000-01-01' then
    raise exception 'invalid_date: solo se puede mover a hoy o a un dia futuro' using errcode = '22023';
  end if;

  if p_date = v_row.session_date then
    -- La misma fecha no cambia el recorrido; una cancelada vuelve a estar planificada.
    if v_row.status = 'cancelled' then
      update public.workout_sessions s set status = 'planned' where s.id = v_row.id returning * into v_row;
    end if;
    return private.session_move_result(v_row);
  end if;

  insert into public.session_date_changes (session_id, user_id, from_date, to_date, client_request_id)
  values (v_row.id, p_user, v_row.session_date, p_date, p_request);
  update public.workout_sessions s
    set session_date = p_date, status = 'planned', rescheduled_count = s.rescheduled_count + 1
    where s.id = v_row.id
    returning * into v_row;
  return private.session_move_result(v_row);
end
$$;

revoke all on function private.reschedule_workout_at(uuid, uuid, date, uuid, timestamptz, text)
  from public, anon, authenticated;

create function public.reschedule_workout(
  id uuid,
  new_date date,
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
  return private.reschedule_workout_at(
    v_user, id, new_date, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.reschedule_workout(uuid, date, uuid, text) from public, anon;
grant execute on function public.reschedule_workout(uuid, date, uuid, text) to authenticated;

-- Cancelar ----------------------------------------------------------------------------------------------------------------
create function public.cancel_workout(id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.workout_sessions;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  select * into v_row from public.workout_sessions s where s.id = cancel_workout.id and s.user_id = v_user for update;
  if not found then
    raise exception 'not_found: la sesion no existe' using errcode = 'P0002';
  end if;
  if v_row.status in ('in_progress', 'completed') then
    raise exception 'invalid_transition: una sesion en curso o realizada no se cancela' using errcode = '22023';
  end if;
  if v_row.status = 'planned' then
    update public.workout_sessions s set status = 'cancelled' where s.id = v_row.id returning * into v_row;
  end if;
  return private.session_move_result(v_row);
end
$$;

revoke all on function public.cancel_workout(uuid) from public, anon;
grant execute on function public.cancel_workout(uuid) to authenticated;

-- Empezar una sesión planificada --------------------------------------------------------------------------------------------
create function private.start_planned_workout_at(
  p_user uuid,
  p_id uuid,
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
  v_row public.workout_sessions;
  v_change public.session_date_changes;
begin
  if p_request is null then
    raise exception 'invalid_session:request_required:request_id' using errcode = '22023';
  end if;

  -- Idempotencia del movimiento de fecha que acompañó al inicio.
  select * into v_change from public.session_date_changes c where c.user_id = p_user and c.client_request_id = p_request;
  if found then
    select * into v_row from public.workout_sessions s where s.id = v_change.session_id;
    return private.session_brief(v_row);
  end if;

  select * into v_row from public.workout_sessions s where s.id = p_id and s.user_id = p_user for update;
  if not found then
    raise exception 'not_found: la sesion no existe' using errcode = 'P0002';
  end if;
  if v_row.status = 'in_progress' then
    return private.session_brief(v_row);
  end if;
  if v_row.status <> 'planned' then
    raise exception 'invalid_transition: solo se empieza una sesion planificada' using errcode = '22023';
  end if;

  v_today := (p_now at time zone p_zone)::date;
  v_date := coalesce(p_date, v_today);
  if v_date > v_today or v_row.session_date > v_today or v_date < date '2000-01-01' then
    raise exception 'invalid_date: hay que reprogramar antes de empezar una sesion futura' using errcode = '22023';
  end if;

  select s.id into v_open from public.workout_sessions s where s.user_id = p_user and s.status = 'in_progress';
  if found then
    raise exception 'session_in_progress:%: ya hay una sesion en curso', v_open using errcode = '55006';
  end if;

  begin
    if v_date <> v_row.session_date then
      insert into public.session_date_changes (session_id, user_id, from_date, to_date, client_request_id)
      values (v_row.id, p_user, v_row.session_date, v_date, p_request);
    end if;
    update public.workout_sessions s
      set status = 'in_progress', started_at = p_now, session_date = v_date,
          rescheduled_count = s.rescheduled_count + case when v_date <> v_row.session_date then 1 else 0 end
      where s.id = v_row.id
      returning * into v_row;
  exception when unique_violation then
    select s.id into v_open from public.workout_sessions s where s.user_id = p_user and s.status = 'in_progress';
    if found then
      raise exception 'session_in_progress:%: ya hay una sesion en curso', v_open using errcode = '55006';
    end if;
    raise;
  end;
  return private.session_brief(v_row);
end
$$;

revoke all on function private.start_planned_workout_at(uuid, uuid, date, uuid, timestamptz, text)
  from public, anon, authenticated;

create function public.start_planned_workout(
  id uuid,
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
  return private.start_planned_workout_at(
    v_user, id, session_date, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.start_planned_workout(uuid, date, uuid, text) from public, anon;
grant execute on function public.start_planned_workout(uuid, date, uuid, text) to authenticated;

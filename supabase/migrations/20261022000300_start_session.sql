-- T024 (spec 006, FR-007, FR-009 a FR-011, FR-047): iniciar una sesión vacía.
--
-- El «hoy» lo calcula el servidor con la zona del perfil, no el reloj del dispositivo. La lógica vive en
-- `private.start_session_at`, con la hora y la zona como parámetros, para poder probarla con una hora simulada
-- (el mismo patrón que `set_energy_goal_at` de la spec 004). Una sola sesión en curso por persona: lo garantiza un
-- índice único parcial, y aquí se responde con el id de la abierta para que la interfaz ofrezca continuarla.

-- Resumen de una sesión para las respuestas de las funciones.
create function private.session_brief(p_session public.workout_sessions) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_session.id,
    'session_date', p_session.session_date,
    'status', p_session.status,
    'revision', p_session.revision
  )
$$;

create function private.start_session_at(
  p_user uuid,
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
begin
  if p_request is null then
    raise exception 'invalid_session:request_required:request_id' using errcode = '22023';
  end if;

  -- Idempotencia: la solicitud ya se guardó (también si es un reintento tardío, con la sesión ya terminada).
  select * into v_row from public.workout_sessions s where s.user_id = p_user and s.client_request_id = p_request;
  if found then
    return private.session_brief(v_row);
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
    insert into public.workout_sessions (user_id, session_date, original_date, status, started_at, client_request_id)
    values (p_user, v_date, v_date, 'in_progress', p_now, p_request)
    returning * into v_row;
  exception when unique_violation then
    -- Dos solicitudes a la vez: gana la primera. La segunda devuelve su sesión o avisa de la abierta.
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

  return private.session_brief(v_row);
end
$$;

revoke all on function private.session_brief(public.workout_sessions) from public, anon, authenticated;
revoke all on function private.start_session_at(uuid, date, uuid, timestamptz, text) from public, anon, authenticated;

-- Devuelve { id, session_date, status, revision }. `session_date` nulo es hoy; no puede ser futura.
create function public.start_session(session_date date default null, request_id uuid default null, client_timezone text default null)
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
  return private.start_session_at(
    v_user, session_date, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.start_session(date, uuid, text) from public, anon;
grant execute on function public.start_session(date, uuid, text) to authenticated;

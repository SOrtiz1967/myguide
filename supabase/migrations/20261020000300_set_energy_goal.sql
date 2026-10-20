-- T022 (spec 004, FR-001, FR-003 a FR-006, FR-008, FR-009, FR-023, FR-024): escribir el objetivo.
--
-- El cliente no inserta en `energy_goals`: llama a `set_energy_goal`, que fija el día de vigencia con el
-- "hoy" de la persona en el servidor (no con el reloj del dispositivo) y es idempotente por `request_id`
-- (research, Decisión 2). La lógica vive en `private.set_energy_goal_at`, con la hora y la zona como
-- parámetros, para poder probarla con una hora simulada (el mismo patrón que `log_day_status_at`).

create function private.set_energy_goal_at(
  p_user uuid,
  p_kcal integer,
  p_request uuid,
  p_now timestamptz,
  p_zone text
)
returns table (effective_from date, kcal integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row public.energy_goals;
  v_today date;
begin
  if p_request is null then
    raise exception 'invalid_goal:request_required:request_id' using errcode = '22023';
  end if;

  -- Idempotencia: la solicitud ya se guardó (también si es un reintento tardío, después de otro cambio).
  select * into v_row
  from public.energy_goals g
  where g.user_id = p_user and g.client_request_id = p_request;
  if found then
    return query select v_row.effective_from, v_row.kcal;
    return;
  end if;

  if p_kcal is not null and (p_kcal < 1000 or p_kcal > 6000) then
    raise exception 'invalid_goal:out_of_range:kcal' using errcode = '22023';
  end if;

  -- El cambio rige desde el día de hoy de la persona, aunque esté registrando el día que se cierra.
  select s.today into v_today from private.log_day_status_at(p_user, p_now, p_zone) s;

  insert into public.energy_goals (user_id, effective_from, kcal, client_request_id, created_at)
  values (p_user, v_today, p_kcal, p_request, p_now)
  on conflict on constraint energy_goals_request_key do nothing
  returning * into v_row;

  -- Dos solicitudes iguales a la vez: pierde la segunda y devuelve la fila de la ganadora.
  if not found then
    select * into v_row
    from public.energy_goals g
    where g.user_id = p_user and g.client_request_id = p_request;
  end if;

  return query select v_row.effective_from, v_row.kcal;
end
$$;

revoke all on function private.set_energy_goal_at(uuid, integer, uuid, timestamptz, text) from public, anon, authenticated;

-- Devuelve un objeto { effective_from, kcal }. `kcal` nulo quita el objetivo.
create function public.set_energy_goal(kcal integer, request_id uuid, client_timezone text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_result record;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  select * into v_result
  from private.set_energy_goal_at(
    v_user, kcal, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );

  return jsonb_build_object('effective_from', v_result.effective_from, 'kcal', v_result.kcal);
end
$$;

revoke all on function public.set_energy_goal(integer, uuid, text) from public, anon;
grant execute on function public.set_energy_goal(integer, uuid, text) to authenticated;

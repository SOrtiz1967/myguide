-- T049 (spec 003, FR-024 a FR-027): la regla del día.
--
-- El día corta a las 00:00 en la zona horaria del perfil. Mientras la persona no haya empezado a registrar
-- el día nuevo, se le propone imputar al que se está cerrando (sin límite de hora). La propuesta solo
-- orienta: cada ítem guarda la fecha con la que se registró y nada la mueve después.

-- `private.log_day_status_at`: la lógica, con la hora y la zona como parámetros para poder probarla con
-- una hora simulada. El cliente no la ejecuta; la pública la llama siempre con `now()`.
create function private.log_day_status_at(p_user uuid, p_now timestamptz, p_zone text)
returns table (today date, proposed_date date, closing boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_closing boolean;
begin
  v_today := (p_now at time zone p_zone)::date;

  v_closing :=
    not exists (select 1 from public.meal_entries e where e.user_id = p_user and e.log_date = v_today)
    and not exists (select 1 from public.log_day_starts s where s.user_id = p_user and s.log_date = v_today)
    and exists (select 1 from public.meal_entries e where e.user_id = p_user and e.log_date = v_today - 1);

  return query select v_today, case when v_closing then v_today - 1 else v_today end, v_closing;
end
$$;

revoke all on function private.log_day_status_at(uuid, timestamptz, text) from public, anon, authenticated;

-- La zona que manda: la del perfil; si no tiene, la del dispositivo (si es válida); si no, UTC.
create function private.effective_timezone(p_user uuid, p_client_timezone text) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.timezone from public.profiles p where p.user_id = p_user),
    (select n.name from pg_catalog.pg_timezone_names n where n.name = p_client_timezone limit 1),
    'UTC'
  );
$$;

revoke all on function private.effective_timezone(uuid, text) from public, anon, authenticated;

create function public.log_day_status(client_timezone text default null)
returns table (today date, proposed_date date, closing boolean)
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
    select s.today, s.proposed_date, s.closing
    from private.log_day_status_at(v_user, now(), private.effective_timezone(v_user, client_timezone)) s;
end
$$;

revoke all on function public.log_day_status(text) from public, anon;
grant execute on function public.log_day_status(text) to authenticated;

-- "Empezar el día de hoy": deja de proponer el día que se cierra. Idempotente; solo admite el "hoy" de la
-- persona, así que no se puede marcar un día cualquiera.
create function public.start_log_day(day date, client_timezone text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  select s.today into v_today
  from private.log_day_status_at(v_user, now(), private.effective_timezone(v_user, client_timezone)) s;

  if day is distinct from v_today then
    raise exception 'invalid_day: solo se puede empezar el dia de hoy' using errcode = '22023';
  end if;

  insert into public.log_day_starts (user_id, log_date) values (v_user, day)
  on conflict do nothing;
end
$$;

revoke all on function public.start_log_day(date, text) from public, anon;
grant execute on function public.start_log_day(date, text) to authenticated;

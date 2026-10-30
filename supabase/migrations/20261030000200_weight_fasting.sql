-- Spec 020: peso en ayunas (opcional).
--
-- Cada peso puede marcarse «en ayunas». Sin la marca el registro queda «sin indicar»: no se afirma que no lo fuera. Solo
-- el peso admite la marca. Las funciones de guardar y corregir reciben un parámetro nuevo al final (`fasting`, por omisión
-- falso), así que las llamadas anteriores siguen funcionando igual. Se recrean porque Postgres no permite cambiar la lista
-- de parámetros de una función existente.

alter table public.body_measurements add column fasting boolean not null default false;
alter table public.body_measurements
  add constraint body_measurements_fasting_check check (not fasting or kind = 'weight');

create or replace function private.measurement_json(p_row public.body_measurements) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_row.id, 'kind', p_row.kind, 'value', p_row.value, 'measured_on', p_row.measured_on, 'note', p_row.note,
    'fasting', p_row.fasting
  )
$$;

drop function public.save_measurement(text, numeric, date, text, uuid, text);
drop function private.save_measurement_at(uuid, text, numeric, date, text, uuid, timestamptz, text);
drop function public.update_measurement(uuid, numeric, date, text, text);
drop function private.update_measurement_at(uuid, uuid, numeric, date, text, timestamptz, text);

create function private.save_measurement_at(
  p_user uuid,
  p_kind text,
  p_value numeric,
  p_date date,
  p_note text,
  p_request uuid,
  p_now timestamptz,
  p_zone text,
  p_fasting boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
  v_fasting boolean := coalesce(p_fasting, false);
  v_row public.body_measurements;
begin
  if p_request is null then
    raise exception 'invalid_measurement:request_required:request_id' using errcode = '22023';
  end if;
  select * into v_row from public.body_measurements m where m.user_id = p_user and m.client_request_id = p_request;
  if found then
    return private.measurement_json(v_row);
  end if;

  v_note := private.check_measurement(p_kind, p_value, p_date, p_note, (p_now at time zone p_zone)::date);
  if v_fasting and p_kind <> 'weight' then
    raise exception 'invalid_measurement:fasting_invalid:fasting' using errcode = '22023';
  end if;

  begin
    insert into public.body_measurements (user_id, kind, value, measured_on, note, fasting, client_request_id)
    values (p_user, p_kind, p_value, p_date, v_note, v_fasting, p_request)
    on conflict (user_id, kind, measured_on)
    do update set value = excluded.value, note = excluded.note, fasting = excluded.fasting,
                  client_request_id = excluded.client_request_id
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.body_measurements m where m.user_id = p_user and m.client_request_id = p_request;
    if not found then
      raise;
    end if;
  end;
  return private.measurement_json(v_row);
end
$$;

revoke all on function private.save_measurement_at(uuid, text, numeric, date, text, uuid, timestamptz, text, boolean)
  from public, anon, authenticated;

create function public.save_measurement(
  kind text,
  value numeric,
  measured_on date,
  note text default null,
  request_id uuid default null,
  client_timezone text default null,
  fasting boolean default false
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
  return private.save_measurement_at(
    v_user, kind, value, measured_on, note, request_id, now(), private.effective_timezone(v_user, client_timezone),
    fasting
  );
end
$$;

revoke all on function public.save_measurement(text, numeric, date, text, uuid, text, boolean) from public, anon;
grant execute on function public.save_measurement(text, numeric, date, text, uuid, text, boolean) to authenticated;

create function private.update_measurement_at(
  p_user uuid,
  p_id uuid,
  p_value numeric,
  p_date date,
  p_note text,
  p_now timestamptz,
  p_zone text,
  p_fasting boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.body_measurements;
  v_note text;
  v_fasting boolean := coalesce(p_fasting, false);
begin
  select * into v_row from public.body_measurements m where m.id = p_id and m.user_id = p_user for update;
  if not found then
    raise exception 'not_found: el registro no existe' using errcode = 'P0002';
  end if;
  v_note := private.check_measurement(v_row.kind, p_value, p_date, p_note, (p_now at time zone p_zone)::date);
  if v_fasting and v_row.kind <> 'weight' then
    raise exception 'invalid_measurement:fasting_invalid:fasting' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.body_measurements m
    where m.user_id = p_user and m.kind = v_row.kind and m.measured_on = p_date and m.id <> p_id
  ) then
    raise exception 'invalid_measurement:date_taken:measured_on' using errcode = '22023';
  end if;
  update public.body_measurements m
    set value = p_value, measured_on = p_date, note = v_note, fasting = v_fasting
    where m.id = p_id
    returning * into v_row;
  return private.measurement_json(v_row);
end
$$;

revoke all on function private.update_measurement_at(uuid, uuid, numeric, date, text, timestamptz, text, boolean)
  from public, anon, authenticated;

create function public.update_measurement(
  id uuid,
  value numeric,
  measured_on date,
  note text default null,
  client_timezone text default null,
  fasting boolean default false
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
  return private.update_measurement_at(
    v_user, id, value, measured_on, note, now(), private.effective_timezone(v_user, client_timezone), fasting
  );
end
$$;

revoke all on function public.update_measurement(uuid, numeric, date, text, text, boolean) from public, anon;
grant execute on function public.update_measurement(uuid, numeric, date, text, text, boolean) to authenticated;

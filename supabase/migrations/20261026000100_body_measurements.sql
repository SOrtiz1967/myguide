-- Spec 008 (versión mínima): peso corporal y medidas (cintura, cadera, pecho, brazo y muslo).
--
-- Un valor por medida y por día. El cliente LEE y BORRA lo propio; nunca inserta ni actualiza directamente: todo pasa
-- por las funciones `save_measurement` y `update_measurement` (security definer, con el dueño y la sesión verificados).
-- Los errores tienen la forma `invalid_measurement:<motivo>:<campo>` y no incluyen el valor de la persona.

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  -- Kilogramos para el peso y centímetros para las demás medidas.
  value numeric(6, 1) not null,
  measured_on date not null,
  note text,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint body_measurements_kind_check check (kind in ('weight', 'waist', 'hips', 'chest', 'arm', 'thigh')),
  constraint body_measurements_range_check check (
    (kind = 'weight' and value between 20 and 500) or (kind <> 'weight' and value between 10 and 300)
  ),
  constraint body_measurements_date_check check (measured_on >= date '2000-01-01'),
  constraint body_measurements_note_check check (note is null or char_length(note) between 1 and 200),
  constraint body_measurements_day_key unique (user_id, kind, measured_on),
  constraint body_measurements_request_key unique (user_id, client_request_id)
);

create index body_measurements_history_idx on public.body_measurements (user_id, kind, measured_on desc);

create trigger body_measurements_set_updated_at
  before update on public.body_measurements
  for each row execute function private.set_updated_at();

alter table public.body_measurements enable row level security;

revoke all on public.body_measurements from anon, authenticated;
grant all on public.body_measurements to service_role;
grant select, delete on public.body_measurements to authenticated;

create policy body_measurements_select_own on public.body_measurements
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy body_measurements_delete_own on public.body_measurements
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

-- Validación común: devuelve la nota recortada (o nula) y lanza el error con el motivo y el campo.
create function private.check_measurement(
  p_kind text,
  p_value numeric,
  p_date date,
  p_note text,
  p_today date
) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_kind is null or p_kind not in ('weight', 'waist', 'hips', 'chest', 'arm', 'thigh') then
    raise exception 'invalid_measurement:kind_invalid:kind' using errcode = '22023';
  end if;
  if p_value is null
     or p_value <> round(p_value, 1)
     or (p_kind = 'weight' and p_value not between 20 and 500)
     or (p_kind <> 'weight' and p_value not between 10 and 300) then
    raise exception 'invalid_measurement:out_of_range:value' using errcode = '22023';
  end if;
  if p_date is null or p_date < date '2000-01-01' then
    raise exception 'invalid_measurement:date_invalid:measured_on' using errcode = '22023';
  end if;
  if p_date > p_today then
    raise exception 'invalid_measurement:date_future:measured_on' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'invalid_measurement:note_too_long:note' using errcode = '22023';
  end if;
  return v_note;
end
$$;

revoke all on function private.check_measurement(text, numeric, date, text, date) from public, anon, authenticated;

create function private.measurement_json(p_row public.body_measurements) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_row.id, 'kind', p_row.kind, 'value', p_row.value, 'measured_on', p_row.measured_on, 'note', p_row.note
  )
$$;

revoke all on function private.measurement_json(public.body_measurements) from public, anon, authenticated;

-- Guardar: un valor por medida y día; guardar de nuevo en el mismo día reemplaza el anterior.
create function private.save_measurement_at(
  p_user uuid,
  p_kind text,
  p_value numeric,
  p_date date,
  p_note text,
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
  v_note text;
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

  begin
    insert into public.body_measurements (user_id, kind, value, measured_on, note, client_request_id)
    values (p_user, p_kind, p_value, p_date, v_note, p_request)
    on conflict (user_id, kind, measured_on)
    do update set value = excluded.value, note = excluded.note, client_request_id = excluded.client_request_id
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

revoke all on function private.save_measurement_at(uuid, text, numeric, date, text, uuid, timestamptz, text)
  from public, anon, authenticated;

create function public.save_measurement(
  kind text,
  value numeric,
  measured_on date,
  note text default null,
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
  return private.save_measurement_at(
    v_user, kind, value, measured_on, note, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.save_measurement(text, numeric, date, text, uuid, text) from public, anon;
grant execute on function public.save_measurement(text, numeric, date, text, uuid, text) to authenticated;

-- Corregir un registro: cambia el valor, la fecha y la nota. Si la fecha ya tiene un valor de esa medida, avisa.
create function private.update_measurement_at(
  p_user uuid,
  p_id uuid,
  p_value numeric,
  p_date date,
  p_note text,
  p_now timestamptz,
  p_zone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.body_measurements;
  v_note text;
begin
  select * into v_row from public.body_measurements m where m.id = p_id and m.user_id = p_user for update;
  if not found then
    raise exception 'not_found: el registro no existe' using errcode = 'P0002';
  end if;
  v_note := private.check_measurement(v_row.kind, p_value, p_date, p_note, (p_now at time zone p_zone)::date);
  if exists (
    select 1 from public.body_measurements m
    where m.user_id = p_user and m.kind = v_row.kind and m.measured_on = p_date and m.id <> p_id
  ) then
    raise exception 'invalid_measurement:date_taken:measured_on' using errcode = '22023';
  end if;
  update public.body_measurements m
    set value = p_value, measured_on = p_date, note = v_note
    where m.id = p_id
    returning * into v_row;
  return private.measurement_json(v_row);
end
$$;

revoke all on function private.update_measurement_at(uuid, uuid, numeric, date, text, timestamptz, text)
  from public, anon, authenticated;

create function public.update_measurement(
  id uuid,
  value numeric,
  measured_on date,
  note text default null,
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
  return private.update_measurement_at(
    v_user, id, value, measured_on, note, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.update_measurement(uuid, numeric, date, text, text) from public, anon;
grant execute on function public.update_measurement(uuid, numeric, date, text, text) to authenticated;

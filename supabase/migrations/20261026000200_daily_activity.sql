-- Spec 007: sueño, pasos y minutos de actividad, registro manual.
--
-- Un valor por tipo, por día y por fuente (hoy solo «manual»). El cliente LEE y BORRA lo propio; nunca inserta ni
-- actualiza directamente: todo pasa por `save_activity` y `update_activity` (security definer, con el dueño y la sesión
-- verificados). Los errores tienen la forma `invalid_activity:<motivo>:<campo>` y no incluyen el valor de la persona.

create table public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  -- Minutos para el sueño y la actividad; cantidad de pasos para los pasos.
  value integer not null,
  activity_date date not null,
  source text not null default 'manual',
  note text,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_activity_kind_check check (kind in ('sleep', 'steps', 'active_minutes')),
  constraint daily_activity_source_check check (source in ('manual')),
  constraint daily_activity_range_check check (
    (kind = 'sleep' and value between 1 and 1440)
    or (kind = 'steps' and value between 0 and 200000)
    or (kind = 'active_minutes' and value between 0 and 1440)
  ),
  constraint daily_activity_date_check check (activity_date >= date '2000-01-01'),
  constraint daily_activity_note_check check (note is null or char_length(note) between 1 and 200),
  constraint daily_activity_day_key unique (user_id, kind, activity_date, source),
  constraint daily_activity_request_key unique (user_id, client_request_id)
);

create index daily_activity_history_idx on public.daily_activity (user_id, kind, activity_date desc);

create trigger daily_activity_set_updated_at
  before update on public.daily_activity
  for each row execute function private.set_updated_at();

alter table public.daily_activity enable row level security;

revoke all on public.daily_activity from anon, authenticated;
grant all on public.daily_activity to service_role;
grant select, delete on public.daily_activity to authenticated;

create policy daily_activity_select_own on public.daily_activity
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy daily_activity_delete_own on public.daily_activity
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create function private.check_activity(
  p_kind text,
  p_value integer,
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
  if p_kind is null or p_kind not in ('sleep', 'steps', 'active_minutes') then
    raise exception 'invalid_activity:kind_invalid:kind' using errcode = '22023';
  end if;
  if p_value is null
     or (p_kind = 'sleep' and p_value not between 1 and 1440)
     or (p_kind = 'steps' and p_value not between 0 and 200000)
     or (p_kind = 'active_minutes' and p_value not between 0 and 1440) then
    raise exception 'invalid_activity:out_of_range:value' using errcode = '22023';
  end if;
  if p_date is null or p_date < date '2000-01-01' then
    raise exception 'invalid_activity:date_invalid:activity_date' using errcode = '22023';
  end if;
  if p_date > p_today then
    raise exception 'invalid_activity:date_future:activity_date' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'invalid_activity:note_too_long:note' using errcode = '22023';
  end if;
  return v_note;
end
$$;

revoke all on function private.check_activity(text, integer, date, text, date) from public, anon, authenticated;

create function private.activity_json(p_row public.daily_activity) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_row.id, 'kind', p_row.kind, 'value', p_row.value, 'activity_date', p_row.activity_date,
    'source', p_row.source, 'note', p_row.note
  )
$$;

revoke all on function private.activity_json(public.daily_activity) from public, anon, authenticated;

create function private.save_activity_at(
  p_user uuid,
  p_kind text,
  p_value integer,
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
  v_row public.daily_activity;
begin
  if p_request is null then
    raise exception 'invalid_activity:request_required:request_id' using errcode = '22023';
  end if;
  select * into v_row from public.daily_activity a where a.user_id = p_user and a.client_request_id = p_request;
  if found then
    return private.activity_json(v_row);
  end if;

  v_note := private.check_activity(p_kind, p_value, p_date, p_note, (p_now at time zone p_zone)::date);

  begin
    insert into public.daily_activity (user_id, kind, value, activity_date, note, client_request_id)
    values (p_user, p_kind, p_value, p_date, v_note, p_request)
    on conflict (user_id, kind, activity_date, source)
    do update set value = excluded.value, note = excluded.note, client_request_id = excluded.client_request_id
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.daily_activity a where a.user_id = p_user and a.client_request_id = p_request;
    if not found then
      raise;
    end if;
  end;
  return private.activity_json(v_row);
end
$$;

revoke all on function private.save_activity_at(uuid, text, integer, date, text, uuid, timestamptz, text)
  from public, anon, authenticated;

create function public.save_activity(
  kind text,
  value integer,
  activity_date date,
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
  return private.save_activity_at(
    v_user, kind, value, activity_date, note, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.save_activity(text, integer, date, text, uuid, text) from public, anon;
grant execute on function public.save_activity(text, integer, date, text, uuid, text) to authenticated;

create function private.update_activity_at(
  p_user uuid,
  p_id uuid,
  p_value integer,
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
  v_row public.daily_activity;
  v_note text;
begin
  select * into v_row from public.daily_activity a where a.id = p_id and a.user_id = p_user for update;
  if not found then
    raise exception 'not_found: el registro no existe' using errcode = 'P0002';
  end if;
  v_note := private.check_activity(v_row.kind, p_value, p_date, p_note, (p_now at time zone p_zone)::date);
  if exists (
    select 1 from public.daily_activity a
    where a.user_id = p_user and a.kind = v_row.kind and a.activity_date = p_date
      and a.source = v_row.source and a.id <> p_id
  ) then
    raise exception 'invalid_activity:date_taken:activity_date' using errcode = '22023';
  end if;
  update public.daily_activity a
    set value = p_value, activity_date = p_date, note = v_note
    where a.id = p_id
    returning * into v_row;
  return private.activity_json(v_row);
end
$$;

revoke all on function private.update_activity_at(uuid, uuid, integer, date, text, timestamptz, text)
  from public, anon, authenticated;

create function public.update_activity(
  id uuid,
  value integer,
  activity_date date,
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
  return private.update_activity_at(
    v_user, id, value, activity_date, note, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.update_activity(uuid, integer, date, text, text) from public, anon;
grant execute on function public.update_activity(uuid, integer, date, text, text) to authenticated;

-- Spec 022: suplementación.
--
-- Cada persona define su propia lista de suplementos (nombre y, si quiere, una dosis escrita por ella como texto libre) y
-- marca cada día cuáles tomó. Un día sin marca es «sin registro»: no existe un estado «olvidado». La aplicación no
-- recomienda suplementos, dosis ni horarios. El cliente LEE lo propio y borra sus suplementos; crear, corregir, archivar
-- y marcar pasan por funciones security definer con el dueño y la sesión verificados. Los errores tienen la forma
-- `invalid_supplement:<motivo>:<campo>` y no incluyen datos de la persona.

create table public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  dose text,
  -- Archivar lo oculta de la lista de cada día pero conserva sus marcas pasadas.
  archived_at timestamptz,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint supplements_name_check check (char_length(name) between 1 and 60 and name = btrim(name)),
  constraint supplements_dose_check check (dose is null or (char_length(dose) between 1 and 60 and dose = btrim(dose))),
  constraint supplements_request_key unique (user_id, client_request_id)
);

-- Entre los no archivados el nombre es único (sin distinguir mayúsculas).
create unique index supplements_active_name_key on public.supplements (user_id, lower(name)) where archived_at is null;
create index supplements_user_idx on public.supplements (user_id, archived_at);

create trigger supplements_set_updated_at
  before update on public.supplements
  for each row execute function private.set_updated_at();

create table public.supplement_marks (
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_on date not null,
  created_at timestamptz not null default now(),

  constraint supplement_marks_pkey primary key (supplement_id, taken_on),
  constraint supplement_marks_date_check check (taken_on >= date '2000-01-01')
);

create index supplement_marks_user_day_idx on public.supplement_marks (user_id, taken_on);

alter table public.supplements enable row level security;
alter table public.supplement_marks enable row level security;

revoke all on public.supplements, public.supplement_marks from anon, authenticated;
grant all on public.supplements, public.supplement_marks to service_role;
grant select, delete on public.supplements to authenticated;
grant select on public.supplement_marks to authenticated;

create policy supplements_select_own on public.supplements
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy supplements_delete_own on public.supplements
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy supplement_marks_select_own on public.supplement_marks
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create function private.supplement_json(p_row public.supplements) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_row.id, 'name', p_row.name, 'dose', p_row.dose, 'archived', p_row.archived_at is not null
  )
$$;

revoke all on function private.supplement_json(public.supplements) from public, anon, authenticated;

-- Valida y normaliza el nombre y la dosis; devuelve el nombre recortado y deja la dosis en `p_dose_out`.
create function private.check_supplement(p_name text, p_dose text, out v_name text, out v_dose text)
language plpgsql
immutable
set search_path = ''
as $$
begin
  v_name := btrim(coalesce(p_name, ''));
  v_dose := nullif(btrim(coalesce(p_dose, '')), '');
  if v_name = '' then
    raise exception 'invalid_supplement:name_required:name' using errcode = '22023';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'invalid_supplement:name_too_long:name' using errcode = '22023';
  end if;
  if v_dose is not null and char_length(v_dose) > 60 then
    raise exception 'invalid_supplement:dose_too_long:dose' using errcode = '22023';
  end if;
end
$$;

revoke all on function private.check_supplement(text, text) from public, anon, authenticated;

-- Crear: idempotente por `request_id`; hasta 30 suplementos sin archivar; el nombre no se repite entre ellos.
create function public.create_supplement(name text, dose text default null, request_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_dose text;
  v_row public.supplements;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if request_id is null then
    raise exception 'invalid_supplement:request_required:request_id' using errcode = '22023';
  end if;
  select * into v_row from public.supplements s where s.user_id = v_user and s.client_request_id = request_id;
  if found then
    return private.supplement_json(v_row);
  end if;

  select c.v_name, c.v_dose into v_name, v_dose from private.check_supplement(name, dose) c;
  if (select count(*) from public.supplements s where s.user_id = v_user and s.archived_at is null) >= 30 then
    raise exception 'invalid_supplement:limit_reached:name' using errcode = '22023';
  end if;

  begin
    insert into public.supplements (user_id, name, dose, client_request_id)
    values (v_user, v_name, v_dose, request_id)
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.supplements s where s.user_id = v_user and s.client_request_id = request_id;
    if found then
      return private.supplement_json(v_row);
    end if;
    raise exception 'invalid_supplement:name_taken:name' using errcode = '22023';
  end;
  return private.supplement_json(v_row);
end
$$;

revoke all on function public.create_supplement(text, text, uuid) from public, anon;
grant execute on function public.create_supplement(text, text, uuid) to authenticated;

-- Corregir el nombre y la dosis.
create function public.update_supplement(id uuid, name text, dose text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_dose text;
  v_row public.supplements;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  select c.v_name, c.v_dose into v_name, v_dose from private.check_supplement(name, dose) c;
  begin
    update public.supplements s set name = v_name, dose = v_dose
      where s.id = update_supplement.id and s.user_id = v_user
      returning * into v_row;
  exception when unique_violation then
    raise exception 'invalid_supplement:name_taken:name' using errcode = '22023';
  end;
  if not found then
    raise exception 'not_found: el suplemento no existe' using errcode = 'P0002';
  end if;
  return private.supplement_json(v_row);
end
$$;

revoke all on function public.update_supplement(uuid, text, text) from public, anon;
grant execute on function public.update_supplement(uuid, text, text) to authenticated;

-- Archivar o restaurar. Restaurar falla si ya hay uno sin archivar con el mismo nombre.
create function public.set_supplement_archived(id uuid, archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.supplements;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if not archived and (select count(*) from public.supplements s where s.user_id = v_user and s.archived_at is null) >= 30 then
    raise exception 'invalid_supplement:limit_reached:name' using errcode = '22023';
  end if;
  begin
    update public.supplements s
      set archived_at = case when archived then coalesce(s.archived_at, now()) else null end
      where s.id = set_supplement_archived.id and s.user_id = v_user
      returning * into v_row;
  exception when unique_violation then
    raise exception 'invalid_supplement:name_taken:name' using errcode = '22023';
  end;
  if not found then
    raise exception 'not_found: el suplemento no existe' using errcode = 'P0002';
  end if;
  return private.supplement_json(v_row);
end
$$;

revoke all on function public.set_supplement_archived(uuid, boolean) from public, anon;
grant execute on function public.set_supplement_archived(uuid, boolean) to authenticated;

-- Marcar (o quitar la marca de) un suplemento en un día. Un día sin marca queda «sin registro». No admite fechas futuras.
create function private.set_supplement_taken_at(
  p_user uuid,
  p_supplement uuid,
  p_date date,
  p_taken boolean,
  p_now timestamptz,
  p_zone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.supplements s where s.id = p_supplement and s.user_id = p_user) then
    raise exception 'not_found: el suplemento no existe' using errcode = 'P0002';
  end if;
  if p_date is null or p_date < date '2000-01-01' then
    raise exception 'invalid_supplement:date_invalid:taken_on' using errcode = '22023';
  end if;
  if p_date > (p_now at time zone p_zone)::date then
    raise exception 'invalid_supplement:date_future:taken_on' using errcode = '22023';
  end if;
  if coalesce(p_taken, false) then
    insert into public.supplement_marks (supplement_id, user_id, taken_on)
    values (p_supplement, p_user, p_date)
    on conflict (supplement_id, taken_on) do nothing;
  else
    delete from public.supplement_marks m where m.supplement_id = p_supplement and m.taken_on = p_date;
  end if;
  return jsonb_build_object('supplement_id', p_supplement, 'taken_on', p_date, 'taken', coalesce(p_taken, false));
end
$$;

revoke all on function private.set_supplement_taken_at(uuid, uuid, date, boolean, timestamptz, text)
  from public, anon, authenticated;

create function public.set_supplement_taken(
  supplement_id uuid,
  taken_on date,
  taken boolean default true,
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
  return private.set_supplement_taken_at(
    v_user, supplement_id, taken_on, taken, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.set_supplement_taken(uuid, date, boolean, text) from public, anon;
grant execute on function public.set_supplement_taken(uuid, date, boolean, text) to authenticated;

-- Spec 018: plan semanal de entrenamiento y «marcar como completado».
--
-- El plan es una plantilla: para cada día de la semana (1 = lunes a 7 = domingo, como ISO) a lo sumo una rutina de la
-- persona. Se lee en el momento; NO genera sesiones por adelantado y no toca el catálogo de rutinas (FR-004). El plan
-- apunta a la rutina: si la rutina se elimina, el día queda sin rutina pero conserva su último nombre para decirlo
-- en texto neutral («La rutina que tenías aquí ya no existe»).
--
-- Como en el resto de la spec 006, el cliente LEE lo propio; las escrituras pasan por funciones security definer con el
-- dueño y la sesión verificados. Los errores tienen la forma `invalid_plan:<motivo>:<campo>` y no incluyen datos.

create table public.weekly_plan_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null,
  routine_id uuid references public.routines (id) on delete set null,
  -- Último nombre conocido de la rutina: queda cuando la rutina se elimina.
  routine_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint weekly_plan_days_pkey primary key (user_id, weekday),
  constraint weekly_plan_days_weekday_check check (weekday between 1 and 7),
  constraint weekly_plan_days_name_check check (char_length(routine_name) between 1 and 80)
);

create index weekly_plan_days_routine_idx on public.weekly_plan_days (routine_id) where routine_id is not null;

create trigger weekly_plan_days_set_updated_at
  before update on public.weekly_plan_days
  for each row execute function private.set_updated_at();

alter table public.weekly_plan_days enable row level security;

revoke all on public.weekly_plan_days from anon, authenticated;
grant all on public.weekly_plan_days to service_role;
grant select on public.weekly_plan_days to authenticated;

create policy weekly_plan_days_select_own on public.weekly_plan_days
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

-- Renombrar una rutina actualiza el nombre que recuerda el plan.
create function private.sync_plan_routine_name() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.weekly_plan_days d set routine_name = new.name where d.routine_id = new.id;
  return new;
end
$$;

revoke all on function private.sync_plan_routine_name() from public, anon, authenticated;

create trigger routines_sync_plan_name
  after update of name on public.routines
  for each row when (new.name is distinct from old.name)
  execute function private.sync_plan_routine_name();

-- Asigna (o quita, con routine_id nulo) la rutina de un día de la semana. Devuelve { weekday, routine_id }.
create function public.set_weekly_plan_day(weekday smallint, routine_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_routine public.routines;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if weekday is null or weekday not between 1 and 7 then
    raise exception 'invalid_plan:weekday_invalid:weekday' using errcode = '22023';
  end if;

  if routine_id is null then
    delete from public.weekly_plan_days d where d.user_id = v_user and d.weekday = set_weekly_plan_day.weekday;
    return jsonb_build_object('weekday', weekday, 'routine_id', null);
  end if;

  select * into v_routine from public.routines r where r.id = set_weekly_plan_day.routine_id and r.user_id = v_user;
  if not found then
    raise exception 'not_found: la rutina no existe' using errcode = 'P0002';
  end if;

  insert into public.weekly_plan_days (user_id, weekday, routine_id, routine_name)
  values (v_user, weekday, v_routine.id, v_routine.name)
  on conflict (user_id, weekday)
  do update set routine_id = excluded.routine_id, routine_name = excluded.routine_name;

  return jsonb_build_object('weekday', weekday, 'routine_id', v_routine.id);
end
$$;

revoke all on function public.set_weekly_plan_day(smallint, uuid) from public, anon;
grant execute on function public.set_weekly_plan_day(smallint, uuid) to authenticated;

-- «Marcada como completada, sin detalle» --------------------------------------------------------------------------------
-- Una sesión realizada que guarda el plan de la rutina y NINGUNA serie realizada: lo planificado nunca pasa por
-- realizado (spec 006, FR-016). La marca se quita sola cuando la sesión recibe su primera serie (al cargar el detalle).
alter table public.workout_sessions add column marked_complete boolean not null default false;
alter table public.workout_sessions
  add constraint workout_sessions_marked_complete_check check (not marked_complete or status = 'completed');

create function private.clear_marked_complete() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workout_sessions s set marked_complete = false where s.id = new.session_id and s.marked_complete;
  return new;
end
$$;

revoke all on function private.clear_marked_complete() from public, anon, authenticated;

create trigger session_sets_clear_marked_complete
  after insert on public.session_sets
  for each row execute function private.clear_marked_complete();

create function private.mark_workout_done_at(
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

  begin
    insert into public.workout_sessions (
      user_id, session_date, original_date, status, started_at, finished_at, client_request_id,
      routine_id, routine_name, has_plan, marked_complete
    )
    values (
      p_user, v_date, v_date, 'completed', p_now, p_now, p_request,
      v_routine.id, v_routine.name, true, true
    )
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.workout_sessions s where s.user_id = p_user and s.client_request_id = p_request;
    if found then
      return private.session_brief(v_row);
    end if;
    raise;
  end;

  perform private.copy_routine_plan(v_row.id, p_user, v_routine.id);
  return private.session_brief(v_row);
end
$$;

revoke all on function private.mark_workout_done_at(uuid, uuid, date, uuid, timestamptz, text)
  from public, anon, authenticated;

-- Devuelve { id, session_date, status, revision }.
create function public.mark_workout_done(
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
  return private.mark_workout_done_at(
    v_user, routine_id, session_date, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );
end
$$;

revoke all on function public.mark_workout_done(uuid, date, uuid, text) from public, anon;
grant execute on function public.mark_workout_done(uuid, date, uuid, text) to authenticated;

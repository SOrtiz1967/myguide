-- Spec 025 (perfil de atleta): objetivos con prioridad, disponibilidad, preferencias y contexto de recuperación.
--
-- Extiende el perfil de la spec 014 (`profiles`) sin duplicar sus datos. Los valores que afectan cálculos futuros
-- (objetivos y disponibilidad) son historiales de filas que nunca se actualizan, igual que `energy_goals`
-- (Principio II). Las preferencias y el contexto de recuperación son del presente: una fila por persona.
-- El cliente solo lee; la escritura son las funciones `save_athlete_*` (security definer, sesión fresca,
-- idempotentes por `request_id`). Los errores tienen la forma `invalid_athlete:<motivo>:<campo>`.

-- Objetivos con prioridad (historial) ---------------------------------------------------------------------------
create table public.athlete_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  -- Lista de { kind, priority, label? }: de 1 a 3 objetivos con prioridades 1 a 3 sin repetir.
  goals jsonb not null,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint athlete_goals_goals_check check (jsonb_typeof(goals) = 'array' and jsonb_array_length(goals) between 1 and 3),
  constraint athlete_goals_effective_from_check check (effective_from >= date '2000-01-01'),
  constraint athlete_goals_request_key unique (user_id, client_request_id)
);

create index athlete_goals_history_idx on public.athlete_goals (user_id, created_at desc);

-- Disponibilidad (historial) --------------------------------------------------------------------------------------
create table public.athlete_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  days_per_week smallint not null,
  session_minutes smallint,
  usual_time text,
  place text,
  equipment text[] not null default '{}',
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint athlete_availability_days_check check (days_per_week between 1 and 7),
  constraint athlete_availability_minutes_check check (session_minutes is null or session_minutes between 15 and 240),
  constraint athlete_availability_time_check check (usual_time is null or usual_time in ('morning', 'afternoon', 'evening', 'varies')),
  constraint athlete_availability_place_check check (place is null or place in ('gym', 'home', 'other')),
  constraint athlete_availability_equipment_check check (
    equipment <@ array['barbell', 'dumbbells', 'machines', 'cables', 'bodyweight', 'bands', 'kettlebell', 'bench', 'rack', 'cardio']::text[]
    and cardinality(equipment) <= 10
  ),
  constraint athlete_availability_effective_from_check check (effective_from >= date '2000-01-01'),
  constraint athlete_availability_request_key unique (user_id, client_request_id)
);

create index athlete_availability_history_idx on public.athlete_availability (user_id, created_at desc);

-- Preferencias y contexto de recuperación (una fila por persona) --------------------------------------------------
create table public.athlete_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  priority_muscles text[] not null default '{}',
  meals_per_day smallint,
  usual_sleep_minutes integer,
  perceived_recovery smallint,
  approx_steps integer,
  effort_scale text not null default 'rir',
  last_request_id uuid,
  updated_at timestamptz not null default now(),
  constraint athlete_preferences_muscles_check check (
    priority_muscles <@ array[
      'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
      'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps'
    ]::text[]
    and cardinality(priority_muscles) <= 5
  ),
  constraint athlete_preferences_meals_check check (meals_per_day is null or meals_per_day between 1 and 8),
  constraint athlete_preferences_sleep_check check (usual_sleep_minutes is null or usual_sleep_minutes between 60 and 960),
  constraint athlete_preferences_recovery_check check (perceived_recovery is null or perceived_recovery between 1 and 5),
  constraint athlete_preferences_steps_check check (approx_steps is null or approx_steps between 0 and 100000),
  constraint athlete_preferences_scale_check check (effort_scale in ('rir', 'rpe'))
);

-- Preferencias por ítem del catálogo ---------------------------------------------------------------------------------
create table public.athlete_item_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  exercise_id uuid references public.exercises (id) on delete cascade,
  food_id uuid references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint athlete_item_preferences_kind_check check (kind in ('exercise_favorite', 'exercise_avoided', 'food_avoided')),
  -- Exactamente uno de los dos ítems, según el tipo.
  constraint athlete_item_preferences_item_check check (
    (kind in ('exercise_favorite', 'exercise_avoided') and exercise_id is not null and food_id is null)
    or (kind = 'food_avoided' and food_id is not null and exercise_id is null)
  )
);

create unique index athlete_item_preferences_exercise_key
  on public.athlete_item_preferences (user_id, kind, exercise_id) where exercise_id is not null;
create unique index athlete_item_preferences_food_key
  on public.athlete_item_preferences (user_id, kind, food_id) where food_id is not null;
-- Un ejercicio no puede ser favorito y evitado a la vez.
create unique index athlete_item_preferences_exercise_once
  on public.athlete_item_preferences (user_id, exercise_id) where exercise_id is not null;

-- Seguridad: RLS, lectura propia con sesión fresca, sin escritura directa ----------------------------------------
alter table public.athlete_goals enable row level security;
alter table public.athlete_availability enable row level security;
alter table public.athlete_preferences enable row level security;
alter table public.athlete_item_preferences enable row level security;

revoke all on public.athlete_goals, public.athlete_availability, public.athlete_preferences, public.athlete_item_preferences
  from anon, authenticated;
grant all on public.athlete_goals, public.athlete_availability, public.athlete_preferences, public.athlete_item_preferences
  to service_role;
grant select on public.athlete_goals, public.athlete_availability, public.athlete_preferences, public.athlete_item_preferences
  to authenticated;

create policy athlete_goals_select_own on public.athlete_goals
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy athlete_availability_select_own on public.athlete_availability
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy athlete_preferences_select_own on public.athlete_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy athlete_item_preferences_select_own on public.athlete_item_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

-- Escritura: objetivos --------------------------------------------------------------------------------------------
-- `p_effective_from` nulo rige desde el "hoy" de la persona; no puede ser anterior a la última vigencia guardada.
-- Con `p_apply_to_profile` y un objetivo de prioridad 1 que tiene equivalente en la spec 014, se actualiza
-- `profiles.goal_type` en la misma transacción. Cambiar el perfil nunca toca el objetivo calórico (FR-009).
create function private.save_athlete_goals_at(
  p_user uuid,
  p_goals jsonb,
  p_effective_from date,
  p_apply boolean,
  p_request uuid,
  p_now timestamptz,
  p_zone text
)
returns table (effective_from date, goals jsonb)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row public.athlete_goals;
  v_today date;
  v_from date;
  v_last date;
  v_item jsonb;
  v_priorities int[] := '{}';
  v_kinds text[] := '{}';
  v_kind text;
  v_priority int;
  v_label text;
  v_top text;
  v_profile_goal text;
begin
  if p_request is null then
    raise exception 'invalid_athlete:request_required:request_id' using errcode = '22023';
  end if;

  select * into v_row from public.athlete_goals g where g.user_id = p_user and g.client_request_id = p_request;
  if found then
    return query select v_row.effective_from, v_row.goals;
    return;
  end if;

  if p_goals is null or jsonb_typeof(p_goals) <> 'array' or jsonb_array_length(p_goals) not between 1 and 3 then
    raise exception 'invalid_athlete:count:goals' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_goals) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_athlete:shape:goals' using errcode = '22023';
    end if;
    v_kind := v_item ->> 'kind';
    if v_kind is null or v_kind not in (
      'hypertrophy', 'strength', 'gradual_fat_loss', 'maintenance', 'recomposition', 'performance', 'fitness', 'custom'
    ) then
      raise exception 'invalid_athlete:kind:goals' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'priority') <> 'number' or (v_item ->> 'priority') !~ '^[1-3]$' then
      raise exception 'invalid_athlete:priority:goals' using errcode = '22023';
    end if;
    v_priority := (v_item ->> 'priority')::int;
    if v_priority = any (v_priorities) then
      raise exception 'invalid_athlete:priority_repeated:goals' using errcode = '22023';
    end if;
    if v_kind = any (v_kinds) and v_kind <> 'custom' then
      raise exception 'invalid_athlete:kind_repeated:goals' using errcode = '22023';
    end if;
    v_label := nullif(btrim(coalesce(v_item ->> 'label', '')), '');
    if v_kind = 'custom' and (v_label is null or char_length(v_label) > 60) then
      raise exception 'invalid_athlete:label:goals' using errcode = '22023';
    end if;
    if v_kind <> 'custom' and v_item ? 'label' and v_item -> 'label' <> 'null'::jsonb then
      raise exception 'invalid_athlete:label_not_allowed:goals' using errcode = '22023';
    end if;
    v_priorities := v_priorities || v_priority;
    v_kinds := v_kinds || v_kind;
    if v_priority = 1 then v_top := v_kind; end if;
  end loop;

  select s.today into v_today from private.log_day_status_at(p_user, p_now, p_zone) s;
  v_from := coalesce(p_effective_from, v_today);
  select max(g.effective_from) into v_last from public.athlete_goals g where g.user_id = p_user;
  if v_last is not null and v_from < v_last then
    raise exception 'invalid_athlete:before_last:effective_from' using errcode = '22023';
  end if;
  if v_from > v_today + 365 then
    raise exception 'invalid_athlete:too_far:effective_from' using errcode = '22023';
  end if;

  insert into public.athlete_goals (user_id, effective_from, goals, client_request_id, created_at)
  values (p_user, v_from, p_goals, p_request, p_now)
  on conflict on constraint athlete_goals_request_key do nothing
  returning * into v_row;

  if not found then
    select * into v_row from public.athlete_goals g where g.user_id = p_user and g.client_request_id = p_request;
    return query select v_row.effective_from, v_row.goals;
    return;
  end if;

  v_profile_goal := case v_top
    when 'hypertrophy' then 'muscle_gain'
    when 'gradual_fat_loss' then 'fat_loss'
    when 'recomposition' then 'recomposition'
    else null
  end;
  if coalesce(p_apply, false) and v_profile_goal is not null then
    update public.profiles set goal_type = v_profile_goal where user_id = p_user;
  end if;

  return query select v_row.effective_from, v_row.goals;
end
$$;

revoke all on function private.save_athlete_goals_at(uuid, jsonb, date, boolean, uuid, timestamptz, text)
  from public, anon, authenticated;

create function public.save_athlete_goals(
  goals jsonb,
  effective_from date,
  apply_to_profile boolean,
  request_id uuid,
  client_timezone text default null
)
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
  from private.save_athlete_goals_at(
    v_user, goals, effective_from, apply_to_profile, request_id, now(), private.effective_timezone(v_user, client_timezone)
  );

  return jsonb_build_object('effective_from', v_result.effective_from, 'goals', v_result.goals);
end
$$;

revoke all on function public.save_athlete_goals(jsonb, date, boolean, uuid, text) from public, anon;
grant execute on function public.save_athlete_goals(jsonb, date, boolean, uuid, text) to authenticated;

-- Escritura: disponibilidad ---------------------------------------------------------------------------------------
create function private.save_athlete_availability_at(
  p_user uuid,
  p_days smallint,
  p_minutes smallint,
  p_usual_time text,
  p_place text,
  p_equipment text[],
  p_effective_from date,
  p_request uuid,
  p_now timestamptz,
  p_zone text
)
returns table (effective_from date, days_per_week smallint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row public.athlete_availability;
  v_today date;
  v_from date;
  v_last date;
  v_equipment text[] := coalesce(p_equipment, '{}');
begin
  if p_request is null then
    raise exception 'invalid_athlete:request_required:request_id' using errcode = '22023';
  end if;

  select * into v_row from public.athlete_availability a where a.user_id = p_user and a.client_request_id = p_request;
  if found then
    return query select v_row.effective_from, v_row.days_per_week;
    return;
  end if;

  if p_days is null or p_days not between 1 and 7 then
    raise exception 'invalid_athlete:out_of_range:days_per_week' using errcode = '22023';
  end if;
  if p_minutes is not null and p_minutes not between 15 and 240 then
    raise exception 'invalid_athlete:out_of_range:session_minutes' using errcode = '22023';
  end if;
  if p_usual_time is not null and p_usual_time not in ('morning', 'afternoon', 'evening', 'varies') then
    raise exception 'invalid_athlete:invalid_value:usual_time' using errcode = '22023';
  end if;
  if p_place is not null and p_place not in ('gym', 'home', 'other') then
    raise exception 'invalid_athlete:invalid_value:place' using errcode = '22023';
  end if;
  if cardinality(v_equipment) > 10
     or not v_equipment <@ array['barbell', 'dumbbells', 'machines', 'cables', 'bodyweight', 'bands', 'kettlebell', 'bench', 'rack', 'cardio']::text[] then
    raise exception 'invalid_athlete:invalid_value:equipment' using errcode = '22023';
  end if;

  select s.today into v_today from private.log_day_status_at(p_user, p_now, p_zone) s;
  v_from := coalesce(p_effective_from, v_today);
  select max(a.effective_from) into v_last from public.athlete_availability a where a.user_id = p_user;
  if v_last is not null and v_from < v_last then
    raise exception 'invalid_athlete:before_last:effective_from' using errcode = '22023';
  end if;
  if v_from > v_today + 365 then
    raise exception 'invalid_athlete:too_far:effective_from' using errcode = '22023';
  end if;

  insert into public.athlete_availability (
    user_id, effective_from, days_per_week, session_minutes, usual_time, place, equipment, client_request_id, created_at
  )
  values (p_user, v_from, p_days, p_minutes, p_usual_time, p_place, v_equipment, p_request, p_now)
  on conflict on constraint athlete_availability_request_key do nothing
  returning * into v_row;

  if not found then
    select * into v_row from public.athlete_availability a where a.user_id = p_user and a.client_request_id = p_request;
  end if;

  return query select v_row.effective_from, v_row.days_per_week;
end
$$;

revoke all on function private.save_athlete_availability_at(uuid, smallint, smallint, text, text, text[], date, uuid, timestamptz, text)
  from public, anon, authenticated;

create function public.save_athlete_availability(
  days_per_week smallint,
  session_minutes smallint,
  usual_time text,
  place text,
  equipment text[],
  effective_from date,
  request_id uuid,
  client_timezone text default null
)
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
  from private.save_athlete_availability_at(
    v_user, days_per_week, session_minutes, usual_time, place, equipment, effective_from, request_id,
    now(), private.effective_timezone(v_user, client_timezone)
  );

  return jsonb_build_object('effective_from', v_result.effective_from, 'days_per_week', v_result.days_per_week);
end
$$;

revoke all on function public.save_athlete_availability(smallint, smallint, text, text, text[], date, uuid, text) from public, anon;
grant execute on function public.save_athlete_availability(smallint, smallint, text, text, text[], date, uuid, text) to authenticated;

-- Escritura: preferencias -------------------------------------------------------------------------------------------
-- `prefs` reemplaza la fila completa (un dato ausente queda sin valor, nunca en cero): priority_muscles,
-- meals_per_day, usual_sleep_minutes, perceived_recovery, approx_steps, effort_scale y `items` (la lista completa de
-- preferencias por ítem: [{ kind, exercise_id | food_id }]). Cada ejercicio o alimento debe ser del catálogo o propio.
create function public.save_athlete_preferences(prefs jsonb, request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_prefs jsonb := coalesce(prefs, '{}'::jsonb);
  v_muscles text[] := '{}';
  v_item jsonb;
  v_kind text;
  v_exercise uuid;
  v_food uuid;
  v_scale text;
  v_meals smallint;
  v_sleep integer;
  v_recovery smallint;
  v_steps integer;
  v_last uuid;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if request_id is null then
    raise exception 'invalid_athlete:request_required:request_id' using errcode = '22023';
  end if;
  if jsonb_typeof(v_prefs) <> 'object' then
    raise exception 'invalid_athlete:shape:prefs' using errcode = '22023';
  end if;

  -- Idempotencia: la misma solicitud ya se guardó.
  select p.last_request_id into v_last from public.athlete_preferences p where p.user_id = v_user;
  if v_last is not null and v_last = request_id then
    return jsonb_build_object('saved', true, 'repeated', true);
  end if;

  if jsonb_typeof(v_prefs -> 'priority_muscles') = 'array' then
    select coalesce(array_agg(m), '{}') into v_muscles from jsonb_array_elements_text(v_prefs -> 'priority_muscles') m;
  elsif v_prefs ? 'priority_muscles' and jsonb_typeof(v_prefs -> 'priority_muscles') <> 'null' then
    raise exception 'invalid_athlete:shape:priority_muscles' using errcode = '22023';
  end if;
  if cardinality(v_muscles) > 5 then
    raise exception 'invalid_athlete:too_many:priority_muscles' using errcode = '22023';
  end if;
  if not v_muscles <@ array[
      'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
      'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps'
    ]::text[] then
    raise exception 'invalid_athlete:invalid_value:priority_muscles' using errcode = '22023';
  end if;

  v_meals := (v_prefs ->> 'meals_per_day')::smallint;
  v_sleep := (v_prefs ->> 'usual_sleep_minutes')::integer;
  v_recovery := (v_prefs ->> 'perceived_recovery')::smallint;
  v_steps := (v_prefs ->> 'approx_steps')::integer;
  v_scale := coalesce(v_prefs ->> 'effort_scale', 'rir');

  if v_meals is not null and v_meals not between 1 and 8 then
    raise exception 'invalid_athlete:out_of_range:meals_per_day' using errcode = '22023';
  end if;
  if v_sleep is not null and v_sleep not between 60 and 960 then
    raise exception 'invalid_athlete:out_of_range:usual_sleep_minutes' using errcode = '22023';
  end if;
  if v_recovery is not null and v_recovery not between 1 and 5 then
    raise exception 'invalid_athlete:out_of_range:perceived_recovery' using errcode = '22023';
  end if;
  if v_steps is not null and v_steps not between 0 and 100000 then
    raise exception 'invalid_athlete:out_of_range:approx_steps' using errcode = '22023';
  end if;
  if v_scale not in ('rir', 'rpe') then
    raise exception 'invalid_athlete:invalid_value:effort_scale' using errcode = '22023';
  end if;

  -- Lista por ítem: se valida completa antes de escribir nada.
  if v_prefs ? 'items' and jsonb_typeof(v_prefs -> 'items') <> 'array' and jsonb_typeof(v_prefs -> 'items') <> 'null' then
    raise exception 'invalid_athlete:shape:items' using errcode = '22023';
  end if;
  if jsonb_typeof(v_prefs -> 'items') = 'array' then
    if jsonb_array_length(v_prefs -> 'items') > 200 then
      raise exception 'invalid_athlete:too_many:items' using errcode = '22023';
    end if;
    for v_item in select * from jsonb_array_elements(v_prefs -> 'items') loop
      v_kind := v_item ->> 'kind';
      if v_kind is null or v_kind not in ('exercise_favorite', 'exercise_avoided', 'food_avoided') then
        raise exception 'invalid_athlete:kind:items' using errcode = '22023';
      end if;
      v_exercise := (v_item ->> 'exercise_id')::uuid;
      v_food := (v_item ->> 'food_id')::uuid;
      if v_kind = 'food_avoided' then
        if v_food is null or v_exercise is not null
           or not exists (select 1 from public.foods f where f.id = v_food and (f.user_id is null or f.user_id = v_user)) then
          raise exception 'invalid_athlete:item:items' using errcode = '22023';
        end if;
      else
        if v_exercise is null or v_food is not null
           or not exists (select 1 from public.exercises e where e.id = v_exercise and (e.user_id is null or e.user_id = v_user)) then
          raise exception 'invalid_athlete:item:items' using errcode = '22023';
        end if;
      end if;
    end loop;
    -- Un ejercicio no puede ser favorito y evitado a la vez.
    if exists (
      select 1
      from jsonb_array_elements(v_prefs -> 'items') i
      where i ->> 'exercise_id' is not null
      group by i ->> 'exercise_id'
      having count(*) > 1
    ) then
      raise exception 'invalid_athlete:conflict:items' using errcode = '22023';
    end if;
  end if;

  insert into public.athlete_preferences (
    user_id, priority_muscles, meals_per_day, usual_sleep_minutes, perceived_recovery, approx_steps, effort_scale,
    last_request_id, updated_at
  )
  values (v_user, v_muscles, v_meals, v_sleep, v_recovery, v_steps, v_scale, request_id, now())
  on conflict (user_id) do update set
    priority_muscles = excluded.priority_muscles,
    meals_per_day = excluded.meals_per_day,
    usual_sleep_minutes = excluded.usual_sleep_minutes,
    perceived_recovery = excluded.perceived_recovery,
    approx_steps = excluded.approx_steps,
    effort_scale = excluded.effort_scale,
    last_request_id = excluded.last_request_id,
    updated_at = excluded.updated_at;

  if v_prefs ? 'items' then
    delete from public.athlete_item_preferences where user_id = v_user;
    if jsonb_typeof(v_prefs -> 'items') = 'array' then
      insert into public.athlete_item_preferences (user_id, kind, exercise_id, food_id)
      select v_user, i ->> 'kind', (i ->> 'exercise_id')::uuid, (i ->> 'food_id')::uuid
      from jsonb_array_elements(v_prefs -> 'items') i
      on conflict do nothing;
    end if;
  end if;

  return jsonb_build_object('saved', true, 'repeated', false);
end
$$;

revoke all on function public.save_athlete_preferences(jsonb, uuid) from public, anon;
grant execute on function public.save_athlete_preferences(jsonb, uuid) to authenticated;

-- T004 (spec 006): rutinas, calendario y sesiones de entrenamiento. Modelo en
-- specs/006-rutinas-calendario-sesiones/data-model.md.
-- RLS activado SIN políticas: denegado por defecto. Las políticas llegan en la migración siguiente.
--
-- Principio II: el plan y lo realizado son tablas distintas; cada ejercicio (de rutina, de plan y realizado)
-- guarda una INSTANTÁNEA de su nombre y su tipo de medición, y el vínculo con `exercises` es
-- `on delete set null`: editar o eliminar un ejercicio, una rutina o reimportar el catálogo nunca reescribe
-- el pasado.

-- Objetivos y valores por tipo de medición --------------------------------------------------------------------------
-- Qué campos admite cada tipo (los de un objetivo del plan y los de una serie son los mismos). Un `check` no
-- admite subconsultas, por eso va en una función inmutable.
create function private.valid_targets(
  p_type text, p_reps integer, p_weight numeric, p_duration integer, p_distance numeric
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'reps_weight' then p_duration is null and p_distance is null
    when 'reps_bodyweight' then p_weight is null and p_duration is null and p_distance is null
    when 'duration' then p_reps is null and p_weight is null and p_distance is null
    when 'distance_duration' then p_reps is null and p_weight is null
    else false
  end
$$;

-- Rutinas ---------------------------------------------------------------------------------------------------------
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_name_check check (char_length(name) between 1 and 80 and name = btrim(name))
);

create unique index routines_request_key on public.routines (user_id, client_request_id)
  where client_request_id is not null;
create index routines_user_name_idx on public.routines (user_id, name);

create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function private.set_updated_at();

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  measurement_type text not null,
  sets integer not null,
  target_reps integer,
  target_weight_kg numeric(6, 2),
  target_duration_s integer,
  target_distance_km numeric(7, 3),
  created_at timestamptz not null default now(),
  -- El tope de 30 ejercicios por rutina sale del rango de la posición y de que sea única.
  constraint routine_exercises_position_key unique (routine_id, position),
  constraint routine_exercises_position_check check (position between 1 and 30),
  constraint routine_exercises_name_check check (char_length(exercise_name) between 1 and 120 and exercise_name = btrim(exercise_name)),
  constraint routine_exercises_type_check check (
    measurement_type in ('reps_weight', 'reps_bodyweight', 'duration', 'distance_duration')
  ),
  constraint routine_exercises_sets_check check (sets between 1 and 20),
  constraint routine_exercises_target_reps_check check (target_reps is null or target_reps between 1 and 999),
  constraint routine_exercises_target_weight_check check (target_weight_kg is null or target_weight_kg between 0 and 999.9),
  constraint routine_exercises_target_duration_check check (target_duration_s is null or target_duration_s between 1 and 86400),
  constraint routine_exercises_target_distance_check check (target_distance_km is null or (target_distance_km > 0 and target_distance_km <= 999.9)),
  constraint routine_exercises_targets_check check (
    private.valid_targets(measurement_type, target_reps, target_weight_kg, target_duration_s, target_distance_km)
  )
);

create index routine_exercises_routine_idx on public.routine_exercises (routine_id);

-- Sesiones ------------------------------------------------------------------------------------------------------------
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_date date not null,
  original_date date not null,
  status text not null,
  routine_id uuid references public.routines (id) on delete set null,
  routine_name text,
  has_plan boolean not null default false,
  note text,
  modified boolean not null default false,
  rescheduled_count integer not null default 0,
  corrected_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  revision integer not null default 1,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workout_sessions_status_check check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  constraint workout_sessions_dates_check check (session_date >= date '2000-01-01' and original_date >= date '2000-01-01'),
  constraint workout_sessions_routine_name_check check (routine_name is null or char_length(routine_name) between 1 and 80),
  constraint workout_sessions_note_check check (note is null or char_length(note) between 1 and 1000),
  constraint workout_sessions_rescheduled_check check (rescheduled_count >= 0),
  constraint workout_sessions_revision_check check (revision >= 1),
  -- Las horas acompañan al estado: planificada y cancelada no empezaron; en curso empezó y no terminó.
  constraint workout_sessions_times_check check (
    (status in ('planned', 'cancelled') and started_at is null and finished_at is null)
    or (status = 'in_progress' and started_at is not null and finished_at is null)
    or (status = 'completed' and started_at is not null and finished_at is not null)
  ),
  -- «Modificada» y «corregida» solo existen en una sesión realizada; «modificada» solo si tuvo plan.
  constraint workout_sessions_modified_check check (not modified or (status = 'completed' and has_plan)),
  constraint workout_sessions_corrected_check check (corrected_at is null or status = 'completed')
);

create index workout_sessions_day_idx on public.workout_sessions (user_id, session_date);
-- Una sola sesión en curso por persona (FR-009).
create unique index workout_sessions_one_open_key on public.workout_sessions (user_id)
  where status = 'in_progress';
create unique index workout_sessions_request_key on public.workout_sessions (user_id, client_request_id)
  where client_request_id is not null;

create trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row execute function private.set_updated_at();

-- La identidad de una sesión no cambia, y una sesión en curso o realizada no cambia de fecha (FR-024).
create function private.protect_session_identity() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.original_date is distinct from old.original_date
     or new.routine_name is distinct from old.routine_name
     or (new.routine_id is distinct from old.routine_id and new.routine_id is not null) then
    raise exception 'training_identity_immutable: el dueno, la fecha original y la rutina de origen no se pueden cambiar'
      using errcode = '42501';
  end if;
  if old.status in ('in_progress', 'completed') and new.session_date is distinct from old.session_date then
    raise exception 'training_date_immutable: la fecha de una sesion en curso o realizada no cambia'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger workout_sessions_protect_identity
  before update on public.workout_sessions
  for each row execute function private.protect_session_identity();

-- Plan de la sesión (lo que se pensaba hacer) --------------------------------------------------------------------------
create table public.session_plan_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  measurement_type text not null,
  sets integer not null,
  target_reps integer,
  target_weight_kg numeric(6, 2),
  target_duration_s integer,
  target_distance_km numeric(7, 3),
  targets_dropped boolean not null default false,
  created_at timestamptz not null default now(),
  constraint session_plan_items_position_key unique (session_id, position),
  constraint session_plan_items_id_session_key unique (id, session_id),
  constraint session_plan_items_position_check check (position between 1 and 30),
  constraint session_plan_items_name_check check (char_length(exercise_name) between 1 and 120 and exercise_name = btrim(exercise_name)),
  constraint session_plan_items_type_check check (
    measurement_type in ('reps_weight', 'reps_bodyweight', 'duration', 'distance_duration')
  ),
  constraint session_plan_items_sets_check check (sets between 1 and 20),
  constraint session_plan_items_target_reps_check check (target_reps is null or target_reps between 1 and 999),
  constraint session_plan_items_target_weight_check check (target_weight_kg is null or target_weight_kg between 0 and 999.9),
  constraint session_plan_items_target_duration_check check (target_duration_s is null or target_duration_s between 1 and 86400),
  constraint session_plan_items_target_distance_check check (target_distance_km is null or (target_distance_km > 0 and target_distance_km <= 999.9)),
  constraint session_plan_items_targets_check check (
    private.valid_targets(measurement_type, target_reps, target_weight_kg, target_duration_s, target_distance_km)
  )
);

create index session_plan_items_session_idx on public.session_plan_items (session_id);

-- Ejercicios realizados --------------------------------------------------------------------------------------------------
create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  measurement_type text not null,
  plan_item_id uuid,
  is_substitute boolean not null default false,
  effort smallint,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_exercises_position_key unique (session_id, position),
  constraint session_exercises_id_session_key unique (id, session_id),
  constraint session_exercises_position_check check (position between 1 and 30),
  constraint session_exercises_name_check check (char_length(exercise_name) between 1 and 120 and exercise_name = btrim(exercise_name)),
  constraint session_exercises_type_check check (
    measurement_type in ('reps_weight', 'reps_bodyweight', 'duration', 'distance_duration')
  ),
  constraint session_exercises_effort_check check (effort is null or effort between 1 and 10),
  constraint session_exercises_note_check check (note is null or char_length(note) between 1 and 500),
  -- Solo se vincula a un ítem del plan de la MISMA sesión; si se elimina el ítem, el vínculo pasa a nulo.
  constraint session_exercises_plan_item_fkey foreign key (plan_item_id, session_id)
    references public.session_plan_items (id, session_id) on delete set null (plan_item_id)
);

-- Un ítem del plan se cumple con un solo ejercicio realizado (el propio o su sustituto).
create unique index session_exercises_plan_item_key on public.session_exercises (session_id, plan_item_id)
  where plan_item_id is not null;
create index session_exercises_exercise_idx on public.session_exercises (user_id, exercise_id);

create trigger session_exercises_set_updated_at
  before update on public.session_exercises
  for each row execute function private.set_updated_at();

-- Un sustituto debe decir a qué ítem sustituye. Va en un disparador de alta y no en un `check` porque la base
-- pone `plan_item_id` en nulo al borrar el plan (al eliminar la sesión) y un `check` rompería esa cascada.
create function private.check_session_exercise_insert() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_substitute and new.plan_item_id is null then
    raise exception 'substitute_needs_plan_item: un sustituto debe indicar a que item del plan sustituye'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger session_exercises_check_insert
  before insert on public.session_exercises
  for each row execute function private.check_session_exercise_insert();

-- La instantánea (nombre y tipo de medición) no cambia; `exercise_id` solo puede pasar a nulo, que es lo que
-- hace la base al eliminar el ejercicio (FR-034, FR-035, FR-036).
create function private.protect_training_snapshot() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.exercise_name is distinct from old.exercise_name
     or new.measurement_type is distinct from old.measurement_type
     or (new.exercise_id is distinct from old.exercise_id and new.exercise_id is not null) then
    raise exception 'training_snapshot_immutable: el nombre y el tipo de medicion de un ejercicio no se pueden cambiar'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger routine_exercises_protect_snapshot
  before update on public.routine_exercises
  for each row execute function private.protect_training_snapshot();
create trigger session_exercises_protect_snapshot
  before update on public.session_exercises
  for each row execute function private.protect_training_snapshot();

-- El plan es inmutable salvo `exercise_id` a nulo (FR-015): solo se reemplaza entero, y solo mientras la sesión
-- está planificada.
create function private.protect_plan_item() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'exercise_id') is distinct from (to_jsonb(old) - 'exercise_id')
     or (new.exercise_id is distinct from old.exercise_id and new.exercise_id is not null) then
    raise exception 'training_snapshot_immutable: el plan de una sesion no se puede cambiar'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger session_plan_items_protect
  before update on public.session_plan_items
  for each row execute function private.protect_plan_item();

-- Series ----------------------------------------------------------------------------------------------------------------------
create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null,
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null,
  reps integer,
  weight_kg numeric(6, 2),
  duration_s integer,
  distance_km numeric(7, 3),
  created_at timestamptz not null default now(),
  constraint session_sets_exercise_fkey foreign key (session_exercise_id, session_id)
    references public.session_exercises (id, session_id) on delete cascade,
  constraint session_sets_position_key unique (session_exercise_id, position),
  constraint session_sets_position_check check (position between 1 and 20),
  constraint session_sets_reps_check check (reps is null or reps between 1 and 999),
  constraint session_sets_weight_check check (weight_kg is null or weight_kg between 0 and 999.9),
  constraint session_sets_duration_check check (duration_s is null or duration_s between 1 and 86400),
  constraint session_sets_distance_check check (distance_km is null or (distance_km > 0 and distance_km <= 999.9)),
  -- Una serie sin ningún valor no existe (FR-030).
  constraint session_sets_value_check check (num_nonnulls(reps, weight_kg, duration_s, distance_km) >= 1)
);

create index session_sets_session_idx on public.session_sets (session_id);

-- Los valores de una serie deben corresponder al tipo de medición de la instantánea de su ejercicio, y la serie
-- debe ser del mismo dueño y de la misma sesión (FR-028).
create function private.check_session_set() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_exercise record;
begin
  select x.measurement_type, x.session_id, x.user_id into v_exercise
  from public.session_exercises x
  where x.id = new.session_exercise_id;
  if not found or v_exercise.session_id <> new.session_id or v_exercise.user_id <> new.user_id then
    raise exception 'set_shape_invalid: la serie no corresponde a su ejercicio' using errcode = '23514';
  end if;
  if not private.valid_targets(v_exercise.measurement_type, new.reps, new.weight_kg, new.duration_s, new.distance_km) then
    raise exception 'set_shape_invalid: los valores de la serie no corresponden al tipo de medicion' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger session_sets_check
  before insert on public.session_sets
  for each row execute function private.check_session_set();

-- Recorrido de fechas (de solo altas) ---------------------------------------------------------------------------------------
create table public.session_date_changes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  constraint session_date_changes_dates_check check (from_date <> to_date)
);

create unique index session_date_changes_request_key on public.session_date_changes (user_id, client_request_id)
  where client_request_id is not null;
create index session_date_changes_session_idx on public.session_date_changes (session_id, created_at);

-- «Modificada» (FR-019): esqueleto. Devuelve siempre falso hasta que la historia 3 agregue la regla completa. --------------
create function private.compute_session_modified(p_session uuid) returns boolean
language sql
stable
set search_path = ''
as $$
  select false
$$;

revoke all on function private.compute_session_modified(uuid) from public, anon, authenticated;

-- Seguridad: RLS activado sin políticas y sin permisos para el cliente ------------------------------------------------------
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_plan_items enable row level security;
alter table public.session_exercises enable row level security;
alter table public.session_sets enable row level security;
alter table public.session_date_changes enable row level security;

revoke all on public.routines, public.routine_exercises, public.workout_sessions, public.session_plan_items,
  public.session_exercises, public.session_sets, public.session_date_changes from anon, authenticated;
grant all on public.routines, public.routine_exercises, public.workout_sessions, public.session_plan_items,
  public.session_exercises, public.session_sets, public.session_date_changes to service_role;

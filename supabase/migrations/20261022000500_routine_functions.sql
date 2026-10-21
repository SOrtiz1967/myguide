-- T036 (spec 006, FR-001 a FR-005, FR-047): crear, editar y duplicar rutinas de forma atómica e idempotente.
-- Las funciones son `security definer` (con `search_path` vacío): el cliente no escribe en las tablas. Cada una
-- verifica `auth.uid()` y `private.is_session_fresh()`, toma al dueño de la sesión y la instantánea de cada ejercicio
-- (solo de ejercicios VISIBLES para la persona: del catálogo o propios). Los errores tienen la forma
-- `invalid_routine:<motivo>:<campo>`. Borrar una rutina es un `delete` directo permitido por RLS.

-- Valida una rutina y devuelve su forma normalizada, con la instantánea de cada ejercicio.
create function private.clean_routine_input(p_user uuid, p_routine jsonb) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_exercises jsonb;
  v_item jsonb;
  v_exercise uuid;
  v_snapshot record;
  v_sets numeric;
  v_reps integer;
  v_weight numeric;
  v_duration integer;
  v_distance numeric;
  v_out jsonb := '[]'::jsonb;
begin
  if p_routine is null or jsonb_typeof(p_routine) <> 'object' then
    raise exception 'invalid_routine:name_required:name' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(p_routine ->> 'name', ''));
  if v_name = '' then
    raise exception 'invalid_routine:name_required:name' using errcode = '22023';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'invalid_routine:name_too_long:name' using errcode = '22023';
  end if;

  v_exercises := p_routine -> 'exercises';
  if v_exercises is null or jsonb_typeof(v_exercises) <> 'array' or jsonb_array_length(v_exercises) = 0 then
    raise exception 'invalid_routine:exercises_required:exercises' using errcode = '22023';
  end if;
  if jsonb_array_length(v_exercises) > 30 then
    raise exception 'invalid_routine:too_many_exercises:exercises' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_exercises) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_routine:exercise_not_found:exercise_id' using errcode = '22023';
    end if;

    begin
      v_exercise := nullif(v_item ->> 'exercise_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid_routine:exercise_not_found:exercise_id' using errcode = '22023';
    end;
    select * into v_snapshot from private.snapshot_exercise(p_user, v_exercise);
    if not found then
      raise exception 'invalid_routine:exercise_not_found:exercise_id' using errcode = '22023';
    end if;

    if jsonb_typeof(v_item -> 'sets') is distinct from 'number' then
      raise exception 'invalid_routine:invalid_sets:sets' using errcode = '22023';
    end if;
    v_sets := (v_item ->> 'sets')::numeric;
    if v_sets <> trunc(v_sets) or v_sets not between 1 and 20 then
      raise exception 'invalid_routine:invalid_sets:sets' using errcode = '22023';
    end if;

    -- Objetivos opcionales: ausente o nulo es «sin objetivo». Cualquier otra cosa debe ser un número en rango
    -- y corresponder al tipo de medición del ejercicio.
    v_reps := null; v_weight := null; v_duration := null; v_distance := null;
    if v_item ? 'target_reps' and jsonb_typeof(v_item -> 'target_reps') <> 'null' then
      if jsonb_typeof(v_item -> 'target_reps') <> 'number'
         or (v_item ->> 'target_reps')::numeric <> trunc((v_item ->> 'target_reps')::numeric)
         or (v_item ->> 'target_reps')::numeric not between 1 and 999 then
        raise exception 'invalid_routine:invalid_target:targets' using errcode = '22023';
      end if;
      v_reps := (v_item ->> 'target_reps')::integer;
    end if;
    if v_item ? 'target_weight_kg' and jsonb_typeof(v_item -> 'target_weight_kg') <> 'null' then
      if jsonb_typeof(v_item -> 'target_weight_kg') <> 'number'
         or (v_item ->> 'target_weight_kg')::numeric not between 0 and 999.9 then
        raise exception 'invalid_routine:invalid_target:targets' using errcode = '22023';
      end if;
      v_weight := (v_item ->> 'target_weight_kg')::numeric;
    end if;
    if v_item ? 'target_duration_s' and jsonb_typeof(v_item -> 'target_duration_s') <> 'null' then
      if jsonb_typeof(v_item -> 'target_duration_s') <> 'number'
         or (v_item ->> 'target_duration_s')::numeric <> trunc((v_item ->> 'target_duration_s')::numeric)
         or (v_item ->> 'target_duration_s')::numeric not between 1 and 86400 then
        raise exception 'invalid_routine:invalid_target:targets' using errcode = '22023';
      end if;
      v_duration := (v_item ->> 'target_duration_s')::integer;
    end if;
    if v_item ? 'target_distance_km' and jsonb_typeof(v_item -> 'target_distance_km') <> 'null' then
      if jsonb_typeof(v_item -> 'target_distance_km') <> 'number'
         or (v_item ->> 'target_distance_km')::numeric <= 0
         or (v_item ->> 'target_distance_km')::numeric > 999.9 then
        raise exception 'invalid_routine:invalid_target:targets' using errcode = '22023';
      end if;
      v_distance := (v_item ->> 'target_distance_km')::numeric;
    end if;
    if not private.valid_targets(v_snapshot.measurement_type, v_reps, v_weight, v_duration, v_distance) then
      raise exception 'invalid_routine:invalid_target:targets' using errcode = '22023';
    end if;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'exercise_id', v_exercise, 'name', v_snapshot.exercise_name, 'type', v_snapshot.measurement_type,
      'sets', v_sets::integer, 'reps', v_reps, 'weight', v_weight, 'duration', v_duration, 'distance', v_distance
    ));
  end loop;

  return jsonb_build_object('name', v_name, 'items', v_out);
end
$$;

-- Inserta los ítems ya normalizados, en el orden recibido.
create function private.insert_routine_items(p_routine uuid, p_user uuid, p_clean jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_position integer := 0;
begin
  for v_item in select value from jsonb_array_elements(p_clean -> 'items') loop
    v_position := v_position + 1;
    insert into public.routine_exercises (
      routine_id, user_id, position, exercise_id, exercise_name, measurement_type, sets,
      target_reps, target_weight_kg, target_duration_s, target_distance_km
    )
    values (
      p_routine, p_user, v_position, (v_item ->> 'exercise_id')::uuid, v_item ->> 'name', v_item ->> 'type',
      (v_item ->> 'sets')::integer, (v_item ->> 'reps')::integer, (v_item ->> 'weight')::numeric,
      (v_item ->> 'duration')::integer, (v_item ->> 'distance')::numeric
    );
  end loop;
end
$$;

revoke all on function private.clean_routine_input(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.insert_routine_items(uuid, uuid, jsonb) from public, anon, authenticated;

create function public.create_routine(routine jsonb, request_id uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_clean jsonb;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if request_id is null then
    raise exception 'invalid_routine:request_required:request_id' using errcode = '22023';
  end if;

  -- Idempotencia: la solicitud ya se guardó (también si es un reintento tardío).
  select r.id into v_id from public.routines r where r.user_id = v_user and r.client_request_id = request_id;
  if found then
    return v_id;
  end if;

  v_clean := private.clean_routine_input(v_user, routine);

  begin
    insert into public.routines (user_id, name, client_request_id)
    values (v_user, v_clean ->> 'name', request_id)
    returning id into v_id;
    perform private.insert_routine_items(v_id, v_user, v_clean);
  exception when unique_violation then
    -- Dos solicitudes iguales a la vez: gana la primera y la segunda devuelve su rutina.
    select r.id into v_id from public.routines r where r.user_id = v_user and r.client_request_id = request_id;
    if not found then
      raise;
    end if;
  end;

  return v_id;
end
$$;

create function public.update_routine(id uuid, routine jsonb) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_clean jsonb;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  perform 1 from public.routines r where r.id = update_routine.id and r.user_id = v_user for update;
  if not found then
    raise exception 'not_found: la rutina no existe' using errcode = 'P0002';
  end if;

  -- Reemplaza el nombre y todos los ítems, volviendo a tomar la instantánea de los ejercicios vigentes. No toca
  -- ninguna sesión: cada una tiene su propio plan (FR-005).
  v_clean := private.clean_routine_input(v_user, routine);
  update public.routines r set name = v_clean ->> 'name' where r.id = update_routine.id;
  delete from public.routine_exercises x where x.routine_id = update_routine.id;
  perform private.insert_routine_items(update_routine.id, v_user, v_clean);
  return update_routine.id;
end
$$;

create function public.duplicate_routine(id uuid, request_id uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_source public.routines;
  v_new uuid;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if request_id is null then
    raise exception 'invalid_routine:request_required:request_id' using errcode = '22023';
  end if;

  select r.id into v_new from public.routines r where r.user_id = v_user and r.client_request_id = request_id;
  if found then
    return v_new;
  end if;

  select * into v_source from public.routines r where r.id = duplicate_routine.id and r.user_id = v_user;
  if not found then
    raise exception 'not_found: la rutina no existe' using errcode = 'P0002';
  end if;

  begin
    -- «… (copia)» recortado para que quepa en 80 caracteres.
    insert into public.routines (user_id, name, client_request_id)
    values (v_user, btrim(left(v_source.name, 72)) || ' (copia)', request_id)
    returning routines.id into v_new;
    insert into public.routine_exercises (
      routine_id, user_id, position, exercise_id, exercise_name, measurement_type, sets,
      target_reps, target_weight_kg, target_duration_s, target_distance_km
    )
    select v_new, v_user, x.position, x.exercise_id, x.exercise_name, x.measurement_type, x.sets,
           x.target_reps, x.target_weight_kg, x.target_duration_s, x.target_distance_km
    from public.routine_exercises x
    where x.routine_id = v_source.id;
  exception when unique_violation then
    select r.id into v_new from public.routines r where r.user_id = v_user and r.client_request_id = request_id;
    if not found then
      raise;
    end if;
  end;

  return v_new;
end
$$;

revoke all on function public.create_routine(jsonb, uuid) from public, anon;
revoke all on function public.update_routine(uuid, jsonb) from public, anon;
revoke all on function public.duplicate_routine(uuid, uuid) from public, anon;
grant execute on function public.create_routine(jsonb, uuid) to authenticated;
grant execute on function public.update_routine(uuid, jsonb) to authenticated;
grant execute on function public.duplicate_routine(uuid, uuid) to authenticated;

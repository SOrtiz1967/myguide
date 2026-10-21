-- T025 (spec 006, FR-010, FR-012 a FR-014, FR-028 a FR-035, FR-038, FR-045, FR-047): guardar el contenido de una
-- sesión de forma atómica e idempotente.
--
-- `save_workout` REEMPLAZA los ejercicios y las series de la sesión por los del payload (research.md, Decisión 4):
-- repetir el envío deja el mismo resultado. La revisión (`revision`) detecta que otro dispositivo guardó antes sin
-- pisarlo en silencio; y un hash del contenido permite reconocer el reintento de un guardado cuya respuesta se perdió
-- (se vuelve a enviar con la revisión anterior y el mismo contenido) y devolver el estado actual sin error.

alter table public.workout_sessions add column content_hash text;

-- Nombre y tipo de medición de un ejercicio VISIBLE para la persona (catálogo o propio), o ninguna fila.
create function private.snapshot_exercise(p_user uuid, p_exercise uuid)
returns table (exercise_name text, measurement_type text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.name, e.measurement_type
  from public.exercises e
  where e.id = p_exercise and (e.user_id is null or e.user_id = p_user)
$$;

revoke all on function private.snapshot_exercise(uuid, uuid) from public, anon, authenticated;

-- Valida y normaliza una serie del payload según el tipo de medición del ejercicio. Devuelve nulo si la serie no
-- tiene ningún valor (se descarta, FR-030) y rechaza con `invalid_set` lo que está fuera de rango, no es un número
-- o no corresponde al tipo.
create function private.clean_session_set(p_set jsonb, p_type text) returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_reps integer;
  v_weight numeric;
  v_duration integer;
  v_distance numeric;
  v_result jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_set) <> 'object' then
    raise exception 'invalid_session:invalid_set:sets' using errcode = '22023';
  end if;

  for v_key, v_value in select * from jsonb_each(p_set) loop
    if v_key not in ('reps', 'weight_kg', 'duration_s', 'distance_km') then
      raise exception 'invalid_session:invalid_set:sets' using errcode = '22023';
    end if;
    if jsonb_typeof(v_value) = 'null' then
      continue;
    end if;
    if jsonb_typeof(v_value) <> 'number' then
      raise exception 'invalid_session:invalid_set:sets' using errcode = '22023';
    end if;
    if v_key = 'reps' then
      if (v_value #>> '{}')::numeric <> trunc((v_value #>> '{}')::numeric)
         or (v_value #>> '{}')::numeric not between 1 and 999 then
        raise exception 'invalid_session:invalid_set:sets' using errcode = '22023';
      end if;
      v_reps := (v_value #>> '{}')::integer;
    elsif v_key = 'weight_kg' then
      if (v_value #>> '{}')::numeric not between 0 and 999.9 then
        raise exception 'invalid_session:invalid_set:sets' using errcode = '22023';
      end if;
      v_weight := (v_value #>> '{}')::numeric;
    elsif v_key = 'duration_s' then
      if (v_value #>> '{}')::numeric <> trunc((v_value #>> '{}')::numeric)
         or (v_value #>> '{}')::numeric not between 1 and 86400 then
        raise exception 'invalid_session:invalid_set:sets' using errcode = '22023';
      end if;
      v_duration := (v_value #>> '{}')::integer;
    else
      if (v_value #>> '{}')::numeric <= 0 or (v_value #>> '{}')::numeric > 999.9 then
        raise exception 'invalid_session:invalid_set:sets' using errcode = '22023';
      end if;
      v_distance := (v_value #>> '{}')::numeric;
    end if;
  end loop;

  if num_nonnulls(v_reps, v_weight, v_duration, v_distance) = 0 then
    return null;
  end if;
  if not private.valid_targets(p_type, v_reps, v_weight, v_duration, v_distance) then
    raise exception 'invalid_session:invalid_set:sets' using errcode = '22023';
  end if;

  if v_reps is not null then v_result := v_result || jsonb_build_object('reps', v_reps); end if;
  if v_weight is not null then v_result := v_result || jsonb_build_object('weight_kg', v_weight); end if;
  if v_duration is not null then v_result := v_result || jsonb_build_object('duration_s', v_duration); end if;
  if v_distance is not null then v_result := v_result || jsonb_build_object('distance_km', v_distance); end if;
  return v_result;
end
$$;

revoke all on function private.clean_session_set(jsonb, text) from public, anon, authenticated;

-- Devuelve { revision, status, modified, corrected_at, finished_at }.
create function public.save_workout(id uuid, payload jsonb, expected_revision integer, finish boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_s public.workout_sessions;
  v_hash text;
  v_note text;
  v_exercises jsonb;
  v_ex jsonb;
  v_ex_id uuid;
  v_exercise_id uuid;
  v_name text;
  v_type text;
  v_created timestamptz;
  v_plan uuid;
  v_sub boolean;
  v_effort smallint;
  v_exnote text;
  v_sets jsonb;
  v_set jsonb;
  v_clean jsonb;
  v_new_sets jsonb;
  v_prepared jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_plans uuid[] := '{}';
  v_old record;
  v_snapshot record;
  v_position integer := 0;
  v_set_position integer;
  v_item jsonb;
  v_set_item jsonb;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid_session:invalid_payload:payload' using errcode = '22023';
  end if;

  select * into v_s from public.workout_sessions s where s.id = save_workout.id and s.user_id = v_user for update;
  if not found then
    raise exception 'not_found: la sesion no existe' using errcode = 'P0002';
  end if;
  if v_s.status not in ('in_progress', 'completed') then
    raise exception 'invalid_transition: la sesion tiene que estar en curso o realizada' using errcode = '22023';
  end if;

  v_hash := md5(payload::text || '|' || coalesce(finish, false)::text);
  if expected_revision is distinct from v_s.revision then
    -- Reintento de un guardado cuya respuesta se perdió: mismo contenido, revisión anterior.
    if expected_revision = v_s.revision - 1 and v_s.content_hash = v_hash then
      return jsonb_build_object(
        'revision', v_s.revision, 'status', v_s.status, 'modified', v_s.modified,
        'corrected_at', v_s.corrected_at, 'finished_at', v_s.finished_at
      );
    end if;
    raise exception 'stale_revision: la sesion cambio en otro dispositivo' using errcode = '40001';
  end if;

  v_note := nullif(btrim(coalesce(payload ->> 'note', '')), '');
  if char_length(v_note) > 1000 then
    raise exception 'invalid_session:note_too_long:note' using errcode = '22023';
  end if;

  v_exercises := coalesce(payload -> 'exercises', '[]'::jsonb);
  if jsonb_typeof(v_exercises) <> 'array' then
    raise exception 'invalid_session:invalid_payload:exercises' using errcode = '22023';
  end if;
  if jsonb_array_length(v_exercises) > 30 then
    raise exception 'invalid_session:too_many_exercises:exercises' using errcode = '22023';
  end if;

  -- Primera pasada: validar todo y preparar las filas, sin escribir nada.
  for v_ex in select value from jsonb_array_elements(v_exercises) loop
    if jsonb_typeof(v_ex) <> 'object' then
      raise exception 'invalid_session:invalid_payload:exercises' using errcode = '22023';
    end if;

    begin
      v_ex_id := (v_ex ->> 'id')::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid_session:invalid_payload:id' using errcode = '22023';
    end;
    if v_ex_id is null or v_ex_id = any (v_seen) then
      raise exception 'invalid_session:duplicate_id:id' using errcode = '22023';
    end if;
    v_seen := v_seen || v_ex_id;
    -- Un id que ya existe en otra sesión (propia o ajena) se rechaza sin revelar nada.
    if exists (select 1 from public.session_exercises x where x.id = v_ex_id and x.session_id <> v_s.id) then
      raise exception 'invalid_session:duplicate_id:id' using errcode = '22023';
    end if;

    select x.exercise_id, x.exercise_name, x.measurement_type, x.created_at into v_old
    from public.session_exercises x where x.id = v_ex_id and x.session_id = v_s.id;
    if found then
      -- Ya estaba en la sesión: conserva su instantánea (FR-034, FR-035).
      v_exercise_id := v_old.exercise_id;
      v_name := v_old.exercise_name;
      v_type := v_old.measurement_type;
      v_created := v_old.created_at;
    else
      begin
        v_exercise_id := nullif(v_ex ->> 'exercise_id', '')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid_session:exercise_not_found:exercise_id' using errcode = '22023';
      end;
      select * into v_snapshot from private.snapshot_exercise(v_user, v_exercise_id);
      if not found then
        raise exception 'invalid_session:exercise_not_found:exercise_id' using errcode = '22023';
      end if;
      v_name := v_snapshot.exercise_name;
      v_type := v_snapshot.measurement_type;
      v_created := now();
    end if;

    begin
      v_plan := nullif(v_ex ->> 'plan_item_id', '')::uuid;
      v_sub := coalesce((v_ex ->> 'is_substitute')::boolean, false);
    exception when invalid_text_representation then
      raise exception 'invalid_session:invalid_plan_item:plan_item_id' using errcode = '22023';
    end;
    if v_plan is not null then
      if not exists (select 1 from public.session_plan_items p where p.id = v_plan and p.session_id = v_s.id)
         or v_plan = any (v_plans) then
        raise exception 'invalid_session:invalid_plan_item:plan_item_id' using errcode = '22023';
      end if;
      v_plans := v_plans || v_plan;
    elsif v_sub then
      raise exception 'invalid_session:invalid_plan_item:plan_item_id' using errcode = '22023';
    end if;

    v_effort := null;
    if v_ex ? 'effort' and jsonb_typeof(v_ex -> 'effort') <> 'null' then
      if jsonb_typeof(v_ex -> 'effort') <> 'number'
         or (v_ex ->> 'effort')::numeric <> trunc((v_ex ->> 'effort')::numeric)
         or (v_ex ->> 'effort')::numeric not between 1 and 10 then
        raise exception 'invalid_session:invalid_effort:effort' using errcode = '22023';
      end if;
      v_effort := (v_ex ->> 'effort')::smallint;
    end if;

    v_exnote := nullif(btrim(coalesce(v_ex ->> 'note', '')), '');
    if char_length(v_exnote) > 500 then
      raise exception 'invalid_session:note_too_long:note' using errcode = '22023';
    end if;

    v_sets := coalesce(v_ex -> 'sets', '[]'::jsonb);
    if jsonb_typeof(v_sets) <> 'array' then
      raise exception 'invalid_session:invalid_payload:sets' using errcode = '22023';
    end if;
    v_new_sets := '[]'::jsonb;
    for v_set in select value from jsonb_array_elements(v_sets) loop
      v_clean := private.clean_session_set(v_set, v_type);
      if v_clean is not null then
        v_new_sets := v_new_sets || jsonb_build_array(v_clean);
      end if;
    end loop;
    if jsonb_array_length(v_new_sets) > 20 then
      raise exception 'invalid_session:too_many_sets:sets' using errcode = '22023';
    end if;

    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'id', v_ex_id, 'exercise_id', v_exercise_id, 'name', v_name, 'type', v_type, 'created_at', v_created,
      'plan_item_id', v_plan, 'is_substitute', v_sub, 'effort', v_effort, 'note', v_exnote, 'sets', v_new_sets
    ));
  end loop;

  -- Segunda pasada: reemplazar el contenido. Las series se borran en cascada con sus ejercicios.
  delete from public.session_exercises x where x.session_id = v_s.id;
  for v_item in select value from jsonb_array_elements(v_prepared) loop
    v_position := v_position + 1;
    insert into public.session_exercises (
      id, session_id, user_id, position, exercise_id, exercise_name, measurement_type,
      plan_item_id, is_substitute, effort, note, created_at
    )
    values (
      (v_item ->> 'id')::uuid, v_s.id, v_user, v_position, (v_item ->> 'exercise_id')::uuid,
      v_item ->> 'name', v_item ->> 'type', (v_item ->> 'plan_item_id')::uuid,
      (v_item ->> 'is_substitute')::boolean, (v_item ->> 'effort')::smallint, v_item ->> 'note',
      (v_item ->> 'created_at')::timestamptz
    );
    v_set_position := 0;
    for v_set_item in select value from jsonb_array_elements(v_item -> 'sets') loop
      v_set_position := v_set_position + 1;
      insert into public.session_sets (
        session_exercise_id, session_id, user_id, position, reps, weight_kg, duration_s, distance_km
      )
      values (
        (v_item ->> 'id')::uuid, v_s.id, v_user, v_set_position,
        (v_set_item ->> 'reps')::integer, (v_set_item ->> 'weight_kg')::numeric,
        (v_set_item ->> 'duration_s')::integer, (v_set_item ->> 'distance_km')::numeric
      );
    end loop;
  end loop;

  update public.workout_sessions s set
    note = v_note,
    revision = s.revision + 1,
    content_hash = v_hash,
    status = case when s.status = 'in_progress' and coalesce(finish, false) then 'completed' else s.status end,
    finished_at = case when s.status = 'in_progress' and coalesce(finish, false) then now() else s.finished_at end,
    corrected_at = case when s.status = 'completed' then now() else s.corrected_at end
  where s.id = v_s.id
  returning * into v_s;

  -- «Modificada» solo existe en una sesión realizada: se recalcula al terminar y al corregir.
  if v_s.status = 'completed' then
    update public.workout_sessions s set modified = private.compute_session_modified(s.id)
    where s.id = v_s.id
    returning * into v_s;
  end if;

  return jsonb_build_object(
    'revision', v_s.revision, 'status', v_s.status, 'modified', v_s.modified,
    'corrected_at', v_s.corrected_at, 'finished_at', v_s.finished_at
  );
end
$$;

revoke all on function public.save_workout(uuid, jsonb, integer, boolean) from public, anon;
grant execute on function public.save_workout(uuid, jsonb, integer, boolean) to authenticated;

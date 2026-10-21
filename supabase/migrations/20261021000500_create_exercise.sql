-- T032 (spec 005, FR-022 a FR-025, FR-029): crear un ejercicio propio de forma atómica e idempotente.
-- Las funciones son `security definer` (con `search_path` vacío): el cliente no tiene permiso de
-- escritura sobre `exercises`. Cada una verifica `auth.uid()` y `private.is_session_fresh()`, toma al
-- dueño de la sesión y fija el origen y el estado de los textos. Los errores tienen la forma
-- `invalid_exercise:<motivo>:<campo>` y el cliente los traduce a un mensaje.

-- Una lista JSON de textos, como arreglo de texto (cada elemento debe ser una cadena).
create function private.json_text_array(p_value jsonb, p_field text) returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_result text[] := '{}';
begin
  if p_value is null or jsonb_typeof(p_value) = 'null' then
    return v_result;
  end if;
  if jsonb_typeof(p_value) <> 'array' then
    raise exception 'invalid_exercise:invalid_list:%', p_field using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(v_item) <> 'string' then
      raise exception 'invalid_exercise:invalid_list:%', p_field using errcode = '22023';
    end if;
    v_result := v_result || (v_item #>> '{}');
  end loop;
  return v_result;
end
$$;

-- Sin repetidos y conservando el orden.
create function private.distinct_in_order(p_items text[]) returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(item order by first_position), '{}')
  from (
    select t.item, min(t.position) as first_position
    from unnest(p_items) with ordinality as t(item, position)
    group by t.item
  ) d
$$;

-- Valida y limpia los datos de un ejercicio propio. Lo comparten create_exercise, update_exercise y
-- copy_exercise. Refleja las restricciones de la tabla para dar un motivo claro antes de que salte una
-- restricción genérica. Devuelve los campos ya limpios.
create function private.clean_exercise_input(p_exercise jsonb) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_muscles constant text[] := array[
    'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
    'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps', 'full_body'
  ];
  v_equipment constant text[] := array[
    'body only', 'barbell', 'dumbbell', 'cable', 'machine', 'e-z curl bar', 'kettlebells', 'bands',
    'medicine ball', 'exercise ball', 'foam roll', 'other'
  ];
  v_name text;
  v_name_key text;
  v_type text;
  v_primary text[];
  v_secondary text[];
  v_equipment_value text;
  v_description text;
  v_aliases text[] := '{}';
  v_seen text[] := '{}';
  v_alias text;
  v_key text;
begin
  if p_exercise is null or jsonb_typeof(p_exercise) <> 'object' then
    raise exception 'invalid_exercise:name_required:name' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(p_exercise ->> 'name', ''));
  if v_name = '' then
    raise exception 'invalid_exercise:name_required:name' using errcode = '22023';
  end if;
  if char_length(v_name) > 120 then
    raise exception 'invalid_exercise:name_too_long:name' using errcode = '22023';
  end if;
  v_name_key := lower(private.immutable_unaccent(v_name));

  v_type := nullif(btrim(coalesce(p_exercise ->> 'measurement_type', '')), '');
  if v_type is null then
    raise exception 'invalid_exercise:measurement_required:measurement_type' using errcode = '22023';
  end if;
  if v_type <> all (array['reps_weight', 'reps_bodyweight', 'duration', 'distance_duration']) then
    raise exception 'invalid_exercise:invalid_measurement:measurement_type' using errcode = '22023';
  end if;

  v_primary := private.distinct_in_order(private.json_text_array(p_exercise -> 'primary_muscles', 'primary_muscles'));
  v_secondary := private.distinct_in_order(private.json_text_array(p_exercise -> 'secondary_muscles', 'secondary_muscles'));
  if not (v_primary <@ v_muscles) then
    raise exception 'invalid_exercise:invalid_muscle:primary_muscles' using errcode = '22023';
  end if;
  if not (v_secondary <@ v_muscles) then
    raise exception 'invalid_exercise:invalid_muscle:secondary_muscles' using errcode = '22023';
  end if;
  if cardinality(v_primary) > 5 then
    raise exception 'invalid_exercise:too_many_muscles:primary_muscles' using errcode = '22023';
  end if;
  if cardinality(v_secondary) > 10 then
    raise exception 'invalid_exercise:too_many_muscles:secondary_muscles' using errcode = '22023';
  end if;
  if v_primary && v_secondary then
    raise exception 'invalid_exercise:muscle_repeated:secondary_muscles' using errcode = '22023';
  end if;

  v_equipment_value := nullif(btrim(coalesce(p_exercise ->> 'equipment', '')), '');
  if v_equipment_value is not null and v_equipment_value <> all (v_equipment) then
    raise exception 'invalid_exercise:invalid_equipment:equipment' using errcode = '22023';
  end if;

  v_description := nullif(btrim(coalesce(p_exercise ->> 'description', '')), '');
  if v_description is not null and char_length(v_description) > 4000 then
    raise exception 'invalid_exercise:description_too_long:description' using errcode = '22023';
  end if;

  -- Otros nombres: se recortan y se descartan los vacíos, los repetidos y el igual al nombre.
  foreach v_alias in array private.json_text_array(p_exercise -> 'aliases', 'aliases') loop
    v_alias := btrim(v_alias);
    if v_alias = '' then
      continue;
    end if;
    if char_length(v_alias) > 80 then
      raise exception 'invalid_exercise:alias_too_long:aliases' using errcode = '22023';
    end if;
    v_key := lower(private.immutable_unaccent(v_alias));
    if v_key = v_name_key or v_key = any (v_seen) then
      continue;
    end if;
    v_seen := v_seen || v_key;
    v_aliases := v_aliases || v_alias;
  end loop;
  if cardinality(v_aliases) > 10 then
    raise exception 'invalid_exercise:too_many_aliases:aliases' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'name', v_name,
    'measurement_type', v_type,
    'primary_muscles', to_jsonb(v_primary),
    'secondary_muscles', to_jsonb(v_secondary),
    'equipment', v_equipment_value,
    'description', v_description,
    'aliases', to_jsonb(v_aliases)
  );
end
$$;

revoke all on function private.json_text_array(jsonb, text) from public, anon, authenticated;
revoke all on function private.distinct_in_order(text[]) from public, anon, authenticated;
revoke all on function private.clean_exercise_input(jsonb) from public, anon, authenticated;

create function public.create_exercise(exercise jsonb, request_id uuid)
returns uuid
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
    raise exception 'invalid_exercise:request_required:request_id' using errcode = '22023';
  end if;

  -- Idempotencia: la solicitud ya se guardó (también si es un reintento tardío).
  select e.id into v_id from public.exercises e
  where e.user_id = v_user and e.client_request_id = request_id;
  if found then
    return v_id;
  end if;

  v_clean := private.clean_exercise_input(exercise);

  begin
    insert into public.exercises (
      origin, user_id, name, name_status, measurement_type, primary_muscles, secondary_muscles,
      equipment, description, description_status, aliases, client_request_id
    )
    values (
      'own', v_user, v_clean ->> 'name', 'original', v_clean ->> 'measurement_type',
      array(select jsonb_array_elements_text(v_clean -> 'primary_muscles')),
      array(select jsonb_array_elements_text(v_clean -> 'secondary_muscles')),
      v_clean ->> 'equipment', v_clean ->> 'description',
      case when v_clean ->> 'description' is null then null else 'original' end,
      array(select jsonb_array_elements_text(v_clean -> 'aliases')),
      request_id
    )
    returning id into v_id;
  exception when unique_violation then
    -- Dos solicitudes iguales a la vez: gana la primera y la segunda devuelve su ejercicio.
    select e.id into v_id from public.exercises e
    where e.user_id = v_user and e.client_request_id = request_id;
  end;

  return v_id;
end
$$;

revoke all on function public.create_exercise(jsonb, uuid) from public, anon;
grant execute on function public.create_exercise(jsonb, uuid) to authenticated;

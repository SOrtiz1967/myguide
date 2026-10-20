-- T024 (spec 005, FR-001 a FR-005, FR-011 a FR-013): búsqueda de ejercicios.
-- `security invoker`: se aplica RLS, así que cada cuenta busca solo en el catálogo y en lo suyo.
--
-- Igual que la búsqueda de alimentos (spec 002): la condición se arma con un LIKE por palabra (hasta 5)
-- sobre `search_text` (nombre + nombre original + alias, sin acentos), que es la forma que aprovecha el
-- índice de trigramas. Los comodines (% _ \) se quitan de cada palabra, así que el texto buscado nunca se
-- interpreta como patrón. Los filtros de músculo (principal o secundario) y de equipamiento se suman a la
-- condición, y con ellos el texto es opcional.
--
-- Los parámetros de los filtros se llaman muscle_filter y equipment_filter (y no "equipment") porque la
-- columna de salida `equipment` ya usa ese nombre.

create function public.search_exercises(
  q text default null,
  scope text default 'all',
  muscle_filter text default null,
  equipment_filter text default null,
  page_size int default 20,
  page_offset int default 0
) returns table (
  id uuid,
  name text,
  name_status text,
  measurement_type text,
  primary_muscles text[],
  equipment text,
  origin text,
  based_on_exercise_id uuid,
  source_name text,
  total_estimate bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $fn$
declare
  v_text text := lower(private.immutable_unaccent(btrim(coalesce(q, ''))));
  v_muscle text := nullif(btrim(coalesce(muscle_filter, '')), '');
  v_equipment text := nullif(btrim(coalesce(equipment_filter, '')), '');
  v_tokens text[];
  v_clean text;
  v_cond text := '';
  v_name_cond text := '';
  v_scope_cond text;
  v_filter_cond text := '';
  v_order text;
  v_size int := least(greatest(coalesce(page_size, 20), 1), 50);
  v_offset int := greatest(coalesce(page_offset, 0), 0);
  v_token text;
begin
  v_scope_cond := case scope
    when 'all' then 'true'
    when 'catalog' then 'f.origin = ''imported'''
    when 'own' then 'f.origin = ''own'''
    else null
  end;
  if v_scope_cond is null then
    raise exception 'invalid_scope: el filtro de origen no es válido' using errcode = '22023';
  end if;

  if v_muscle is not null and v_muscle <> all (array[
    'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
    'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps', 'full_body'
  ]) then
    raise exception 'invalid_filter: el músculo no es válido' using errcode = '22023';
  end if;
  if v_equipment is not null and v_equipment <> all (array[
    'body only', 'barbell', 'dumbbell', 'cable', 'machine', 'e-z curl bar', 'kettlebells', 'bands',
    'medicine ball', 'exercise ball', 'foam roll', 'other'
  ]) then
    raise exception 'invalid_filter: el equipamiento no es válido' using errcode = '22023';
  end if;

  if v_text = '' and v_muscle is null and v_equipment is null then
    raise exception 'query_required: escribe un nombre o elige un filtro' using errcode = '22023';
  end if;
  if v_text <> '' and char_length(v_text) < 2 then
    raise exception 'query_too_short: escribe al menos 2 caracteres' using errcode = '22023';
  end if;

  if v_muscle is not null then
    v_filter_cond := v_filter_cond || format(
      ' and (f.primary_muscles || f.secondary_muscles) @> array[%L]::text[]', v_muscle
    );
  end if;
  if v_equipment is not null then
    v_filter_cond := v_filter_cond || format(' and f.equipment = %L', v_equipment);
  end if;

  if v_text = '' then
    -- Solo filtros: se explora el catálogo por nombre.
    return query execute format(
      $q$
      select f.id, f.name, f.name_status, f.measurement_type, f.primary_muscles, f.equipment, f.origin,
             f.based_on_exercise_id,
             case when f.origin = 'imported' then s.name end as source_name,
             count(*) over () as total_estimate
      from public.exercises f
      left join public.exercise_sources s on s.id = f.source_id
      where %s %s
      order by f.name_norm, f.id
      limit %s offset %s
      $q$,
      v_scope_cond, v_filter_cond, v_size, v_offset
    );
    return;
  end if;

  select coalesce(array_agg(t), '{}')
    into v_tokens
  from (
    select cleaned as t
    from (
      select regexp_replace(w, '[%_\\]', '', 'g') as cleaned
      from regexp_split_to_table(v_text, '\s+') w
    ) c
    where cleaned <> ''
    limit 5
  ) z;

  -- Solo comodines: no hay nada que buscar.
  if cardinality(v_tokens) = 0 then
    return;
  end if;

  v_clean := array_to_string(v_tokens, ' ');
  foreach v_token in array v_tokens loop
    v_cond := v_cond || format(' and f.search_text like %L', '%' || v_token || '%');
    v_name_cond := v_name_cond || format(' and f.name_norm like %L', '%' || v_token || '%');
  end loop;

  -- Orden: nombre exacto, prefijo del nombre, todas las palabras en el nombre, y por último lo que solo
  -- coincide por el nombre original o un alias; después la similitud.
  v_order := format(
    $o$
    case
      when f.name_norm = %L then 0
      when f.name_norm like %L then 1
      when true %s then 2
      else 3
    end,
    extensions.similarity(f.search_text, %L) desc,
    f.name_norm,
    f.id
    $o$,
    v_clean, v_clean || '%', v_name_cond, v_clean
  );

  return query execute format(
    $q$
    select f.id, f.name, f.name_status, f.measurement_type, f.primary_muscles, f.equipment, f.origin,
           f.based_on_exercise_id,
           case when f.origin = 'imported' then s.name end as source_name,
           count(*) over () as total_estimate
    from public.exercises f
    left join public.exercise_sources s on s.id = f.source_id
    where %s %s %s
    order by %s
    limit %s offset %s
    $q$,
    v_scope_cond, v_cond, v_filter_cond, v_order, v_size, v_offset
  );
end
$fn$;

revoke all on function public.search_exercises(text, text, text, text, int, int) from public, anon;
grant execute on function public.search_exercises(text, text, text, text, int, int) to authenticated;

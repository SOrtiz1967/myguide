-- T023 (spec 002, FR-001 a FR-004, FR-032, FR-033): búsqueda de alimentos.
-- `security invoker`: se aplica RLS, así que cada cuenta busca solo en el catálogo y en lo suyo.
--
-- La condición se arma con un LIKE por palabra (hasta 5) sobre `search_text`, porque esa forma es la
-- que aprovecha el índice de trigramas (prototipo T005: p95 de 164 ms con 50.000 alimentos). Los
-- comodines (% _ \) se quitan de cada palabra, así que el texto buscado nunca se interpreta como patrón.

create function public.search_foods(
  q text,
  scope text default 'all',
  page_size int default 20,
  page_offset int default 0
) returns table (
  id uuid,
  name text,
  name_status text,
  brand text,
  reference_basis text,
  energy_kcal numeric,
  origin text,
  based_on_food_id uuid,
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
  v_tokens text[];
  v_clean text;
  v_cond text := '';
  v_name_cond text := '';
  v_scope_cond text;
  v_size int := least(greatest(coalesce(page_size, 20), 1), 50);
  v_offset int := greatest(coalesce(page_offset, 0), 0);
  v_token text;
begin
  if char_length(v_text) < 2 then
    raise exception 'query_too_short: escribe al menos 2 caracteres' using errcode = '22023';
  end if;

  v_scope_cond := case scope
    when 'all' then 'true'
    when 'catalog' then 'f.origin = ''imported'''
    when 'own' then 'f.origin = ''own'''
    else null
  end;
  if v_scope_cond is null then
    raise exception 'invalid_scope: el filtro de origen no es válido' using errcode = '22023';
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

  return query execute format(
    $q$
    select f.id, f.name, f.name_status, f.brand, f.reference_basis, f.energy_kcal, f.origin,
           f.based_on_food_id,
           case when f.origin = 'imported' then s.name end as source_name,
           count(*) over () as total_estimate
    from public.foods f
    left join public.food_sources s on s.id = f.source_id
    where %s %s
    order by
      case
        when f.name_norm = %L then 0
        when f.name_norm like %L then 1
        when true %s then 2
        else 3
      end,
      extensions.similarity(f.search_text, %L) desc,
      f.completeness desc,
      f.id
    limit %s offset %s
    $q$,
    v_scope_cond, v_cond, v_clean, v_clean || '%', v_name_cond, v_clean, v_size, v_offset
  );
end
$fn$;

revoke all on function public.search_foods(text, text, int, int) from public, anon;
grant execute on function public.search_foods(text, text, int, int) to authenticated;

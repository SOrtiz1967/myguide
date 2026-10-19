-- T035 (spec 002, FR-015 a FR-019, FR-023): crear un alimento propio de forma atómica e idempotente.
-- Las funciones son `security invoker`: RLS decide quién puede escribir (solo lo propio, con sesión vigente).
-- Los errores tienen la forma `invalid_food:<motivo>:<campo>` y el cliente los traduce a un mensaje.

-- Validación compartida por create_food, update_food y copy_food. Refleja las restricciones de la tabla
-- para dar un motivo claro antes de que salte una restricción genérica.
create function private.validate_food_input(p_food jsonb, p_portions jsonb) returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_number numeric;
  v_max numeric;
  v_name text := btrim(coalesce(p_food ->> 'name', ''));
  v_brand text := nullif(btrim(coalesce(p_food ->> 'brand', '')), '');
  v_count int;
  v_portion jsonb;
  v_portion_name text;
  v_names text[] := '{}';
begin
  if v_name = '' then
    raise exception 'invalid_food:name_required:name' using errcode = '22023';
  end if;
  if char_length(v_name) > 200 then
    raise exception 'invalid_food:out_of_range:name' using errcode = '22023';
  end if;
  if v_brand is not null and char_length(v_brand) > 120 then
    raise exception 'invalid_food:out_of_range:brand' using errcode = '22023';
  end if;
  if coalesce(p_food ->> 'reference_basis', '') not in ('100g', '100ml') then
    raise exception 'invalid_food:invalid_basis:reference_basis' using errcode = '22023';
  end if;
  if p_food -> 'energy_kcal' is null or jsonb_typeof(p_food -> 'energy_kcal') = 'null' then
    raise exception 'invalid_food:energy_required:energy_kcal' using errcode = '22023';
  end if;

  foreach v_key in array array[
    'energy_kcal', 'protein_g', 'carbs_g', 'sugars_g', 'fat_g', 'saturated_fat_g', 'fiber_g', 'sodium_mg'
  ] loop
    v_value := p_food -> v_key;
    if v_value is null or jsonb_typeof(v_value) = 'null' then
      continue;
    end if;
    if jsonb_typeof(v_value) <> 'number' then
      raise exception 'invalid_food:invalid_number:%', v_key using errcode = '22023';
    end if;
    v_number := (p_food ->> v_key)::numeric;
    if v_number < 0 then
      raise exception 'invalid_food:negative_value:%', v_key using errcode = '22023';
    end if;
    v_max := case v_key when 'energy_kcal' then 900 when 'sodium_mg' then 40000 else 100 end;
    if v_number > v_max then
      raise exception 'invalid_food:out_of_range:%', v_key using errcode = '22023';
    end if;
  end loop;

  if coalesce((p_food ->> 'protein_g')::numeric, 0)
     + coalesce((p_food ->> 'carbs_g')::numeric, 0)
     + coalesce((p_food ->> 'fat_g')::numeric, 0) > 100 then
    raise exception 'invalid_food:macros_exceed_100:protein_g' using errcode = '22023';
  end if;
  if (p_food ->> 'sugars_g') is not null and (p_food ->> 'carbs_g') is not null
     and (p_food ->> 'sugars_g')::numeric > (p_food ->> 'carbs_g')::numeric then
    raise exception 'invalid_food:sugars_exceed_carbs:sugars_g' using errcode = '22023';
  end if;
  if (p_food ->> 'saturated_fat_g') is not null and (p_food ->> 'fat_g') is not null
     and (p_food ->> 'saturated_fat_g')::numeric > (p_food ->> 'fat_g')::numeric then
    raise exception 'invalid_food:saturated_exceeds_fat:saturated_fat_g' using errcode = '22023';
  end if;

  if p_portions is null or jsonb_typeof(p_portions) = 'null' then
    return;
  end if;
  if jsonb_typeof(p_portions) <> 'array' then
    raise exception 'invalid_food:invalid_portion:portions' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_portions);
  if v_count > 20 then
    raise exception 'invalid_food:too_many_portions:portions' using errcode = '22023';
  end if;
  for v_portion in select value from jsonb_array_elements(p_portions) loop
    v_portion_name := btrim(coalesce(v_portion ->> 'name', ''));
    if v_portion_name = ''
       or char_length(v_portion_name) > 80
       or jsonb_typeof(v_portion -> 'quantity') is distinct from 'number'
       or (v_portion ->> 'quantity')::numeric <= 0
       or (v_portion ->> 'quantity')::numeric > 5000
       or v_portion_name = any (v_names) then
      raise exception 'invalid_food:invalid_portion:portions' using errcode = '22023';
    end if;
    v_names := v_names || v_portion_name;
  end loop;
end
$$;

revoke all on function private.validate_food_input(jsonb, jsonb) from public, anon;
grant execute on function private.validate_food_input(jsonb, jsonb) to authenticated;

-- Inserta las porciones de un alimento a partir de la lista JSON (ya validada).
create function private.insert_food_portions(p_food_id uuid, p_portions jsonb) returns void
language sql
set search_path = ''
as $$
  insert into public.food_portions (food_id, name, quantity, position)
  select p_food_id, btrim(item.value ->> 'name'), (item.value ->> 'quantity')::numeric,
         (item.ordinality - 1)::smallint
  from jsonb_array_elements(coalesce(p_portions, '[]'::jsonb)) with ordinality as item;
$$;

revoke all on function private.insert_food_portions(uuid, jsonb) from public, anon;
grant execute on function private.insert_food_portions(uuid, jsonb) to authenticated;

create function public.create_food(food jsonb, portions jsonb, request_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_user uuid := (select auth.uid());
begin
  if request_id is not null then
    select f.id into v_id from public.foods f
    where f.user_id = v_user and f.client_request_id = request_id;
    if found then
      return v_id;
    end if;
  end if;

  perform private.validate_food_input(food, portions);

  begin
    insert into public.foods (
      user_id, origin, name, brand, reference_basis,
      energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg,
      client_request_id
    ) values (
      v_user, 'own', btrim(food ->> 'name'), nullif(btrim(coalesce(food ->> 'brand', '')), ''),
      food ->> 'reference_basis',
      (food ->> 'energy_kcal')::numeric, (food ->> 'protein_g')::numeric,
      (food ->> 'carbs_g')::numeric, (food ->> 'sugars_g')::numeric, (food ->> 'fat_g')::numeric,
      (food ->> 'saturated_fat_g')::numeric, (food ->> 'fiber_g')::numeric,
      (food ->> 'sodium_mg')::numeric,
      request_id
    ) returning id into v_id;
  exception when unique_violation then
    -- Un reintento simultáneo con el mismo request_id: devuelve el que ganó.
    select f.id into v_id from public.foods f
    where f.user_id = v_user and f.client_request_id = request_id;
    if found then
      return v_id;
    end if;
    raise;
  end;

  perform private.insert_food_portions(v_id, portions);
  return v_id;
end
$$;

revoke all on function public.create_food(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.create_food(jsonb, jsonb, uuid) to authenticated;

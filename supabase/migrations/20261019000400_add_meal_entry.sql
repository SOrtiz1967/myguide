-- T024 y T039 (spec 003, FR-001 a FR-012, FR-024, FR-027): agregar un ítem a una comida.
--
-- `add_meal_entry` es SECURITY DEFINER a propósito: el ítem guarda una INSTANTÁNEA del alimento y esa
-- copia la toma el servidor, no el cliente (que no tiene permiso de insertar en la tabla). Como la
-- función corre con los permisos de su dueño, verifica ella misma la sesión, el dueño y que el alimento
-- sea visible (del catálogo o propio). Los errores tienen la forma `invalid_entry:<motivo>:<campo>`.

create function private.try_uuid(p_text text) returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end
$$;

-- Valida el día: formato AAAA-MM-DD, desde el 1/1/2000 hasta 7 días después de hoy en la zona del
-- perfil; sin zona en el perfil, en UTC con un día de tolerancia (research, Decisión 8).
create function private.parse_log_date(p_user uuid, p_text text) returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_date date;
  v_zone text;
  v_today date;
  v_max date;
begin
  if p_text is null or p_text !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid_entry:invalid_date:log_date' using errcode = '22023';
  end if;
  begin
    v_date := p_text::date;
  exception when others then
    raise exception 'invalid_entry:invalid_date:log_date' using errcode = '22023';
  end;

  select p.timezone into v_zone from public.profiles p where p.user_id = p_user;
  v_today := (now() at time zone coalesce(v_zone, 'UTC'))::date;
  v_max := v_today + 7 + case when v_zone is null then 1 else 0 end;
  if v_date < date '2000-01-01' or v_date > v_max then
    raise exception 'invalid_entry:invalid_date:log_date' using errcode = '22023';
  end if;
  return v_date;
end
$$;

-- Valida los valores escritos a mano (FR-006). Compartida con update_meal_entry.
create function private.validate_manual_values(p jsonb) returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_number numeric;
  v_max numeric;
begin
  if p -> 'energy_kcal' is null or jsonb_typeof(p -> 'energy_kcal') = 'null' then
    raise exception 'invalid_entry:energy_required:energy_kcal' using errcode = '22023';
  end if;

  foreach v_key in array array[
    'energy_kcal', 'protein_g', 'carbs_g', 'sugars_g', 'fat_g', 'saturated_fat_g', 'fiber_g', 'sodium_mg'
  ] loop
    v_value := p -> v_key;
    if v_value is null or jsonb_typeof(v_value) = 'null' then
      continue;
    end if;
    if jsonb_typeof(v_value) <> 'number' then
      raise exception 'invalid_entry:invalid_number:%', v_key using errcode = '22023';
    end if;
    v_number := (p ->> v_key)::numeric;
    if v_number < 0 then
      raise exception 'invalid_entry:negative_value:%', v_key using errcode = '22023';
    end if;
    v_max := case v_key when 'energy_kcal' then 5000 when 'sodium_mg' then 50000 else 1000 end;
    if v_number > v_max then
      raise exception 'invalid_entry:out_of_range:%', v_key using errcode = '22023';
    end if;
  end loop;

  if (p ->> 'sugars_g') is not null and (p ->> 'carbs_g') is not null
     and (p ->> 'sugars_g')::numeric > (p ->> 'carbs_g')::numeric then
    raise exception 'invalid_entry:sugars_exceed_carbs:sugars_g' using errcode = '22023';
  end if;
  if (p ->> 'saturated_fat_g') is not null and (p ->> 'fat_g') is not null
     and (p ->> 'saturated_fat_g')::numeric > (p ->> 'fat_g')::numeric then
    raise exception 'invalid_entry:saturated_exceeds_fat:saturated_fat_g' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p ->> 'quantity_text', ''))) > 60 then
    raise exception 'invalid_entry:out_of_range:quantity_text' using errcode = '22023';
  end if;
end
$$;

create function public.add_meal_entry(entry jsonb, request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_date date;
  v_meal text;
  v_food public.foods%rowtype;
  v_food_id uuid;
  v_portion public.food_portions%rowtype;
  v_has_portion boolean := false;
  v_count numeric;
  v_quantity numeric;
  v_description text;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  if request_id is not null then
    select e.id into v_id from public.meal_entries e
    where e.user_id = v_user and e.client_request_id = request_id;
    if found then
      return v_id;
    end if;
  end if;

  v_meal := entry ->> 'meal';
  if v_meal is null or v_meal not in ('breakfast', 'lunch', 'snack', 'dinner', 'extra') then
    raise exception 'invalid_entry:invalid_meal:meal' using errcode = '22023';
  end if;
  v_date := private.parse_log_date(v_user, entry ->> 'log_date');

  v_food_id := private.try_uuid(entry ->> 'food_id');
  if (entry ->> 'food_id') is null and coalesce(entry ->> 'origin', '') = 'manual' then
    -- Ítem escrito a mano (FR-006).
    v_description := btrim(coalesce(entry ->> 'description', ''));
    if v_description = '' then
      raise exception 'invalid_entry:description_required:description' using errcode = '22023';
    end if;
    if char_length(v_description) > 200 then
      raise exception 'invalid_entry:out_of_range:description' using errcode = '22023';
    end if;
    perform private.validate_manual_values(entry);

    begin
      insert into public.meal_entries (
        user_id, log_date, meal, origin, food_name, quantity_text,
        energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg,
        client_request_id
      ) values (
        v_user, v_date, v_meal, 'manual', v_description,
        nullif(btrim(coalesce(entry ->> 'quantity_text', '')), ''),
        (entry ->> 'energy_kcal')::numeric, (entry ->> 'protein_g')::numeric,
        (entry ->> 'carbs_g')::numeric, (entry ->> 'sugars_g')::numeric, (entry ->> 'fat_g')::numeric,
        (entry ->> 'saturated_fat_g')::numeric, (entry ->> 'fiber_g')::numeric,
        (entry ->> 'sodium_mg')::numeric,
        request_id
      ) returning id into v_id;
    exception when unique_violation then
      select e.id into v_id from public.meal_entries e
      where e.user_id = v_user and e.client_request_id = request_id;
      if found then
        return v_id;
      end if;
      raise;
    end;
    return v_id;
  end if;

  -- Ítem desde un alimento del catálogo o propio (FR-001): la instantánea la toma el servidor.
  if (entry ->> 'food_id') is null then
    raise exception 'invalid_entry:food_required:food_id' using errcode = '22023';
  end if;
  select f.* into v_food from public.foods f
  where f.id = v_food_id and (f.user_id is null or f.user_id = v_user);
  if not found then
    raise exception 'not_found: el alimento no existe' using errcode = 'P0002';
  end if;

  if (entry ->> 'portion_id') is not null then
    select p.* into v_portion from public.food_portions p
    where p.id = private.try_uuid(entry ->> 'portion_id')
      and p.food_id = v_food.id and (p.user_id is null or p.user_id = v_user);
    if not found then
      raise exception 'invalid_entry:invalid_portion:portion_id' using errcode = '22023';
    end if;
    if jsonb_typeof(entry -> 'portion_count') is distinct from 'number' then
      raise exception 'invalid_entry:invalid_portion_count:portion_count' using errcode = '22023';
    end if;
    v_count := (entry ->> 'portion_count')::numeric;
    if v_count <= 0 or v_count > 50 then
      raise exception 'invalid_entry:invalid_portion_count:portion_count' using errcode = '22023';
    end if;
    v_has_portion := true;
  else
    if jsonb_typeof(entry -> 'quantity') is distinct from 'number' then
      raise exception 'invalid_entry:invalid_quantity:quantity' using errcode = '22023';
    end if;
    v_quantity := (entry ->> 'quantity')::numeric;
    if v_quantity <= 0 or v_quantity > 5000 then
      raise exception 'invalid_entry:invalid_quantity:quantity' using errcode = '22023';
    end if;
  end if;

  begin
    insert into public.meal_entries (
      user_id, log_date, meal, origin, food_id, food_name, food_brand, reference_basis,
      per100_energy_kcal, per100_protein_g, per100_carbs_g, per100_sugars_g, per100_fat_g,
      per100_saturated_fat_g, per100_fiber_g, per100_sodium_mg,
      quantity, portion_name, portion_quantity, portion_count, client_request_id
    ) values (
      v_user, v_date, v_meal, case when v_food.user_id is null then 'catalog' else 'own' end,
      v_food.id, v_food.name, v_food.brand, v_food.reference_basis,
      v_food.energy_kcal, v_food.protein_g, v_food.carbs_g, v_food.sugars_g, v_food.fat_g,
      v_food.saturated_fat_g, v_food.fiber_g, v_food.sodium_mg,
      v_quantity,
      case when v_has_portion then v_portion.name end,
      case when v_has_portion then v_portion.quantity end,
      case when v_has_portion then v_count end,
      request_id
    ) returning id into v_id;
  exception when unique_violation then
    select e.id into v_id from public.meal_entries e
    where e.user_id = v_user and e.client_request_id = request_id;
    if found then
      return v_id;
    end if;
    raise;
  end;
  return v_id;
end
$$;

revoke all on function public.add_meal_entry(jsonb, uuid) from public, anon;
grant execute on function public.add_meal_entry(jsonb, uuid) to authenticated;

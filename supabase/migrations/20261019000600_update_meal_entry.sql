-- T044 (spec 003, FR-019 a FR-021, FR-026): corregir, mover y editar un ítem registrado.
--
-- SECURITY DEFINER por la misma razón que add_meal_entry: la instantánea no se toca y los valores se
-- recalculan en el servidor. La función verifica la sesión y el dueño ella misma. Un ítem que viene de un
-- alimento se recalcula SIEMPRE desde su instantánea, nunca desde el alimento actual (FR-019). El origen,
-- el alimento y la instantánea no se pueden cambiar desde el cliente: esas claves se ignoran.

create function public.update_meal_entry(id uuid, changes jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_e public.meal_entries%rowtype;
  v_meal text;
  v_date date;
  v_quantity numeric;
  v_portion_name text;
  v_portion_quantity numeric;
  v_portion_count numeric;
  v_portion public.food_portions%rowtype;
  v_merged jsonb;
  v_description text;
  v_key text;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  select e.* into v_e from public.meal_entries e
  where e.id = update_meal_entry.id and e.user_id = v_user;
  if not found then
    raise exception 'not_found: el registro no existe' using errcode = 'P0002';
  end if;

  v_meal := coalesce(changes ->> 'meal', v_e.meal);
  if v_meal not in ('breakfast', 'lunch', 'snack', 'dinner', 'extra') then
    raise exception 'invalid_entry:invalid_meal:meal' using errcode = '22023';
  end if;
  v_date := case
    when changes ? 'log_date' then private.parse_log_date(v_user, changes ->> 'log_date')
    else v_e.log_date
  end;

  if v_e.origin in ('catalog', 'own') then
    v_quantity := v_e.quantity;
    v_portion_name := v_e.portion_name;
    v_portion_quantity := v_e.portion_quantity;
    v_portion_count := v_e.portion_count;

    if (changes ->> 'portion_id') is not null then
      -- Elegir otra porción: se lee del alimento, que tiene que seguir existiendo y ser visible.
      if v_e.food_id is null then
        raise exception 'not_found: el alimento ya no existe' using errcode = 'P0002';
      end if;
      select p.* into v_portion
      from public.food_portions p
      join public.foods f on f.id = p.food_id
      where p.id = private.try_uuid(changes ->> 'portion_id')
        and p.food_id = v_e.food_id
        and (f.user_id is null or f.user_id = v_user);
      if not found then
        raise exception 'invalid_entry:invalid_portion:portion_id' using errcode = '22023';
      end if;
      if jsonb_typeof(changes -> 'portion_count') is distinct from 'number'
         or (changes ->> 'portion_count')::numeric <= 0 or (changes ->> 'portion_count')::numeric > 50 then
        raise exception 'invalid_entry:invalid_portion_count:portion_count' using errcode = '22023';
      end if;
      v_portion_name := v_portion.name;
      v_portion_quantity := v_portion.quantity;
      v_portion_count := (changes ->> 'portion_count')::numeric;
    elsif changes ? 'portion_count' then
      if v_e.portion_name is null then
        raise exception 'invalid_entry:invalid_portion:portion_id' using errcode = '22023';
      end if;
      if jsonb_typeof(changes -> 'portion_count') is distinct from 'number'
         or (changes ->> 'portion_count')::numeric <= 0 or (changes ->> 'portion_count')::numeric > 50 then
        raise exception 'invalid_entry:invalid_portion_count:portion_count' using errcode = '22023';
      end if;
      v_portion_count := (changes ->> 'portion_count')::numeric;
    elsif changes ? 'quantity' then
      if jsonb_typeof(changes -> 'quantity') is distinct from 'number'
         or (changes ->> 'quantity')::numeric <= 0 or (changes ->> 'quantity')::numeric > 5000 then
        raise exception 'invalid_entry:invalid_quantity:quantity' using errcode = '22023';
      end if;
      v_quantity := (changes ->> 'quantity')::numeric;
      v_portion_name := null;
      v_portion_quantity := null;
      v_portion_count := null;
    end if;

    -- Los valores del ítem los recalcula el disparador desde la instantánea y la cantidad.
    update public.meal_entries e set
      meal = v_meal,
      log_date = v_date,
      quantity = v_quantity,
      portion_name = v_portion_name,
      portion_quantity = v_portion_quantity,
      portion_count = v_portion_count
    where e.id = v_e.id;
    return v_e.id;
  end if;

  -- Ítem escrito a mano (o estimado): se editan la descripción y los valores.
  foreach v_key in array array['quantity', 'portion_id', 'portion_count'] loop
    if changes ? v_key then
      raise exception 'invalid_entry:invalid_change:%', v_key using errcode = '22023';
    end if;
  end loop;

  v_merged := jsonb_build_object(
    'energy_kcal', v_e.energy_kcal, 'protein_g', v_e.protein_g, 'carbs_g', v_e.carbs_g,
    'sugars_g', v_e.sugars_g, 'fat_g', v_e.fat_g, 'saturated_fat_g', v_e.saturated_fat_g,
    'fiber_g', v_e.fiber_g, 'sodium_mg', v_e.sodium_mg, 'quantity_text', v_e.quantity_text
  );
  foreach v_key in array array[
    'energy_kcal', 'protein_g', 'carbs_g', 'sugars_g', 'fat_g', 'saturated_fat_g', 'fiber_g',
    'sodium_mg', 'quantity_text'
  ] loop
    if changes ? v_key then
      v_merged := v_merged || jsonb_build_object(v_key, changes -> v_key);
    end if;
  end loop;
  perform private.validate_manual_values(v_merged);

  v_description := btrim(coalesce(case when changes ? 'description' then changes ->> 'description' else v_e.food_name end, ''));
  if v_description = '' then
    raise exception 'invalid_entry:description_required:description' using errcode = '22023';
  end if;
  if char_length(v_description) > 200 then
    raise exception 'invalid_entry:out_of_range:description' using errcode = '22023';
  end if;

  update public.meal_entries e set
    meal = v_meal,
    log_date = v_date,
    food_name = v_description,
    quantity_text = nullif(btrim(coalesce(v_merged ->> 'quantity_text', '')), ''),
    energy_kcal = (v_merged ->> 'energy_kcal')::numeric,
    protein_g = (v_merged ->> 'protein_g')::numeric,
    carbs_g = (v_merged ->> 'carbs_g')::numeric,
    sugars_g = (v_merged ->> 'sugars_g')::numeric,
    fat_g = (v_merged ->> 'fat_g')::numeric,
    saturated_fat_g = (v_merged ->> 'saturated_fat_g')::numeric,
    fiber_g = (v_merged ->> 'fiber_g')::numeric,
    sodium_mg = (v_merged ->> 'sodium_mg')::numeric
  where e.id = v_e.id;
  return v_e.id;
end
$$;

revoke all on function public.update_meal_entry(uuid, jsonb) from public, anon;
grant execute on function public.update_meal_entry(uuid, jsonb) to authenticated;

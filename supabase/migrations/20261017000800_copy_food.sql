-- T057 (spec 002, FR-020, FR-023, FR-024): copia propia y editable de un alimento visible.
-- Es `security invoker`: RLS decide qué alimentos se pueden leer (el catálogo y lo propio), así que un
-- alimento ajeno se comporta como inexistente. La copia nunca modifica el original.

create function public.copy_food(id uuid, request_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_source public.foods%rowtype;
  v_new uuid;
begin
  if request_id is not null then
    select f.id into v_new from public.foods f
    where f.user_id = v_user and f.client_request_id = request_id;
    if found then
      return v_new;
    end if;
  end if;

  select * into v_source from public.foods f where f.id = copy_food.id;
  if not found then
    raise exception 'not_found: el alimento no existe' using errcode = 'P0002';
  end if;

  begin
    insert into public.foods (
      user_id, origin, based_on_food_id, name, brand, reference_basis,
      energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg,
      client_request_id
    ) values (
      v_user, 'own', v_source.id, v_source.name, v_source.brand, v_source.reference_basis,
      v_source.energy_kcal, v_source.protein_g, v_source.carbs_g, v_source.sugars_g, v_source.fat_g,
      v_source.saturated_fat_g, v_source.fiber_g, v_source.sodium_mg,
      request_id
    ) returning foods.id into v_new;
  exception when unique_violation then
    -- Un reintento simultáneo con el mismo request_id: devuelve el que ganó.
    select f.id into v_new from public.foods f
    where f.user_id = v_user and f.client_request_id = request_id;
    if found then
      return v_new;
    end if;
    raise;
  end;

  insert into public.food_portions (food_id, name, quantity, position)
  select v_new, p.name, p.quantity, p.position
  from public.food_portions p
  where p.food_id = v_source.id;

  return v_new;
end
$$;

revoke all on function public.copy_food(uuid, uuid) from public, anon;
grant execute on function public.copy_food(uuid, uuid) to authenticated;

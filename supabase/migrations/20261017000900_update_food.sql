-- T062 (spec 002, FR-015, FR-017, FR-021, FR-022, FR-024): editar un alimento propio.
-- Es `security invoker`: RLS solo deja modificar lo propio con sesión vigente. Sobre un alimento del
-- catálogo o de otra cuenta no se afecta ninguna fila y se devuelve `not_found`. Las porciones se
-- reemplazan en la misma operación, así que un rechazo no deja el alimento a medias.

create function public.update_food(id uuid, food jsonb, portions jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.validate_food_input(food, portions);

  update public.foods f set
    name = btrim(food ->> 'name'),
    brand = nullif(btrim(coalesce(food ->> 'brand', '')), ''),
    reference_basis = food ->> 'reference_basis',
    energy_kcal = (food ->> 'energy_kcal')::numeric,
    protein_g = (food ->> 'protein_g')::numeric,
    carbs_g = (food ->> 'carbs_g')::numeric,
    sugars_g = (food ->> 'sugars_g')::numeric,
    fat_g = (food ->> 'fat_g')::numeric,
    saturated_fat_g = (food ->> 'saturated_fat_g')::numeric,
    fiber_g = (food ->> 'fiber_g')::numeric,
    sodium_mg = (food ->> 'sodium_mg')::numeric
  where f.id = update_food.id
    and f.origin = 'own'
    and f.user_id = (select auth.uid())
  returning f.id into v_id;

  if v_id is null then
    raise exception 'not_found: el alimento no existe' using errcode = 'P0002';
  end if;

  delete from public.food_portions p where p.food_id = v_id;
  perform private.insert_food_portions(v_id, portions);
  return v_id;
end
$$;

revoke all on function public.update_food(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_food(uuid, jsonb, jsonb) to authenticated;

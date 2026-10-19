-- T054 (spec 003, FR-028, FR-029): repetir una comida de otro día.
--
-- Cada ítem de la comida de origen genera uno nuevo e independiente. Si el alimento todavía existe y la
-- persona lo puede ver, el ítem nuevo toma una instantánea NUEVA (recalcula); si no, o si es manual, se
-- copia tal cual estaba. Es idempotente: cada ítem nuevo lleva un `client_request_id` derivado de
-- `(request_id, id del ítem de origen)`, y todo ocurre en una sola transacción.

-- Un ítem copiado cuyo alimento ya no existe conserva su origen y su instantánea sin alimento: es lo que
-- le pasa a cualquier ítem cuando se elimina el alimento. Solo `repeat_meal` lo permite, con una marca
-- local a la transacción (la persona no tiene permiso de escritura directa sobre la tabla).
create or replace function private.prepare_meal_entry() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.origin in ('catalog', 'own') and new.food_id is null
       and coalesce(current_setting('myguide.repeat_copy', true), '') <> 'on' then
      raise exception 'food_required: un item del catalogo o propio necesita su alimento'
        using errcode = '23514';
    end if;
  else
    -- food_id solo puede pasar a nulo: es lo que hace la base cuando se elimina el alimento.
    if new.user_id is distinct from old.user_id
       or new.origin is distinct from old.origin
       or (new.food_id is distinct from old.food_id and new.food_id is not null)
       or (
         old.origin in ('catalog', 'own') and (
           new.food_name is distinct from old.food_name
           or new.food_brand is distinct from old.food_brand
           or new.reference_basis is distinct from old.reference_basis
           or new.per100_energy_kcal is distinct from old.per100_energy_kcal
           or new.per100_protein_g is distinct from old.per100_protein_g
           or new.per100_carbs_g is distinct from old.per100_carbs_g
           or new.per100_sugars_g is distinct from old.per100_sugars_g
           or new.per100_fat_g is distinct from old.per100_fat_g
           or new.per100_saturated_fat_g is distinct from old.per100_saturated_fat_g
           or new.per100_fiber_g is distinct from old.per100_fiber_g
           or new.per100_sodium_mg is distinct from old.per100_sodium_mg
         )
       ) then
      raise exception 'entry_identity_immutable: el origen y la instantanea de un item no se pueden cambiar'
        using errcode = '42501';
    end if;
  end if;

  if new.portion_count is not null then
    new.quantity := round(new.portion_quantity * new.portion_count, 2);
  end if;

  if new.origin in ('catalog', 'own') then
    new.energy_kcal := round(new.per100_energy_kcal * new.quantity / 100, 2);
    new.protein_g := round(new.per100_protein_g * new.quantity / 100, 2);
    new.carbs_g := round(new.per100_carbs_g * new.quantity / 100, 2);
    new.sugars_g := round(new.per100_sugars_g * new.quantity / 100, 2);
    new.fat_g := round(new.per100_fat_g * new.quantity / 100, 2);
    new.saturated_fat_g := round(new.per100_saturated_fat_g * new.quantity / 100, 2);
    new.fiber_g := round(new.per100_fiber_g * new.quantity / 100, 2);
    new.sodium_mg := round(new.per100_sodium_mg * new.quantity / 100, 2);
  end if;
  return new;
end;
$$;

-- Qué se haría al repetir: cuántos ítems se recalculan y cuántos se copian (FR-028). Solo lectura.
create function public.preview_repeat_meal(from_date date, from_meal text)
returns table (total int, recalculated int, copied int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_date date;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if from_meal is null or from_meal not in ('breakfast', 'lunch', 'snack', 'dinner', 'extra') then
    raise exception 'invalid_entry:invalid_meal:meal' using errcode = '22023';
  end if;
  v_date := private.parse_log_date(v_user, from_date::text);

  return query
    select
      count(*)::int,
      (count(*) filter (where e.origin in ('catalog', 'own') and f.id is not null))::int,
      (count(*) filter (where not (e.origin in ('catalog', 'own') and f.id is not null)))::int
    from public.meal_entries e
    left join public.foods f
      on f.id = e.food_id and (f.user_id is null or f.user_id = v_user)
    where e.user_id = v_user and e.log_date = v_date and e.meal = from_meal;
end
$$;

revoke all on function public.preview_repeat_meal(date, text) from public, anon;
grant execute on function public.preview_repeat_meal(date, text) to authenticated;

create function public.repeat_meal(from_date date, from_meal text, to_date date, to_meal text, request_id uuid)
returns table (created int, recalculated int, copied int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_from date;
  v_to date;
  v_src public.meal_entries%rowtype;
  v_food public.foods%rowtype;
  v_portion public.food_portions%rowtype;
  v_key uuid;
  v_found boolean;
  v_created int := 0;
  v_recalculated int := 0;
  v_copied int := 0;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if from_meal is null or from_meal not in ('breakfast', 'lunch', 'snack', 'dinner', 'extra')
     or to_meal is null or to_meal not in ('breakfast', 'lunch', 'snack', 'dinner', 'extra') then
    raise exception 'invalid_entry:invalid_meal:meal' using errcode = '22023';
  end if;
  if request_id is null then
    raise exception 'invalid_entry:request_required:request_id' using errcode = '22023';
  end if;
  v_from := private.parse_log_date(v_user, from_date::text);
  v_to := private.parse_log_date(v_user, to_date::text);

  perform set_config('myguide.repeat_copy', 'on', true);

  for v_src in
    select e.* from public.meal_entries e
    where e.user_id = v_user and e.log_date = v_from and e.meal = from_meal
      -- Si el destino es la misma comida, un reintento no toma como origen lo que esta solicitud ya creó.
      and not exists (
        select 1 from public.meal_entries t
        where t.user_id = v_user and t.log_date = v_from and t.meal = from_meal
          and md5(request_id::text || ':' || t.id::text)::uuid = e.client_request_id
      )
    order by e.created_at, e.id
  loop
    v_key := md5(request_id::text || ':' || v_src.id::text)::uuid;
    v_created := v_created + 1;

    v_found := false;
    if v_src.origin in ('catalog', 'own') and v_src.food_id is not null then
      select f.* into v_food from public.foods f
      where f.id = v_src.food_id and (f.user_id is null or f.user_id = v_user);
      v_found := found;
    end if;
    if v_found then v_recalculated := v_recalculated + 1; else v_copied := v_copied + 1; end if;

    begin
      if v_found then
        -- Instantánea nueva desde el alimento actual; la porción se busca por nombre y, si ya no está,
        -- se conserva la que tenía el ítem.
        v_portion := null;
        if v_src.portion_name is not null then
          select p.* into v_portion from public.food_portions p
          where p.food_id = v_food.id and (p.user_id is null or p.user_id = v_user)
            and p.name = v_src.portion_name
          order by p.position limit 1;
        end if;
        insert into public.meal_entries (
          user_id, log_date, meal, origin, food_id, food_name, food_brand, reference_basis,
          per100_energy_kcal, per100_protein_g, per100_carbs_g, per100_sugars_g, per100_fat_g,
          per100_saturated_fat_g, per100_fiber_g, per100_sodium_mg,
          quantity, portion_name, portion_quantity, portion_count, client_request_id
        ) values (
          v_user, v_to, to_meal, case when v_food.user_id is null then 'catalog' else 'own' end,
          v_food.id, v_food.name, v_food.brand, v_food.reference_basis,
          v_food.energy_kcal, v_food.protein_g, v_food.carbs_g, v_food.sugars_g, v_food.fat_g,
          v_food.saturated_fat_g, v_food.fiber_g, v_food.sodium_mg,
          v_src.quantity,
          v_src.portion_name,
          case when v_src.portion_name is null then null else coalesce(v_portion.quantity, v_src.portion_quantity) end,
          v_src.portion_count,
          v_key
        );
      else
        -- Manual, o alimento que ya no existe: se copia lo que estaba guardado.
        insert into public.meal_entries (
          user_id, log_date, meal, origin, status, food_id, food_name, food_brand, reference_basis,
          per100_energy_kcal, per100_protein_g, per100_carbs_g, per100_sugars_g, per100_fat_g,
          per100_saturated_fat_g, per100_fiber_g, per100_sodium_mg,
          quantity, portion_name, portion_quantity, portion_count, quantity_text,
          energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg,
          client_request_id
        ) values (
          v_user, v_to, to_meal, v_src.origin, v_src.status, null, v_src.food_name, v_src.food_brand,
          v_src.reference_basis,
          v_src.per100_energy_kcal, v_src.per100_protein_g, v_src.per100_carbs_g, v_src.per100_sugars_g,
          v_src.per100_fat_g, v_src.per100_saturated_fat_g, v_src.per100_fiber_g, v_src.per100_sodium_mg,
          v_src.quantity, v_src.portion_name, v_src.portion_quantity, v_src.portion_count,
          v_src.quantity_text,
          v_src.energy_kcal, v_src.protein_g, v_src.carbs_g, v_src.sugars_g, v_src.fat_g,
          v_src.saturated_fat_g, v_src.fiber_g, v_src.sodium_mg,
          v_key
        );
      end if;
    exception when unique_violation then
      -- Reintento: este ítem ya se había creado con la misma solicitud.
      if not exists (
        select 1 from public.meal_entries e where e.user_id = v_user and e.client_request_id = v_key
      ) then
        raise;
      end if;
    end;
  end loop;

  perform set_config('myguide.repeat_copy', 'off', true);
  return query select v_created, v_recalculated, v_copied;
end
$$;

revoke all on function public.repeat_meal(date, text, date, text, uuid) from public, anon;
grant execute on function public.repeat_meal(date, text, date, text, uuid) to authenticated;

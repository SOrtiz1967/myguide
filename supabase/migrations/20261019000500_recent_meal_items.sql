-- T025 (spec 003, FR-040): los recientes de la persona al agregar a una comida.
--
-- `security invoker`: se leen los ítems propios (RLS) y los alimentos que la persona puede ver (RLS), así
-- que un alimento que ya no existe o ya no es visible no aparece. Los que vienen de un alimento se
-- devuelven calculados con el alimento ACTUAL, porque al volver a registrarlos se toma una instantánea
-- nueva; los manuales se devuelven con los valores de la última vez.

create function public.recent_meal_items(max_items int default 20)
returns table (
  food_id uuid,
  origin text,
  food_name text,
  food_brand text,
  reference_basis text,
  quantity numeric,
  portion_id uuid,
  portion_name text,
  portion_count numeric,
  quantity_text text,
  energy_kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  sugars_g numeric,
  fat_g numeric,
  saturated_fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  last_logged_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select e.*,
           row_number() over (
             partition by coalesce(e.food_id::text, 'm:' || lower(e.food_name))
             order by e.created_at desc, e.id desc
           ) as rn
    from public.meal_entries e
    where e.food_id is not null or e.origin in ('manual', 'estimated')
  ),
  latest as (
    select r.*, f.id as current_food_id, f.user_id as current_owner, f.name as current_name,
           f.brand as current_brand, f.reference_basis as current_basis,
           f.energy_kcal as f_energy, f.protein_g as f_protein, f.carbs_g as f_carbs,
           f.sugars_g as f_sugars, f.fat_g as f_fat, f.saturated_fat_g as f_saturated,
           f.fiber_g as f_fiber, f.sodium_mg as f_sodium,
           pp.id as current_portion_id, pp.quantity as current_portion_quantity
    from ranked r
    left join public.foods f on f.id = r.food_id
    left join lateral (
      select p.id, p.quantity from public.food_portions p
      where p.food_id = f.id and p.name = r.portion_name
      limit 1
    ) pp on true
    where r.rn = 1 and (r.origin in ('manual', 'estimated') or f.id is not null)
  ),
  sized as (
    select l.*,
           case
             when l.current_food_id is null then l.quantity
             when l.current_portion_id is not null then round(l.current_portion_quantity * l.portion_count, 2)
             else l.quantity
           end as qty
    from latest l
  )
  select
    s.current_food_id,
    case when s.current_food_id is null then s.origin
         when s.current_owner is null then 'catalog' else 'own' end,
    coalesce(s.current_name, s.food_name),
    case when s.current_food_id is null then s.food_brand else s.current_brand end,
    s.current_basis,
    s.qty,
    s.current_portion_id,
    case when s.current_portion_id is not null then s.portion_name end,
    case when s.current_portion_id is not null then s.portion_count end,
    s.quantity_text,
    case when s.current_food_id is null then s.energy_kcal else round(s.f_energy * s.qty / 100, 2) end,
    case when s.current_food_id is null then s.protein_g else round(s.f_protein * s.qty / 100, 2) end,
    case when s.current_food_id is null then s.carbs_g else round(s.f_carbs * s.qty / 100, 2) end,
    case when s.current_food_id is null then s.sugars_g else round(s.f_sugars * s.qty / 100, 2) end,
    case when s.current_food_id is null then s.fat_g else round(s.f_fat * s.qty / 100, 2) end,
    case when s.current_food_id is null then s.saturated_fat_g else round(s.f_saturated * s.qty / 100, 2) end,
    case when s.current_food_id is null then s.fiber_g else round(s.f_fiber * s.qty / 100, 2) end,
    case when s.current_food_id is null then s.sodium_mg else round(s.f_sodium * s.qty / 100, 2) end,
    s.created_at
  from sized s
  order by s.created_at desc, s.id desc
  limit least(greatest(coalesce(max_items, 20), 1), 50);
$$;

revoke all on function public.recent_meal_items(int) from public, anon;
grant execute on function public.recent_meal_items(int) to authenticated;

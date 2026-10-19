-- T044 (spec 002, FR-013, FR-025 a FR-029): funciones de carga del catálogo. Solo las ejecuta el
-- autor con la clave de servicio; ni `anon` ni `authenticated` pueden llamarlas.
--
-- `import_foods` crea o actualiza únicamente filas con origin = 'imported', identificadas por
-- (fuente, source_item_id). Los alimentos propios y las copias no tienen fuente, así que nunca
-- coinciden con esa clave y una importación no puede alcanzarlos (FR-027).

create function public.import_foods(source_slug text, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.food_sources%rowtype;
  v_item jsonb;
  v_id uuid;
  v_inserted boolean;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_reasons jsonb := '{}'::jsonb;
  v_reason text;
  v_constraint text;
begin
  select * into v_source from public.food_sources s where s.slug = source_slug;
  if not found then
    raise exception 'source_not_found: la fuente % no existe', source_slug using errcode = 'P0002';
  end if;
  if btrim(coalesce(v_source.license_name, '')) = ''
     or btrim(coalesce(v_source.license_url, '')) = ''
     or btrim(coalesce(v_source.attribution, '')) = '' then
    raise exception 'license_missing: la fuente % no tiene licencia y atribución registradas', source_slug
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    begin
      insert into public.foods (
        origin, source_id, source_item_id, imported_at, name, name_status, brand, reference_basis,
        energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg
      ) values (
        'imported', v_source.id, btrim(v_item ->> 'source_item_id'), now(),
        btrim(coalesce(v_item ->> 'name', '')), coalesce(v_item ->> 'name_status', 'original'),
        nullif(btrim(coalesce(v_item ->> 'brand', '')), ''), v_item ->> 'reference_basis',
        (v_item ->> 'energy_kcal')::numeric, (v_item ->> 'protein_g')::numeric,
        (v_item ->> 'carbs_g')::numeric, (v_item ->> 'sugars_g')::numeric,
        (v_item ->> 'fat_g')::numeric, (v_item ->> 'saturated_fat_g')::numeric,
        (v_item ->> 'fiber_g')::numeric, (v_item ->> 'sodium_mg')::numeric
      )
      on conflict (source_id, source_item_id) where origin = 'imported' do update set
        imported_at = now(),
        name = excluded.name,
        name_status = excluded.name_status,
        brand = excluded.brand,
        reference_basis = excluded.reference_basis,
        energy_kcal = excluded.energy_kcal,
        protein_g = excluded.protein_g,
        carbs_g = excluded.carbs_g,
        sugars_g = excluded.sugars_g,
        fat_g = excluded.fat_g,
        saturated_fat_g = excluded.saturated_fat_g,
        fiber_g = excluded.fiber_g,
        sodium_mg = excluded.sodium_mg
      returning id, (xmax = 0) into v_id, v_inserted;

      -- Las porciones se reemplazan por las de la fuente.
      delete from public.food_portions where food_id = v_id;
      insert into public.food_portions (food_id, name, quantity, position)
      select v_id, btrim(p.value ->> 'name'), (p.value ->> 'quantity')::numeric,
             (p.ordinality - 1)::smallint
      from jsonb_array_elements(coalesce(v_item -> 'portions', '[]'::jsonb)) with ordinality as p;

      if v_inserted then
        v_created := v_created + 1;
      else
        v_updated := v_updated + 1;
      end if;
    exception
      when check_violation or not_null_violation or invalid_text_representation
           or numeric_value_out_of_range or string_data_right_truncation or unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        v_reason := case v_constraint
          when 'foods_name_check' then 'no_name'
          when 'foods_grams_check' then 'out_of_range'
          when 'foods_energy_check' then 'out_of_range'
          when 'foods_sodium_check' then 'out_of_range'
          when 'foods_macros_sum_check' then 'macros_exceed_100'
          when 'foods_sugars_check' then 'sugars_exceed_carbs'
          when 'foods_saturated_check' then 'saturated_exceeds_fat'
          else 'invalid'
        end;
        v_skipped := v_skipped + 1;
        v_reasons := jsonb_set(
          v_reasons, array[v_reason], to_jsonb(coalesce((v_reasons ->> v_reason)::int, 0) + 1)
        );
    end;
  end loop;

  return jsonb_build_object(
    'created', v_created, 'updated', v_updated, 'skipped', v_skipped, 'skipped_reasons', v_reasons
  );
end
$$;

create function public.finish_import(source_slug text, report jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_run uuid;
begin
  select s.id into v_source_id from public.food_sources s where s.slug = source_slug;
  if v_source_id is null then
    raise exception 'source_not_found: la fuente % no existe', source_slug using errcode = 'P0002';
  end if;

  update public.food_sources s
  set last_imported_at = now(),
      food_count = (select count(*) from public.foods f where f.source_id = s.id and f.origin = 'imported')
  where s.id = v_source_id;

  insert into private.import_runs (
    source_id, finished_at, created_count, updated_count, skipped_count, skipped_reasons
  ) values (
    v_source_id, now(),
    coalesce((report ->> 'created')::int, 0), coalesce((report ->> 'updated')::int, 0),
    coalesce((report ->> 'skipped')::int, 0), coalesce(report -> 'skipped_reasons', '{}'::jsonb)
  ) returning id into v_run;
  return v_run;
end
$$;

-- Solo service_role: se quita el permiso por defecto de PUBLIC y de los roles del cliente.
revoke all on function public.import_foods(text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_import(text, jsonb) from public, anon, authenticated;
grant execute on function public.import_foods(text, jsonb) to service_role;
grant execute on function public.finish_import(text, jsonb) to service_role;

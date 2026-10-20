-- T039 (spec 005, FR-019, FR-031 a FR-035): funciones de carga del catálogo de ejercicios. Solo las ejecuta
-- el autor con la clave de servicio; ni `anon` ni `authenticated` pueden llamarlas.
--
-- `import_exercises` crea o actualiza únicamente filas con origin = 'imported', identificadas por
-- (fuente, source_item_id). Los ejercicios propios y las copias no tienen fuente, así que nunca coinciden
-- con esa clave y una importación no puede alcanzarlos (FR-033).
--
-- Una traducción revisada (`reviewed`) no se pisa con una automática (FR-021): el nombre, los otros
-- nombres y la descripción conservan lo revisado; solo los reemplaza otra traducción también revisada.
-- Los datos de la fuente (tipo de medición, músculos, equipamiento, nombre original) siempre se actualizan.
-- `drop_descriptions` carga los ejercicios sin descripción y quita la que tuvieran (research.md, Decisión 2).

-- La fecha de importación se actualiza con cada carga que toca el ejercicio: ya no es parte de la
-- identidad inmutable (a diferencia del origen, el dueño y la fuente).
create or replace function private.protect_exercise_identity() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin is distinct from old.origin
     or new.user_id is distinct from old.user_id
     or new.source_id is distinct from old.source_id
     or new.source_item_id is distinct from old.source_item_id then
    raise exception 'exercise_identity_immutable: el origen, el dueno y la fuente de un ejercicio no se pueden cambiar'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create function public.import_exercises(source_slug text, items jsonb, drop_descriptions boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.exercise_sources%rowtype;
  v_item jsonb;
  v_inserted boolean;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_reasons jsonb := '{}'::jsonb;
  v_reason text;
  v_constraint text;
begin
  select * into v_source from public.exercise_sources s where s.slug = source_slug;
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
      insert into public.exercises as t (
        origin, source_id, source_item_id, imported_at, name, name_status, original_name, aliases,
        measurement_type, primary_muscles, secondary_muscles, equipment, description, description_status
      ) values (
        'imported', v_source.id, btrim(v_item ->> 'source_item_id'), now(),
        btrim(coalesce(v_item ->> 'name', '')), coalesce(v_item ->> 'name_status', 'original'),
        nullif(btrim(coalesce(v_item ->> 'original_name', '')), ''),
        array(select jsonb_array_elements_text(coalesce(v_item -> 'aliases', '[]'::jsonb))),
        v_item ->> 'measurement_type',
        array(select jsonb_array_elements_text(coalesce(v_item -> 'primary_muscles', '[]'::jsonb))),
        array(select jsonb_array_elements_text(coalesce(v_item -> 'secondary_muscles', '[]'::jsonb))),
        nullif(btrim(coalesce(v_item ->> 'equipment', '')), ''),
        case when drop_descriptions then null else nullif(btrim(coalesce(v_item ->> 'description', '')), '') end,
        case when drop_descriptions then null else v_item ->> 'description_status' end
      )
      on conflict (source_id, source_item_id) where origin = 'imported' do update set
        imported_at = now(),
        -- lo revisado no se pisa con una traducción automática
        name = case when t.name_status = 'reviewed' and excluded.name_status <> 'reviewed' then t.name else excluded.name end,
        aliases = case when t.name_status = 'reviewed' and excluded.name_status <> 'reviewed' then t.aliases else excluded.aliases end,
        name_status = case when t.name_status = 'reviewed' and excluded.name_status <> 'reviewed' then t.name_status else excluded.name_status end,
        original_name = excluded.original_name,
        measurement_type = excluded.measurement_type,
        primary_muscles = excluded.primary_muscles,
        secondary_muscles = excluded.secondary_muscles,
        equipment = excluded.equipment,
        description = case
          when drop_descriptions then null
          when t.description_status = 'reviewed' and excluded.description_status is distinct from 'reviewed' then t.description
          else excluded.description
        end,
        description_status = case
          when drop_descriptions then null
          when t.description_status = 'reviewed' and excluded.description_status is distinct from 'reviewed' then t.description_status
          else excluded.description_status
        end
      returning (xmax = 0) into v_inserted;

      if v_inserted then
        v_created := v_created + 1;
      else
        v_updated := v_updated + 1;
      end if;
    exception
      when check_violation or not_null_violation or invalid_text_representation
           or string_data_right_truncation or unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        v_reason := case v_constraint
          when 'exercises_name_check' then 'invalid_name'
          when 'exercises_original_name_check' then 'invalid_name'
          when 'exercises_measurement_check' then 'invalid_measurement'
          when 'exercises_primary_muscles_check' then 'invalid_muscle'
          when 'exercises_secondary_muscles_check' then 'invalid_muscle'
          when 'exercises_muscles_disjoint_check' then 'invalid_muscle'
          when 'exercises_equipment_check' then 'invalid_equipment'
          when 'exercises_aliases_check' then 'invalid_aliases'
          when 'exercises_description_check' then 'description_too_long'
          when 'exercises_name_status_check' then 'invalid_status'
          when 'exercises_description_status_check' then 'invalid_status'
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

create function public.finish_exercise_import(source_slug text, report jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_run uuid;
begin
  select s.id into v_source_id from public.exercise_sources s where s.slug = source_slug;
  if v_source_id is null then
    raise exception 'source_not_found: la fuente % no existe', source_slug using errcode = 'P0002';
  end if;

  update public.exercise_sources s
  set last_imported_at = now(),
      exercise_count = (select count(*) from public.exercises e where e.source_id = s.id and e.origin = 'imported')
  where s.id = v_source_id;

  insert into private.exercise_import_runs (
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
revoke all on function public.import_exercises(text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.finish_exercise_import(text, jsonb) from public, anon, authenticated;
grant execute on function public.import_exercises(text, jsonb, boolean) to service_role;
grant execute on function public.finish_exercise_import(text, jsonb) to service_role;

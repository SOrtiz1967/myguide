-- Spec 009: estimación de comidas con IA. Contrato en specs/009-estimacion-comidas-ia/contracts/estimate-meal.md.
--
-- `ai_estimates` guarda 24 horas el resultado de cada consulta a la IA, por cuenta e identificador de
-- solicitud, para que un reintento no vuelva a llamar al proveedor ni gaste cuota (Principio II). Solo la
-- función `estimate-meal` (rol de servicio) la usa; la aplicación nunca la lee ni la escribe.
-- `add_estimated_entries` guarda de una vez los ítems que la persona revisó y confirmó.

create table public.ai_estimates (
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  kind text not null default 'text',
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id),
  constraint ai_estimates_kind_check check (kind in ('text', 'photo'))
);

create index ai_estimates_created_idx on public.ai_estimates (created_at);

alter table public.ai_estimates enable row level security;
revoke all on public.ai_estimates from anon, authenticated;
grant all on public.ai_estimates to service_role;

-- La convención del proyecto exige una política de lectura propia en toda tabla de `public` (guardián de RLS).
-- Sin permiso de `select` para `authenticated`, la política no concede acceso: queda como segunda barrera.
create policy ai_estimates_select_own on public.ai_estimates
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

-- Ítems estimados confirmados --------------------------------------------------------------------------
-- Cada ítem queda como comida con origen «estimado» y estado confirmado. Se valida con las mismas reglas
-- que el alta manual. Una sola transacción: o se guardan todos o ninguno. El identificador de cada ítem
-- se deriva de `request_id` y de su posición, así repetir la llamada devuelve los mismos ítems.
create function public.add_estimated_entries(entries jsonb, request_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_meal text;
  v_date date;
  v_items jsonb;
  v_count int;
  v_item jsonb;
  v_index int := 0;
  v_description text;
  v_item_request uuid;
  v_id uuid;
  v_ids uuid[] := array[]::uuid[];
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if request_id is null then
    raise exception 'invalid_entry:invalid_request:request_id' using errcode = '22023';
  end if;

  v_meal := entries ->> 'meal';
  if v_meal is null or v_meal not in ('breakfast', 'lunch', 'snack', 'dinner', 'extra') then
    raise exception 'invalid_entry:invalid_meal:meal' using errcode = '22023';
  end if;
  v_date := private.parse_log_date(v_user, entries ->> 'log_date');

  v_items := entries -> 'items';
  if jsonb_typeof(v_items) is distinct from 'array' then
    raise exception 'invalid_entry:invalid_items:items' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(v_items);
  if v_count < 1 or v_count > 12 then
    raise exception 'invalid_entry:invalid_items:items' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_items) loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'invalid_entry:invalid_items:items' using errcode = '22023';
    end if;
    v_description := btrim(coalesce(v_item ->> 'description', ''));
    if v_description = '' then
      raise exception 'invalid_entry:description_required:description' using errcode = '22023';
    end if;
    if char_length(v_description) > 200 then
      raise exception 'invalid_entry:out_of_range:description' using errcode = '22023';
    end if;
    perform private.validate_manual_values(v_item);

    -- Identificador estable por ítem: mismo request_id y misma posición, mismo identificador.
    v_item_request := md5(request_id::text || ':' || v_index::text)::uuid;
    v_index := v_index + 1;

    select e.id into v_id from public.meal_entries e
    where e.user_id = v_user and e.client_request_id = v_item_request;
    if not found then
      begin
        insert into public.meal_entries (
          user_id, log_date, meal, origin, status, food_name, quantity_text,
          energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg,
          client_request_id
        ) values (
          v_user, v_date, v_meal, 'estimated', 'confirmed', v_description,
          nullif(btrim(coalesce(v_item ->> 'quantity_text', '')), ''),
          (v_item ->> 'energy_kcal')::numeric, (v_item ->> 'protein_g')::numeric,
          (v_item ->> 'carbs_g')::numeric, (v_item ->> 'sugars_g')::numeric,
          (v_item ->> 'fat_g')::numeric, (v_item ->> 'saturated_fat_g')::numeric,
          (v_item ->> 'fiber_g')::numeric, (v_item ->> 'sodium_mg')::numeric,
          v_item_request
        ) returning id into v_id;
      exception when unique_violation then
        -- Otra llamada con el mismo identificador ganó la carrera: devuelve la suya.
        select e.id into v_id from public.meal_entries e
        where e.user_id = v_user and e.client_request_id = v_item_request;
        if not found then
          raise;
        end if;
      end;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end
$$;

revoke all on function public.add_estimated_entries(jsonb, uuid) from public, anon;
grant execute on function public.add_estimated_entries(jsonb, uuid) to authenticated;

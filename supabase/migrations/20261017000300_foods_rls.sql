-- T010 (spec 002, FR-016, FR-022): politicas y permisos minimos por columna.
-- El catalogo comun (user_id nulo) es de solo lectura: ninguna politica de escritura lo alcanza.
-- Solo service_role (la carga del catalogo) escribe filas del catalogo.

-- Permisos por columna: el cliente nunca envia origen, fuente, identificador de origen, fecha de
-- importacion ni columnas calculadas.
grant select on public.foods, public.food_portions, public.food_sources to authenticated;

grant insert (
  user_id, origin, based_on_food_id, name, brand, reference_basis,
  energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg,
  client_request_id
) on public.foods to authenticated;

grant update (
  name, brand, reference_basis,
  energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg
) on public.foods to authenticated;

grant delete on public.foods to authenticated;

grant insert (food_id, name, quantity, position) on public.food_portions to authenticated;
grant update (name, quantity, position) on public.food_portions to authenticated;
grant delete on public.food_portions to authenticated;

-- foods -------------------------------------------------------------------------------------------
create policy foods_select on public.foods
  for select to authenticated
  using ((user_id is null or user_id = (select auth.uid())) and private.is_session_fresh());

create policy foods_insert_own on public.foods
  for insert to authenticated
  with check (
    origin = 'own' and user_id = (select auth.uid()) and private.is_session_fresh()
  );

create policy foods_update_own on public.foods
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh())
  with check (user_id = (select auth.uid()) and private.is_session_fresh());

create policy foods_delete_own on public.foods
  for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh());

-- food_portions ---------------------------------------------------------------------------------
create policy food_portions_select on public.food_portions
  for select to authenticated
  using ((user_id is null or user_id = (select auth.uid())) and private.is_session_fresh());

create policy food_portions_insert_own on public.food_portions
  for insert to authenticated
  with check (
    private.is_session_fresh()
    and exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id = (select auth.uid())
    )
  );

create policy food_portions_update_own on public.food_portions
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh())
  with check (user_id = (select auth.uid()) and private.is_session_fresh());

create policy food_portions_delete_own on public.food_portions
  for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh());

-- food_sources: solo lectura para cuentas con sesion vigente ------------------------------------
create policy food_sources_select on public.food_sources
  for select to authenticated
  using (private.is_session_fresh());

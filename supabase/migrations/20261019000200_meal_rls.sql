-- T009 (spec 003, FR-036): permisos mínimos y políticas de los ítems, los inicios de día y las fotos.
--
-- El cliente LEE lo propio y puede BORRAR sus ítems. Nunca inserta ni actualiza directamente: los ítems
-- nacen y cambian por las funciones add_meal_entry / update_meal_entry / repeat_meal, que toman la
-- instantánea del alimento en el servidor (security definer, con el dueño y la sesión verificados). Las
-- fotos solo las escribe la Edge Function `meal-photo`, que les quita los metadatos antes de guardarlas.
--
-- La vigencia de la sesión se escribe (select private.is_session_fresh()): una llamada suelta se
-- evaluaría por cada fila (lección de la spec 002, T071).

grant select, delete on public.meal_entries to authenticated;
grant select on public.log_day_starts to authenticated;
grant select on public.meal_photos to authenticated;

create policy meal_entries_select_own on public.meal_entries
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy meal_entries_delete_own on public.meal_entries
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy log_day_starts_select_own on public.log_day_starts
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy meal_photos_select_own on public.meal_photos
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

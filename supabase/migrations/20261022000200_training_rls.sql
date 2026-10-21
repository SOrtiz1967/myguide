-- T007 (spec 006, FR-050): permisos mínimos y políticas de rutinas y sesiones.
--
-- El cliente LEE lo propio y puede BORRAR rutinas y sesiones propias. Nunca inserta ni actualiza
-- directamente: todo nace y cambia por las funciones de la spec (security definer, con el dueño y la sesión
-- verificados). Las tablas hijas no se borran directamente: se borran por cascada al eliminar la rutina o la
-- sesión. Un registro ajeno se comporta como inexistente.
--
-- La vigencia de la sesión se escribe (select private.is_session_fresh()): una llamada suelta se evaluaría por
-- cada fila (lección de la spec 002, T071).

grant select on
  public.routines, public.routine_exercises, public.workout_sessions, public.session_plan_items,
  public.session_exercises, public.session_sets, public.session_date_changes
  to authenticated;
grant delete on public.routines, public.workout_sessions to authenticated;

create policy routines_select_own on public.routines
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy routines_delete_own on public.routines
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy routine_exercises_select_own on public.routine_exercises
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy workout_sessions_select_own on public.workout_sessions
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));
create policy workout_sessions_delete_own on public.workout_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy session_plan_items_select_own on public.session_plan_items
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy session_exercises_select_own on public.session_exercises
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy session_sets_select_own on public.session_sets
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy session_date_changes_select_own on public.session_date_changes
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

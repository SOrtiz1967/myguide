-- T008 (spec 005, FR-023, FR-028, FR-039): permisos mínimos y políticas del catálogo de ejercicios.
--
-- El cliente LEE el catálogo y lo propio, y puede BORRAR lo propio. Nunca inserta ni actualiza directamente:
-- los ejercicios nacen y cambian por las funciones create_exercise / update_exercise / copy_exercise, que
-- toman el dueño de la sesión, fijan el origen y el estado de los textos y calculan los campos de búsqueda
-- (security definer, con el dueño y la sesión verificados). El catálogo común (user_id nulo) es de solo
-- lectura: ninguna política de escritura ni de borrado lo alcanza; solo service_role (la carga) lo escribe.
--
-- La vigencia de la sesión se escribe (select private.is_session_fresh()): una llamada suelta se
-- evaluaría por cada fila (lección de la spec 002, T071).

grant select, delete on public.exercises to authenticated;
grant select on public.exercise_sources to authenticated;

create policy exercises_select on public.exercises
  for select to authenticated
  using (
    (user_id is null or user_id = (select auth.uid()))
    and (select private.is_session_fresh())
  );

create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create policy exercise_sources_select on public.exercise_sources
  for select to authenticated
  using ((select private.is_session_fresh()));

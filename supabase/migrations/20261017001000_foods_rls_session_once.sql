-- T071 (spec 002, SC-002): la vigencia de la sesión se evalúa UNA vez por consulta, no por fila.
-- Medido con 50.000 alimentos: una llamada suelta a private.is_session_fresh() en la política se
-- ejecutaba por cada fila leída (la función es security definer y no se simplifica), y las búsquedas
-- tardaban segundos. Envuelta en (select ...) el planificador la trata como un valor fijo de la consulta.
-- El comportamiento es el mismo: con la sesión vencida no se ve ni se escribe nada.

alter policy foods_select on public.foods
  using ((user_id is null or user_id = (select auth.uid())) and (select private.is_session_fresh()));

alter policy foods_insert_own on public.foods
  with check (origin = 'own' and user_id = (select auth.uid()) and (select private.is_session_fresh()));

alter policy foods_update_own on public.foods
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()))
  with check (user_id = (select auth.uid()) and (select private.is_session_fresh()));

alter policy foods_delete_own on public.foods
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

alter policy food_portions_select on public.food_portions
  using ((user_id is null or user_id = (select auth.uid())) and (select private.is_session_fresh()));

alter policy food_portions_insert_own on public.food_portions
  with check (
    (select private.is_session_fresh())
    and exists (
      select 1 from public.foods f
      where f.id = food_id and f.user_id = (select auth.uid())
    )
  );

alter policy food_portions_update_own on public.food_portions
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()))
  with check (user_id = (select auth.uid()) and (select private.is_session_fresh()));

alter policy food_portions_delete_own on public.food_portions
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

alter policy food_sources_select on public.food_sources
  using ((select private.is_session_fresh()));

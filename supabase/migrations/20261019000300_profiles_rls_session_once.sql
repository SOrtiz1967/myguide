-- T010 (spec 003): la vigencia de la sesión se evalúa UNA vez por consulta también en `profiles`.
-- Lección de la spec 002 (T071): una llamada suelta a private.is_session_fresh() en una política se
-- ejecuta por cada fila. En `profiles` hay una sola fila por cuenta, así que no hay problema de
-- rendimiento hoy, pero el guardián (rls_guardrail) exige el mismo patrón en todas las tablas para que
-- no se copie el patrón costoso. El comportamiento es idéntico.

alter policy profiles_select_own on public.profiles
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

alter policy profiles_update_own on public.profiles
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()))
  with check (user_id = (select auth.uid()) and (select private.is_session_fresh()));

-- T006 (spec 004, FR-023): el objetivo y su historial son datos de salud, privados de cada cuenta.
--
-- El cliente LEE lo propio. Nunca inserta, actualiza ni borra directamente: el objetivo entra por la
-- función set_energy_goal, que fija el día de vigencia en el servidor.
--
-- La vigencia de la sesión se escribe (select private.is_session_fresh()): una llamada suelta se
-- evaluaría por cada fila (lección de la spec 002, T071).

grant select on public.energy_goals to authenticated;

create policy energy_goals_select_own on public.energy_goals
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

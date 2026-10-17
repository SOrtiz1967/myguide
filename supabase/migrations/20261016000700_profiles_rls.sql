-- T047 (FR-009 a FR-012): politicas RLS del perfil. Cada cuenta ve y edita solo el suyo, y solo con
-- sesion vigente. El cliente no inserta ni elimina perfiles (los crea el disparador de alta).

-- Permisos minimos: lectura del propio perfil y edicion solo de las columnas del formulario.
-- user_id, email_verified_at, privacy_notice_* y last_active_at quedan fuera del alcance del cliente.
grant select on public.profiles to authenticated;
grant update (birth_date, sex, height_cm, timezone) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh())
  with check (user_id = (select auth.uid()) and private.is_session_fresh());

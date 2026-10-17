-- T028 (FR-003): la sesion vence tras 30 dias sin actividad, aplicado en la base de datos.
-- Decision 4 de research.md; el claim `amr` del JWT quedo confirmado en el prototipo T007.

-- Las politicas RLS de `public` invocan funciones de `private`: authenticated necesita USAGE en el
-- esquema (las tablas de `private` siguen sin ningun permiso para anon ni authenticated).
grant usage on schema private to authenticated;

-- true si el usuario actual tuvo actividad en los ultimos 30 dias. Falso si no tiene perfil.
create function private.is_session_fresh() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.last_active_at > now() - interval '30 days'
      from public.profiles p
      where p.user_id = auth.uid()
    ),
    false
  );
$$;

revoke all on function private.is_session_fresh() from public, anon;
grant execute on function private.is_session_fresh() to authenticated;

-- Marca actividad. Si la sesion ya vencio, falla: el cliente cierra la sesion y pide ingresar.
create function public.touch_session() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set last_active_at = now()
  where user_id = auth.uid()
    and last_active_at > now() - interval '30 days';

  if not found then
    raise exception 'session_expired: la sesion vencio por inactividad' using errcode = '28000';
  end if;
end;
$$;

-- Reinicia el contador solo si el JWT viene de un inicio de sesion con contrasena de los ultimos
-- 5 minutos. Un token renovado de una sesion vieja conserva su `amr` original y no sirve.
create function public.start_session() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_login bigint;
begin
  select max((e ->> 'timestamp')::bigint)
  into v_login
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as e
  where e ->> 'method' = 'password';

  if auth.uid() is null
     or v_login is null
     or v_login < extract(epoch from now())::bigint - 300 then
    raise exception 'login_required: se necesita un inicio de sesion reciente' using errcode = '28000';
  end if;

  update public.profiles set last_active_at = now() where user_id = auth.uid();
end;
$$;

revoke all on function public.touch_session() from public, anon;
revoke all on function public.start_session() from public, anon;
grant execute on function public.touch_session() to authenticated;
grant execute on function public.start_session() to authenticated;

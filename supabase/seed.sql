-- Datos y utilidades SOLO para desarrollo local y pruebas (no se aplica a produccion).
-- Ayudantes pgTAP de la spec 001 (tarea T019). Viven en el esquema `tests`.

create schema if not exists tests;

-- Crea un usuario directamente en auth.users, con el metadato del aviso de privacidad
-- (a menos que se pase NULL, para probar el rechazo). Devuelve su id.
create or replace function tests.create_user(
  p_email text,
  p_privacy_version text default '2026-10-16'
) returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_meta jsonb := case
    when p_privacy_version is null then '{}'::jsonb
    else jsonb_build_object('privacy_notice_version', p_privacy_version)
  end;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v_id, 'authenticated', 'authenticated', p_email, v_meta, now(), now());
  return v_id;
end;
$$;

-- Actua como el usuario indicado (rol `authenticated` con su JWT simulado).
-- p_amr_ts: hora (epoch) del inicio de sesion con contrasena que simula el claim `amr` del JWT.
create or replace function tests.authenticate_as(p_user_id uuid, p_amr_ts bigint default null)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    (
      jsonb_build_object('sub', p_user_id, 'role', 'authenticated')
      || case
        when p_amr_ts is null then '{}'::jsonb
        else jsonb_build_object(
          'amr',
          jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', p_amr_ts))
        )
      end
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Actua como una peticion anonima.
create or replace function tests.authenticate_as_anon() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end;
$$;

-- Vuelve al rol de administrador de la sesion de pruebas.
create or replace function tests.clear_authentication() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'reset role';
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

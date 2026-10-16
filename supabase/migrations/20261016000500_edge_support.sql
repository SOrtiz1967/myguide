-- T090: soporte de las Edge Functions. Todo es exclusivo del rol de servicio (service_role):
-- anon y authenticated no pueden ejecutar nada de esto (FR-010).

-- Limite de solicitudes por clave (por ejemplo, por IP) -----------------------------------------
create table private.rate_limit_hits (
  id bigint generated always as identity primary key,
  key text not null,
  hit_at timestamptz not null default now()
);

create index rate_limit_hits_key_idx on private.rate_limit_hits (key, hit_at desc);
create index rate_limit_hits_hit_at_idx on private.rate_limit_hits (hit_at);

alter table private.rate_limit_hits enable row level security;
revoke all on private.rate_limit_hits from anon, authenticated;
grant all on private.rate_limit_hits to service_role;

-- true si la solicitud se permite (y la registra); false si ya se alcanzo el maximo en la ventana.
create function public.check_rate_limit(p_key text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from private.rate_limit_hits where hit_at < now() - interval '1 day';

  select count(*) into v_count
  from private.rate_limit_hits
  where key = p_key and hit_at > now() - p_window;

  if v_count >= p_max then
    return false;
  end if;

  insert into private.rate_limit_hits (key) values (p_key);
  return true;
end;
$$;

-- Tokens de confirmacion de correo ---------------------------------------------------------------
-- Emite un token nuevo e invalida los pendientes de la misma cuenta.
create function public.issue_email_token(p_user_id uuid, p_token_hash text, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.email_verification_tokens
  set used_at = now()
  where user_id = p_user_id and used_at is null;

  insert into private.email_verification_tokens (user_id, token_hash, expires_at)
  values (p_user_id, p_token_hash, p_expires_at);
end;
$$;

-- Atomico: consume el token solo si existe, no vencio y no se uso. Devuelve la cuenta o null.
create function public.consume_email_token(p_token_hash text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  update private.email_verification_tokens
  set used_at = now()
  where token_hash = p_token_hash and used_at is null and expires_at > now()
  returning user_id into v_user_id;

  return v_user_id;
end;
$$;

create function public.email_token_stats(p_user_id uuid)
returns table (last_created_at timestamptz, created_last_day integer)
language sql
security definer
set search_path = ''
as $$
  select
    max(created_at),
    (count(*) filter (where created_at > now() - interval '1 day'))::integer
  from private.email_verification_tokens
  where user_id = p_user_id;
$$;

create function public.mark_email_verified(p_user_id uuid) returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set email_verified_at = coalesce(email_verified_at, now())
  where user_id = p_user_id;
$$;

-- Busqueda de cuenta por correo para la recuperacion (FR-027). No expone mas que id y estado.
create function public.find_user_by_email(p_email text)
returns table (id uuid, email_verified boolean)
language sql
security definer
set search_path = ''
as $$
  select u.id, (p.email_verified_at is not null)
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where lower(u.email) = lower(p_email);
$$;

revoke all on function public.check_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke all on function public.issue_email_token(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_email_token(text) from public, anon, authenticated;
revoke all on function public.email_token_stats(uuid) from public, anon, authenticated;
revoke all on function public.mark_email_verified(uuid) from public, anon, authenticated;
revoke all on function public.find_user_by_email(text) from public, anon, authenticated;

grant execute on function public.check_rate_limit(text, integer, interval) to service_role;
grant execute on function public.issue_email_token(uuid, text, timestamptz) to service_role;
grant execute on function public.consume_email_token(text) to service_role;
grant execute on function public.email_token_stats(uuid) to service_role;
grant execute on function public.mark_email_verified(uuid) to service_role;
grant execute on function public.find_user_by_email(text) to service_role;

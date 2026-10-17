-- T011: esquema `private` y sus tablas. Solo accesibles con la clave de servicio (Edge Functions).

create schema if not exists private;

revoke all on schema private from anon, authenticated;
grant usage on schema private to service_role;

create table private.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_verification_tokens_user_id_idx
  on private.email_verification_tokens (user_id, created_at desc);

create table private.privacy_notice_versions (
  version text primary key,
  is_current boolean not null,
  published_at timestamptz not null
);

insert into private.privacy_notice_versions (version, is_current, published_at)
values ('2026-10-16', true, '2026-10-16T00:00:00Z');

alter table private.email_verification_tokens enable row level security;
alter table private.privacy_notice_versions enable row level security;

revoke all on all tables in schema private from anon, authenticated;
grant all on all tables in schema private to service_role;

alter default privileges in schema private revoke all on tables from anon, authenticated;
alter default privileges in schema private grant all on tables to service_role;

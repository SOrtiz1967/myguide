-- T010: tabla de perfiles (spec 001, data-model.md).
-- RLS activado SIN politicas: acceso denegado por defecto. Las politicas llegan con la historia 2 (T047).

create schema if not exists private;

create function private.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birth_date date,
  sex text,
  height_cm numeric(4, 1),
  timezone text,
  unit_system text not null default 'metric',
  privacy_notice_version text not null,
  privacy_notice_accepted_at timestamptz not null,
  email_verified_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

-- Supabase otorga permisos por defecto a anon y authenticated en `public`: se retiran.
-- Los permisos minimos por columna se agregan junto con las politicas (T047).
revoke all on public.profiles from anon, authenticated;

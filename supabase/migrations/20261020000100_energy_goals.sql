-- T004 (spec 004, FR-001, FR-004, FR-006, FR-008, FR-028): historial del objetivo de energía diaria.
--
-- Una fila por CAMBIO del objetivo. Nunca se actualiza ni se borra una fila (salvo la cascada al eliminar
-- la cuenta): cambiar o quitar el objetivo agrega otra fila, así un cambio no reescribe lo que regía en
-- un día pasado (Principio II). El objetivo de un día D es el `kcal` de la fila de `created_at` más
-- reciente entre las que tienen `effective_from <= D`; si no hay filas o ese `kcal` es nulo, D no tiene
-- objetivo. Esa resolución la hace el cliente con una función pura (research, Decisión 3).
--
-- El cliente solo lee; la escritura es la función `set_energy_goal` (migración 20261020000300).

create table public.energy_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- El día (en la zona horaria de la persona) desde el que rige. Lo fija el servidor, no el cliente.
  effective_from date not null,
  -- Kilocalorías por día; nulo = la persona quitó el objetivo.
  kcal integer,
  client_request_id uuid not null,
  -- La hora con la que se guardó el cambio; define cuál cambio es el último.
  created_at timestamptz not null default now(),
  constraint energy_goals_kcal_check check (kcal is null or kcal between 1000 and 6000),
  -- No se compara con la fecha actual (una restricción con now() no es estable); la función siempre
  -- escribe el "hoy" de la persona.
  constraint energy_goals_effective_from_check check (effective_from >= date '2000-01-01'),
  constraint energy_goals_request_key unique (user_id, client_request_id)
);

create index energy_goals_history_idx on public.energy_goals (user_id, created_at desc);

-- Seguridad: RLS activado sin políticas y sin permisos para el cliente (las agrega la migración siguiente).
alter table public.energy_goals enable row level security;

revoke all on public.energy_goals from anon, authenticated;
grant all on public.energy_goals to service_role;

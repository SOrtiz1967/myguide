-- Spec 021: recordatorios configurables.
--
-- Para el peso, las fotos de progreso y los suplementos, la persona elige cada cuánto le gustaría que la aplicación le
-- avise: cada día, cada tantos días o ciertos días de la semana. El aviso es una tarjeta dentro de la aplicación (se
-- calcula en el navegador a partir de esta configuración y de lo ya registrado); no se envía nada con la aplicación
-- cerrada. La tabla guarda solo la configuración, así que las notificaciones push de la spec 024 podrán leerla sin
-- rehacerla. Reemplaza la casilla `profiles.weight_reminder` de la spec 016: lo que estaba activado pasa a un
-- recordatorio diario de peso.
--
-- El cliente LEE lo propio; configurar y posponer pasan por funciones security definer con el dueño y la sesión
-- verificados. Los errores tienen la forma `invalid_reminder:<motivo>:<campo>` y no incluyen datos de la persona.

create table public.reminders (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  enabled boolean not null default true,
  frequency text not null,
  -- Solo con frecuencia «cada tantos días».
  every_n smallint,
  -- Solo con frecuencia «ciertos días»: 1 = lunes a 7 = domingo, sin repetidos y ordenados.
  weekdays smallint[],
  -- «Más tarde»: el aviso no vuelve a mostrarse hasta después de esta fecha.
  snoozed_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reminders_pkey primary key (user_id, kind),
  constraint reminders_kind_check check (kind in ('weight', 'photos', 'supplements')),
  constraint reminders_frequency_check check (frequency in ('daily', 'every_n_days', 'weekdays')),
  constraint reminders_every_n_check check ((frequency = 'every_n_days') = (every_n is not null)),
  constraint reminders_every_n_range_check check (every_n is null or every_n between 2 and 30),
  constraint reminders_weekdays_check check ((frequency = 'weekdays') = (weekdays is not null)),
  constraint reminders_weekdays_range_check check (
    weekdays is null
    or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
  ),
  -- Los suplementos se marcan día por día: «cada tantos días» no tiene sentido para ellos.
  constraint reminders_supplements_frequency_check check (kind <> 'supplements' or frequency <> 'every_n_days')
);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function private.set_updated_at();

alter table public.reminders enable row level security;

revoke all on public.reminders from anon, authenticated;
grant all on public.reminders to service_role;
grant select on public.reminders to authenticated;

create policy reminders_select_own on public.reminders
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

create function private.reminder_json(p_row public.reminders) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', p_row.kind, 'enabled', p_row.enabled, 'frequency', p_row.frequency, 'every_n', p_row.every_n,
    'weekdays', to_jsonb(p_row.weekdays), 'snoozed_until', p_row.snoozed_until
  )
$$;

revoke all on function private.reminder_json(public.reminders) from public, anon, authenticated;

-- Crea o reemplaza la configuración de un recordatorio. Cambiarla quita cualquier «más tarde» anterior.
create function public.set_reminder(
  kind text,
  enabled boolean,
  frequency text,
  every_n integer default null,
  weekdays integer[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_days smallint[];
  v_row public.reminders;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if kind is null or kind not in ('weight', 'photos', 'supplements') then
    raise exception 'invalid_reminder:kind_invalid:kind' using errcode = '22023';
  end if;
  if frequency is null or frequency not in ('daily', 'every_n_days', 'weekdays') then
    raise exception 'invalid_reminder:frequency_invalid:frequency' using errcode = '22023';
  end if;
  if kind = 'supplements' and frequency = 'every_n_days' then
    raise exception 'invalid_reminder:frequency_invalid:frequency' using errcode = '22023';
  end if;
  if frequency = 'every_n_days' and (every_n is null or every_n not between 2 and 30) then
    raise exception 'invalid_reminder:every_n_invalid:every_n' using errcode = '22023';
  end if;
  if frequency = 'weekdays' then
    select array_agg(distinct d::smallint order by d::smallint) into v_days from unnest(weekdays) d;
    if v_days is null or exists (select 1 from unnest(v_days) d where d not between 1 and 7) then
      raise exception 'invalid_reminder:weekdays_invalid:weekdays' using errcode = '22023';
    end if;
  end if;

  insert into public.reminders (user_id, kind, enabled, frequency, every_n, weekdays, snoozed_until)
  values (
    v_user, kind, coalesce(enabled, false), frequency,
    case when frequency = 'every_n_days' then every_n::smallint end,
    case when frequency = 'weekdays' then v_days end,
    null
  )
  on conflict (user_id, kind) do update
    set enabled = excluded.enabled, frequency = excluded.frequency, every_n = excluded.every_n,
        weekdays = excluded.weekdays, snoozed_until = null
  returning * into v_row;
  return private.reminder_json(v_row);
end
$$;

revoke all on function public.set_reminder(text, boolean, text, integer, integer[]) from public, anon;
grant execute on function public.set_reminder(text, boolean, text, integer, integer[]) to authenticated;

-- «Más tarde»: oculta el aviso hasta mañana (en la zona horaria de la persona). No cambia la configuración.
create function private.snooze_reminder_at(p_user uuid, p_kind text, p_now timestamptz, p_zone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.reminders;
begin
  update public.reminders r
    set snoozed_until = (p_now at time zone p_zone)::date + 1
    where r.user_id = p_user and r.kind = p_kind
    returning * into v_row;
  if not found then
    raise exception 'not_found: el recordatorio no existe' using errcode = 'P0002';
  end if;
  return private.reminder_json(v_row);
end
$$;

revoke all on function private.snooze_reminder_at(uuid, text, timestamptz, text) from public, anon, authenticated;

create function public.snooze_reminder(kind text, client_timezone text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  return private.snooze_reminder_at(v_user, kind, now(), private.effective_timezone(v_user, client_timezone));
end
$$;

revoke all on function public.snooze_reminder(text, text) from public, anon;
grant execute on function public.snooze_reminder(text, text) to authenticated;

-- Lo que la spec 016 guardaba como una casilla pasa a un recordatorio diario de peso, y la columna se elimina.
insert into public.reminders (user_id, kind, enabled, frequency)
select p.user_id, 'weight', true, 'daily' from public.profiles p where p.weight_reminder
on conflict (user_id, kind) do nothing;

alter table public.profiles drop column weight_reminder;

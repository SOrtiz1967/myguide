-- T055 (FR-013 a FR-017): restricciones del perfil, aplicadas en la base de datos y no solo en el cliente.
-- Las reglas que dependen de la fecha actual o de la lista de zonas horarias van en un disparador,
-- porque un CHECK debe ser inmutable.

alter table public.profiles
  add constraint profiles_sex_check check (sex is null or sex in ('female', 'male')),
  add constraint profiles_height_check check (height_cm is null or (height_cm >= 50 and height_cm <= 250)),
  add constraint profiles_unit_system_check check (unit_system = 'metric');

create function private.validate_profile() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null
     and (new.birth_date > current_date or new.birth_date < current_date - interval '120 years') then
    raise exception 'invalid_birth_date: la fecha de nacimiento no es razonable' using errcode = '23514';
  end if;

  if new.timezone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone: zona horaria desconocida' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger profiles_validate
  before insert or update on public.profiles
  for each row execute function private.validate_profile();

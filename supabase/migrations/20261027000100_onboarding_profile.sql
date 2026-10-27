-- Spec 014: datos del primer ingreso. Objetivo físico, experiencia, actividad y marca de recorrido completado.
-- Sin tablas nuevas: son columnas del perfil propio, con las mismas políticas RLS (spec 001).

alter table public.profiles
  add column goal_type text,
  add column experience text,
  add column job_activity text,
  add column training_days smallint,
  add column onboarding_completed_at timestamptz;

alter table public.profiles
  add constraint profiles_goal_type_check check (goal_type is null or goal_type in ('muscle_gain', 'fat_loss', 'recomposition')),
  add constraint profiles_experience_check check (experience is null or experience in ('beginner', 'intermediate', 'advanced')),
  add constraint profiles_job_activity_check check (job_activity is null or job_activity in ('sedentary', 'mixed', 'on_feet')),
  add constraint profiles_training_days_check check (training_days is null or training_days between 0 and 7);

grant update (goal_type, experience, job_activity, training_days, onboarding_completed_at) on public.profiles to authenticated;

-- Completar el recorrido exige todos los datos y ser mayor de edad. El mensaje es `invalid_onboarding:<motivo>`.
create or replace function private.validate_profile() returns trigger
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

  if new.onboarding_completed_at is not null
     and (tg_op = 'INSERT' or old.onboarding_completed_at is null) then
    if new.sex is null or new.birth_date is null or new.height_cm is null or new.timezone is null
       or new.goal_type is null or new.experience is null or new.job_activity is null
       or new.training_days is null then
      raise exception 'invalid_onboarding:incomplete: faltan datos del recorrido' using errcode = '23514';
    end if;
    if new.birth_date > current_date - interval '18 years' then
      raise exception 'invalid_onboarding:underage: la estimacion es solo para personas adultas' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

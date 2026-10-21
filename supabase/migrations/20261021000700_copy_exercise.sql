-- T052 (spec 005, FR-026, FR-033): copia propia y editable de un ejercicio visible.
-- Es `security definer` porque el cliente no escribe en `exercises`. La visibilidad se comprueba a mano:
-- se puede copiar el catálogo (sin dueño) y lo propio; un ejercicio ajeno se comporta como inexistente.
-- La copia nunca modifica el original, queda como ejercicio propio sin fuente ni fecha de importación, y
-- sus textos pasan a `original` (ahora son de la persona).

create function public.copy_exercise(id uuid, request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_source public.exercises%rowtype;
  v_new uuid;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  if request_id is null then
    raise exception 'invalid_exercise:request_required:request_id' using errcode = '22023';
  end if;

  -- Idempotencia: la solicitud ya se guardó (también si es un reintento tardío).
  select e.id into v_new from public.exercises e
  where e.user_id = v_user and e.client_request_id = request_id;
  if found then
    return v_new;
  end if;

  select * into v_source from public.exercises e
  where e.id = copy_exercise.id and (e.user_id is null or e.user_id = v_user);
  if not found then
    raise exception 'not_found: el ejercicio no existe' using errcode = 'P0002';
  end if;

  begin
    insert into public.exercises (
      origin, user_id, based_on_exercise_id, name, name_status, aliases, measurement_type, primary_muscles,
      secondary_muscles, equipment, description, description_status, client_request_id
    )
    values (
      'own', v_user, v_source.id, v_source.name, 'original', v_source.aliases, v_source.measurement_type,
      v_source.primary_muscles, v_source.secondary_muscles, v_source.equipment, v_source.description,
      case when v_source.description is null then null else 'original' end, request_id
    )
    returning exercises.id into v_new;
  exception when unique_violation then
    -- Dos solicitudes iguales a la vez: gana la primera y la segunda devuelve su copia.
    select e.id into v_new from public.exercises e
    where e.user_id = v_user and e.client_request_id = request_id;
    if found then
      return v_new;
    end if;
    raise;
  end;

  return v_new;
end
$$;

revoke all on function public.copy_exercise(uuid, uuid) from public, anon;
grant execute on function public.copy_exercise(uuid, uuid) to authenticated;

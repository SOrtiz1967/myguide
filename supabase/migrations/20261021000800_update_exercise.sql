-- T057 (spec 005, FR-025, FR-027, FR-028, FR-030): editar un ejercicio propio (incluidas las copias).
-- Es `security definer` porque el cliente no escribe en `exercises`: solo toca filas del dueño de la
-- sesión y con origen propio. Sobre un ejercicio del catálogo, ajeno o inexistente no afecta ninguna fila
-- y devuelve `not_found`. Usa la misma validación y limpieza que `create_exercise`. La identidad (origen,
-- dueño, fuente) no cambia nunca: el disparador `exercises_protect_identity` también lo impide.

create function public.update_exercise(id uuid, exercise jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_clean jsonb;
  v_id uuid;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  -- El ejercicio debe ser propio antes de validar, así lo ajeno no revela nada con los errores de validación.
  perform 1 from public.exercises e
  where e.id = update_exercise.id and e.origin = 'own' and e.user_id = v_user;
  if not found then
    raise exception 'not_found: el ejercicio no existe' using errcode = 'P0002';
  end if;

  v_clean := private.clean_exercise_input(exercise);

  update public.exercises e set
    name = v_clean ->> 'name',
    name_status = 'original',
    measurement_type = v_clean ->> 'measurement_type',
    primary_muscles = array(select jsonb_array_elements_text(v_clean -> 'primary_muscles')),
    secondary_muscles = array(select jsonb_array_elements_text(v_clean -> 'secondary_muscles')),
    equipment = v_clean ->> 'equipment',
    description = v_clean ->> 'description',
    description_status = case when v_clean ->> 'description' is null then null else 'original' end,
    aliases = array(select jsonb_array_elements_text(v_clean -> 'aliases'))
  where e.id = update_exercise.id and e.origin = 'own' and e.user_id = v_user
  returning e.id into v_id;

  return v_id;
end
$$;

revoke all on function public.update_exercise(uuid, jsonb) from public, anon;
grant execute on function public.update_exercise(uuid, jsonb) to authenticated;

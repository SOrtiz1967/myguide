-- Spec 011: privacidad y ciclo de vida. Contrato en specs/011-privacidad-ciclo-de-vida/contracts/privacy.md.
--
-- `export_my_data` reúne en un solo JSON las filas de la cuenta de todas las tablas con datos de la persona.
-- La lista es fija a propósito: una prueba (privacy_lifecycle.test.sql) falla si una tabla nueva con `user_id`
-- no está acá, así nadie agrega datos de la persona sin decidir si se exportan.
-- La eliminación de cuenta no necesita código en la base de datos: toda tabla con `user_id` depende de
-- `auth.users` con `on delete cascade` (también lo comprueba esa prueba).

create function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_table text;
  v_rows jsonb;
  v_tables jsonb := '{}'::jsonb;
  v_email text;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;

  foreach v_table in array array[
    'profiles', 'foods', 'food_portions', 'meal_entries', 'log_day_starts', 'meal_photos', 'energy_goals',
    'exercises', 'routines', 'routine_exercises', 'workout_sessions', 'session_plan_items', 'session_exercises',
    'session_sets', 'session_date_changes', 'weekly_plan_days', 'body_measurements', 'daily_activity',
    'progress_photos', 'supplements', 'supplement_marks', 'reminders'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) order by t.ctid), ''[]''::jsonb) from public.%I t where t.user_id = $1',
      v_table
    ) into v_rows using v_user;
    v_tables := v_tables || jsonb_build_object(v_table, v_rows);
  end loop;

  select u.email into v_email from auth.users u where u.id = v_user;

  return jsonb_build_object(
    'format_version', 1,
    'exported_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'account', jsonb_build_object('email', v_email),
    'tables', v_tables
  );
end
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Aviso de privacidad vigente -------------------------------------------------------------------------------------
-- La versión nueva refleja lo que ya existe (exportar y eliminar) y detalla los servicios de terceros.
update private.privacy_notice_versions set is_current = false where is_current;
insert into private.privacy_notice_versions (version, is_current, published_at)
values ('2026-11-01', true, '2026-11-01T00:00:00Z');

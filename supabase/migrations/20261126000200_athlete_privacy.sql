-- Spec 025 (FR-010, SC-004): las tablas del perfil de atleta entran en la exportación de la cuenta (spec 011).
-- La eliminación de la cuenta no necesita código: todas dependen de `auth.users` con `on delete cascade`.
-- `export_my_data` mantiene una lista fija a propósito; se redefine completa con las tablas nuevas.

create or replace function public.export_my_data()
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
    'progress_photos', 'supplements', 'supplement_marks', 'reminders',
    'athlete_goals', 'athlete_availability', 'athlete_preferences', 'athlete_item_preferences'
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

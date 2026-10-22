-- Datos sintéticos para la medición de SC-010 (spec 006, T076).
-- Se ejecuta con psql como `postgres` sobre la base LOCAL, reemplazando __EMAIL__ por la cuenta de prueba, que ya debe
-- tener un ejercicio propio llamado «Press e2e». Crea, para esa cuenta:
--   - 200 sesiones realizadas en el mes en curso (varias por día);
--   - 500 sesiones realizadas anteriores a hoy, una por día;
-- cada una con el press y 3 series. Son 700 sesiones del mismo ejercicio.
-- Son sentencias separadas (no un solo CTE) porque los disparadores de validación leen las filas padre ya confirmadas.

insert into public.workout_sessions (user_id, session_date, original_date, status, started_at, finished_at)
select u.id, t.d, t.d, 'completed', now() - interval '2 hours', now() - interval '1 hour'
from (select id from auth.users where email = '__EMAIL__') u,
  (
    select (date_trunc('month', current_date)::date + (n % 28)) as d from generate_series(0, 199) n
    union all
    select current_date - (n + 1) from generate_series(0, 499) n
  ) t;

insert into public.session_exercises (session_id, user_id, position, exercise_id, exercise_name, measurement_type)
select s.id, s.user_id, 1, e.id, e.name, e.measurement_type
from public.workout_sessions s
join public.exercises e on e.user_id = s.user_id and e.name = 'Press e2e'
where s.user_id = (select id from auth.users where email = '__EMAIL__');

insert into public.session_sets (session_exercise_id, session_id, user_id, position, reps, weight_kg)
select x.id, x.session_id, x.user_id, p, 8, 60
from public.session_exercises x, generate_series(1, 3) p
where x.user_id = (select id from auth.users where email = '__EMAIL__');

analyze public.workout_sessions;
analyze public.session_exercises;
analyze public.session_sets;

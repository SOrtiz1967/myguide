-- T039 (spec 004, FR-008 a FR-010, SC-004): cambiar o quitar el objetivo nunca reescribe lo anterior.
-- Prueba de caracterización de la regla del historial: la función ya existe (T022), así que esta prueba
-- no "falla primero"; fija el comportamiento contra regresiones.
begin;
select plan(17);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset
select tests.set_profile_timezone(:'uid_a', 'America/Argentina/Buenos_Aires');

-- Una huella de las filas de la cuenta (todo su contenido), para comprobar que no se tocan.
create function pg_temp.fingerprint(p_user uuid) returns text
language sql stable as $$
  select coalesce(md5(string_agg(g::text, '|' order by g.created_at, g.id)), '') from public.energy_goals g where g.user_id = p_user
$$;
-- El objetivo de un día según la regla del historial: la fila más recientemente guardada que ya regía.
create function pg_temp.goal_on(p_user uuid, p_day date) returns integer
language sql stable as $$
  select kcal from public.energy_goals
  where user_id = p_user and effective_from <= p_day
  order by created_at desc limit 1
$$;

-- cambiar de 2.000 a 1.800 ---------------------------------------------------------------------------------------
select kcal from private.set_energy_goal_at(:'uid_a', 2000, '30000000-0000-0000-0000-000000000001', '2026-10-12 15:00+00', 'America/Argentina/Buenos_Aires');
select md5(g::text) as first_row from public.energy_goals g where client_request_id = '30000000-0000-0000-0000-000000000001' \gset
select kcal from private.set_energy_goal_at(:'uid_a', 1800, '30000000-0000-0000-0000-000000000002', '2026-10-19 15:00+00', 'America/Argentina/Buenos_Aires');

select is((select count(*) from public.energy_goals where user_id = :'uid_a'), 2::bigint, 'FR-008: cambiar agrega una fila');
select is(
  (select md5(g::text) from public.energy_goals g where client_request_id = '30000000-0000-0000-0000-000000000001'),
  :'first_row', 'y la fila anterior queda idéntica'
);
select is(pg_temp.goal_on(:'uid_a', '2026-10-18'), 2000, 'SC-004: el día anterior sigue con 2.000');
select is(pg_temp.goal_on(:'uid_a', '2026-10-19'), 1800, 'y hoy rige 1.800');
select is(pg_temp.goal_on(:'uid_a', '2026-10-11'), null, 'FR-010: antes de la primera vez no hay objetivo');

-- dos cambios el mismo día ------------------------------------------------------------------------------------------
select kcal from private.set_energy_goal_at(:'uid_a', 1900, '30000000-0000-0000-0000-000000000003', '2026-10-19 16:00+00', 'America/Argentina/Buenos_Aires');
select is((select count(*) from public.energy_goals where user_id = :'uid_a' and effective_from = '2026-10-19'), 2::bigint, 'FR-009: ambos cambios del día quedan guardados');
select is(pg_temp.goal_on(:'uid_a', '2026-10-19'), 1900, 'y rige el último guardado');

-- quitar y volver a fijar -----------------------------------------------------------------------------------------------
select pg_temp.fingerprint(:'uid_a') as before_remove \gset
select kcal from private.set_energy_goal_at(:'uid_a', null, '30000000-0000-0000-0000-000000000004', '2026-10-21 15:00+00', 'America/Argentina/Buenos_Aires');
select is((select count(*) from public.energy_goals where user_id = :'uid_a'), 4::bigint, 'FR-010: quitar agrega una fila');
select is(
  (select coalesce(md5(string_agg(g::text, '|' order by g.created_at, g.id)), '') from public.energy_goals g where g.user_id = :'uid_a' and g.created_at < '2026-10-21 00:00+00'),
  :'before_remove', 'y las filas anteriores quedan idénticas'
);
select is(pg_temp.goal_on(:'uid_a', '2026-10-20'), 1900, 'el día anterior a quitarlo conserva el suyo');
select is(pg_temp.goal_on(:'uid_a', '2026-10-21'), null, 'desde hoy no hay objetivo');
select kcal from private.set_energy_goal_at(:'uid_a', 1700, '30000000-0000-0000-0000-000000000005', '2026-10-24 15:00+00', 'America/Argentina/Buenos_Aires');
select is(pg_temp.goal_on(:'uid_a', '2026-10-23'), null, 'los días intermedios siguen sin objetivo');
select is(pg_temp.goal_on(:'uid_a', '2026-10-24'), 1700, 'al volver a fijarlo rige desde ese día');

-- la una de la madrugada, con el día que se cierra ---------------------------------------------------------------
select tests.create_manual_entry(:'uid_b', '2026-10-18', 'dinner', 'Cena de ayer', 500);
select tests.set_profile_timezone(:'uid_b', 'America/Argentina/Buenos_Aires');
select kcal from private.set_energy_goal_at(:'uid_b', 2000, '40000000-0000-0000-0000-000000000001', '2026-10-17 15:00+00', 'America/Argentina/Buenos_Aires');
-- 2026-10-19 01:00 en Buenos Aires = 04:00 UTC; ayer tiene ítems y hoy ninguno: se está cerrando el 18
select is(
  (select closing from private.log_day_status_at(:'uid_b', '2026-10-19 04:00+00', 'America/Argentina/Buenos_Aires')),
  true, 'a la 01:00 se está cerrando el día anterior'
);
select kcal from private.set_energy_goal_at(:'uid_b', 1500, '40000000-0000-0000-0000-000000000002', '2026-10-19 04:00+00', 'America/Argentina/Buenos_Aires');
select is(
  (select effective_from from public.energy_goals where client_request_id = '40000000-0000-0000-0000-000000000002'),
  '2026-10-19'::date, 'FR-008: el cambio rige desde el día nuevo, no desde el que se cierra'
);
select is(pg_temp.goal_on(:'uid_b', '2026-10-18'), 2000, 'y el día que se cierra conserva el valor anterior');

-- cambio de zona del perfil -----------------------------------------------------------------------------------------
select pg_temp.fingerprint(:'uid_b') as before_zone \gset
select tests.set_profile_timezone(:'uid_b', 'Pacific/Auckland');
select is(pg_temp.fingerprint(:'uid_b'), :'before_zone', 'SC-004: cambiar la zona del perfil no toca ninguna fila ya guardada');

select * from finish();
rollback;

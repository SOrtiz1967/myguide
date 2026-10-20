-- T007 (spec 005, FR-023, FR-028, FR-039): ejercicios propios privados y catálogo de solo lectura.
begin;
select plan(22);

-- La base local puede tener el catálogo cargado: la prueba parte de una base sin ejercicios.
delete from public.exercises;

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

insert into public.exercise_sources (slug, name, license_name, license_url, attribution, source_url)
values ('rls-prueba-ej', 'Fuente RLS', 'CC0 1.0', 'https://ej.test/l', 'Atribucion', 'https://ej.test')
returning id as sid \gset

-- datos de partida (como administrador)
insert into public.exercises (id, origin, source_id, source_item_id, name, measurement_type)
values ('00000000-0000-0000-0000-0000000000c1', 'imported', :'sid', 'C-1', 'Catalogo uno', 'reps_weight');
insert into public.exercises (id, user_id, origin, name, measurement_type)
values ('00000000-0000-0000-0000-0000000000a1', :'uid_a', 'own', 'Propio de A', 'duration'),
       ('00000000-0000-0000-0000-0000000000b1', :'uid_b', 'own', 'Propio de B', 'duration');

-- Cuenta A --------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');

select is((select count(*) from public.exercises where name = 'Propio de A'), 1::bigint, 'FR-023: A ve su ejercicio propio');
select is((select count(*) from public.exercises where name = 'Propio de B'), 0::bigint, 'FR-023: A no ve el ejercicio propio de B');
select is((select count(*) from public.exercises where name = 'Catalogo uno'), 1::bigint, 'A ve el catálogo común');
select is((select count(*) from public.exercise_sources where slug = 'rls-prueba-ej'), 1::bigint, 'FR-018: A puede leer las fuentes');

-- el cliente no escribe directamente: los ejercicios nacen y cambian por las funciones
select throws_ilike(
  format($$ insert into public.exercises (origin, user_id, name, measurement_type) values ('own', %L, 'Nuevo de A', 'duration') $$, :'uid_a'),
  'permission denied%', 'el cliente no puede insertar ejercicios directamente'
);
select throws_ilike(
  $$ update public.exercises set name = 'Cambiado' where name = 'Propio de A' $$,
  'permission denied%', 'el cliente no puede actualizar ejercicios directamente'
);
select throws_ilike(
  $$ insert into public.exercise_sources (slug, name, license_name, license_url, attribution, source_url) values ('x', 'x', 'x', 'x', 'x', 'x') $$,
  'permission denied%', 'el cliente no escribe fuentes'
);

-- A puede borrar lo suyo, no lo ajeno ni el catálogo
select lives_ok($$ delete from public.exercises where name = 'Propio de B' $$, 'el intento de borrar lo de B no falla...');
select lives_ok($$ delete from public.exercises where name = 'Catalogo uno' $$, '...ni el de borrar el catálogo (no afectan ninguna fila)');
select tests.clear_authentication();
select is((select count(*) from public.exercises where name in ('Propio de B', 'Catalogo uno')), 2::bigint, 'FR-028: el ejercicio de B y el catálogo siguen ahí');
select tests.authenticate_as(:'uid_a');
select lives_ok($$ delete from public.exercises where name = 'Propio de A' $$, 'A puede borrar su ejercicio');
select is((select count(*) from public.exercises where name = 'Propio de A'), 0::bigint, 'y desaparece');
select tests.clear_authentication();

-- Cuenta B ve el catálogo y lo suyo -----------------------------------------------------------------------------
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.exercises where name = 'Propio de B'), 1::bigint, 'B ve su ejercicio');
select is((select count(*) from public.exercises where name = 'Catalogo uno'), 1::bigint, 'B ve el catálogo');
select tests.clear_authentication();

-- sesión vencida: ni siquiera el catálogo (FR-039) --------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_b';
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.exercises), 0::bigint, 'FR-039: con la sesión vencida no ve ni el catálogo ni lo propio');
select is((select count(*) from public.exercise_sources), 0::bigint, '...ni las fuentes');
select lives_ok($$ delete from public.exercises where name = 'Propio de B' $$, 'y borrar no afecta nada');
select tests.clear_authentication();
select is((select count(*) from public.exercises where name = 'Propio de B'), 1::bigint, 'el ejercicio sigue ahí');

-- anónimo ---------------------------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ilike($$ select * from public.exercises $$, 'permission denied%', 'una petición anónima no accede a los ejercicios');
select throws_ilike($$ select * from public.exercise_sources $$, 'permission denied%', 'ni a las fuentes');
select tests.clear_authentication();

-- guardián de rendimiento: la vigencia de la sesión se evalúa una vez por consulta -----------------------------------
select ok(
  not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename in ('exercises', 'exercise_sources')
      and p.qual ~* 'is_session_fresh' and p.qual !~* '\(\s*select\s+private\.is_session_fresh'
  ),
  'las políticas envuelven is_session_fresh() en (select …)'
);
select ok(
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'exercises') = 2,
  'exercises tiene exactamente dos políticas (lectura y borrado de lo propio)'
);

select * from finish();
rollback;

-- T009 (spec 002, FR-016, FR-022): alimentos propios privados y catálogo de solo lectura.
begin;
select plan(29);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url)
values ('rls-prueba', 'Fuente RLS', 'CC0 1.0', 'https://ej.test/l', 'Atribucion', 'https://ej.test')
returning id as sid \gset

-- datos de partida (como administrador)
insert into public.foods (id, origin, source_id, source_item_id, name, reference_basis, energy_kcal)
values ('00000000-0000-0000-0000-0000000000c1', 'imported', :'sid', 'C-1', 'Catalogo uno', '100g', 100);
insert into public.foods (id, user_id, origin, name, reference_basis, energy_kcal)
values ('00000000-0000-0000-0000-0000000000a1', :'uid_a', 'own', 'Propio de A', '100g', 50),
       ('00000000-0000-0000-0000-0000000000b1', :'uid_b', 'own', 'Propio de B', '100g', 60);
insert into public.food_portions (food_id, name, quantity) values
  ('00000000-0000-0000-0000-0000000000c1', 'porcion catalogo', 100),
  ('00000000-0000-0000-0000-0000000000a1', 'porcion de A', 100),
  ('00000000-0000-0000-0000-0000000000b1', 'porcion de B', 100);

-- Cuenta A -----------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');

select is((select count(*) from public.foods where name = 'Propio de A'), 1::bigint, 'FR-016: A ve su alimento propio');
select is((select count(*) from public.foods where name = 'Propio de B'), 0::bigint, 'FR-016: A no ve el alimento propio de B');
select is((select count(*) from public.foods where name = 'Catalogo uno'), 1::bigint, 'FR-001: A ve el catálogo común');
select is((select count(*) from public.food_portions where name = 'porcion de B'), 0::bigint, 'las porciones de B no son visibles para A');
select is((select count(*) from public.food_portions where name in ('porcion de A', 'porcion catalogo')), 2::bigint, 'A ve las porciones propias y las del catálogo');
select is((select count(*) from public.food_sources where slug = 'rls-prueba'), 1::bigint, 'FR-012: A puede leer las fuentes');

-- A puede crear y editar lo suyo
select lives_ok(
  format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, 'Nuevo de A', '100g', 10) $$, :'uid_a'),
  'A puede crear un alimento propio'
);
select lives_ok($$ update public.foods set energy_kcal = 55 where name = 'Propio de A' $$, 'A puede editar su alimento');
select is((select energy_kcal from public.foods where name = 'Propio de A'), 55.00, 'el cambio de A quedó guardado');

-- A no puede escribir donde no debe
select lives_ok($$ update public.foods set energy_kcal = 1 where name = 'Propio de B' $$, 'el intento de editar lo de B no falla...');
select lives_ok($$ delete from public.foods where name = 'Propio de B' $$, '...ni el de borrarlo...');
select lives_ok($$ update public.foods set energy_kcal = 1 where name = 'Catalogo uno' $$, '...ni el de editar el catálogo...');
select lives_ok($$ delete from public.foods where name = 'Catalogo uno' $$, '...ni el de borrar el catálogo (no afectan ninguna fila)');
select throws_ilike(
  $$ insert into public.foods (origin, name, reference_basis, energy_kcal) values ('imported', 'Falso catalogo', '100g', 1) $$,
  '%row-level security%', 'FR-022: A no puede insertar filas del catálogo'
);
select throws_ilike(
  $$ insert into public.foods (origin, source_id, name, reference_basis, energy_kcal) values ('imported', null, 'Falso 2', '100g', 1) $$,
  'permission denied%', 'FR-022: tampoco eligiendo la fuente a mano'
);
select throws_ilike(
  format($$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal) values ('own', %L, 'A nombre de B', '100g', 1) $$, :'uid_b'),
  '%row-level security%', 'A no puede crear alimentos a nombre de B'
);
select throws_ilike(
  $$ insert into public.foods (origin, user_id, name, reference_basis, energy_kcal, search_text) values ('own', auth.uid(), 'X', '100g', 1, 'x') $$,
  '%search_text%', 'el cliente no puede enviar columnas calculadas (search_text)'
);
select throws_ilike(
  $$ update public.foods set origin = 'imported' where name = 'Propio de A' $$,
  'permission denied%', 'el cliente no puede cambiar el origen'
);
select throws_ilike(
  $$ insert into public.food_sources (slug, name, license_name, license_url, attribution, source_url) values ('x', 'x', 'x', 'x', 'x', 'x') $$,
  'permission denied%', 'FR-013: el cliente no puede crear fuentes'
);
select throws_ilike(
  $$ update public.food_sources set license_name = 'otra' $$,
  'permission denied%', 'el cliente no puede modificar las fuentes'
);
select lives_ok(
  $$ insert into public.food_portions (food_id, name, quantity) values ('00000000-0000-0000-0000-0000000000a1', 'otra de A', 50) $$,
  'A puede agregar una porción a su alimento'
);
select throws_ilike(
  $$ insert into public.food_portions (food_id, name, quantity) values ('00000000-0000-0000-0000-0000000000b1', 'intrusa', 50) $$,
  '%row-level security%', 'A no puede agregar porciones al alimento de B'
);
select throws_ilike(
  $$ insert into public.food_portions (food_id, name, quantity) values ('00000000-0000-0000-0000-0000000000c1', 'intrusa', 50) $$,
  '%row-level security%', 'FR-022: A no puede agregar porciones al catálogo'
);
select tests.clear_authentication();

-- verificación como administrador: nada del ajeno ni del catálogo cambió
select is((select energy_kcal from public.foods where name = 'Propio de B'), 60.00, 'el alimento de B no cambió');
select is((select energy_kcal from public.foods where name = 'Catalogo uno'), 100.00, 'FR-022: el catálogo no cambió');
select is((select count(*) from public.foods where name in ('Propio de B', 'Catalogo uno')), 2::bigint, 'no se borró ninguna fila ajena ni del catálogo');

-- sesión vencida -----------------------------------------------------------------------------------
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.foods), 0::bigint, 'FR-003: con la sesión vencida no ve nada, ni siquiera el catálogo');
select tests.clear_authentication();

-- rendimiento: la vigencia de la sesión se evalúa una sola vez por consulta, no por fila ---------------------
-- Una llamada suelta a una función en una política se evalúa por cada fila; envuelta en (select ...) el
-- planificador la evalúa una vez. Con un catálogo grande la diferencia es de segundos (T071).
select is(
  (
    select count(*)
    from pg_policies p,
         lateral (select coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') as expr) e
    where p.schemaname = 'public'
      and p.tablename in ('foods', 'food_portions', 'food_sources')
      and regexp_count(e.expr, 'private.is_session_fresh()') > regexp_count(e.expr, 'SELECT private.is_session_fresh()')
  ),
  0::bigint,
  'SC-002: las políticas evalúan la vigencia de la sesión una sola vez por consulta'
);

-- anónimo -------------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ilike($$ select * from public.foods $$, 'permission denied%', 'FR-012: una petición anónima no accede a los alimentos');
select tests.clear_authentication();

select * from finish();
rollback;

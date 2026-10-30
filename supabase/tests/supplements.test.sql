-- Spec 022: suplementación (FR-001 a FR-012, FR-016): lista propia, marcas por día y aislamiento.
begin;
select plan(32);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- crear -------------------------------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select (public.create_supplement('  Creatina  ', ' 5 g ', '70000000-0000-0000-0000-000000000001')) ->> 'id' as s1 \gset
select is((select name from public.supplements where id = :'s1'), 'Creatina', 'el nombre se guarda recortado');
select is((select dose from public.supplements where id = :'s1'), '5 g', 'la dosis es el texto que escribió la persona, recortado');
select is(
  (public.create_supplement('Otra cosa', null, '70000000-0000-0000-0000-000000000001')) ->> 'id', :'s1',
  'un reintento con el mismo identificador devuelve el mismo suplemento'
);
select is((select count(*) from public.supplements), 1::bigint, 'y no crea otro');
select (public.create_supplement('Magnesio', '   ', gen_random_uuid())) ->> 'id' as s0 \gset
select is((select dose from public.supplements where id = :'s0'), null, 'una dosis en blanco queda sin dosis');

select throws_ilike(
  $$ select public.create_supplement('creatina', null, gen_random_uuid()) $$,
  'invalid_supplement:name_taken:name%', 'el nombre no se repite entre los no archivados, sin distinguir mayúsculas'
);
select throws_ilike(
  $$ select public.create_supplement('   ', null, gen_random_uuid()) $$,
  'invalid_supplement:name_required:name%', 'el nombre es obligatorio'
);
select throws_ilike(
  format($$ select public.create_supplement(%L, null, gen_random_uuid()) $$, repeat('a', 61)),
  'invalid_supplement:name_too_long:name%', 'el nombre tiene hasta 60 caracteres'
);
select throws_ilike(
  format($$ select public.create_supplement('X', %L, gen_random_uuid()) $$, repeat('a', 61)),
  'invalid_supplement:dose_too_long:dose%', 'la dosis tiene hasta 60 caracteres'
);
select throws_ilike(
  $$ select public.create_supplement('Y', null, null) $$,
  'invalid_supplement:request_required:request_id%', 'sin identificador de solicitud se rechaza'
);

-- corregir y archivar ----------------------------------------------------------------------------------------------
select is((public.update_supplement(:'s1'::uuid, 'Creatina monohidrato', '3 g') ->> 'name'), 'Creatina monohidrato', 'corrige el nombre');
select is((select dose from public.supplements where id = :'s1'), '3 g', 'y la dosis');
select throws_ilike(
  format($$ select public.update_supplement(%L::uuid, 'magnesio', null) $$, :'s1'),
  'invalid_supplement:name_taken:name%', 'corregir tampoco admite un nombre repetido'
);
select is((public.set_supplement_archived(:'s1'::uuid, true) ->> 'archived'), 'true', 'archiva');
select lives_ok(
  $$ select public.create_supplement('Creatina monohidrato', null, gen_random_uuid()) $$,
  'el nombre de uno archivado se puede volver a usar'
);
select throws_ilike(
  format($$ select public.set_supplement_archived(%L::uuid, false) $$, :'s1'),
  'invalid_supplement:name_taken:name%', 'restaurar falla si ya hay uno sin archivar con ese nombre'
);

-- marcas -----------------------------------------------------------------------------------------------------------
select (public.create_supplement('Vitamina D', null, gen_random_uuid())) ->> 'id' as s2 \gset
select is(
  (public.set_supplement_taken(:'s2'::uuid, date '2026-10-26', true, 'UTC') ->> 'taken'), 'true',
  'marca un día'
);
select lives_ok(
  format($$ select public.set_supplement_taken(%L::uuid, date '2026-10-26', true, 'UTC') $$, :'s2'),
  'marcar dos veces el mismo día no falla'
);
select is((select count(*) from public.supplement_marks where supplement_id = :'s2'), 1::bigint, 'y no duplica la marca');
select is(
  (public.set_supplement_taken(:'s2'::uuid, date '2026-10-26', false, 'UTC') ->> 'taken'), 'false',
  'quita la marca'
);
select is((select count(*) from public.supplement_marks where supplement_id = :'s2'), 0::bigint, 'y el día vuelve a estar sin registro');
select throws_ilike(
  format($$ select public.set_supplement_taken(%L::uuid, current_date + 2, true, 'UTC') $$, :'s2'),
  'invalid_supplement:date_future:taken_on%', 'no se marca un día futuro'
);
select throws_ilike(
  format($$ select public.set_supplement_taken(%L::uuid, date '1999-12-31', true, 'UTC') $$, :'s2'),
  'invalid_supplement:date_invalid:taken_on%', 'ni uno anterior al 2000'
);

-- permisos y aislamiento --------------------------------------------------------------------------------------------
select throws_ilike(
  $$ insert into public.supplements (user_id, name, client_request_id) values (auth.uid(), 'Directo', gen_random_uuid()) $$,
  '%permission denied%', 'el cliente no inserta directamente'
);
select throws_ilike($$ update public.supplements set name = 'x' $$, '%permission denied%', 'ni actualiza directamente');
select throws_ilike($$ insert into public.supplement_marks (supplement_id, user_id, taken_on) values (gen_random_uuid(), auth.uid(), current_date) $$, '%permission denied%', 'ni marca directamente');
select tests.clear_authentication();

select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.supplements), 0::bigint, 'otra cuenta no ve los suplementos de A');
select throws_ilike(
  format($$ select public.update_supplement(%L::uuid, 'Robado', null) $$, :'s2'),
  'not_found%', 'ni los corrige'
);
select throws_ilike(
  format($$ select public.set_supplement_taken(%L::uuid, date '2026-10-26', true, 'UTC') $$, :'s2'),
  'not_found%', 'ni los marca'
);
select tests.clear_authentication();

-- borrar: se llevan sus marcas
select tests.authenticate_as(:'uid_a');
select public.set_supplement_taken(:'s2'::uuid, date '2026-10-25', true, 'UTC');
delete from public.supplements where id = :'s2';
select is((select count(*) from public.supplement_marks where supplement_id = :'s2'), 0::bigint, 'eliminar un suplemento elimina sus marcas');
select tests.clear_authentication();

-- sesión vencida
update public.profiles set last_active_at = now() - interval '40 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.supplements), 0::bigint, 'con la sesión vencida no lee nada');
select tests.clear_authentication();

-- límite de 30
update public.profiles set last_active_at = now() where user_id = :'uid_a';
select tests.authenticate_as(:'uid_b');
select count(*) from (select public.create_supplement('S' || n, null, gen_random_uuid()) from generate_series(1, 30) n) t;
select throws_ilike(
  $$ select public.create_supplement('Uno más', null, gen_random_uuid()) $$,
  'invalid_supplement:limit_reached:name%', 'hasta 30 suplementos sin archivar'
);
select tests.clear_authentication();

select * from finish();
rollback;

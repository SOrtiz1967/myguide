-- T003 (spec 004, FR-004, FR-006, FR-028): integridad del historial del objetivo de energía diaria.
begin;
select plan(17);

select tests.create_user('a@test.local') as uid \gset
select tests.create_user('b@test.local') as uid2 \gset

select has_table('public', 'energy_goals', 'existe la tabla del historial');

select col_type_is('public', 'energy_goals', 'id', 'uuid', 'id es uuid');
select col_type_is('public', 'energy_goals', 'effective_from', 'date', 'effective_from es una fecha');
select col_type_is('public', 'energy_goals', 'kcal', 'integer', 'kcal es entero');
select col_is_null('public', 'energy_goals', 'kcal', 'kcal admite nulo (nulo = se quitó el objetivo)');
select col_not_null('public', 'energy_goals', 'effective_from', 'effective_from es obligatorio');
select col_not_null('public', 'energy_goals', 'client_request_id', 'client_request_id es obligatorio');

-- rango (FR-004) -------------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '2026-10-19', 999, gen_random_uuid()) $$, :'uid'),
  '%energy_goals_kcal_check%', 'FR-004: 999 kcal se rechaza'
);
select throws_ilike(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '2026-10-19', 6001, gen_random_uuid()) $$, :'uid'),
  '%energy_goals_kcal_check%', 'FR-004: 6001 kcal se rechaza'
);
select lives_ok(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '2026-10-19', 1000, gen_random_uuid()), (%L, '2026-10-19', 6000, gen_random_uuid()), (%L, '2026-10-19', null, gen_random_uuid()) $$, :'uid', :'uid', :'uid'),
  'FR-004: 1000, 6000 y nulo (quitar) se aceptan'
);

-- fecha mínima ---------------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '1999-12-31', 2000, gen_random_uuid()) $$, :'uid'),
  '%energy_goals_effective_from_check%', 'effective_from anterior a 2000-01-01 se rechaza'
);

-- idempotencia (FR-006) ------------------------------------------------------------------------------------------
select tests.create_energy_goal(:'uid', '2026-10-10', 2000);
insert into public.energy_goals (user_id, effective_from, kcal, client_request_id)
values (:'uid', '2026-10-11', 1800, '11111111-1111-1111-1111-111111111111');
select throws_ilike(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '2026-10-12', 1700, '11111111-1111-1111-1111-111111111111') $$, :'uid'),
  '%energy_goals_request_key%', 'FR-006: el mismo identificador de solicitud no se repite para una cuenta'
);
select lives_ok(
  format($$ insert into public.energy_goals (user_id, effective_from, kcal, client_request_id) values (%L, '2026-10-12', 1700, '11111111-1111-1111-1111-111111111111') $$, :'uid2'),
  'pero otra cuenta puede usar el mismo identificador'
);

-- índice del historial -------------------------------------------------------------------------------------------
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'energy_goals'
      and indexdef ilike '%(user_id, created_at desc)%'
  ),
  'existe el índice (user_id, created_at desc)'
);

-- eliminar la cuenta borra el historial (FR-028) -------------------------------------------------------------------
select is(
  (select count(*) from public.energy_goals where user_id = :'uid2'), 1::bigint, 'la cuenta B tiene su fila'
);
delete from auth.users where id = :'uid';
select is((select count(*) from public.energy_goals where user_id = :'uid'), 0::bigint, 'FR-028: eliminar la cuenta borra su historial');
select is((select count(*) from public.energy_goals where user_id = :'uid2'), 1::bigint, '...y deja intacto el de otra cuenta');

select * from finish();
rollback;

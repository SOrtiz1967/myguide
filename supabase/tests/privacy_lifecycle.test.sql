-- Spec 011: exportación y eliminación de cuenta (FR-002, FR-003, FR-004, FR-009, FR-014).
begin;
select plan(13);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- guardianes ----------------------------------------------------------------------------------------------------------
select is(
  (
    select count(*)
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'
      and not exists (
        select 1
        from pg_constraint k
        where k.conrelid = format('public.%I', c.table_name)::regclass
          and k.confrelid = 'auth.users'::regclass
          and k.contype = 'f' and k.confdeltype = 'c'
      )
  ),
  0::bigint,
  'FR-009: toda tabla de public con user_id depende de la cuenta con borrado en cascada'
);

select tests.authenticate_as(:'uid_a');
select public.export_my_data() as export_a \gset
select is(
  (
    select count(*)
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'user_id' and t.table_type = 'BASE TABLE'
      and c.table_name <> 'ai_estimates'
      and not (:'export_a'::jsonb -> 'tables') ? c.table_name
  ),
  0::bigint,
  'FR-004: toda tabla con datos de la cuenta (salvo los resultados temporales de la IA) está en la exportación'
);
select is(
  (select count(*) from jsonb_object_keys(:'export_a'::jsonb -> 'tables') k where k not in (
    select table_name from information_schema.columns where table_schema = 'public' and column_name = 'user_id'
  )),
  0::bigint,
  'y la exportación no nombra tablas que no sean de la cuenta'
);
select ok(not (:'export_a'::jsonb -> 'tables') ? 'ai_estimates', 'los resultados temporales de la IA no se exportan');

-- contenido -------------------------------------------------------------------------------------------------------------
select is((:'export_a'::jsonb) ->> 'format_version', '1', 'lleva la versión del formato');
select ok((:'export_a'::jsonb) ->> 'exported_at' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$', 'y la fecha de exportación');
select is((:'export_a'::jsonb) -> 'account' ->> 'email', 'a@test.local', 'incluye el correo de la cuenta');

select tests.clear_authentication();
insert into public.supplements (user_id, name, client_request_id) values (:'uid_a', 'Creatina', gen_random_uuid());
insert into public.supplements (user_id, name, client_request_id) values (:'uid_b', 'Magnesio', gen_random_uuid());
insert into public.body_measurements (user_id, kind, value, measured_on, client_request_id)
  values (:'uid_a', 'weight', 80, current_date, gen_random_uuid());

select tests.authenticate_as(:'uid_a');
select public.export_my_data() as export_a2 \gset
select is(
  (:'export_a2'::jsonb) -> 'tables' -> 'supplements' -> 0 ->> 'name', 'Creatina',
  'FR-002: exporta lo registrado'
);
select is(jsonb_array_length((:'export_a2'::jsonb) -> 'tables' -> 'supplements'), 1, 'FR-003: solo lo propio, nada de otra cuenta');
select is(jsonb_array_length((:'export_a2'::jsonb) -> 'tables' -> 'body_measurements'), 1, 'y cada tipo de registro');
select is((:'export_a2'::jsonb) -> 'tables' -> 'profiles' -> 0 ->> 'user_id', :'uid_a', 'el perfil es el propio');

-- eliminar la cuenta borra todo ---------------------------------------------------------------------------------------
select tests.clear_authentication();
delete from auth.users where id = :'uid_a';
select is(
  (select count(*) from public.supplements where user_id = :'uid_a')
    + (select count(*) from public.body_measurements where user_id = :'uid_a')
    + (select count(*) from public.profiles where user_id = :'uid_a'),
  0::bigint,
  'FR-009: al eliminar la cuenta no queda ninguna fila suya'
);

-- sesión ------------------------------------------------------------------------------------------------------------------
select throws_ilike($$ select public.export_my_data() $$, 'session_expired%', 'sin sesión no se exporta nada');

select * from finish();
rollback;

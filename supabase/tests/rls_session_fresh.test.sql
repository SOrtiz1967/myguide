-- FR-003 / FR-010: con la sesión vencida (30 días sin actividad) el token ya no da acceso a datos.
begin;
select plan(5);

select tests.create_user('vencida@test.local') as uid \gset

update public.profiles set last_active_at = now() - interval '29 days' where user_id = :'uid';
select tests.authenticate_as(:'uid');
select is((select count(*) from public.profiles), 1::bigint, 'FR-003: con 29 días de inactividad ve su perfil');
select tests.clear_authentication();

update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid';
select tests.authenticate_as(:'uid');
select is((select count(*) from public.profiles), 0::bigint, 'FR-003: con 31 días de inactividad no ve nada');
select lives_ok(
  $$ update public.profiles set height_cm = 170 where user_id = auth.uid() $$,
  'FR-003: con la sesión vencida el intento de modificar no falla pero no afecta ninguna fila'
);
select tests.clear_authentication();

select is(
  (select height_cm from public.profiles where user_id = :'uid'),
  null,
  'FR-003: con la sesión vencida el perfil no se modificó'
);

-- start_session reactiva la sesión con un inicio de sesión reciente
select extract(epoch from now())::bigint as ahora \gset
select tests.authenticate_as(:'uid', :'ahora'::bigint - 30);
select public.start_session();
select is((select count(*) from public.profiles), 1::bigint, 'FR-003: tras un inicio de sesión reciente vuelve a ver su perfil');
select tests.clear_authentication();

select * from finish();
rollback;

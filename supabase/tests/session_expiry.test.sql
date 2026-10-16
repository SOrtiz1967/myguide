-- FR-003: la sesion vence tras 30 dias sin actividad y solo un inicio de sesion reciente la reinicia.
begin;
select plan(8);

select tests.create_user('sesion@test.local') as uid \gset
select extract(epoch from now())::bigint as ahora \gset

-- 1 y 2: private.is_session_fresh()
update public.profiles set last_active_at = now() - interval '29 days' where user_id = :'uid';
select tests.authenticate_as(:'uid');
select is(private.is_session_fresh(), true, 'FR-003: con 29 dias de inactividad la sesion sigue vigente');
select tests.clear_authentication();

update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid';
select tests.authenticate_as(:'uid');
select is(private.is_session_fresh(), false, 'FR-003: con 31 dias de inactividad la sesion ya no es vigente');
select tests.clear_authentication();

-- 3: touch_session renueva una sesion vigente
update public.profiles set last_active_at = now() - interval '29 days' where user_id = :'uid';
select tests.authenticate_as(:'uid');
select lives_ok($$ select public.touch_session() $$, 'FR-003: touch_session acepta una sesion vigente');
select tests.clear_authentication();

-- 4: touch_session rechaza una sesion vencida
update public.profiles set last_active_at = now() - interval '31 days' where user_id = :'uid';
select tests.authenticate_as(:'uid');
select throws_ilike(
  $$ select public.touch_session() $$,
  'session_expired%',
  'FR-003: touch_session rechaza una sesion vencida'
);
select tests.clear_authentication();

-- 5: start_session con inicio de sesion reciente reinicia el contador aunque este vencida
select tests.authenticate_as(:'uid', :'ahora'::bigint - 60);
select lives_ok($$ select public.start_session() $$, 'FR-003: start_session acepta un inicio de sesion reciente');
select tests.clear_authentication();
select cmp_ok(
  (select last_active_at from public.profiles where user_id = :'uid'),
  '>',
  now() - interval '1 minute',
  'FR-003: start_session reinicia last_active_at'
);

-- 6: start_session con un inicio de sesion viejo (token renovado) no revive una sesion vencida
update public.profiles set last_active_at = now() - interval '40 days' where user_id = :'uid';
select tests.authenticate_as(:'uid', :'ahora'::bigint - 3600);
select throws_ilike(
  $$ select public.start_session() $$,
  'login_required%',
  'FR-003: un token renovado de una sesion vieja no puede reiniciar el contador'
);
select tests.clear_authentication();

-- 7: sin claim amr tampoco
select tests.authenticate_as(:'uid');
select throws_ilike(
  $$ select public.start_session() $$,
  'login_required%',
  'FR-003: sin claim amr no se puede reiniciar la sesion'
);
select tests.clear_authentication();

select * from finish();
rollback;

-- Historia 2 (FR-009 a FR-011): cada cuenta solo accede a su propio perfil.
begin;
select plan(13);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- A como propietaria ---------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');

select is((select count(*) from public.profiles), 1::bigint, 'FR-010: A solo ve una fila (la suya)');
select is(
  (select count(*) from public.profiles where user_id = :'uid_b'),
  0::bigint,
  'FR-011: el perfil de B se comporta como inexistente para A'
);

select lives_ok(
  $$ update public.profiles set height_cm = 171.5 where user_id = auth.uid() $$,
  'FR-013: A puede editar su altura'
);
select is(
  (select height_cm from public.profiles),
  171.5,
  'FR-013: el cambio quedó guardado'
);

select lives_ok(
  format($$ update public.profiles set height_cm = 99 where user_id = %L $$, :'uid_b'),
  'FR-010: el intento de A de modificar el perfil de B no falla pero no afecta ninguna fila'
);

select throws_ilike(
  format($$ insert into public.profiles (user_id, privacy_notice_version, privacy_notice_accepted_at) values (%L, 'x', now()) $$, gen_random_uuid()),
  'permission denied%',
  'FR-009: el cliente no puede insertar perfiles'
);
select throws_ilike(
  $$ delete from public.profiles where user_id = auth.uid() $$,
  'permission denied%',
  'FR-009: el cliente no puede eliminar perfiles (la eliminación llega con la spec 011)'
);

-- columnas protegidas ------------------------------------------------------------------------------
select throws_ilike(
  $$ update public.profiles set email_verified_at = now() where user_id = auth.uid() $$,
  'permission denied%',
  'FR-026: el cliente no puede marcar su correo como confirmado'
);
select throws_ilike(
  $$ update public.profiles set privacy_notice_version = 'otra' where user_id = auth.uid() $$,
  'permission denied%',
  'FR-029: el cliente no puede cambiar la versión del aviso aceptada'
);
select throws_ilike(
  $$ update public.profiles set last_active_at = now() where user_id = auth.uid() $$,
  'permission denied%',
  'FR-003: el cliente no puede tocar last_active_at directamente (solo con las funciones de sesión)'
);
select throws_ilike(
  $$ update public.profiles set user_id = gen_random_uuid() where user_id = auth.uid() $$,
  'permission denied%',
  'FR-010: el cliente no puede cambiar el propietario del perfil'
);
select tests.clear_authentication();

-- verificación como administrador: el perfil de B no cambió
select is(
  (select height_cm from public.profiles where user_id = :'uid_b'),
  null,
  'FR-010: el perfil de B sigue intacto después del intento de A'
);

-- anónimo ------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ilike(
  $$ select * from public.profiles $$,
  'permission denied%',
  'FR-012: una petición anónima no accede a los perfiles'
);
select tests.clear_authentication();

select * from finish();
rollback;

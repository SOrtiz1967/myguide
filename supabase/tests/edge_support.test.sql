-- Soporte de las Edge Functions (T089): límite por IP, tokens de confirmación y búsqueda de cuenta.
-- Todas las funciones son exclusivas del rol de servicio: ni anon ni authenticated pueden llamarlas.
begin;
select plan(15);

select tests.create_user('soporte@test.local') as uid \gset

-- check_rate_limit ---------------------------------------------------------------------------
select is(public.check_rate_limit('k1', 2, interval '1 hour'), true, 'FR-008: primer intento permitido');
select is(public.check_rate_limit('k1', 2, interval '1 hour'), true, 'FR-008: segundo intento permitido');
select is(public.check_rate_limit('k1', 2, interval '1 hour'), false, 'FR-008: el tercero supera el límite');
select is(public.check_rate_limit('k2', 2, interval '1 hour'), true, 'FR-008: otra clave tiene su propio contador');

-- tokens de confirmación -----------------------------------------------------------------------
select lives_ok(
  format($$ select public.issue_email_token(%L, 'hash-uno', now() + interval '24 hours') $$, :'uid'),
  'FR-026: se emite un token'
);
select is(
  public.consume_email_token('hash-uno'),
  :'uid'::uuid,
  'FR-026: un token vigente devuelve el id de la cuenta'
);
select is(public.consume_email_token('hash-uno'), null, 'FR-026: un token solo se puede usar una vez');
select is(public.consume_email_token('no-existe'), null, 'FR-026: un token inexistente no devuelve nada');

select public.issue_email_token(:'uid', 'hash-vencido', now() - interval '1 minute');
select is(public.consume_email_token('hash-vencido'), null, 'FR-026: un token vencido no devuelve nada');

select public.issue_email_token(:'uid', 'hash-viejo', now() + interval '24 hours');
select public.issue_email_token(:'uid', 'hash-nuevo', now() + interval '24 hours');
select is(
  public.consume_email_token('hash-viejo'),
  null,
  'FR-026: emitir un token nuevo invalida los pendientes anteriores'
);

select is(
  (select created_last_day from public.email_token_stats(:'uid')),
  4,
  'FR-026: cuenta los tokens emitidos en las últimas 24 horas'
);

-- confirmar y buscar ---------------------------------------------------------------------------
select is(
  (select email_verified from public.find_user_by_email('soporte@test.local')),
  false,
  'FR-027: una cuenta recién creada figura sin confirmar'
);
select public.mark_email_verified(:'uid');
select is(
  (select email_verified from public.find_user_by_email('soporte@test.local')),
  true,
  'FR-026: tras confirmar figura confirmada'
);
select is(
  (select count(*) from public.find_user_by_email('nadie@test.local')),
  0::bigint,
  'FR-005: una cuenta inexistente no devuelve filas'
);

-- permisos ---------------------------------------------------------------------------------------
select tests.authenticate_as(:'uid');
select throws_ilike(
  $$ select public.check_rate_limit('k3', 5, interval '1 hour') $$,
  'permission denied%',
  'FR-010: un usuario autenticado no puede usar las funciones de servicio'
);
select tests.clear_authentication();

select * from finish();
rollback;

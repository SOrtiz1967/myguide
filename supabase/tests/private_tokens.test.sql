-- FR-010: el esquema `private` no es accesible para el cliente (ni anónimo ni autenticado).
begin;
select plan(8);

select tests.create_user('privado@test.local') as uid \gset

select tests.authenticate_as(:'uid');
select throws_ilike($$ select * from private.email_verification_tokens $$, 'permission denied%', 'authenticated no lee los tokens de confirmación');
select throws_ilike(
  $$ insert into private.email_verification_tokens (user_id, token_hash, expires_at) values (auth.uid(), 'h', now()) $$,
  'permission denied%',
  'authenticated no inserta tokens de confirmación'
);
select throws_ilike($$ select * from private.privacy_notice_versions $$, 'permission denied%', 'authenticated no lee las versiones del aviso');
select throws_ilike($$ select * from private.rate_limit_hits $$, 'permission denied%', 'authenticated no lee el registro del límite por IP');
select tests.clear_authentication();

select tests.authenticate_as_anon();
select throws_ilike($$ select * from private.email_verification_tokens $$, 'permission denied%', 'anon no lee los tokens de confirmación');
select throws_ilike($$ select * from private.privacy_notice_versions $$, 'permission denied%', 'anon no lee las versiones del aviso');
select throws_ilike($$ select * from private.rate_limit_hits $$, 'permission denied%', 'anon no lee el registro del límite por IP');
select throws_ilike($$ select private.is_session_fresh() $$, 'permission denied%', 'anon no ejecuta funciones de private');
select tests.clear_authentication();

select * from finish();
rollback;

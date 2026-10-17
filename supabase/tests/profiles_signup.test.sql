-- Verifica FR-007 y FR-029: el alta crea un unico perfil y exige un aviso de privacidad vigente.
begin;
select plan(6);

select throws_ilike(
  $$ select tests.create_user('sin-aviso@test.local', null) $$,
  'privacy_notice_required%',
  'FR-029: el alta sin version del aviso de privacidad falla'
);

select throws_ilike(
  $$ select tests.create_user('aviso-viejo@test.local', '1999-01-01') $$,
  'privacy_notice_required%',
  'FR-029: el alta con una version no vigente falla'
);

select tests.create_user('ok@test.local') as uid \gset

select is(
  (select count(*) from public.profiles where user_id = :'uid'),
  1::bigint,
  'FR-007: el alta valida crea exactamente un perfil'
);

select is(
  (select privacy_notice_version from public.profiles where user_id = :'uid'),
  '2026-10-16',
  'FR-029: el perfil guarda la version del aviso aceptada'
);

select isnt(
  (select privacy_notice_accepted_at from public.profiles where user_id = :'uid'),
  null,
  'FR-029: el perfil guarda cuando se acepto el aviso'
);

select is(
  (select unit_system from public.profiles where user_id = :'uid'),
  'metric',
  'FR-015: el sistema de unidades es metrico por defecto'
);

select * from finish();
rollback;

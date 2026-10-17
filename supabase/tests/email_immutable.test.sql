-- FR-028: nadie puede dejar un cambio de correo pendiente (GoTrue lo hace con updateUser({ email })).
-- El disparador no depende del rol (solo mira el campo email_change), por eso basta con el rol de pruebas.
begin;
select plan(3);

select tests.create_user('inmutable@test.local') as uid \gset

select throws_ilike(
  format($$ update auth.users set email_change = 'otro@test.local' where id = %L $$, :'uid'),
  'email_change_not_allowed%',
  'FR-028: no se puede dejar un cambio de correo pendiente'
);

select lives_ok(
  format($$ update auth.users set email_change = '' where id = %L $$, :'uid'),
  'FR-028: limpiar el campo de cambio pendiente sigue permitido'
);

select lives_ok(
  format($$ update auth.users set email = 'admin-cambio@test.local' where id = %L $$, :'uid'),
  'FR-028: el administrador si puede cambiar el correo directamente'
);

select * from finish();
rollback;

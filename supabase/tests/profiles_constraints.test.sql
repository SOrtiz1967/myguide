-- Historia 3 (FR-014, FR-015, FR-017): el perfil rechaza valores fuera de rango.
-- Se prueba con el rol de pruebas (sin RLS): son restricciones de integridad, no de acceso.
begin;
select plan(18);

select tests.create_user('perfil@test.local') as uid \gset

-- fecha de nacimiento ---------------------------------------------------------------------------
select throws_ilike(
  format($$ update public.profiles set birth_date = current_date + 1 where user_id = %L $$, :'uid'),
  'invalid_birth_date%',
  'FR-014: una fecha de nacimiento futura se rechaza'
);
select throws_ilike(
  format($$ update public.profiles set birth_date = current_date - interval '121 years' where user_id = %L $$, :'uid'),
  'invalid_birth_date%',
  'FR-014: una fecha de hace más de 120 años se rechaza'
);
select lives_ok(
  format($$ update public.profiles set birth_date = '1990-05-17' where user_id = %L $$, :'uid'),
  'FR-013: una fecha de nacimiento razonable se acepta'
);

-- altura ------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ update public.profiles set height_cm = 49.9 where user_id = %L $$, :'uid'),
  '%violates check constraint%',
  'FR-014: una altura menor a 50 cm se rechaza'
);
select throws_ilike(
  format($$ update public.profiles set height_cm = 250.1 where user_id = %L $$, :'uid'),
  '%violates check constraint%',
  'FR-014: una altura mayor a 250 cm se rechaza'
);
select lives_ok(
  format($$ update public.profiles set height_cm = 50 where user_id = %L $$, :'uid'),
  'FR-014: 50 cm es el mínimo válido'
);
select lives_ok(
  format($$ update public.profiles set height_cm = 250 where user_id = %L $$, :'uid'),
  'FR-014: 250 cm es el máximo válido'
);

-- sexo ----------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ update public.profiles set sex = 'otro' where user_id = %L $$, :'uid'),
  '%violates check constraint%',
  'FR-013: solo se admite female, male o no informado'
);
select lives_ok(
  format($$ update public.profiles set sex = 'female' where user_id = %L $$, :'uid'),
  'FR-013: female se acepta'
);
select lives_ok(
  format($$ update public.profiles set sex = null where user_id = %L $$, :'uid'),
  'FR-017: no informado (nulo) se acepta y no se reemplaza por un valor supuesto'
);

-- zona horaria --------------------------------------------------------------------------------------
select throws_ilike(
  format($$ update public.profiles set timezone = 'Marte/Fobos' where user_id = %L $$, :'uid'),
  'invalid_timezone%',
  'FR-014: una zona horaria inexistente se rechaza'
);
select lives_ok(
  format($$ update public.profiles set timezone = 'America/Argentina/Buenos_Aires' where user_id = %L $$, :'uid'),
  'FR-016: una zona horaria IANA válida se acepta'
);

-- unidades ----------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ update public.profiles set unit_system = 'imperial' where user_id = %L $$, :'uid'),
  '%violates check constraint%',
  'FR-015: solo se admite el sistema métrico en el MVP'
);
select is(
  (select unit_system from public.profiles where user_id = :'uid'),
  'metric',
  'FR-015: el sistema de unidades sigue siendo métrico'
);

-- valores no informados ----------------------------------------------------------------------------
select lives_ok(
  format($$ update public.profiles set birth_date = null, height_cm = null, timezone = null where user_id = %L $$, :'uid'),
  'FR-017: los datos no informados se permiten (nulo)'
);
select is(
  (select height_cm from public.profiles where user_id = :'uid'),
  null,
  'FR-017: una altura no informada queda nula, sin cero ni valor supuesto'
);
select is(
  (select birth_date from public.profiles where user_id = :'uid'),
  null,
  'FR-017: una fecha no informada queda nula'
);
select is(
  (select timezone from public.profiles where user_id = :'uid'),
  null,
  'FR-016: la zona horaria queda nula hasta que la persona la confirma'
);

select * from finish();
rollback;

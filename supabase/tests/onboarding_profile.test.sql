-- Spec 014: datos del primer ingreso — valores permitidos, exigencia de datos completos, mayoría de edad y aislamiento.
begin;
select plan(16);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select tests.authenticate_as(:'uid_a');

select is(
  (select onboarding_completed_at from public.profiles), null, 'una cuenta nueva no tiene el recorrido completado'
);

select lives_ok(
  $$ update public.profiles set goal_type = 'muscle_gain', experience = 'intermediate', job_activity = 'mixed', training_days = 3 where user_id = auth.uid() $$,
  'la cuenta guarda objetivo, experiencia, trabajo y días'
);
select throws_ilike(
  $$ update public.profiles set goal_type = 'bulk' where user_id = auth.uid() $$,
  '%profiles_goal_type_check%', 'un objetivo desconocido se rechaza'
);
select throws_ilike(
  $$ update public.profiles set experience = 'pro' where user_id = auth.uid() $$,
  '%profiles_experience_check%', 'una experiencia desconocida se rechaza'
);
select throws_ilike(
  $$ update public.profiles set job_activity = 'sentado' where user_id = auth.uid() $$,
  '%profiles_job_activity_check%', 'un tipo de trabajo desconocido se rechaza'
);
select throws_ilike(
  $$ update public.profiles set training_days = 8 where user_id = auth.uid() $$,
  '%profiles_training_days_check%', 'más de 7 días de entrenamiento se rechaza'
);

-- completar el recorrido exige todos los datos
select throws_ilike(
  $$ update public.profiles set onboarding_completed_at = now() where user_id = auth.uid() $$,
  '%invalid_onboarding:incomplete%', 'completar sin sexo, nacimiento, altura y zona se rechaza'
);
select lives_ok(
  $$ update public.profiles set sex = 'male', birth_date = date '2020-01-01', height_cm = 175, timezone = 'UTC' where user_id = auth.uid() $$,
  'se completan los datos básicos'
);
select throws_ilike(
  $$ update public.profiles set onboarding_completed_at = now() where user_id = auth.uid() $$,
  '%invalid_onboarding:underage%', 'una persona menor de 18 años no completa el recorrido'
);
select lives_ok(
  $$ update public.profiles set birth_date = current_date - interval '30 years' where user_id = auth.uid() $$,
  'se corrige la fecha de nacimiento'
);
select lives_ok(
  $$ update public.profiles set onboarding_completed_at = now() where user_id = auth.uid() $$,
  'con todos los datos y mayor de edad se completa'
);
select isnt(
  (select onboarding_completed_at from public.profiles), null, 'queda la marca de recorrido completado'
);

-- recordatorio de peso: apagado por defecto y editable
select is((select weight_reminder from public.profiles), false, 'el recordatorio de peso empieza apagado');
select lives_ok(
  $$ update public.profiles set weight_reminder = true where user_id = auth.uid() $$,
  'la cuenta puede encender el recordatorio de peso'
);

-- aislamiento: B no ve ni cambia el perfil de A
select tests.authenticate_as(:'uid_b');
select is((select count(*) from public.profiles where goal_type = 'muscle_gain'), 0::bigint, 'B no ve los datos de A');
update public.profiles set goal_type = 'fat_loss' where user_id = :'uid_a';
select tests.clear_authentication();
select is(
  (select goal_type from public.profiles where user_id = :'uid_a'), 'muscle_gain', 'B no puede cambiar el objetivo de A'
);

select * from finish();
rollback;

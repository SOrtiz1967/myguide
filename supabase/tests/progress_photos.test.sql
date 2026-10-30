-- Spec 019: fotos de progreso (FR-005, FR-006, FR-008, FR-018): tabla privada, función de corrección y bucket privado.
begin;
select plan(27);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

-- Las filas las inserta la función de servidor (clave de servicio); aquí se simulan como superusuario.
insert into public.progress_photos (user_id, taken_on, pose, storage_path, width, height, bytes) values
  (:'uid_a', date '2026-10-01', 'front', :'uid_a' || '/uno.jpg', 900, 1200, 200000),
  (:'uid_a', date '2026-10-20', null, :'uid_a' || '/dos.jpg', 900, 1200, 210000),
  (:'uid_b', date '2026-10-05', 'side', :'uid_b' || '/tres.jpg', 900, 1200, 190000);
select id as photo_a from public.progress_photos where storage_path = :'uid_a' || '/uno.jpg' \gset
select id as photo_b from public.progress_photos where storage_path = :'uid_b' || '/tres.jpg' \gset

-- restricciones -----------------------------------------------------------------------------------------------------
select throws_ilike(
  format($$ insert into public.progress_photos (user_id, taken_on, pose, storage_path, width, height, bytes)
            values (%L, date '2026-10-01', 'cara', 'x.jpg', 1, 1, 1) $$, :'uid_a'),
  '%progress_photos_pose_check%', 'la pose solo admite frente, perfil, espalda u otra'
);
select throws_ilike(
  format($$ insert into public.progress_photos (user_id, taken_on, storage_path, width, height, bytes)
            values (%L, date '2026-10-01', 'x.jpg', 1, 1, 3145729) $$, :'uid_a'),
  '%progress_photos_bytes_check%', 'ninguna foto pesa más de 3 MiB'
);
select throws_ilike(
  format($$ insert into public.progress_photos (user_id, taken_on, storage_path, width, height, bytes)
            values (%L, date '1999-12-31', 'x.jpg', 1, 1, 1) $$, :'uid_a'),
  '%progress_photos_date_check%', 'la fecha no es anterior al 2000'
);

-- lectura y aislamiento (FR-018) ----------------------------------------------------------------------------------
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.progress_photos), 2::bigint, 'A lee solo sus dos fotos');
select is((select count(*) from public.progress_photos where id = :'photo_b'), 0::bigint, 'A no ve la foto de B');
select throws_ilike(
  format($$ insert into public.progress_photos (user_id, taken_on, storage_path, width, height, bytes)
            values (%L, date '2026-10-01', 'x.jpg', 1, 1, 1) $$, :'uid_a'),
  '%permission denied%', 'el navegador no inserta filas'
);
select throws_ilike($$ delete from public.progress_photos $$, '%permission denied%', 'el navegador no borra filas');
select throws_ilike(
  $$ update public.progress_photos set taken_on = date '2026-01-01' $$,
  '%permission denied%', 'el navegador no actualiza filas directamente'
);

-- corregir fecha y pose (FR-008) -----------------------------------------------------------------------------------
select is(
  (select taken_on::text from public.update_progress_photo(:'photo_a', date '2026-10-02', 'side')), '2026-10-02',
  'corrige la fecha'
);
select is((select pose from public.progress_photos where id = :'photo_a'), 'side', 'y la pose');
select is(
  (select pose from public.update_progress_photo(:'photo_a', date '2026-10-02', null)), null,
  'una pose nula la deja sin indicar'
);
select is(
  (select storage_path from public.progress_photos where id = :'photo_a'), :'uid_a' || '/uno.jpg',
  'el archivo no cambia'
);
select throws_ilike(
  format('select public.update_progress_photo(%L::uuid, current_date + 2, null)', :'photo_a'),
  'invalid_date%', 'una fecha posterior a mañana se rechaza'
);
select lives_ok(
  format('select public.update_progress_photo(%L::uuid, current_date + 1, null)', :'photo_a'),
  'mañana se acepta (margen por la zona horaria)'
);
select throws_ilike(
  format($$ select public.update_progress_photo(%L::uuid, date '1999-01-01', null) $$, :'photo_a'),
  'invalid_date%', 'una fecha anterior al 2000 se rechaza'
);
select throws_ilike(
  format($$ select public.update_progress_photo(%L::uuid, date '2026-10-02', 'cara') $$, :'photo_a'),
  'invalid_pose%', 'una pose inválida se rechaza'
);
select throws_ilike(
  format($$ select public.update_progress_photo(%L::uuid, date '2026-10-02', null) $$, :'photo_b'),
  'photo_not_found%', 'no se puede corregir la foto de otra cuenta'
);
select tests.clear_authentication();
select is(
  (select taken_on::text from public.progress_photos where id = :'photo_b'), '2026-10-05',
  'la foto de B quedó como estaba'
);

-- anónimo y sesión vencida ------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ilike(
  format($$ select public.update_progress_photo(%L::uuid, date '2026-10-02', null) $$, :'photo_a'),
  '%permission denied%', 'una petición anónima no ejecuta la función'
);
select tests.clear_authentication();

update public.profiles set last_active_at = now() - interval '40 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from public.progress_photos), 0::bigint, 'con la sesión vencida no lee nada');
select throws_ilike(
  format($$ select public.update_progress_photo(%L::uuid, date '2026-10-02', null) $$, :'photo_a'),
  'session_expired%', 'ni corrige nada'
);
select tests.clear_authentication();

-- bucket privado (FR-005, FR-006) -----------------------------------------------------------------------------------
select is((select public from storage.buckets where id = 'progress-photos'), false, 'el bucket no es público');
select is((select file_size_limit from storage.buckets where id = 'progress-photos'), 3145728::bigint, 'pesa como mucho 3 MiB');
select is((select allowed_mime_types from storage.buckets where id = 'progress-photos'), array['image/jpeg'], 'solo admite JPEG');

insert into storage.objects (bucket_id, name) values
  ('progress-photos', :'uid_a' || '/uno.jpg'),
  ('progress-photos', :'uid_b' || '/dos.jpg');
update public.profiles set last_active_at = now() where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is(
  (select count(*) from storage.objects where bucket_id = 'progress-photos' and name like :'uid_a' || '/%'), 1::bigint,
  'A lee lo de su carpeta'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'progress-photos' and name like :'uid_b' || '/%'), 0::bigint,
  'y nada de la carpeta de B'
);
select throws_ilike(
  format($$ insert into storage.objects (bucket_id, name) values ('progress-photos', %L) $$, :'uid_a' || '/nuevo.jpg'),
  '%row-level security%', 'el navegador no sube archivos'
);
select tests.clear_authentication();

select * from finish();
rollback;

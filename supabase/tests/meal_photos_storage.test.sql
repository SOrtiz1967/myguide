-- T058 (spec 003, FR-032, FR-033): el bucket de fotos es privado y cada persona solo lee lo suyo.
begin;
select plan(13);

select tests.create_user('a@test.local') as uid_a \gset
select tests.create_user('b@test.local') as uid_b \gset

select is((select public from storage.buckets where id = 'meal-photos'), false, 'FR-032: el bucket no es público');
select is((select file_size_limit from storage.buckets where id = 'meal-photos'), 3145728::bigint, 'pesa como mucho 3 MiB');
select is((select allowed_mime_types from storage.buckets where id = 'meal-photos'), array['image/jpeg'], 'solo admite JPEG');

insert into storage.buckets (id, name, public) values ('otro-prueba', 'otro-prueba', false);
insert into storage.objects (bucket_id, name) values
  ('meal-photos', :'uid_a' || '/uno.jpg'),
  ('meal-photos', :'uid_b' || '/dos.jpg'),
  ('otro-prueba', :'uid_a' || '/tres.jpg');

-- la persona dueña
select tests.authenticate_as(:'uid_a');
select is((select count(*) from storage.objects where bucket_id = 'meal-photos'), 1::bigint, 'la dueña lee lo de su carpeta y nada más');
select is((select name from storage.objects where bucket_id = 'meal-photos'), :'uid_a' || '/uno.jpg', 'y es su archivo');
select is((select count(*) from storage.objects where bucket_id = 'otro-prueba'), 0::bigint, 'la política no abre otros buckets');
select throws_ilike(
  format($$ insert into storage.objects (bucket_id, name) values ('meal-photos', %L) $$, :'uid_a' || '/nuevo.jpg'),
  '%row-level security%', 'FR-033: el cliente no puede subir objetos'
);
select lives_ok($$ update storage.objects set name = 'x/otro.jpg' where bucket_id = 'meal-photos' $$, 'renombrar no falla pero no toca nada (sin política)');
select throws_ilike($$ delete from storage.objects where bucket_id = 'meal-photos' $$, '%not allowed%', 'borrar directo tampoco se puede (solo por la API de Storage con la clave de servicio)');
select tests.clear_authentication();
-- La base local puede tener fotos de otras corridas (los archivos no se borran por SQL): se cuentan solo las de esta prueba.
select is((select count(*) from storage.objects where bucket_id = 'meal-photos' and (name like :'uid_a' || '/%' or name like :'uid_b' || '/%')), 2::bigint, 'los objetos siguen ahí');

-- otra cuenta y anónimo
select tests.authenticate_as(:'uid_b');
select is((select name from storage.objects where bucket_id = 'meal-photos'), :'uid_b' || '/dos.jpg', 'otra cuenta lee solo lo suyo');
select tests.clear_authentication();
select tests.authenticate_as_anon();
select is((select count(*) from storage.objects where bucket_id = 'meal-photos'), 0::bigint, 'una petición anónima no lee nada');
select tests.clear_authentication();

-- sesión vencida
update public.profiles set last_active_at = now() - interval '40 days' where user_id = :'uid_a';
select tests.authenticate_as(:'uid_a');
select is((select count(*) from storage.objects where bucket_id = 'meal-photos'), 0::bigint, 'con la sesión vencida no lee nada');
select tests.clear_authentication();

select * from finish();
rollback;

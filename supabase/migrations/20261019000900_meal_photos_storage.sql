-- T064 (spec 003, FR-032, FR-033): las fotos de las comidas viven en un bucket PRIVADO.
--
-- Solo la Edge Function `meal-photo` (con la clave de servicio) escribe y borra objetos. La persona solo
-- puede pedir una URL firmada de lo que está en su carpeta, y únicamente con la sesión vigente. En local
-- el bucket también sale de `config.toml`; esta migración lo deja listo en producción.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

-- Lectura de lo propio: la carpeta de primer nivel es el id de la persona.
create policy meal_photos_storage_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_session_fresh())
  );
-- Sin políticas de insert, update ni delete: ningún rol del cliente puede escribir en el bucket.

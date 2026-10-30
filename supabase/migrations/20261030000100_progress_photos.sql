-- Spec 019: fotos de progreso.
--
-- El archivo vive en el bucket PRIVADO `progress-photos`, en la carpeta de su dueño (`<user_id>/<uuid>.jpg`); esta
-- tabla lo registra con la fecha de la toma y una pose opcional. Solo la Edge Function `progress-photo` (con la clave
-- de servicio) inserta y borra filas y objetos; la persona lee lo propio y corrige fecha y pose con una función que no
-- toca el archivo. Las fotos de progreso nunca salen a servicios externos (Constitution, Principio I).

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_on date not null,
  pose text,
  storage_path text not null,
  width integer not null,
  height integer not null,
  bytes integer not null,
  created_at timestamptz not null default now(),

  constraint progress_photos_pose_check check (pose is null or pose in ('front', 'side', 'back', 'other')),
  constraint progress_photos_path_check check (char_length(storage_path) between 1 and 300),
  constraint progress_photos_size_check check (width > 0 and height > 0),
  constraint progress_photos_bytes_check check (bytes > 0 and bytes <= 3145728),
  constraint progress_photos_date_check check (taken_on >= date '2000-01-01')
);

create index progress_photos_user_date_idx on public.progress_photos (user_id, taken_on desc, created_at desc);

alter table public.progress_photos enable row level security;

revoke all on public.progress_photos from anon, authenticated;
grant all on public.progress_photos to service_role;
grant select on public.progress_photos to authenticated;

create policy progress_photos_select_own on public.progress_photos
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_session_fresh()));

-- Corrige la fecha y la pose de una foto propia. No toca el archivo. Errores: photo_not_found, invalid_date, invalid_pose.
create function public.update_progress_photo(p_id uuid, p_taken_on date, p_pose text default null)
returns public.progress_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.progress_photos;
begin
  if v_user is null or not private.is_session_fresh() then
    raise exception 'session_expired: la sesion vencio' using errcode = '42501';
  end if;
  -- Mañana de margen por la zona horaria de la persona.
  if p_taken_on is null or p_taken_on < date '2000-01-01' or p_taken_on > current_date + 1 then
    raise exception 'invalid_date: la fecha esta fuera de rango' using errcode = '22023';
  end if;
  if p_pose is not null and p_pose not in ('front', 'side', 'back', 'other') then
    raise exception 'invalid_pose: la pose no es valida' using errcode = '22023';
  end if;

  update public.progress_photos p
     set taken_on = p_taken_on, pose = p_pose
   where p.id = p_id and p.user_id = v_user
  returning * into v_row;
  if not found then
    raise exception 'photo_not_found: la foto no existe' using errcode = 'P0002';
  end if;
  return v_row;
end
$$;

revoke all on function public.update_progress_photo(uuid, date, text) from public, anon;
grant execute on function public.update_progress_photo(uuid, date, text) to authenticated;

-- Almacenamiento ---------------------------------------------------------------------------------------------------
-- Bucket privado, solo JPEG y como mucho 3 MiB: lo que sube la función ya viene reducido y sin metadatos. En local el
-- bucket también sale de `config.toml`; esta migración lo deja listo en producción.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

-- Lectura de lo propio: la carpeta de primer nivel es el id de la persona, y con la sesión vigente.
create policy progress_photos_storage_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_session_fresh())
  );
-- Sin políticas de insert, update ni delete: ningún rol del cliente puede escribir en el bucket.

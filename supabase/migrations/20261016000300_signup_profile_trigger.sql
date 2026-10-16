-- T012: al crear una cuenta se crea su perfil. El alta falla si el aviso de privacidad
-- no esta presente o no es una version vigente (FR-029). Idempotente (FR-007).

create function private.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text := new.raw_user_meta_data ->> 'privacy_notice_version';
begin
  if v_version is null or not exists (
    select 1
    from private.privacy_notice_versions
    where version = v_version and is_current
  ) then
    raise exception 'privacy_notice_required: falta una version vigente del aviso de privacidad'
      using errcode = '22023';
  end if;

  insert into public.profiles (user_id, privacy_notice_version, privacy_notice_accepted_at, last_active_at)
  values (new.id, v_version, now(), now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

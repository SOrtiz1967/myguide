-- FR-029: permite a la Edge Function `register` validar la version del aviso de privacidad ANTES de
-- crear la cuenta. Si fallara el disparador de alta, GoTrue devolveria un error generico y no se
-- podria distinguir un aviso invalido de otro problema.

create function public.is_privacy_notice_current(p_version text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.privacy_notice_versions
    where version = p_version and is_current
  );
$$;

revoke all on function public.is_privacy_notice_current(text) from public, anon, authenticated;
grant execute on function public.is_privacy_notice_current(text) to service_role;

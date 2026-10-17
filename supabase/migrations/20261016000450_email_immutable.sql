-- T088 (FR-028): el correo no se puede cambiar en el MVP.
-- Prototipo T007: updateUser({ email }) desde el cliente deja un cambio pendiente (email_change)
-- y envia correos de confirmacion. Se impide que el campo pase a tener valor; el administrador
-- sigue pudiendo cambiar `email` directamente.

create function private.block_email_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email_change is distinct from old.email_change and coalesce(new.email_change, '') <> '' then
    raise exception 'email_change_not_allowed: el correo no se puede cambiar' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger block_email_change
  before update on auth.users
  for each row execute function private.block_email_change();

-- T006 (spec 002): extensiones de busqueda sin acentos y con coincidencias parciales.
-- Las columnas generadas y los indices exigen funciones INMUTABLES: unaccent no lo es por defecto,
-- asi que se envuelve fijando el diccionario (patron recomendado por la documentacion de Postgres).

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create function private.immutable_unaccent(text) returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1);
$$;

revoke all on function private.immutable_unaccent(text) from public, anon;
grant execute on function private.immutable_unaccent(text) to authenticated, service_role;

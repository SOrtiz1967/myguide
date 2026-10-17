-- Guardián de la convención de propiedad (data-model.md): protege a las specs 002 a 011.
-- Falla si alguien agrega una tabla en `public` sin RLS, sin `user_id` o con una política abierta.
begin;
select plan(4);

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'Principio I: toda tabla de public tiene RLS activado'
);

select is(
  (
    select count(*)
    from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.tablename and c.column_name = 'user_id'
      )
  ),
  0::bigint,
  'FR-009: toda tabla de public tiene la columna user_id (propietario)'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public' and (qual is null or trim(qual) in ('true', '(true)'))
      and cmd in ('SELECT', 'UPDATE', 'DELETE')
  ),
  0::bigint,
  'FR-010: ninguna política de public deja leer, modificar o borrar sin condición'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and roles && array['anon']::name[]
  ),
  0::bigint,
  'FR-012: ninguna política de public concede acceso al rol anónimo'
);

select * from finish();
rollback;

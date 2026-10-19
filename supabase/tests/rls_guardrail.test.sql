-- Guardián de la convención de propiedad (data-model.md): protege a las specs 002 a 011.
-- Falla si alguien agrega una tabla en `public` sin RLS, sin `user_id` o con una política abierta.
--
-- Excepción explícita: las TABLAS DE REFERENCIA de solo lectura (información común, no datos de
-- usuario) no tienen `user_id`, pero deben tener RLS, una única política `select` y ningún permiso
-- de escritura para anon ni authenticated. Agregar una tabla a esta lista requiere justificarlo.
begin;
select plan(7);

create temp table reference_tables (name text primary key) on commit drop;
insert into reference_tables (name) values ('food_sources');

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
      and t.tablename not in (select name from reference_tables)
      and not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.tablename and c.column_name = 'user_id'
      )
  ),
  0::bigint,
  'FR-009: toda tabla de public tiene la columna user_id (propietario), salvo las de referencia'
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

select is(
  (
    select count(*)
    from reference_tables r
    where (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = r.name) <> 1
       or exists (
         select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = r.name and p.cmd <> 'SELECT'
       )
  ),
  0::bigint,
  'las tablas de referencia tienen una única política y es de lectura (SELECT)'
);

select is(
  (
    select count(*)
    from reference_tables r
    join information_schema.role_table_grants g
      on g.table_schema = 'public' and g.table_name = r.name
    where g.grantee in ('anon', 'authenticated')
      and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ),
  0::bigint,
  'las tablas de referencia no admiten escritura desde el cliente'
);

-- Rendimiento (lección de la spec 002, T071): una llamada suelta a private.is_session_fresh() en una política
-- se ejecuta por CADA fila; envuelta en (select ...) se evalúa una vez por consulta. Debe ser uniforme.
select is(
  (
    select count(*)
    from pg_policies p,
         lateral (select coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') as expr) e
    where p.schemaname = 'public'
      and regexp_count(e.expr, 'private.is_session_fresh()') > regexp_count(e.expr, 'SELECT private.is_session_fresh()')
  ),
  0::bigint,
  'rendimiento: ninguna política de public llama a is_session_fresh() fuera de un (select ...)'
);

select * from finish();
rollback;

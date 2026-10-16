---
name: database-design
description: Usar al diseñar o revisar entidades, relaciones, migraciones, políticas RLS, snapshots históricos e integridad de datos de la app de fitness. Aplica las reglas de propiedad, inmutabilidad del historial, procedencia y idempotencia de la Constitution.
---

# Diseño de base de datos

Base: Postgres en Supabase. Fuente de verdad de las reglas: `.specify/memory/constitution.md` (Principios I, II, X) y `specs/001-cuentas-perfil-pwa/data-model.md`.

## Cuándo usarla

- Al escribir `data-model.md` de una spec nueva.
- Al crear o revisar una migración en `supabase/migrations/`.
- Al revisar políticas RLS, claves foráneas, índices o restricciones.

## Reglas obligatorias

### 1. Propiedad (Principio I)
- Toda tabla de datos de usuario tiene `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`.
- RLS activado, con políticas separadas de `select`, `insert`, `update` y `delete` que verifican `user_id = auth.uid()` y `private.is_session_fresh()`.
- El `user_id` nunca viene del cliente. Las políticas `insert` y `update` lo validan.
- Cada tabla nueva trae pruebas pgTAP: la cuenta B no lee, modifica ni borra filas de A, y `anon` no accede a nada.
- Claves foráneas entre tablas de usuario deben impedir referenciar filas de otra cuenta (clave compuesta con `user_id` o política que lo verifique).

### 2. Historial inmutable (Principio II)
- Un registro confirmado (comida, sesión, medición) guarda **snapshot** de los valores relevantes: nombre, macros y calorías del alimento; nombre y tipo de medición del ejercicio. No se calcula leyendo el catálogo en vivo.
- Editar o borrar un ítem del catálogo **nunca** altera registros pasados. La referencia al catálogo es opcional y de procedencia (`on delete set null`), no de valores.
- **Planificado y ejecutado son tablas distintas.** Reprogramar modifica lo planificado, jamás lo ejecutado.
- Los estados se modelan explícitos (`manual`, `imported`, `estimated`, `confirmed`) y una estimación no sobrescribe un valor confirmado.

### 3. Procedencia del catálogo (Principio X)
- Cada ítem de catálogo: `source`, `source_id`, `imported_at`, `origin` (`imported` | `user`) y licencia/atribución de la fuente.
- Valores nutricionales por 100 g o 100 ml, con la porción como dato aparte. Un valor faltante es `null`, nunca `0`.
- Los ítems propios del usuario y las copias editadas son filas del usuario; el original no se toca.

### 4. Idempotencia y concurrencia
- Operaciones de creación críticas llevan una clave de idempotencia (`client_request_id uuid`) con restricción única por `(user_id, client_request_id)`.
- Los reintentos devuelven el registro existente, no uno nuevo.
- Decidir y documentar cómo se resuelven ediciones concurrentes (por ejemplo, `updated_at` o versión).

### 5. Fechas y zonas horarias
- Instantes en `timestamptz`. Para el "día del usuario" guardar la fecha local imputada (`date`) además del instante, porque el usuario puede imputar una comida al día que está cerrando (Principio II).
- La zona horaria vive en el perfil; los registros históricos no se reinterpretan si la zona cambia.

### 6. Datos de contexto
- Pasos, sueño y actividad guardan `source` (manual o integración) y fecha. Dos fuentes para el mismo día son filas distintas, no se suman.
- Un dato faltante es ausencia de fila o `null`, nunca un valor supuesto.

### 7. Migraciones
- Una migración por cambio lógico, con nombre descriptivo y orden cronológico.
- Preferir cambios aditivos. Las migraciones destructivas o que reescriben datos exigen plan de reversa y se prueban sobre datos de ejemplo.
- Ningún secreto ni dato real en migraciones o semillas.
- Cada migración que toca una tabla de usuario revisa RLS en el mismo cambio.

## Lista de revisión

- [ ] ¿Toda tabla de usuario tiene `user_id`, RLS y pruebas de aislamiento?
- [ ] ¿Un cambio en el catálogo puede alterar el historial? (debe ser imposible)
- [ ] ¿Planificado y ejecutado están separados?
- [ ] ¿Las operaciones críticas son idempotentes?
- [ ] ¿Se distingue el origen y el estado de cada dato?
- [ ] ¿Los faltantes son `null` y no ceros ni supuestos?
- [ ] ¿Las unidades están normalizadas y documentadas?
- [ ] ¿La migración es reversible o su riesgo está documentado?
- [ ] ¿Las restricciones (`check`, `unique`, `not null`) respaldan las reglas de negocio en la base y no solo en el cliente?

## Qué entregar

Un `data-model.md` o una revisión con: entidades, relaciones, restricciones, políticas RLS, snapshots que se guardan y por qué, y los riesgos abiertos. Si una regla de la Constitution no se puede cumplir con el diseño, decirlo explícitamente en lugar de adaptarla en silencio.

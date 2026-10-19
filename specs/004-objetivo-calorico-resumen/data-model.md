# Data Model: Objetivo calórico y resumen diario

**Feature**: 004-objetivo-calorico-resumen

Sigue la convención de propiedad de la spec 001: toda tabla tiene `user_id`, RLS activado y políticas que exigen `user_id = (select auth.uid())` y `(select private.is_session_fresh())`. La vigencia de la sesión se evalúa **una vez por consulta**, como corrigió la spec 002 (T071).

## `public.energy_goals` — historial del objetivo de energía diaria

Una fila por **cambio**. Nunca se actualiza ni se borra una fila (salvo al eliminar la cuenta): cambiar o quitar el objetivo agrega otra.

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | `gen_random_uuid()` |
| `user_id` | uuid, no nulo | → `auth.users`, `on delete cascade` |
| `effective_from` | date, no nulo | el día, en la zona horaria de la persona, desde el que rige; lo fija el servidor con el "hoy" de la persona (no lo elige el cliente) |
| `kcal` | integer, **nulo** | de 1.000 a 6.000, ambos incluidos; **nulo = la persona quitó el objetivo** |
| `client_request_id` | uuid, no nulo | único por `(user_id, client_request_id)` |
| `created_at` | timestamptz, no nulo | `now()`; define cuál cambio es el último |

**Restricciones**:

- `check (kcal is null or kcal between 1000 and 6000)` (la misma regla que la función y que Zod).
- `unique (user_id, client_request_id)`: la idempotencia.
- `check (effective_from >= date '2000-01-01')`. No se compara con la fecha actual en la base (una restricción con `now()` no es estable); la función siempre escribe el "hoy" de la persona.

**Índices**: `(user_id, created_at desc)` (la consulta del historial); la restricción única crea el índice de `(user_id, client_request_id)`.

**Resolución del objetivo de un día `D`** (función pura del cliente, `goalOn`; ver `research.md`, Decisión 3): entre las filas con `effective_from <= D`, la de `created_at` más reciente. Su `kcal` es el objetivo de `D`; si no hay filas o `kcal` es nulo, `D` no tiene objetivo.

**Ejemplo**:

| `effective_from` | `kcal` | `created_at` |
|---|---|---|
| 2026-10-01 | 2.000 | 2026-10-01 09:10 |
| 2026-10-12 | 1.800 | 2026-10-12 21:30 |
| 2026-10-12 | 1.900 | 2026-10-12 21:45 |
| 2026-10-15 | (nulo) | 2026-10-15 08:00 |

Resultado: antes del 1/10 y desde el 15/10 sin objetivo; del 1/10 al 11/10, 2.000; el 12/10 y hasta el 14/10, 1.900 (el último de ese día).

## Resumen del día (calculado, no se guarda)

Lo produce `summarizeDay(entries, goal)` en el cliente a partir de los ítems del día (spec 003) y del objetivo que regía.

| Campo | Qué es |
|---|---|
| `registered` | suma de `energy_kcal` de los ítems con dato, redondeada **una vez** a kcal enteras |
| `pending` | la parte de `registered` que viene de ítems con `status = 'pending'`, redondeada una vez |
| `missing` | cantidad de ítems con `energy_kcal` nulo (un `0` es dato) |
| `goal` | `kcal` del objetivo del día, o ausente si no hay |
| `remaining` | `goal − registered`; solo con objetivo; negativo si se superó |
| `difference` | `registered − goal` cuando se superó; solo con objetivo |
| `percent` | `round(registered / goal × 100)`; solo con objetivo |
| `state` | `none` (sin objetivo), `under`, `met` (`registered = goal`) u `over` |
| `lowerBound` | `missing > 0`: `registered` es un mínimo y `remaining` un máximo |

Con `state = none`, `goal`, `remaining`, `difference` y `percent` no existen en el resultado (FR-002, SC-009).

## Lo que no cambia

- `meal_entries` (spec 003) no se modifica: su energía, su `origin` y su `status` son la entrada del resumen. Un ítem editado o eliminado cambia el resumen del día en el que está y de ningún otro.
- `profiles` (spec 001) no se modifica.
- No hay columnas nuevas en el perfil ni en los ítems, ni archivos en Storage.

## Cascada y eliminación de cuenta

`energy_goals.user_id → auth.users on delete cascade`: al eliminar la cuenta se borra todo el historial (FR-028). No hay archivos externos que limpiar.

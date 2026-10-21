# Contrato: funciones y acceso a datos

**Feature**: 006-rutinas-calendario-sesiones | Todas las funciones son `security definer` con `search_path` vacío, verifican `auth.uid()` y `private.is_session_fresh()` (sin sesión vigente responden `session_expired`) y no son ejecutables por `anon`. Los errores de validación tienen la forma `invalid_routine:<motivo>:<campo>` o `invalid_session:<motivo>:<campo>`; ninguno incluye contenido de la persona.

## Rutinas

### `create_routine(routine jsonb, request_id uuid) → uuid`

- **Entrada**: `routine = { name, exercises: [ { exercise_id, sets, target_reps?, target_weight_kg?, target_duration_s?, target_distance_km? } ] }` (el orden del arreglo es el orden de la rutina) y `request_id`.
- **Efecto**: valida, toma la instantánea (`exercise_name`, `measurement_type`) de cada ejercicio **visible** para la persona y crea la rutina con sus ítems de forma atómica. Idempotente por `request_id`: repetir devuelve la rutina ya creada (FR-047).
- **Errores**: `name_required`, `name_too_long`, `exercises_required`, `too_many_exercises` (más de 30), `exercise_not_found` (no existe o no es visible), `invalid_sets` (fuera de 1 a 20), `invalid_target` (fuera de rango o que no corresponde al tipo de medición del ejercicio), `request_required`.
- **Requisitos**: FR-001, FR-002, FR-004, FR-047.

### `update_routine(id uuid, routine jsonb) → uuid`

- **Efecto**: reemplaza el nombre y todos los ítems por los del `routine` (mismas reglas que al crear), volviendo a tomar las instantáneas de los ejercicios vigentes. No toca ninguna sesión. Una rutina ajena o inexistente responde `not_found`.
- **Requisitos**: FR-003, FR-005.

### `duplicate_routine(id uuid, request_id uuid) → uuid`

- **Efecto**: crea una rutina independiente con el mismo contenido y el nombre «<nombre> (copia)» recortado a 80 caracteres. Idempotente por `request_id`.
- **Requisitos**: FR-003.

### Borrado

`delete from routines where id = …` (solo lo propio, por RLS). Los ítems se borran en cascada y las sesiones creadas a partir de ella conservan su plan, con `routine_id` nulo (FR-005).

## Sesiones: ciclo de vida

### `plan_workout(session_date date, routine_id uuid, request_id uuid, client_timezone text) → uuid`

- **Efecto**: crea una sesión `planned` en `session_date` (hoy o futura, con el «hoy» del servidor y la zona del perfil). Con `routine_id` copia su contenido a `session_plan_items` refrescando nombre y tipo de medición desde el ejercicio vigente (si el ejercicio ya no existe usa la instantánea de la rutina; si hay objetivos incompatibles con el tipo vigente, no se copian y el ítem queda con `targets_dropped`). Sin `routine_id` crea una sesión sin plan. Idempotente por `request_id`.
- **Errores**: `invalid_date` (anterior a hoy), `not_found` (rutina ajena o inexistente), `request_required`.
- **Requisitos**: FR-015, FR-017, FR-022, FR-027, FR-027a, FR-037.

### `set_workout_routine(id uuid, routine_id uuid) → uuid`

- **Efecto**: en una sesión `planned`, reemplaza el plan por el de otra rutina; con `routine_id` nulo quita el plan (la sesión queda sin planificación). No toca otros días.
- **Errores**: `invalid_transition` si la sesión no está `planned`, `not_found`.
- **Requisitos**: FR-027a.

### `reschedule_workout(id uuid, new_date date, request_id uuid, client_timezone text) → jsonb`

- **Efecto**: mueve una sesión `planned` (o vuelve a planificar una `cancelled`, que pasa a `planned`) a `new_date` de hoy o futura. Es la misma sesión: no se crea otra. Agrega una fila a `session_date_changes`, suma uno a `rescheduled_count` y devuelve `{ id, session_date, status, rescheduled_count }`. Mover a la misma fecha en la que ya está no cambia nada. Idempotente por `request_id`: repetirlo devuelve el movimiento ya hecho.
- **Errores**: `invalid_date` (anterior a hoy), `invalid_transition` (`in_progress` o `completed`: la fecha de lo que ya ocurrió no cambia, FR-024), `not_found`.
- **Requisitos**: FR-023, FR-024, FR-025, FR-047.

### `cancel_workout(id uuid) → jsonb`

- **Efecto**: pasa una sesión `planned` a `cancelled`, conservando su plan. Si ya está cancelada no cambia nada. No borra datos.
- **Errores**: `invalid_transition` (`in_progress` o `completed`), `not_found`.
- **Requisitos**: FR-025.

### `start_workout(session_date date, request_id uuid, client_timezone text) → jsonb`

- **Efecto**: crea una sesión **vacía** `in_progress` en `session_date` (por omisión hoy; no puede ser futura) y fija `started_at`. Devuelve `{ id, session_date, status, revision }`. Idempotente por `request_id`.
- **Errores**: `session_in_progress` (ya hay otra abierta; el mensaje lleva su identificador para ofrecer continuarla, FR-009), `invalid_date` (futura), `request_required`.
- **Requisitos**: FR-007, FR-009, FR-010, FR-011.

### `start_workout_from_routine(routine_id uuid, session_date date, request_id uuid, client_timezone text) → jsonb`

- **Efecto**: igual que `start_workout`, pero la sesión nace con el plan de la rutina (copia de sus ítems con las instantáneas refrescadas, como en `plan_workout`). Idempotente por `request_id`.
- **Errores**: los de `start_workout` y `not_found` (rutina ajena o inexistente).
- **Requisitos**: FR-007, FR-015, FR-037.

### `start_planned_workout(id uuid, session_date date, request_id uuid, client_timezone text) → jsonb`

- **Efecto**: pasa una sesión `planned` de fecha de hoy o anterior a `in_progress`, conservando su plan, y fija `started_at`. `session_date` es el día en que se hizo: nulo significa hoy; no puede ser futuro. Si difiere de la fecha planificada, la sesión pasa a ese día, se agrega una fila a `session_date_changes`, sube `rescheduled_count` y queda el recorrido de fechas (no se pierde la fecha original). Si la sesión ya está `in_progress` devuelve su estado actual sin cambiar nada (idempotente), y el movimiento se repite de forma idempotente por `request_id`.
- **Errores**: `session_in_progress` (otra distinta ya está abierta), `invalid_date` (la fecha planificada o la elegida es futura: primero hay que reprogramar), `invalid_transition` (cancelada o realizada), `not_found`, `request_required`.
- **Requisitos**: FR-009, FR-026.

### `save_workout(id uuid, payload jsonb, expected_revision integer, finish boolean) → jsonb`

- **Efecto**: reemplaza **de forma atómica** la nota, los ejercicios realizados y sus series por los del `payload`.
  - Sesión `in_progress`: guarda el avance; con `finish = true` además pasa a `completed`, fija `finished_at` y calcula `modified`.
  - Sesión `completed`: es una corrección; fija `corrected_at` y recalcula `modified`. `finish` se ignora.
  - Sesión `planned` o `cancelled`: `invalid_transition` (primero hay que iniciarla).
  - Si `expected_revision` no es la revisión actual, rechaza con `stale_revision` sin cambiar nada. Devuelve `{ revision, status, modified, corrected_at, finished_at }`.
- **Payload** (los textos se recortan; los vacíos pasan a nulo):

```json
{
  "note": "…" ,
  "exercises": [
    {
      "id": "uuid generado por el cliente",
      "exercise_id": "uuid del ejercicio (solo se usa si el ejercicio es nuevo en la sesión)",
      "plan_item_id": "uuid de un ítem del plan de esta sesión, o null",
      "is_substitute": false,
      "effort": 7,
      "note": "…",
      "sets": [ { "reps": 8, "weight_kg": 60 }, { "reps": 8 } ]
    }
  ]
}
```

  - El orden de `exercises` y de `sets` es el orden en la sesión.
  - Un ejercicio cuyo `id` ya existe en la sesión **conserva su instantánea**; uno nuevo toma nombre y tipo de medición del ejercicio vigente **visible** (`exercise_not_found` si no lo es). Una fila que no está en el payload se elimina.
  - Una serie sin ningún valor se descarta; las series deben llevar solo los valores del tipo de medición del ejercicio.
- **Errores**: `stale_revision`, `invalid_transition`, `duplicate_id` (el `id` de un ejercicio ya existe en otra sesión o cuenta: se rechaza sin revelar nada), `too_many_exercises` (más de 30), `too_many_sets` (más de 20), `invalid_set` (valor fuera de rango o que no corresponde al tipo), `invalid_effort`, `invalid_plan_item`, `note_too_long`, `exercise_not_found`, `not_found`.
- **Requisitos**: FR-012, FR-013, FR-014, FR-018, FR-019, FR-028 a FR-035, FR-038, FR-045 a FR-047.

### Borrado

`delete from workout_sessions where id = …` (solo lo propio, por RLS): elimina la sesión con su plan, sus ejercicios, sus series y su recorrido de fechas. Las rutinas y el catálogo no cambian (FR-039).

## Lectura

| Qué | Cómo | Notas |
|---|---|---|
| Rutinas de la cuenta | `select` sobre `routines` con `routine_exercises` embebidos y, por cada ítem, el ejercicio vigente (`exercise:exercises(id, name, measurement_type)`, que queda nulo si ya no existe o no es visible) | Ordenadas por nombre. El nombre actual se muestra si existe (FR-004) y la diferencia de tipo de medición con la instantánea dispara el aviso de revisar objetivos |
| Calendario de un mes | `select` sobre `workout_sessions` por rango de `session_date` (`id, session_date, status, modified, rescheduled_count, corrected_at, routine_name, has_plan`) | Sin series: liviano |
| Sesiones de un día | `select` sobre `workout_sessions` por `session_date`, con sus ítems | Orden estable por `started_at`/`created_at` |
| Una sesión | `select` con `session_plan_items`, `session_exercises`, `session_sets` y `session_date_changes` embebidos | Los ítems y las series ordenados por `position` |
| Sesión en curso | `select … where status = 'in_progress'` | Para ofrecer continuarla |

### `exercise_history(exercise_id uuid, exclude_session_id uuid, page_size integer, page_offset integer) → table`

- **Seguridad**: `security invoker` (RLS filtra: solo lo propio, con sesión vigente).
- **Devuelve**, por cada sesión **realizada** donde se registró el ejercicio, de la más reciente a la más antigua (`session_date desc`, desempate estable): `session_id`, `session_date`, `exercise_name` (el guardado en esa sesión), `effort`, `note` y `sets` (arreglo ordenado de `{ reps, weight_kg, duration_s, distance_km }`), más `total_estimate`.
- **Parámetros**: `page_size` con tope de 50 (por omisión 10); `exclude_session_id` para «la última vez» dentro de una sesión en curso.
- **Errores**: `session_expired`. Un ejercicio sin historia devuelve cero filas.
- **Requisitos**: FR-041 a FR-043, SC-009, SC-010.

## Acceso directo a tablas

| Tabla | `select` | `insert` / `update` | `delete` |
|---|---|---|---|
| `routines`, `workout_sessions` | lo propio | nunca directo | lo propio |
| `routine_exercises`, `session_plan_items`, `session_exercises`, `session_sets`, `session_date_changes` | lo propio | nunca directo | nunca directo |

Sin sesión vigente nada es visible. Un ejercicio, rutina o sesión ajena se comporta como inexistente.

## Garantías

- **Instantánea**: el nombre y el tipo de medición de un ejercicio de plan, de rutina o de sesión no cambian después de insertarse; solo `exercise_id` puede pasar a nulo (cuando se elimina el ejercicio).
- **Separación**: nada de `session_plan_items` se modifica al guardar lo realizado, ni al revés.
- **Atomicidad**: `save_workout` y las funciones de rutina no dejan datos a medias ante un error.
- **Sin contenido en registros**: ningún mensaje de error, registro ni excepción incluye nombres, notas ni valores de la persona.

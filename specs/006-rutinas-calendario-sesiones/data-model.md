# Modelo de datos: rutinas, calendario y sesiones

**Feature**: 006-rutinas-calendario-sesiones | Postgres 17 (Supabase). Todas las tablas son de usuario: llevan `user_id` con `on delete cascade` hacia `auth.users` (FR-054) y RLS activado. Decisiones y alternativas en [research.md](research.md).

## Resumen

```text
routines ──< routine_exercises ──> exercises (set null)
   │
   └──(referencia, set null)── workout_sessions ──< session_plan_items ──> exercises (set null)
                                    │  │                  ▲
                                    │  └──< session_exercises ──< session_sets
                                    │            │  (plan_item_id, set null)
                                    │            └──> exercises (set null)
                                    └──< session_date_changes
```

## `public.routines`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, clave primaria | `gen_random_uuid()` |
| `user_id` | uuid | obligatorio, `on delete cascade` |
| `name` | text | 1 a 80 caracteres, sin espacios en los extremos |
| `client_request_id` | uuid | nulo permitido; único por `(user_id, client_request_id)` cuando no es nulo (FR-047) |
| `created_at`, `updated_at` | timestamptz | `updated_at` por disparador |

Índices: `(user_id, name)` para la lista; el único parcial de `client_request_id`.

## `public.routine_exercises`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, clave primaria | |
| `routine_id` | uuid | `on delete cascade` |
| `user_id` | uuid | obligatorio, `on delete cascade`; se repite para que RLS no necesite un join |
| `position` | integer | 1 a 30; único por `(routine_id, position)` |
| `exercise_id` | uuid | referencia a `exercises(id)` **`on delete set null`** |
| `exercise_name` | text | 1 a 120 caracteres: nombre con que se agregó (FR-004) |
| `measurement_type` | text | uno de los cuatro tipos de la spec 005 |
| `sets` | integer | 1 a 20 |
| `target_reps` | integer | nulo o 1 a 999 |
| `target_weight_kg` | numeric(6,2) | nulo o 0 a 999,9 |
| `target_duration_s` | integer | nulo o 1 a 86.400 |
| `target_distance_km` | numeric(7,3) | nulo o mayor que 0 y hasta 999,9 |

**Objetivos válidos por tipo** (restricción `check`): `reps_weight` admite `target_reps` y `target_weight_kg`; `reps_bodyweight` solo `target_reps`; `duration` solo `target_duration_s`; `distance_duration` `target_distance_km` y `target_duration_s`. Cualquier otro objetivo debe ser nulo. Un objetivo nulo es «sin objetivo», nunca 0.

El máximo de 30 ejercicios por rutina lo impone `create_routine`/`update_routine` y lo respalda un disparador de inserción.

## `public.workout_sessions`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, clave primaria | |
| `user_id` | uuid | `on delete cascade` |
| `session_date` | date | desde 2000-01-01; el día de la sesión en la zona de la persona |
| `original_date` | date | la primera fecha de la sesión (no cambia) |
| `status` | text | `planned`, `in_progress`, `completed`, `cancelled` |
| `routine_id` | uuid | referencia a `routines(id)` **`on delete set null`**; solo informativa, sin dependencia |
| `routine_name` | text | nulo o 1 a 80: nombre de la rutina al crear (para decir «la rutina ya no existe») |
| `has_plan` | boolean | verdadero si se creó con ítems de plan |
| `note` | text | nulo o 1 a 1.000 caracteres |
| `modified` | boolean | calculado por el servidor; solo puede ser verdadero si `status = 'completed'` y `has_plan` |
| `rescheduled_count` | integer | 0 o más; mayor que 0 ⇒ marca «Reprogramada» |
| `corrected_at` | timestamptz | fecha de la última corrección de una sesión ya realizada |
| `started_at`, `finished_at` | timestamptz | `in_progress` exige `started_at`; `completed` exige ambos; `planned` y `cancelled` no los tienen |
| `revision` | integer | empieza en 1; sube con cada guardado de contenido |
| `client_request_id` | uuid | único por `(user_id, client_request_id)` cuando no es nulo |
| `created_at`, `updated_at` | timestamptz | |

Índices: `(user_id, session_date)` para el calendario; **único parcial `(user_id)` donde `status = 'in_progress'`** (una sola sesión en curso, FR-009); el único parcial de `client_request_id`.

**Identidad protegida** (disparador): `user_id`, `original_date` y `routine_name` no cambian nunca; `routine_id` solo puede pasar a nulo.

### Estados y transiciones

| Desde | Hacia | Quién | Condición |
|---|---|---|---|
| (nada) | `planned` | `plan_session` | fecha de hoy o futura |
| (nada) | `in_progress` | `start_session`, `start_session_from_routine` | fecha de hoy o pasada; sin otra sesión en curso |
| `planned` | `in_progress` | `start_planned_session` | fecha de hoy o anterior; sin otra en curso; puede pasar al día en que se hizo (hoy o pasado), con su fila en `session_date_changes` |
| `planned` | `planned` | `reschedule_session`, `set_session_routine` | nueva fecha de hoy o futura |
| `planned` | `cancelled` | `cancel_session` | |
| `cancelled` | `planned` | `reschedule_session` | nueva fecha de hoy o futura (volver a planificar) |
| `in_progress` | `completed` | `save_session` con `finish` | |
| `completed` | `completed` | `save_session` (corrección) | marca `corrected_at` |
| cualquiera | (eliminada) | borrado directo (RLS) | con confirmación en la interfaz |

Cualquier otra transición responde `invalid_transition`. Una sesión `in_progress` o `completed` **nunca** cambia de fecha (FR-024).

### Regla de «modificada» (se calcula al terminar o corregir, solo con plan)

Una sesión con plan queda `modified = true` si ocurre **alguna** de estas diferencias; en caso contrario `false`:

1. Un ítem del plan sin ejercicio realizado propio con al menos una serie (no realizado).
2. Un ítem del plan cuyo cumplimiento es un ejercicio sustituto (`is_substitute`) con series.
3. Un ejercicio realizado con al menos una serie que no está vinculado a un ítem del plan (agregado).
4. Un ejercicio realizado vinculado a un ítem del plan, no sustituto, con una cantidad de series distinta de `sets` del ítem.

Las diferencias de repeticiones, peso, duración o distancia frente a los objetivos **no** cuentan (FR-019). Un ejercicio realizado con cero series se trata como «no realizado» (caso 1) y no cuenta como agregado.

## `public.session_plan_items`

El plan de una sesión: copia de los ítems de la rutina al crear la sesión. **Inmutable respecto de la rutina de origen** (FR-015) y de lo realizado (FR-016).

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, clave primaria | |
| `session_id` | uuid | `on delete cascade` |
| `user_id` | uuid | `on delete cascade` |
| `position` | integer | 1 a 30; único por `(session_id, position)` |
| `exercise_id` | uuid | `exercises(id)` **`on delete set null`** |
| `exercise_name`, `measurement_type` | text | instantánea tomada del ejercicio vigente al crear el plan (o de la rutina si ya no existe) |
| `sets` | integer | 1 a 20 |
| `target_reps`, `target_weight_kg`, `target_duration_s`, `target_distance_km` | | las mismas reglas y la misma restricción por tipo que en `routine_exercises` |
| `targets_dropped` | boolean | verdadero si la rutina traía objetivos incompatibles con el tipo vigente y no se copiaron |

**Disparador de inmutabilidad**: ninguna columna cambia después de insertar, salvo `exercise_id` que solo puede pasar a nulo. El plan solo se reemplaza entero (borrar e insertar) desde `set_session_routine`, y solo mientras la sesión está `planned`.

## `public.session_exercises` (lo realizado)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, clave primaria | lo genera el cliente (también da idempotencia al reintentar) |
| `session_id` | uuid | `on delete cascade` |
| `user_id` | uuid | `on delete cascade` |
| `position` | integer | 1 a 30; único por `(session_id, position)` |
| `exercise_id` | uuid | `exercises(id)` **`on delete set null`** |
| `exercise_name`, `measurement_type` | text | **instantánea** tomada al agregar el ejercicio a la sesión (FR-034) |
| `plan_item_id` | uuid | nulo o un ítem del plan **de la misma sesión**; único por `(session_id, plan_item_id)` cuando no es nulo; `on delete set null` |
| `is_substitute` | boolean | verdadero solo si `plan_item_id` no es nulo (sustituye a ese ítem) |
| `effort` | smallint | nulo o 1 a 10; uno por ejercicio, para todas sus series (FR-014) |
| `note` | text | nulo o 1 a 500 caracteres |

**Disparador de inmutabilidad**: `exercise_name` y `measurement_type` no cambian después de insertar; `exercise_id` solo puede pasar a nulo (FR-035, FR-036).

## `public.session_sets`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, clave primaria | `gen_random_uuid()` |
| `session_exercise_id` | uuid | `on delete cascade` |
| `session_id`, `user_id` | uuid | para RLS e índices sin join |
| `position` | integer | 1 a 20; único por `(session_exercise_id, position)` |
| `reps` | integer | nulo o 1 a 999 |
| `weight_kg` | numeric(6,2) | nulo o 0 a 999,9 |
| `duration_s` | integer | nulo o 1 a 86.400 |
| `distance_km` | numeric(7,3) | nulo o mayor que 0 y hasta 999,9 |

**Reglas**: al menos un valor no nulo (una serie sin valores no existe, FR-030); un valor nulo es «sin dato», nunca 0; un peso de 0 es válido y distinto de «sin dato». Un disparador comprueba, al insertar, que los valores presentes correspondan al tipo de medición **de la instantánea** del ejercicio realizado (`reps_weight`: reps y peso; `reps_bodyweight`: reps; `duration`: duración; `distance_duration`: distancia y duración).

Las series se reemplazan enteras en cada guardado, por eso su `id` no es estable y nada lo referencia.

## `public.session_date_changes` (de solo altas)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, clave primaria | |
| `session_id` | uuid | `on delete cascade` |
| `user_id` | uuid | `on delete cascade` |
| `from_date`, `to_date` | date | distintas entre sí |
| `client_request_id` | uuid | único por `(user_id, client_request_id)`: reintentar un movimiento devuelve el mismo |
| `created_at` | timestamptz | |

Nunca se actualiza ni se borra una fila (salvo la cascada de la sesión o de la cuenta). Se agrega una fila al reprogramar y también cuando una sesión planificada vencida se registra en otro día. El recorrido de fechas de una sesión es `original_date` más los `to_date` en orden de `created_at`.

## Seguridad (RLS)

Convención de la spec 001 (`supabase/README.md`): toda tabla de usuario tiene `user_id`, RLS activado y políticas con la vigencia de sesión escrita `(select private.is_session_fresh())` (nunca como llamada suelta).

| Tabla | `select` | `insert` / `update` | `delete` |
|---|---|---|---|
| `routines`, `workout_sessions` | solo lo propio | nunca directo: solo por las funciones | solo lo propio |
| `routine_exercises`, `session_plan_items`, `session_exercises`, `session_sets`, `session_date_changes` | solo lo propio | nunca directo | nunca directo (se borran por cascada) |

`grant select` (y `delete` en `routines` y `workout_sessions`) para `authenticated`; nada para `anon`; todo para `service_role`. Un registro ajeno se comporta como inexistente (resultado vacío).

## Funciones auxiliares privadas

- `private.compute_session_modified(session_id)`: la regla de «modificada».
- `private.snapshot_exercise(user, exercise_id)`: devuelve nombre y tipo de un ejercicio **visible** para la persona (catálogo o propio) o nulo.
- `private.clean_routine_input(jsonb)`, `private.clean_session_payload(jsonb)`: validan y limpian (recortan textos, descartan series vacías, comprueban rangos y la forma por tipo de medición) antes de escribir.
- Disparadores: `touch updated_at`, inmutabilidad de instantáneas y de identidad, forma de las series por tipo, tope de 30 ejercicios.

Todas con `search_path` vacío y sin permiso para el cliente.

## Cobertura de requisitos

| Requisito | Dónde |
|---|---|
| FR-001 a FR-006 (rutinas) | `routines`, `routine_exercises`, `create/update/duplicate_routine`, borrado directo |
| FR-007 a FR-013 (sesiones y estados) | `workout_sessions`, índice de sesión en curso, transiciones |
| FR-014 (esfuerzo) | `session_exercises.effort` |
| FR-015 a FR-020 (plan frente a realizado) | `session_plan_items` separada de `session_exercises`; `modified`; `is_substitute` |
| FR-021 a FR-027a (calendario) | `session_date`, `session_date_changes`, `rescheduled_count`, `plan_session`, `reschedule_session`, `cancel_session`, `set_session_routine` |
| FR-028 a FR-033 (series) | `session_sets` y sus restricciones |
| FR-034 a FR-040 (integridad) | instantáneas inmutables, `set null`, `corrected_at`, borrado |
| FR-041 a FR-044 (historia) | `exercise_history`; sin gráficos |
| FR-045 a FR-049 (borrador, idempotencia) | `revision`, `client_request_id`, `save_session` |
| FR-050 a FR-054 (privacidad) | RLS, cascada de cuenta |

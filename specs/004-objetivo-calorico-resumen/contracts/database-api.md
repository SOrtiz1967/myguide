# Contrato: acceso a datos del objetivo de energía

**Feature**: 004-objetivo-calorico-resumen

La escritura es una función `security definer` (con `search_path` vacío) que verifica `auth.uid()` y `private.is_session_fresh()`. La lectura es un `select` directo con RLS. Ninguna otra cuenta ve ni cambia nada de la persona (`not_found` no aplica: la función solo opera sobre quien llama).

## `set_energy_goal(kcal integer, request_id uuid, client_timezone text default null) → { effective_from date, kcal integer }`

- **Entrada**:
  - `kcal`: entero de **1.000 a 6.000**, o **`null` para quitar el objetivo**.
  - `request_id`: identificador de la solicitud (obligatorio).
  - `client_timezone`: nombre IANA del dispositivo; solo se usa si el perfil no tiene zona (igual que `log_day_status` y `start_log_day` de la spec 003).
- **Efecto**:
  1. Si ya existe una fila de la cuenta con `request_id`, **la devuelve sin cambiar nada** (idempotencia; también para reintentos tardíos).
  2. Valida `kcal`.
  3. Calcula `effective_from` = el "hoy" de la persona con `private.log_day_status_at(auth.uid(), now(), private.effective_timezone(auth.uid(), client_timezone))`.
  4. Inserta una fila con ese `effective_from`, `kcal` y `request_id`.
  5. Devuelve `effective_from` y `kcal` de la fila (la nueva o la ya existente).
- **Concurrencia**: dos solicitudes con el mismo `request_id` a la vez resuelven por la restricción única; la que pierde devuelve la fila de la ganadora.
- **Errores**:
  - `session_expired` (`42501`): sesión vencida o sin sesión.
  - `invalid_goal:out_of_range:kcal` (`22023`): `kcal` fuera de 1.000 a 6.000.
  - `invalid_goal:request_required:request_id` (`22023`): falta `request_id`.
- **Permisos**: `anon` no puede ejecutarla; `authenticated` sí. La versión con la hora como parámetro, `private.set_energy_goal_at(usuario, kcal, request_id, ahora, zona)`, no la ejecuta ningún rol de la API: existe para probar con una hora simulada.
- **Requisitos**: FR-001, FR-003 a FR-006, FR-008, FR-009, FR-010, FR-023, FR-024.

## Lectura del historial

- **Consulta**: `select effective_from, kcal, created_at from energy_goals order by created_at desc limit 1000`, con RLS (solo las filas de la cuenta, con sesión vigente).
- **Uso**: la función pura `goalOn(history, day)` del cliente resuelve el objetivo de un día (ver `data-model.md`). La consulta se guarda en caché y se invalida al guardar.
- **Requisitos**: FR-008 a FR-011.

## Acceso directo a tablas

| Tabla | `select` | `insert` | `update` | `delete` |
|---|---|---|---|---|
| `energy_goals` | propias | solo por `set_energy_goal` | nunca | nunca (solo la cascada al eliminar la cuenta) |

`anon` no tiene ningún permiso. El rol `service_role` tiene todos (como en las demás tablas).

## Lo que el servidor no hace

- No resuelve el objetivo de un día (lo hace el cliente con una función pura; ver `research.md`, Decisión 3).
- No ajusta, sugiere ni recalcula el objetivo (FR-007).
- No registra el valor del objetivo en ningún registro técnico (FR-027).

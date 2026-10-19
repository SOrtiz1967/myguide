# Contrato: acceso a datos del registro de comidas

**Feature**: 003-registro-de-comidas

Todas las funciones son `security invoker`, exigen sesión vigente y aplican RLS. Los errores de validación tienen la forma `invalid_entry:<motivo>:<campo>`; un ítem o un alimento ajeno se comporta como inexistente (`not_found`).

## `add_meal_entry(entry jsonb, request_id uuid) → uuid`

- **Entrada** (`entry`):
  - Desde un alimento: `{ log_date, meal, food_id, quantity }` o `{ log_date, meal, food_id, portion_id, portion_count }`.
  - Manual: `{ log_date, meal, origin: 'manual', description, quantity_text?, energy_kcal, protein_g?, carbs_g?, sugars_g?, fat_g?, saturated_fat_g?, fiber_g?, sodium_mg? }`.
- **Efecto**: lee el alimento con RLS y copia su instantánea (nombre, marca, base, 8 valores por 100, y la porción elegida). `origin` es `catalog` u `own` según el alimento. Calcula los valores del ítem. Si ya existe un ítem del mismo dueño con ese `request_id`, devuelve el existente.
- **Día admitido**: desde el 1/1/2000 hasta hoy + 7 días en la zona horaria del perfil (sin zona, en UTC con un día de tolerancia).
- **Errores**:
  - Del alimento: `not_found` (alimento ausente o ajeno), `invalid_portion` (la porción no es de ese alimento).
  - De los datos del ítem (`invalid_entry:<motivo>:<campo>`): `invalid_quantity`, `invalid_portion_count`, `invalid_meal`, `invalid_date`, `description_required`, `energy_required`, `negative_value`, `out_of_range`, `sugars_exceed_carbs`, `saturated_exceeds_fat`.
- **Requisitos**: FR-001 a FR-012.

## `update_meal_entry(id uuid, changes jsonb) → uuid`

- **Entrada**: cualquiera de `quantity`, `portion_count`, `meal`, `log_date`. En los manuales, además, `description`, `quantity_text` y los valores.
- **Efecto**: recalcula a partir de la **instantánea del ítem** (nunca del alimento actual). No se puede cambiar el origen, el alimento ni la instantánea.
- **Errores**: los de `add_meal_entry`; `not_found`.
- **Requisitos**: FR-019 a FR-021, FR-026.

## `log_day_status(client_timezone text) → { today date, proposed_date date, closing boolean }`

- Usa la zona horaria del perfil; `client_timezone` solo se usa si el perfil no tiene ninguna. Delega en `private.log_day_status_at(ahora, zona)` (sin permiso para el cliente), que es la que prueban las pruebas con una hora simulada.
- `closing = true` y `proposed_date = today - 1` si hoy no tiene ítems, no hay marca de inicio para hoy y ayer tiene al menos un ítem. Si no, `proposed_date = today`.
- **Requisitos**: FR-024, FR-025.

## `start_log_day(day date) → void`

Inserta la marca de inicio del día (idempotente). Solo admite `day` igual al `today` del perfil.

## `recent_meal_items(max int default 20) → filas`

- **Salida**: `food_id, origin, food_name, food_brand, reference_basis, quantity, portion_id, portion_name, portion_count, quantity_text, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, sodium_mg, last_logged_at`.
- **Reglas**:
  - Hasta `max` (1 a 50) elementos distintos: por alimento, o por la descripción normalizada si es manual. Gana el más reciente de cada grupo.
  - Se excluyen los de alimentos que ya no existen o ya no son visibles.
  - Para los que vienen de un alimento, los valores se devuelven calculados con el alimento **actual**, porque al volver a registrar se toma una instantánea nueva. Los manuales se devuelven con sus valores.
  - `portion_id` se resuelve por el nombre de la porción en el alimento actual; si ya no existe, es nulo y queda la cantidad en g o ml.
- **Requisitos**: FR-040.

## `preview_repeat_meal(from_date date, from_meal text) → { total int, recalculated int, copied int }`

Solo lectura. Es lo que la pantalla muestra antes de confirmar (FR-028).

## `repeat_meal(from_date, from_meal, to_date, to_meal, request_id) → { created int, recalculated int, copied int }`

- **Efecto**: un ítem nuevo por cada ítem de origen, en una transacción. El destino puede ser el mismo día y la misma comida que el origen (los ítems quedan duplicados a propósito). Recalcula con una instantánea nueva si el alimento existe y es visible; si no, copia. Cada ítem nuevo lleva un `client_request_id` derivado de `(request_id, id de origen)`: un reintento no duplica.
- **Errores**: `invalid_date`, `invalid_meal`; repetir una comida sin ítems da `created = 0`.
- **Requisitos**: FR-028, FR-029.

## Acceso directo a tablas

| Tabla | `select` | `insert` | `update` | `delete` |
|---|---|---|---|---|
| `meal_entries` | propios | solo por `add_meal_entry` y `repeat_meal` | solo por `update_meal_entry` | propios (con confirmación en la interfaz) |
| `log_day_starts` | propios | propios (por `start_log_day`) | — | — |
| `meal_photos` | propios | solo la Edge Function | solo la Edge Function | solo la Edge Function |

Sin sesión vigente nada es visible. `anon` no tiene permisos.

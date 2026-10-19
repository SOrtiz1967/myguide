# Data Model: Registro de comidas

**Feature**: 003-registro-de-comidas

Sigue la convención de propiedad de la spec 001: toda tabla tiene `user_id`, RLS activado y políticas que exigen `user_id = (select auth.uid())` y `(select private.is_session_fresh())`. La vigencia de la sesión se evalúa **una vez por consulta**, como corrigió la spec 002 (T071).

## `public.meal_entries` — ítem registrado

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, no nulo | → `auth.users`, `on delete cascade` |
| `log_date` | date, no nulo | día de imputación; desde 2000-01-01 hasta hoy + 7 días (lo valida la función) |
| `meal` | text, no nulo | `breakfast`, `lunch`, `snack`, `dinner`, `extra` (desayuno, almuerzo, merienda, cena, colación) |
| `origin` | text, no nulo | `catalog`, `own`, `manual`, `estimated` (este último reservado para la spec 009) |
| `status` | text, no nulo | `confirmed` o `pending`; en esta spec siempre `confirmed` |
| `food_id` | uuid, nulo | → `public.foods`, **`on delete set null`**; obligatorio al crear si `origin` es `catalog` u `own` |
| `food_name` | text, no nulo | instantánea del nombre, o la descripción si es manual (1 a 200) |
| `food_brand` | text, nulo | instantánea de la marca |
| `reference_basis` | text, nulo | `100g` o `100ml`; nulo en los manuales |
| `per100_energy_kcal` … `per100_sodium_mg` | numeric, nulo | instantánea de los 8 valores por 100 g/ml; nulos en los manuales |
| `quantity` | numeric(10,2), nulo | g o ml, de 0 (excluido) a 5000; obligatorio salvo en los manuales |
| `portion_name` | text, nulo | porción elegida (instantánea) |
| `portion_quantity` | numeric(8,2), nulo | g o ml de una porción (instantánea) |
| `portion_count` | numeric(6,2), nulo | de 0 (excluido) a 50; si hay porción, `quantity = portion_quantity × portion_count` |
| `quantity_text` | text, nulo | cantidad descriptiva de un manual ("1 porción"), hasta 60 |
| `energy_kcal`, `protein_g`, `carbs_g`, `sugars_g`, `fat_g`, `saturated_fat_g`, `fiber_g`, `sodium_mg` | numeric, nulo | valores **del ítem**; los calcula el disparador desde la instantánea (o los escribe la persona si es manual). Un faltante es `null` |
| `client_request_id` | uuid, nulo | único por `(user_id, client_request_id)` |
| `created_at`, `updated_at` | timestamptz | `created_at` es el "momento de registro" |

**Restricciones**:

- `origin in ('catalog','own')` ⇒ instantánea y `quantity` presentes. `origin = 'manual'` ⇒ `quantity` y la instantánea por 100 nulas, y `energy_kcal` no nula.
- Rangos de los manuales (ver `research.md`, Decisión 8): azúcares ≤ carbohidratos, saturadas ≤ grasas.
- `status = 'pending'` solo si `origin = 'estimated'` (la spec 009 lo usará).

**Disparador `prepare_meal_entry`** (antes de insertar o actualizar):

- Si no es manual, calcula cada valor como `per100_x × quantity / 100`, redondeado a 2 decimales; si `per100_x` es nulo, el valor queda nulo.
- Si hay porción, fija `quantity = portion_quantity × portion_count`.
- Impide cambiar `user_id`, `origin`, `food_id` y la instantánea después de crear. Solo cambian la cantidad, la porción, la comida, el día y, en los manuales, la descripción y los valores.

**Índices**: `(user_id, log_date, meal)`; `(user_id, created_at desc)` para los recientes; `(food_id)`.

## `public.log_day_starts` — "Empezar el día de hoy"

| Columna | Tipo | Reglas |
|---|---|---|
| `user_id` | uuid, no nulo | → `auth.users`, `on delete cascade` |
| `log_date` | date, no nulo | el día que la persona eligió empezar |
| `created_at` | timestamptz | |

PK `(user_id, log_date)`. Solo `select` e `insert` propios.

## `public.meal_photos` — foto de una comida

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, no nulo | → `auth.users`, `on delete cascade` |
| `log_date` | date, no nulo | |
| `meal` | text, no nulo | mismos valores que en `meal_entries` |
| `storage_path` | text, no nulo | `<user_id>/<uuid>.jpg` en el bucket `meal-photos` |
| `width`, `height` | integer | |
| `bytes` | integer | ≤ 3.145.728 |
| `created_at` | timestamptz | |

Única por `(user_id, log_date, meal)`. El cliente solo tiene `select` y `delete` propios; las altas y los reemplazos los hace la Edge Function con la clave de servicio, después de limpiar la imagen. Al eliminar o reemplazar, la función borra también el objeto de Storage.

**Bucket `meal-photos`** (privado; sin listado público):

- Política de `select` sobre `storage.objects`: `bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_session_fresh())`.
- Sin políticas de `insert`, `update` ni `delete` para el cliente.

## Funciones

| Función | Quién | Qué |
|---|---|---|
| `add_meal_entry(entry jsonb, request_id uuid)` | authenticated (invoker) | Crea un ítem; toma la instantánea del alimento visible; idempotente |
| `update_meal_entry(id uuid, changes jsonb)` | authenticated (invoker) | Cambia cantidad o porción, comida, día y, si es manual, la descripción y los valores |
| `log_day_status(client_timezone text)` | authenticated (invoker) | `{today, proposed_date, closing}` según la Decisión 4 |
| `start_log_day(day date)` | authenticated (invoker) | Inserta la marca de "Empezar el día de hoy" (idempotente) |
| `recent_meal_items(max int default 20)` | authenticated (invoker) | Los recientes de la Decisión 5 |
| `preview_repeat_meal(from_date, from_meal)` | authenticated (invoker) | Cuántos ítems se recalcularían y cuántos se copiarían |
| `repeat_meal(from_date, from_meal, to_date, to_meal, request_id)` | authenticated (invoker) | Repite la comida, atómico e idempotente |

Eliminar un ítem es un `delete` directo (RLS). La validación compartida vive en `private.validate_meal_entry(...)`.

## Relación con la spec 002

`meal_entries.food_id` → `foods.id` con `on delete set null`: la prueba guardiana de claves foráneas de la spec 002 (`foods_schema.test.sql`) ya exige exactamente esto. Las copias de alimentos y las reimportaciones del catálogo no tocan `meal_entries`.

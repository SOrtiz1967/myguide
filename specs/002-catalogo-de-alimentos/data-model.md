# Data Model: Catálogo de alimentos

**Feature**: 002-catalogo-de-alimentos | Base de datos: Postgres (Supabase)

Hereda la convención de propiedad de la spec 001 (`supabase/README.md`), con la excepción documentada en `research.md`, Decisión 5: en `foods` y `food_portions`, `user_id` nulo identifica filas del catálogo común.

## Extensiones

`unaccent` y `pg_trgm` (esquema `extensions`), para la búsqueda sin acentos y con coincidencias parciales.

## `public.food_sources` (fuentes del catálogo)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | |
| `slug` | text, único, no nulo | por ejemplo `open-food-facts`, `usda-sr-legacy` |
| `name` | text, no nulo | nombre para mostrar |
| `license_name` | text, no nulo | por ejemplo `ODbL 1.0` |
| `license_url` | text, no nulo | |
| `attribution` | text, no nulo | texto de atribución exigido por la licencia (FR-013) |
| `source_url` | text, no nulo | |
| `last_imported_at` | timestamptz, nulo | |
| `food_count` | integer, no nulo, por defecto 0 | lo actualiza la carga |

- **Acceso**: `select` para `authenticated` (pantalla de fuentes, FR-012). Sin escritura desde el cliente; solo `service_role`.
- No tiene `user_id`: es un catálogo común de referencia, no un dato de usuario. Se agrega a la lista de excepciones del guardián `rls_guardrail` (tabla de referencia, solo lectura).

## `public.foods`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, nulo | `null` = catálogo importado; si no, dueño. `references auth.users on delete cascade` |
| `origin` | text, no nulo | `imported` o `own` |
| `source_id` | uuid, nulo | `references food_sources`; obligatorio si `origin = 'imported'` |
| `source_item_id` | text, nulo | identificador de origen (código de barras en OFF, `fdc_id` en USDA) |
| `imported_at` | timestamptz, nulo | fecha de importación |
| `based_on_food_id` | uuid, nulo | `references foods on delete set null`: de qué alimento es copia |
| `name` | text, no nulo | 1 a 200 caracteres, sin espacios en los extremos |
| `name_status` | text, no nulo | `original`, `machine_translated` o `reviewed` |
| `brand` | text, nulo | hasta 120 caracteres |
| `reference_basis` | text, no nulo | `100g` o `100ml` |
| `energy_kcal` | numeric(8,2), nulo | 0 a 900 |
| `protein_g`, `carbs_g`, `sugars_g`, `fat_g`, `saturated_fat_g`, `fiber_g` | numeric(8,2), nulo | 0 a 100 |
| `sodium_mg` | numeric(10,2), nulo | 0 a 40000 |
| `search_text` | text, no nulo | nombre + marca, en minúsculas y sin acentos (columna generada) |
| `completeness` | smallint, no nulo | cantidad de nutrientes informados (0 a 8), generada; sirve para ordenar |
| `client_request_id` | uuid, nulo | clave de idempotencia de la creación |
| `created_at`, `updated_at` | timestamptz | |

**Restricciones**

- `origin = 'imported'` ⇔ `user_id is null` y `source_id is not null` y `source_item_id is not null`.
- `origin = 'own'` ⇔ `user_id is not null` y `source_id is null`.
- Único `(source_id, source_item_id)` cuando es importado (idempotencia de la carga).
- Único `(user_id, client_request_id)` cuando no es nulo (FR-023).
- Coherencia: proteínas + carbohidratos + grasas ≤ 100; azúcares ≤ carbohidratos; saturadas ≤ grasas.
- Un disparador impide cambiar `origin`, `user_id`, `source_id` y `source_item_id` después de creado.

**Índices**: GIN de trigramas sobre `search_text`; `(user_id)`; `(origin)`.

**Políticas (RLS)**

| Operación | Quién | Condición |
|---|---|---|
| `select` | `authenticated` | `(user_id is null or user_id = auth.uid()) and private.is_session_fresh()` |
| `insert` | `authenticated` | `origin = 'own' and user_id = auth.uid() and private.is_session_fresh()` |
| `update` | `authenticated` | `user_id = auth.uid()` en `using` y `with check`, y sesión vigente |
| `delete` | `authenticated` | `user_id = auth.uid()` y sesión vigente |

Ninguna fila del catálogo cumple las condiciones de escritura: **el catálogo es de solo lectura** (FR-022). Permisos por columna: el cliente no puede enviar `origin`, `source_id`, `source_item_id`, `imported_at`, `search_text`, `completeness`.

## `public.food_portions`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | |
| `food_id` | uuid, no nulo | `references foods on delete cascade` |
| `user_id` | uuid, nulo | igual al del alimento (se copia por disparador); `null` en el catálogo |
| `name` | text, no nulo | 1 a 80 caracteres, por ejemplo `1 vaso` |
| `quantity` | numeric(8,2), no nulo | mayor que 0 y hasta 5000; en la base del alimento (g o ml) |
| `position` | smallint, no nulo | orden de visualización |

- Único `(food_id, name)`.
- Políticas con las mismas reglas que `foods` (lectura del catálogo y de lo propio; escritura solo de lo propio).
- Máximo 20 porciones por alimento (disparador).

## `private.import_runs` (informe de cada carga)

| Columna | Tipo |
|---|---|
| `id` | uuid, PK |
| `source_id` | uuid |
| `started_at`, `finished_at` | timestamptz |
| `created_count`, `updated_count`, `skipped_count` | integer |
| `skipped_reasons` | jsonb (motivo → cantidad, sin datos personales) |

Solo `service_role`.

## Funciones

| Función | Quién la invoca | Qué hace |
|---|---|---|
| `public.search_foods(q, scope, page_size, page_offset)` | cliente autenticado (`security invoker`, así aplica RLS) | busca y ordena por relevancia; `scope` es `all`, `catalog` u `own`; exige `q` de 2 o más caracteres |
| `public.create_food(food, portions, request_id)` | cliente | crea un alimento propio con sus porciones de forma atómica e idempotente |
| `public.update_food(id, food, portions)` | cliente | actualiza un alimento propio y reemplaza sus porciones atómicamente |
| `public.copy_food(id, request_id)` | cliente | crea la copia propia de cualquier alimento visible, con sus porciones, en una sola operación idempotente |
| `public.import_foods(source_slug, items jsonb)` | solo `service_role` | crea o actualiza alimentos del catálogo en lote, por `(fuente, identificador)`; devuelve cuentas |
| `public.finish_import(source_slug, report jsonb)` | solo `service_role` | actualiza `last_imported_at`, `food_count` y registra el informe |

## Transiciones

- **Alimento propio**: creado → editado → eliminado. Al eliminarlo, las copias que se basaban en él quedan con `based_on_food_id` nulo y conservan sus valores.
- **Alimento del catálogo**: importado → actualizado por una nueva carga. Las copias no cambian.
- **Registros históricos (spec 003)**: guardarán un *snapshot*; la referencia a `foods` será `on delete set null` (Principio II).

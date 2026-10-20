# Data Model: Catálogo de ejercicios

**Feature**: 005-catalogo-de-ejercicios | Base de datos: Postgres (Supabase)

Hereda la convención de propiedad de la spec 001 (`supabase/README.md`) con la misma excepción que la spec 002 (`research.md` de aquella spec, Decisión 5): en `exercises`, `user_id` nulo identifica filas del catálogo común. Reutiliza las extensiones `unaccent` y `pg_trgm` y la función `extensions.immutable_unaccent` de la spec 002.

## Listas cerradas

Se imponen con restricciones `check` sobre los códigos (ver `research.md`, Decisión 5).

- **Tipo de medición** (`measurement_type`): `reps_weight`, `reps_bodyweight`, `duration`, `distance_duration`.
- **Músculo** (18): `abdominals`, `abductors`, `adductors`, `biceps`, `calves`, `chest`, `forearms`, `glutes`, `hamstrings`, `lats`, `lower back`, `middle back`, `neck`, `quadriceps`, `shoulders`, `traps`, `triceps`, `full_body`.
- **Equipamiento** (12): `body only`, `barbell`, `dumbbell`, `cable`, `machine`, `e-z curl bar`, `kettlebells`, `bands`, `medicine ball`, `exercise ball`, `foam roll`, `other`.
- **Estado del texto** (`name_status`, `description_status`): `original`, `machine_translated`, `reviewed`.

## `public.exercise_sources` (fuentes del catálogo de ejercicios)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | |
| `slug` | text, único, no nulo | `free-exercise-db`, `myguide-base` |
| `name` | text, no nulo | nombre para mostrar |
| `license_name` | text, no nulo | `Unlicense` · `CC0 1.0` |
| `license_url` | text, no nulo | |
| `attribution` | text, no nulo | texto de atribución (aunque la licencia no la exija, se muestra) |
| `source_url` | text, no nulo | |
| `source_version` | text, nulo | por ejemplo el commit fijado |
| `last_imported_at` | timestamptz, nulo | |
| `exercise_count` | integer, no nulo, por defecto 0 | lo actualiza la carga |

- **Acceso**: `select` para `authenticated` con sesión vigente (pantalla de fuentes). Sin escritura desde el cliente; solo `service_role`.
- No tiene `user_id`: es información común de referencia. Se agrega a la lista de excepciones del guardián `rls_guardrail` (como `food_sources`).

## `public.exercises`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | identificador estable (lo referenciarán las sesiones de la spec 006) |
| `user_id` | uuid, nulo | `null` = catálogo importado; si no, dueño. `references auth.users on delete cascade` |
| `origin` | text, no nulo | `imported` o `own` |
| `source_id` | uuid, nulo | `references exercise_sources`; obligatorio si `origin = 'imported'` |
| `source_item_id` | text, nulo | identificador de origen (`3_4_Sit-Up`) |
| `imported_at` | timestamptz, nulo | fecha de importación |
| `based_on_exercise_id` | uuid, nulo | `references exercises on delete set null`: de qué ejercicio es copia |
| `name` | text, no nulo | 1 a 120 caracteres, sin espacios en los extremos; siempre en español |
| `name_status` | text, no nulo | estado del nombre |
| `original_name` | text, nulo | nombre en el idioma de la fuente (hasta 120 caracteres); solo ejercicios importados |
| `aliases` | text[], no nulo | sinónimos (hasta 10, cada uno de 1 a 80 caracteres, sin repetir el nombre ni entre sí). Por defecto `{}`. El límite de 10 es de la base (los importados pueden traer varios); el formulario ofrece hasta 5 «Otros nombres» |
| `measurement_type` | text, no nulo | uno de los cuatro tipos |
| `primary_muscles` | text[], no nulo | códigos de músculo; hasta 5; por defecto `{}` (= «sin dato») |
| `secondary_muscles` | text[], no nulo | códigos de músculo; hasta 8; sin repetir ninguno de los principales; por defecto `{}` |
| `equipment` | text, nulo | código de equipamiento; `null` = «sin dato» |
| `description` | text, nulo | pasos o descripción, hasta 4.000 caracteres; los pasos se separan con saltos de línea |
| `description_status` | text, nulo | estado de la descripción; nulo si y solo si no hay descripción |
| `search_text` | text, no nulo | nombre + nombre original + alias, en minúsculas y sin acentos (lo calcula un disparador) |
| `name_norm` | text, no nulo | solo el nombre, en minúsculas y sin acentos (disparador); ordena por coincidencia exacta o por prefijo |
| `client_request_id` | uuid, nulo | clave de idempotencia de la creación o la copia |
| `created_at`, `updated_at` | timestamptz | |

**Restricciones**

- `origin = 'imported'` ⇔ `user_id is null` y `source_id is not null` y `source_item_id is not null`.
- `origin = 'own'` ⇔ `user_id is not null` y `source_id is null` y `source_item_id is null`.
- Único `(source_id, source_item_id)` cuando es importado (idempotencia de la carga).
- Único `(user_id, client_request_id)` cuando no es nulo (FR-029).
- `primary_muscles` y `secondary_muscles` contenidos en la lista de músculos (`<@`) y sin elementos en común; `equipment` en su lista (o nulo).
- `original_name` nulo si `origin = 'own'`.
- Los alias cumplen su límite con la función inmutable `private.valid_aliases(text[])` (un `check` no admite subconsultas).
- Un disparador impide cambiar `origin`, `user_id`, `source_id`, `source_item_id` y `imported_at` después de creado.

**Índices**: GIN de trigramas sobre `search_text`; `name_norm` con `text_pattern_ops` (prefijos y orden por nombre); `(user_id)`; `(origin)`. Los filtros por músculo y equipamiento no necesitan índice propio a esta escala (cientos de filas); se miden en el prototipo.

**Políticas (RLS)**

| Operación | Quién | Condición |
|---|---|---|
| `select` | `authenticated` | `(user_id is null or user_id = (select auth.uid())) and (select private.is_session_fresh())` |
| `delete` | `authenticated` | `user_id = (select auth.uid()) and (select private.is_session_fresh())` |

No hay políticas de `insert` ni de `update` para el cliente: **las altas y los cambios pasan solo por las funciones** (que toman el dueño de la sesión y fijan `origin`, el estado de los textos y los campos calculados). Ninguna fila del catálogo cumple la condición de `delete`: el catálogo es de solo lectura (FR-028). La vigencia de la sesión se escribe `(select …)` para evaluarse una vez por consulta (lección de la spec 002, T071).

## `private.exercise_import_runs` (informe de cada carga)

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
| `public.search_exercises(q, scope, muscle, equipment, page_size, page_offset)` | cliente autenticado (`security invoker`, así aplica RLS) | busca, filtra y ordena por relevancia; `q` es opcional si hay un filtro |
| `public.create_exercise(exercise, request_id)` | cliente (`security definer`) | crea un ejercicio propio, atómico e idempotente |
| `public.update_exercise(id, exercise)` | cliente (`security definer`) | actualiza un ejercicio propio |
| `public.copy_exercise(id, request_id)` | cliente (`security definer`) | crea la copia propia de cualquier ejercicio visible, idempotente |
| `public.import_exercises(source_slug, items jsonb)` | solo `service_role` | crea o actualiza ejercicios del catálogo en lote, por `(fuente, identificador)`; respeta las traducciones `reviewed` |
| `public.finish_exercise_import(source_slug, report jsonb)` | solo `service_role` | actualiza `last_imported_at`, `exercise_count` y registra el informe |

Las funciones del cliente verifican `auth.uid()` y `private.is_session_fresh()` (`session_expired` si no), y tienen `search_path` vacío.

## Regla de claves foráneas hacia `exercises`

Ninguna tabla que referencie `exercises` puede usar `on delete cascade`. Las referencias futuras (las sesiones de la spec 006) deben usar `on delete set null` y guardar una copia del nombre y del tipo de medición. Lo hace cumplir una prueba guardiana (`exercises_schema.test.sql`), así eliminar un ejercicio nunca borra ni altera historial (FR-030, Principio II).

## Transiciones

- **Ejercicio propio**: creado → editado → eliminado. Al eliminarlo, las copias que se basaban en él quedan con `based_on_exercise_id` nulo y conservan sus datos.
- **Ejercicio del catálogo**: importado → actualizado por una nueva carga. Las copias no cambian; los textos marcados `reviewed` no se pisan con una traducción automática.
- **Estado de un texto**: `machine_translated` → `reviewed` (el autor lo edita en `ejercicios-es.json` y recarga). Los ejercicios propios y las copias guardan sus textos como `original` (los escribió la persona).

## Qué no se guarda

Imágenes y videos, dificultad, fuerza, mecánica, calorías por ejercicio. Ver `research.md`, Decisión 11.

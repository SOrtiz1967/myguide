# Contrato: acceso a datos del catálogo de ejercicios

**Feature**: 005-catalogo-de-ejercicios

El frontend usa `supabase-js` contra tablas y funciones protegidas por RLS. No hay Edge Functions nuevas. Todas las funciones del cliente exigen sesión vigente: sin ella devuelven `session_expired` (`42501`).

## `search_exercises`

- **Entrada**: `q text` (opcional; si viene, 2 o más caracteres tras recortar), `scope text` (`all` | `catalog` | `own`, por defecto `all`), `muscle_filter text` (código de músculo, opcional), `equipment_filter text` (código de equipamiento, opcional; el parámetro no se llama `equipment` porque la columna de salida ya usa ese nombre), `page_size int` (1 a 50, por defecto 20), `page_offset int` (≥ 0).
- **Salida**: filas con `id, name, name_status, measurement_type, primary_muscles, equipment, origin, based_on_exercise_id, source_name` (la fuente solo si es importado), más `total_estimate`.
- **Reglas**:
  - Ignora acentos y mayúsculas; coincidencias parciales de palabras; busca en el nombre, el nombre original y los alias (FR-013).
  - `muscle` coincide si está entre los músculos principales **o** secundarios; `equipment` por igualdad; los filtros se combinan con `y` entre sí, con `q` y con `scope`.
  - Orden con texto: nombre exacto, prefijo del nombre, coincidencia por alias u original, similitud; desempate estable por `id`. Sin texto: por nombre.
  - Sin `q` y sin ningún filtro no hay búsqueda.
- **Errores**: `q` corto → `query_too_short`; sin `q` ni filtros → `query_required`; `scope` inválido → `invalid_scope`; músculo o equipamiento fuera de la lista → `invalid_filter`.
- **Requisitos**: FR-001 a FR-005, FR-011 a FR-013.

## `create_exercise`

- **Entrada**: `exercise jsonb` (`name`, `measurement_type`, `aliases?`, `primary_muscles?`, `secondary_muscles?`, `equipment?`, `description?`), `request_id uuid`.
- **Efecto**: valida e inserta el ejercicio propio (`origin = 'own'`, textos `original`). Si ya existe uno del mismo dueño con ese `request_id`, devuelve el existente sin crear otro (FR-029). Devuelve el `id`.
- **Errores**: `invalid_exercise:<motivo>:<campo>` con motivo `name_required`, `name_too_long`, `measurement_required`, `invalid_measurement`, `invalid_muscle`, `too_many_muscles`, `muscle_repeated`, `invalid_equipment`, `description_too_long`, `too_many_aliases`, `alias_too_long`; y `request_required`.
- **Requisitos**: FR-022, FR-024, FR-025, FR-029.

## `update_exercise`

- **Entrada**: `id uuid`, `exercise jsonb` (los mismos campos).
- **Efecto**: actualiza un ejercicio **propio** (incluidas las copias). Sobre uno del catálogo o ajeno no afecta ninguna fila y devuelve `not_found`.
- **Requisitos**: FR-027, FR-028, FR-030.

## `copy_exercise`

- **Entrada**: `id uuid` (cualquier ejercicio visible), `request_id uuid`.
- **Efecto**: crea una copia propia con los mismos datos (los textos pasan a `original`, sin el nombre original ni la fuente) y `based_on_exercise_id = id`. Idempotente por `request_id`; copiar dos veces con distinto `request_id` crea dos copias independientes.
- **Requisitos**: FR-026.

## Acceso directo a tablas

| Tabla | `select` | `insert` / `update` | `delete` |
|---|---|---|---|
| `exercises` | catálogo común y lo propio | nunca directo: solo por las funciones | solo lo propio (con confirmación en la interfaz) |
| `exercise_sources` | todas | nadie desde el cliente | nadie |

Un ejercicio ajeno se comporta como inexistente (resultado vacío). Sin sesión vigente, nada es visible.

## Funciones exclusivas de `service_role` (carga del catálogo)

- `import_exercises(source_slug text, items jsonb)` → `{created, updated, skipped}`. Crea o actualiza **solo** filas con `origin = 'imported'`. Rechaza (`license_missing`) si la fuente no tiene licencia y atribución. Rechaza elementos que violan las restricciones y los cuenta en `skipped` con el motivo. No reemplaza `name`, `aliases` ni `description` cuya entrada guardada esté `reviewed` por una traducción `machine_translated`.
- `finish_exercise_import(source_slug text, report jsonb)` → registra el informe en `private.exercise_import_runs` y actualiza `exercise_sources.last_imported_at` y `exercise_count`.

Ninguna es ejecutable por `anon` ni `authenticated`.

## Lo que el servidor no hace

- No guarda ni registra el contenido de los ejercicios propios en ningún registro técnico (FR-040).
- No completa datos faltantes: un músculo o equipamiento ausente queda vacío.

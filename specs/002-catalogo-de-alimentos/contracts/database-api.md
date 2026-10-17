# Contrato: acceso a datos del catálogo

**Feature**: 002-catalogo-de-alimentos

El frontend usa `supabase-js` contra tablas y funciones protegidas por RLS. No hay Edge Functions nuevas.

## Funciones RPC para clientes autenticados

Todas exigen sesión vigente (`private.is_session_fresh()`); sin sesión devuelven error de permisos.

### `search_foods`

- **Entrada**: `q text` (2 o más caracteres tras recortar), `scope text` (`all` | `catalog` | `own`, por defecto `all`), `page_size int` (1 a 50, por defecto 20), `page_offset int` (≥ 0).
- **Salida**: filas con `id, name, name_status, brand, reference_basis, energy_kcal, origin, based_on_food_id, source_name` (la fuente solo si es importado), más `total_estimate`.
- **Reglas**: ignora acentos y mayúsculas; coincidencias parciales de palabras; orden: nombre exacto, prefijo del nombre, marca, similitud; a igualdad, `completeness` descendente; desempate estable por `id`.
- **Errores**: `q` corto → `query_too_short` (el cliente ya lo evita); `scope` inválido → `invalid_scope`.
- **Requisitos**: FR-001 a FR-004, FR-032, FR-033.

### `create_food`

- **Entrada**: `food jsonb` (`name`, `brand?`, `reference_basis`, nutrientes opcionales con `energy_kcal` obligatorio), `portions jsonb` (lista de `{name, quantity}`), `request_id uuid`.
- **Efecto**: valida, inserta el alimento propio y sus porciones en una sola transacción. Si ya existe un alimento del mismo dueño con ese `request_id`, devuelve el existente sin crear otro (idempotencia, FR-023).
- **Errores**: `invalid_food` con el campo y el motivo (`negative_value`, `out_of_range`, `macros_exceed_100`, `sugars_exceed_carbs`, `saturated_exceeds_fat`, `energy_required`, `name_required`, `invalid_portion`, `too_many_portions`).
- **Requisitos**: FR-015 a FR-019, FR-023.

### `update_food`

- **Entrada**: `id uuid`, `food jsonb`, `portions jsonb`.
- **Efecto**: actualiza un alimento **propio** y reemplaza sus porciones atómicamente. Sobre un alimento del catálogo o ajeno no afecta ninguna fila y devuelve `not_found`.
- **Requisitos**: FR-021, FR-022, FR-024.

### `copy_food`

- **Entrada**: `id uuid` (cualquier alimento visible), `request_id uuid`.
- **Efecto**: crea una copia propia con los mismos datos y porciones, con `based_on_food_id = id`. Idempotente por `request_id`. Copiar dos veces con distinto `request_id` crea dos copias independientes.
- **Requisitos**: FR-020.

## Acceso directo a tablas

| Tabla | `select` | `insert` / `update` / `delete` |
|---|---|---|
| `foods` | catálogo común y lo propio | solo lo propio; `delete` con confirmación en la interfaz |
| `food_portions` | las del catálogo y las propias | solo las propias (en la práctica, a través de `create_food` y `update_food`) |
| `food_sources` | todas | nadie desde el cliente |

Un alimento ajeno se comporta como inexistente (resultado vacío). Sin sesión vigente, nada es visible.

## Funciones exclusivas de `service_role` (carga del catálogo)

- `import_foods(source_slug text, items jsonb)` → `{created, updated, skipped}`. Crea o actualiza **solo** filas con `origin = 'imported'`. Rechaza (`license_missing`) si la fuente no tiene licencia y atribución. Rechaza elementos que violan las restricciones y los cuenta en `skipped` con el motivo.
- `finish_import(source_slug text, report jsonb)` → registra el informe en `private.import_runs` y actualiza `food_sources.last_imported_at` y `food_count`.

Ninguna es ejecutable por `anon` ni `authenticated`.

---

description: "Lista de tareas de la spec 002: catálogo de alimentos"
---

# Tasks: Catálogo de alimentos

**Input**: documentos de diseño en `/specs/002-catalogo-de-alimentos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (`database-api.md`, `import-pipeline.md`, `ui-routes.md`), quickstart.md. La spec 001 está integrada en `main`.

**Tests**: INCLUIDOS. Los exige la Constitution (Principio VIII) y el flujo TDD del proyecto. En cada historia, las pruebas se escriben primero y se verifica que **fallen por la razón correcta** antes de implementar (skill `test-driven-development`). Cada prueba referencia el requisito (FR-xxx) o el escenario del `quickstart.md` que verifica. Skills aplicables: `database-design` (migraciones, RLS, restricciones), `nutrition-domain-rules` (valores, unidades, faltantes, lenguaje), `frontend-design` (interfaz), `systematic-debugging` (fallos).

**Organization**: tareas agrupadas por historia de usuario. Las historias se ordenan por dependencia: la búsqueda (US1) y la creación (US2) se prueban con datos de ejemplo propios; la carga del catálogo (US5) viene después y llena el catálogo real.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US6, numeradas como en `spec.md`)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

- Frontend: `app/src/features/foods/`, pruebas en `app/tests/{unit,component,e2e}/`
- Backend: `supabase/migrations/`, `supabase/tests/` (pgTAP), `supabase/import/` (carga del catálogo, Deno)
- Documentación: `Documentacion/` y `specs/002-catalogo-de-alimentos/`
- Migraciones: prefijo `20261017` (siguen a las de la spec 001)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: prototipos de riesgo, documentación obligatoria de licencias y estructura

- [ ] T001 Prototipo del riesgo #1 (cobertura): obtener una muestra de hasta 5.000 productos de Argentina de Open Food Facts (por la API de búsqueda con `User-Agent` identificado y ritmo cortés, o por el volcado `jsonl.gz` en transmisión si la API no responde) y medir: cantidad de productos de Argentina que se pueden obtener, porcentaje con energía y macros informados, y tamaño medio de fila. Registrar en `specs/002-catalogo-de-alimentos/research.md`, sección "Resultados de prototipos", y decidir el tope de volumen
- [ ] T002 [P] Documentar las fuentes en `Documentacion/fuentes-datos.md`: Open Food Facts (ODbL 1.0, DbCL 1.0, texto de atribución, enlace a las condiciones, qué se importa y qué no —imágenes excluidas—, nota sobre *share-alike* y reutilización pública) y USDA FoodData Central (CC0 1.0, cita requerida, conjuntos usados). Entregable obligatorio antes de importar (Principio X, FR-013)
- [ ] T003 [P] Crear `supabase/import/` con su `deno.json` (importaciones `@std/csv`, `@std/assert`) y los comandos de la raíz `import:muestra`, `import:off`, `import:usda` y `test:import` en `package.json`
- [ ] T004 [P] Ampliar `.gitignore` con `supabase/import/out/` (archivos intermedios generados, potencialmente grandes) y verificar que `supabase/import/data/` sí se versiona

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: esquema, seguridad y utilidades que necesitan todas las historias

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase

### Prototipo de tamaño y velocidad

- [ ] T005 Prototipo del riesgo #2: en una base local descartable, crear una tabla con la forma de `foods` (ver `data-model.md`), cargar 50.000 filas sintéticas con nombres y marcas realistas, crear el índice GIN de trigramas y medir (a) tamaño de tabla e índice, (b) p95 del tiempo de búsqueda con consultas típicas. Registrar en `research.md`; si no cumple SC-002 (menos de 1 s) o el presupuesto de 150 MB, ajustar el índice o el tope

### Base de datos (usar la skill `database-design`)

- [ ] T006 Migración `supabase/migrations/20261017000100_foods_extensions.sql`: habilitar `unaccent` y `pg_trgm` en el esquema `extensions` y crear la función envoltorio inmutable `private.immutable_unaccent(text)` que exigen las columnas generadas y los índices
- [ ] T007 [P] Prueba pgTAP en `supabase/tests/foods_schema.test.sql` (escribir primero, debe fallar): coherencia `origin`/propiedad (`imported` ⇔ `user_id` nulo y fuente e identificador presentes; `own` ⇔ `user_id` presente y fuente nula); único `(source_id, source_item_id)`; único `(user_id, client_request_id)`; rangos (energía 0 a 900, gramos 0 a 100, sodio 0 a 40000); proteínas + carbohidratos + grasas ≤ 100; azúcares ≤ carbohidratos; saturadas ≤ grasas; nombre de 1 a 200 caracteres; base solo `100g` o `100ml`; no se pueden cambiar `origin`, `user_id`, `source_id` ni `source_item_id`; máximo 20 porciones; cantidad de porción mayor que 0 y hasta 5000; `search_text` sin acentos y en minúsculas; `completeness` cuenta los nutrientes informados; un nutriente faltante queda `null`, nunca 0
- [ ] T008 Migración `supabase/migrations/20261017000200_foods_tables.sql`: crear `public.food_sources`, `public.foods`, `public.food_portions` y `private.import_runs` con las columnas, restricciones, columnas generadas (`search_text`, `completeness`), índices y disparadores de `data-model.md`; **RLS activado sin políticas** y `revoke all` para `anon` y `authenticated`
- [ ] T009 [P] Prueba pgTAP en `supabase/tests/foods_rls.test.sql` (escribir primero, debe fallar): la cuenta B no ve, modifica ni borra los alimentos propios de A; el catálogo (`user_id` nulo) lo ve cualquier cuenta con sesión; **nadie puede insertar, modificar ni borrar filas del catálogo** (insert con `origin = 'imported'` rechazado; update y delete sin efecto); `anon` no accede; sesión vencida no ve nada; el cliente no puede enviar `origin`, `source_id`, `source_item_id`, `imported_at`, `search_text`, `completeness`; `food_portions` sigue las mismas reglas; `food_sources` es solo lectura para cuentas con sesión (FR-016, FR-022)
- [ ] T010 Migración `supabase/migrations/20261017000300_foods_rls.sql`: permisos mínimos por columna y las políticas de `foods`, `food_portions` y `food_sources` de `data-model.md` (`select` del catálogo y de lo propio; escritura solo de lo propio con sesión vigente)
- [ ] T011 [P] Prueba pgTAP en `supabase/tests/food_sources_seed.test.sql` (escribir primero, debe fallar): existen las fuentes `open-food-facts` (ODbL 1.0) y `usda-fdc` (CC0 1.0), cada una con licencia, enlace de licencia, texto de atribución y enlace de la fuente no vacíos (FR-013)
- [ ] T012 Migración `supabase/migrations/20261017000400_food_sources_seed.sql`: insertar las dos fuentes con la información documentada en T002
- [ ] T013 Actualizar `supabase/tests/rls_guardrail.test.sql`: admitir una **lista explícita de tablas de referencia de solo lectura** (por ahora `food_sources`) que no tienen `user_id`, siempre que tengan RLS, una única política `select` y ningún permiso de escritura para `anon` ni `authenticated`; toda otra tabla de `public` sigue exigiendo `user_id`. Verificar con una mutación que una tabla nueva sin `user_id` fuera de la lista falla
- [ ] T014 [P] Ayudantes de prueba en `supabase/seed.sql`: `tests.create_food(user_id, name, ...)` para alimentos propios y `tests.create_catalog_food(source_slug, source_item_id, name, ...)` para filas del catálogo (solo local)

### Utilidades del frontend (usar la skill `nutrition-domain-rules`)

- [ ] T015 [P] Pruebas unitarias en `app/tests/unit/nutrition.test.ts` (escribir primero, deben fallar): `formatValue` (valor con unidad y formato regional; `null` → "sin dato", nunca 0), `parseDecimal` (coma y punto; texto inválido → error), `energyCoherence` (esperada = 4·P + 4·C + 9·G; avisa solo si la diferencia supera el 25 % y 30 kcal; no avisa con datos insuficientes), `basisLabel` ("por 100 g" / "por 100 ml")
- [ ] T016 Implementar `app/src/features/foods/nutrition.ts` (funciones puras) para que pasen las pruebas de T015
- [ ] T017 [P] Prueba en `app/tests/component/session-ui.test.tsx` (ampliar, escribir primero, debe fallar): con sesión, la cabecera muestra el enlace "Alimentos" hacia `/alimentos`; sin sesión no
- [ ] T018 Textos en español de la spec en `app/src/copy/es.ts` (sección `foods`: pestañas, estados, etiquetas de nutrientes, procedencia, avisos, errores), enlace "Alimentos" en `app/src/components/AppShell.tsx` y rutas provisionales de `contracts/ui-routes.md` en `app/src/routes/index.tsx` (todas bajo `RequireAuth`)

**Checkpoint**: esquema y seguridad listos. Las historias pueden comenzar.

---

## Phase 3: User Story 1 - Buscar un alimento y ver sus valores (Priority: P1) 🎯 MVP

**Goal**: buscar por nombre o marca, ver resultados por tandas con filtro de origen, y abrir el detalle con valores, porciones, procedencia y faltantes como "sin dato".

**Independent Test**: escenarios 1 a 8 y 26 del `quickstart.md`, con la muestra de pruebas cargada.

### Tests for User Story 1 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T019 [P] [US1] Prueba pgTAP en `supabase/tests/search_foods.test.sql`: ignora acentos y mayúsculas ("Dulce de Leche" = "dulce de leche"); coincidencias parciales de palabras; orden por relevancia (nombre exacto, prefijo, marca, similitud) con desempate por completitud y luego por `id`; `scope` `all`, `catalog` y `own`; no devuelve alimentos propios de otras cuentas; `q` de menos de 2 caracteres → `query_too_short`; `scope` inválido → `invalid_scope`; `page_size` y `page_offset` paginan sin repetir ni saltear; sin coincidencias devuelve vacío; los nutrientes faltantes llegan `null`; incluye `source_name` solo en los importados (FR-001 a FR-004, FR-032, FR-033)
- [ ] T020 [P] [US1] Pruebas de componentes en `app/tests/component/FoodSearchPage.test.tsx`: pide 2 o más caracteres; la búsqueda espera 300 ms tras dejar de escribir; cada resultado muestra nombre, marca, base, energía y la marca "Del catálogo" o "Propio"; las pestañas Todos / Del catálogo / Mis alimentos filtran y guardan texto y pestaña en la URL (`?q=&origen=`), y se conservan al ir al detalle y volver; sin resultados muestra el estado vacío con "Crear [lo buscado]"; catálogo vacío lo informa; "Ver más" agrega sin perder lo anterior; no muestra resultados viejos mientras carga; error de red con "Reintentar" y mensaje sin conexión; anuncia la cantidad de resultados con `aria-live` (FR-009, FR-010, FR-033)
- [ ] T021 [P] [US1] Pruebas de componentes en `app/tests/component/FoodDetailPage.test.tsx`: valores con unidad y base (kcal, g, mg; "por 100 g"/"por 100 ml"); faltantes como "sin dato" y **nunca** 0; porciones separadas o "Sin porciones"; procedencia del importado (fuente, código, fecha dd/mm/aaaa), del propio y de la copia ("basado en…"); etiqueta "traducción sin revisar"; alimento inexistente o ajeno → "No encontramos este alimento"; acciones según el origen (catálogo: "Crear mi versión"; propio: Editar, Eliminar, Crear una copia) (FR-005 a FR-007, FR-011)
- [ ] T022 [P] [US1] Prueba de extremo a extremo `app/tests/e2e/foods-search.spec.ts` contra Supabase local con la muestra: escenarios 1 a 8 y 26 (búsqueda, acentos, detalle completo, faltante, procedencia, vacío, "Ver más", pestañas, y búsqueda sin servicios de terceros)

### Implementation for User Story 1

- [ ] T023 [US1] Migración `supabase/migrations/20261017000500_search_foods.sql`: función `public.search_foods(q, scope, page_size, page_offset)` con `security invoker` (aplica RLS), búsqueda con `unaccent` y `pg_trgm`, escape de comodines del texto buscado, orden por relevancia y paginación estable, según `contracts/database-api.md`
- [ ] T024 [P] [US1] Acceso a datos en `app/src/features/foods/api.ts`: `searchFoods` (RPC), `fetchFood` (alimento con porciones y fuente) y los tipos `Food`, `Portion`, `FoodSource`
- [ ] T025 [P] [US1] Hook `app/src/features/foods/useFoodSearch.ts`: texto con retardo de 300 ms, pestaña, tandas acumuladas y estados, sincronizado con la URL
- [ ] T026 [P] [US1] Componentes `app/src/features/foods/NutritionFacts.tsx` (tabla de valores con unidad, base y "sin dato") y `app/src/features/foods/FoodProvenance.tsx` (fuente, código, fecha, origen, "basado en", estado del nombre)
- [ ] T027 [US1] Pantalla `app/src/features/foods/FoodSearchPage.tsx` con campo, pestañas accesibles, lista por tandas y los cuatro estados (aplicar la skill `frontend-design`)
- [ ] T028 [US1] Pantalla `app/src/features/foods/FoodDetailPage.tsx` con valores, porciones, procedencia y acciones según el origen
- [ ] T029 [US1] Conectar `/alimentos` y `/alimentos/:id` en `app/src/routes/index.tsx` reemplazando las rutas provisionales de T018

**Checkpoint**: se puede buscar y consultar. Pasan T019 a T022.

---

## Phase 4: User Story 2 - Crear mi propio alimento (Priority: P1)

**Goal**: crear alimentos propios con nombre, marca opcional, base, nutrientes y porciones, con validación en cliente y en base de datos, idempotentes y privados.

**Independent Test**: escenarios 9 a 15 del `quickstart.md`.

### Tests for User Story 2 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T030 [P] [US2] Prueba pgTAP en `supabase/tests/create_food.test.sql`: `create_food` inserta alimento y porciones en una sola transacción; con una porción inválida no queda nada insertado; idempotente por `request_id` (el segundo envío devuelve el mismo alimento); `energy_required`; errores `negative_value`, `out_of_range`, `macros_exceed_100`, `sugars_exceed_carbs`, `saturated_exceeds_fat`, `name_required`, `invalid_portion`, `too_many_portions`; otra cuenta no lo ve; no se puede crear con `origin = 'imported'`
- [ ] T031 [P] [US2] Pruebas unitarias en `app/tests/unit/foodSchema.test.ts`: las mismas reglas que la base; decimales con coma y con punto; mensajes claros con el campo; la incoherencia energía/macros **no** bloquea; nombres con espacios en los extremos se recortan; hasta 20 porciones sin repetir nombre
- [ ] T032 [P] [US2] Pruebas de componentes en `app/tests/component/FoodForm.test.tsx`: crea con solo nombre y energía; agrega y quita porciones; errores por campo con foco en el primero; aviso informativo de incoherencia; el botón se deshabilita al enviar (doble clic = un solo envío, mismo `request_id`); fallo de red conserva lo escrito y el borrador y no muestra "guardado"; éxito lleva al detalle; precarga el nombre desde `?nombre=`; todos los campos con etiqueta y unidad (FR-015 a FR-019, FR-023, FR-031)
- [ ] T033 [P] [US2] Prueba de extremo a extremo `app/tests/e2e/foods-create.spec.ts`: escenarios 9 a 15 (alimento mínimo, con porciones, valores imposibles, incoherencia, coma decimal, privacidad entre cuentas, doble clic)

### Implementation for User Story 2

- [ ] T034 [US2] Migración `supabase/migrations/20261017000600_create_food.sql`: función `public.create_food(food, portions, request_id)` atómica e idempotente, con las validaciones y los códigos de error de `contracts/database-api.md`
- [ ] T035 [P] [US2] Esquema Zod `app/src/features/foods/schema.ts` con las mismas reglas que la base, usando `parseDecimal` de `nutrition.ts`
- [ ] T036 [P] [US2] Escritura en `app/src/features/foods/api.ts`: `createFood` con `request_id` generado por formulario y `saveRemotely` (guardado confirmado, spec 001)
- [ ] T037 [US2] Formulario `app/src/features/foods/FoodForm.tsx` y página `app/src/features/foods/FoodCreatePage.tsx` con porciones, borrador local (`useDraft`, formulario `food-new`) y aviso de coherencia
- [ ] T038 [US2] Conectar `/alimentos/nuevo` y el botón "Crear [lo buscado]" del estado vacío de la búsqueda (T027) en `app/src/routes/index.tsx`

**Checkpoint**: se puede crear y encontrar un alimento propio. Pasan T030 a T033.

---

## Phase 5: User Story 5 - Cargar y actualizar el catálogo (Priority: P1)

**Goal**: pipeline del autor que importa genéricos (USDA) y marcas (Open Food Facts) a la copia local, repetible y respetuoso con las licencias.

**Independent Test**: escenarios 22 a 24 del `quickstart.md`, más la carga de la muestra.

### Tests for User Story 5 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T039 [P] [US5] Pruebas Deno en `supabase/import/normalize.test.ts`: kJ → kcal (÷ 4,184) solo si falta la energía en kcal; sodio desde sal (× 400 mg por g) solo si falta el sodio; **dato ausente → `null`, nunca 0**; se descartan con motivo los registros con valores negativos, macros > 100 g por 100, sin nombre o sin ningún nutriente; nombre en español si existe, si no el principal; duplicados dentro de la fuente: gana el más completo; puntaje de completitud; tope de volumen priorizando los más completos; mapeo de nutrientes de USDA; estado de nombre `original` o `machine_translated` según la tabla de traducciones (FR-026, FR-028, FR-029)
- [ ] T040 [P] [US5] Pruebas Deno en `supabase/import/load.test.ts` con un cliente simulado: carga en lotes de 500; `--dry-run` valida y cuenta sin escribir; **rechaza** una fuente sin licencia ni atribución (`license_missing`); calcula y registra el informe (creados, actualizados, omitidos y motivos); un lote que falla no deja datos a medias; no imprime la clave de servicio
- [ ] T041 [P] [US5] Prueba pgTAP en `supabase/tests/import_foods.test.sql`: `import_foods` crea y actualiza **solo** filas del catálogo; repetir la carga no duplica (idempotente por fuente e identificador); no toca alimentos propios ni copias, ni siquiera con el mismo nombre; omite elementos inválidos con su motivo; rechaza fuente sin licencia; solo `service_role` puede ejecutar `import_foods` y `finish_import` (`anon` y `authenticated` reciben permiso denegado); `finish_import` actualiza `last_imported_at`, `food_count` y registra el informe; una copia propia conserva sus valores tras actualizar el original (FR-026, FR-027)
- [ ] T042 [P] [US5] Muestra de desarrollo y pruebas en `supabase/import/data/muestra.ndjson` (unos 200 alimentos: genéricos y de marca de Argentina, completos e incompletos, con faltantes, con porciones, con tildes y mayúsculas, y algunos inválidos a propósito) y las primeras traducciones en `supabase/import/data/usda-nombres-es.csv`

### Implementation for User Story 5

- [ ] T043 [US5] Migración `supabase/migrations/20261017000700_import_functions.sql`: `public.import_foods(source_slug, items)` y `public.finish_import(source_slug, report)` (`security definer`, `search_path` vacío, ejecutables solo por `service_role`), con validación por elemento y resumen de resultados
- [ ] T044 [P] [US5] Normalización pura y probada en `supabase/import/normalize.ts` según `contracts/import-pipeline.md`
- [ ] T045 [P] [US5] Extractor de USDA en `supabase/import/extract-usda.ts`: lee los CSV de Foundation Foods y SR Legacy, mapea nutrientes y porciones, y aplica la traducción de nombres
- [ ] T046 [P] [US5] Extractor de Open Food Facts en `supabase/import/extract-off.ts`: API de búsqueda filtrada a Argentina con `User-Agent` identificado, ritmo cortés, reanudable y con tope; respaldo por el volcado `jsonl.gz` en transmisión; descarta imágenes
- [ ] T047 [US5] Cargador `supabase/import/load.ts` (CLI con `--source`, `--limit`, `--dry-run`) que lee el NDJSON, normaliza, carga en lotes y cierra con `finish_import`; conectar los comandos `import:muestra`, `import:off` e `import:usda` de la raíz; exige `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del entorno del servidor
- [ ] T048 [US5] Traducción asistida de los nombres de USDA a `supabase/import/data/usda-nombres-es.csv` (SR Legacy y Foundation Foods), marcados `machine_translated`; revisar una muestra de 100 nombres y corregir los errores evidentes. Los nombres se corrigen editando el archivo y volviendo a cargar (Principio X)
- [ ] T049 [US5] Ejecutar la carga local de la muestra y de las fuentes reales dentro del tope decidido en T001/T005, revisar el informe (creados, actualizados y omitidos con motivos) y registrarlo en `research.md`

**Checkpoint**: el catálogo se puede cargar y recargar sin riesgos. Pasan T039 a T041.

---

## Phase 6: User Story 3 - Crear mi versión de un alimento del catálogo (Priority: P2)

**Goal**: copia propia editable de cualquier alimento visible, sin alterar el original.

**Independent Test**: escenarios 16 a 18 del `quickstart.md`.

### Tests for User Story 3 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T050 [P] [US3] Prueba pgTAP en `supabase/tests/copy_food.test.sql`: copiar un alimento del catálogo y uno propio, con sus porciones; la copia tiene `based_on_food_id` y es propia; idempotente por `request_id`; dos copias con distinto `request_id` son independientes; el original no cambia; otra cuenta ve el original intacto; una nueva importación que cambia el original no altera la copia; eliminar el original deja `based_on_food_id` nulo y la copia con sus valores; no se puede copiar un alimento ajeno (FR-020, FR-024, FR-027)
- [ ] T051 [P] [US3] Pruebas de componentes en `app/tests/component/FoodCopy.test.tsx`: "Crear mi versión" crea la copia y lleva a su edición; muestra "basado en [original]" con enlace; en la búsqueda se distinguen el original y la copia; sin conexión no se da por creada
- [ ] T052 [P] [US3] Prueba de extremo a extremo `app/tests/e2e/foods-copy.spec.ts`: escenarios 16 a 18 (copia, edición sin tocar el original, y repetir la carga sin afectar la copia)

### Implementation for User Story 3

- [ ] T053 [US3] Migración `supabase/migrations/20261017000800_copy_food.sql`: función `public.copy_food(id, request_id)` atómica e idempotente
- [ ] T054 [US3] `copyFood` en `app/src/features/foods/api.ts` y botones "Crear mi versión" / "Crear una copia" en `FoodDetailPage.tsx`

**Checkpoint**: se puede corregir un dato del catálogo sin tocarlo. Pasan T050 a T052.

---

## Phase 7: User Story 4 - Editar y eliminar mis alimentos (Priority: P2)

**Goal**: editar y eliminar alimentos propios y copias, con confirmación y sin alterar el pasado.

**Independent Test**: escenarios 19 a 21 del `quickstart.md`.

### Tests for User Story 4 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T055 [P] [US4] Prueba pgTAP en `supabase/tests/update_delete_food.test.sql`: `update_food` reemplaza porciones atómicamente; sobre un alimento del catálogo o ajeno devuelve `not_found` y no cambia nada; valida igual que al crear; eliminar un alimento propio elimina sus porciones; las copias que se basaban en él conservan sus valores; el catálogo no se puede eliminar (FR-021, FR-022, FR-024)
- [ ] T056 [P] [US4] Pruebas de componentes en `app/tests/component/FoodEdit.test.tsx`: el formulario de edición viene cargado; guarda y confirma; eliminar pide confirmación accesible (foco, Escape cancela) y recién entonces elimina; el catálogo no ofrece Editar ni Eliminar; fallo de red conserva el borrador y no da por guardado; valores inválidos se rechazan igual que al crear
- [ ] T057 [P] [US4] Prueba de extremo a extremo `app/tests/e2e/foods-edit.spec.ts`: escenarios 19 a 21 (editar, eliminar, catálogo de solo lectura, corte de red)

### Implementation for User Story 4

- [ ] T058 [US4] Migración `supabase/migrations/20261017000900_update_food.sql`: función `public.update_food(id, food, portions)` atómica
- [ ] T059 [P] [US4] Componente accesible `app/src/components/ConfirmDialog.tsx` (rol de diálogo, foco atrapado, Escape, devolución del foco)
- [ ] T060 [US4] Página `app/src/features/foods/FoodEditPage.tsx` reutilizando `FoodForm`, con borrador (`food-edit-<id>`) y `updateFood` en `api.ts`; conectar `/alimentos/:id/editar`
- [ ] T061 [US4] Eliminar con confirmación en `FoodDetailPage.tsx` (`deleteFood` en `api.ts`) y volver a la búsqueda

**Checkpoint**: el ciclo de vida de los alimentos propios está completo. Pasan T055 a T057.

---

## Phase 8: User Story 6 - Ver las fuentes y sus licencias (Priority: P3)

**Goal**: pantalla de fuentes con licencia, atribución, fecha y cantidad.

**Independent Test**: escenario 25 del `quickstart.md`.

### Tests for User Story 6 ⚠️ (escribir primero y verificar que FALLAN)

- [ ] T062 [P] [US6] Pruebas de componentes en `app/tests/component/SourcesPage.test.tsx`: lista cada fuente con nombre, licencia (enlazada), texto de atribución, fecha de la última importación (dd/mm/aaaa) y cantidad de alimentos; fuente sin importar → "Todavía no se importó"; estado vacío, carga y error con "Reintentar"; desde la procedencia de un alimento se llega a su fuente (FR-012)
- [ ] T063 [P] [US6] Prueba de extremo a extremo `app/tests/e2e/foods-sources.spec.ts`: escenario 25

### Implementation for User Story 6

- [ ] T064 [US6] Pantalla `app/src/features/foods/SourcesPage.tsx`, `fetchSources` en `api.ts`, enlace desde `FoodProvenance.tsx` y ruta `/fuentes`

**Checkpoint**: todas las historias funcionan. Pasan T062 y T063.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: calidad transversal, medición y cierre

- [ ] T065 [P] Accesibilidad en `app/tests/e2e/a11y-foods.spec.ts`: axe en `/alimentos`, el detalle, el formulario, la edición y `/fuentes`; recorrido por teclado de las pestañas (flechas), la lista y el diálogo de confirmación (FR-030)
- [ ] T066 [P] Pruebas de ancho de teléfono y de escritorio de las pantallas nuevas en `app/tests/e2e/responsive-foods.spec.ts`: sin desplazamiento horizontal y botones de 44 px o más (SC-010)
- [ ] T067 Medición de rendimiento con el catálogo cargado (T049) o 50.000 alimentos sintéticos: p95 de `search_foods` menor a 1 s (SC-002) y tamaño de tablas e índices dentro de los 150 MB; registrar en `research.md`
- [ ] T068 [P] Documentación: `supabase/README.md` (tablas, funciones, carga del catálogo y de qué fuente sale cada dato), `README.md` (estado y comandos `import:*` y `test:import`) y `Documentacion/roadmap-specs.md`
- [ ] T069 Ejecutar los 27 escenarios del `quickstart.md` y registrar el resultado en `specs/002-catalogo-de-alimentos/verification.md`
- [ ] T070 Revisión de seguridad dirigida de todo el cambio, registrada en `verification.md`: intentos de escribir en el catálogo, funciones de carga solo para `service_role`, escape de comodines en la búsqueda, endurecimiento del cargador frente a datos externos malformados (JSON, CSV, tamaños, URL), y que la clave de servicio no aparezca en el bundle (`check:secrets`); corregir hallazgos con TDD
- [ ] T071 Ejecutar `npm run format:check`, `lint`, `typecheck`, `test`, `e2e` (por partes si la memoria no alcanza), `test:db`, `test:functions`, `test:import`, `test:config` y `check:secrets`; todo en verde antes de dar la spec por terminada
- [ ] T072 Actualizar la Constitution a la versión 1.2.1 (PATCH): registrar en "Decisiones ya tomadas" las fuentes del catálogo de alimentos y su licencia, y en la lista de pendientes dejar la #4 solo para ejercicios; agregar la fila al historial de versiones
- [ ] T073 Carga en producción (requiere acción del autor): ejecutar `import:usda` e `import:off` contra el proyecto de Supabase de producción con la clave de servicio, revisar el informe y comprobar que la atribución de Open Food Facts se ve en `/fuentes`
- [ ] T074 Antes de abrir la aplicación a otras personas (requiere acción del autor): revisar con asesoramiento legal la obligación de compartir bajo la misma licencia (ODbL) y anotar la conclusión en `Documentacion/fuentes-datos.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 (cobertura) condiciona el tope de volumen de T049
- **Foundational (Phase 2)**: depende de Setup. **Bloquea todas las historias**. T005 (tamaño y velocidad) condiciona el índice de T008 y el tope de T049
- **User Stories (Phase 3 a 8)**: dependen de Foundational
- **Polish (Phase 9)**: depende de las historias deseadas

### User Story Dependencies

- **US1 (P1)**: después de Foundational. Se prueba con alimentos de prueba creados por los ayudantes de T014
- **US2 (P1)**: después de Foundational; independiente de US1 salvo el botón "Crear [lo buscado]" (T038), que conecta con la búsqueda
- **US5 (P1)**: después de Foundational (necesita las tablas y las fuentes sembradas). Independiente de US1 y US2; llena el catálogo real
- **US3 (P2)**: después de US1 (detalle) y US2 (formulario); reutiliza ambos
- **US4 (P2)**: después de US2 (formulario) y US1 (detalle)
- **US6 (P3)**: después de US1 (procedencia) y de T012 (fuentes sembradas)

### Within Each User Story

- Las pruebas se escriben primero y deben **fallar** antes de implementar
- Migraciones antes del código que las usa
- Acceso a datos y esquemas antes de pantallas
- Historia completa antes de pasar a la siguiente prioridad

### Parallel Opportunities

- Setup: T002, T003, T004
- Foundational: T007, T009, T011, T014, T015 y T017 (pruebas) son paralelas entre sí
- Dentro de cada historia: todas las pruebas marcadas [P]; `api.ts`, hooks y componentes de US1 (T024 a T026)
- US5 puede avanzar en paralelo con US1 y US2 (equipos o sesiones distintas)

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (deben fallar):
Task: "Prueba pgTAP de búsqueda en supabase/tests/search_foods.test.sql"
Task: "Pruebas de FoodSearchPage en app/tests/component/FoodSearchPage.test.tsx"
Task: "Pruebas de FoodDetailPage en app/tests/component/FoodDetailPage.test.tsx"

# Piezas independientes de US1:
Task: "api.ts de búsqueda y detalle"
Task: "Hook useFoodSearch"
Task: "NutritionFacts y FoodProvenance"
```

---

## Implementation Strategy

### MVP primero (US1 + US2 + US5)

1. Setup y Foundational, **empezando por los prototipos T001 y T005**
2. US1: buscar y consultar
3. US2: crear alimentos propios
4. US5: cargar el catálogo real
5. **DETENERSE Y VALIDAR**: escenarios 1 a 15 y 22 a 27 del `quickstart.md`. Ya se puede buscar en un catálogo real y crear lo que falte; es lo mínimo que necesita la spec 003

### Entrega incremental

1. Foundational → base lista
2. US1 → US2 → US5 (MVP)
3. US3 → corregir datos del catálogo
4. US4 → ciclo de vida completo de lo propio
5. US6 → transparencia de fuentes
6. Polish → seguridad, accesibilidad, rendimiento, producción

### Si un prototipo falla

- T001 con poca cobertura de Argentina → documentar el resultado y reforzar los alimentos propios; evaluar sumar otras fuentes con licencia verificada (por ejemplo, ARGENFOODS si se obtiene permiso) como carga adicional
- T005 con búsqueda lenta o índice demasiado grande → bajar el tope de volumen, restringir columnas indexadas o cambiar a prefijos; ajustar SC-002 solo con la aprobación del autor
- API de Open Food Facts caída → usar el volcado en transmisión (T046)

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- La etiqueta [Story] vincula cada tarea con su historia
- Verificar que las pruebas fallen antes de implementar
- Confirmar los cambios (commit) por tarea o grupo lógico
- El catálogo es de solo lectura para las personas: cualquier cambio de datos del catálogo pasa por el pipeline de carga, nunca por la aplicación
- Los registros no contienen datos personales (Principio IX)

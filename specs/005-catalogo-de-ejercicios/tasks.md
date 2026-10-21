---

description: "Lista de tareas de la spec 005: catálogo de ejercicios"
---

# Tasks: Catálogo de ejercicios

**Input**: documentos de diseño en `/specs/005-catalogo-de-ejercicios/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (`database-api.md`, `import-pipeline.md`, `ui-routes.md`), quickstart.md. Las specs 001 a 004 están en la rama base (la 004 sale de la 003; esta rama sale de la 004).

**Tests**: INCLUIDOS. Los exige la Constitution (Principio VIII) y el flujo TDD del proyecto. En cada historia, las pruebas se escriben primero y se verifica que **fallen por la razón correcta** antes de implementar (skill `test-driven-development`). Cada prueba referencia el requisito (FR-xxx) o el escenario del `quickstart.md` que verifica. Skills: `database-design` (migraciones, RLS, funciones), `nutrition-domain-rules` (listas cerradas, datos faltantes), `frontend-design` (interfaz), `systematic-debugging` (fallos).

**Organization**: tareas agrupadas por historia de usuario, numeradas como en `spec.md` (US1 a US6) y ordenadas por prioridad: US1, US2 y US5 (P1), US3 y US4 (P2), US6 (P3). Las pruebas pgTAP del catálogo empiezan con `delete from public.exercises` dentro de su transacción (la base local tiene el catálogo cargado; lección de las specs 002 y 003) y, si cuentan filas, filtran por los usuarios de la prueba.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US6)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

- Frontend: `app/src/features/exercises/`, pruebas en `app/tests/{unit,component,e2e}/`
- Backend: `supabase/migrations/` (prefijo `20261021`), `supabase/tests/` (pgTAP)
- Carga del catálogo: `supabase/import/` (Deno), datos en `supabase/import/data/`
- Documentación: `Documentacion/`, `supabase/README.md` y `specs/005-catalogo-de-ejercicios/`

## Decisiones de implementación que las tareas dan por fijadas

- Códigos y listas: tipo de medición `reps_weight`, `reps_bodyweight`, `duration`, `distance_duration`; 18 músculos y 12 equipamientos con los códigos de `research.md` (Decisión 5).
- Migraciones, en este orden: `20261021000100_exercise_tables.sql`, `…000200_exercise_rls.sql`, `…000300_exercise_sources_seed.sql`, `…000400_search_exercises.sql`, `…000500_create_exercise.sql`, `…000600_import_exercises.sql`, `…000700_copy_exercise.sql`, `…000800_update_exercise.sql`.
- La copia de free-exercise-db (commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`, SHA-256 `5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf`) **se versiona en el repositorio** (`supabase/import/data/fuentes/free-exercise-db/`, con su `LICENSE.md`; la Unlicense lo permite): las pruebas y la carga no necesitan red y la carga verifica el SHA-256. Esto ajusta `contracts/import-pipeline.md`.
- Los pasos de la descripción se guardan como texto con un paso por línea, numerados («1. …»); la interfaz los muestra como lista.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: la fuente fijada, la documentación de licencias exigida por el Principio X y los datos de muestra

- [X] T001 [P] Copia fijada de la fuente. Prueba primero en `supabase/import/source_pin.test.ts` (debe fallar): el archivo `supabase/import/data/fuentes/free-exercise-db/exercises.json` existe, su SHA-256 es el de arriba, tiene 876 ejercicios y cada uno tiene `id`, `name`, `category`, `primaryMuscles`, `secondaryMuscles`, `equipment` (puede ser nulo) e `instructions`. Después, copiar el archivo desde el repositorio de origen en ese commit, junto con `LICENSE.md` (Unlicense) y un `README.md` que anote la procedencia, el commit, el SHA-256 y que **no se importan las imágenes**
- [X] T002 [P] Documentación de licencias, antes de importar nada (Principio X, FR-019): agregar a `Documentacion/fuentes-datos.md` la sección «Ejercicios» con, para `free-exercise-db` y `myguide-base`, la licencia, la versión fijada, las obligaciones (ninguna), la atribución que se muestra y el riesgo de procedencia de los pasos; y crear `Documentacion/issues-autor/08-ejercicios-licencias.md` con las tareas del autor: (1) aceptar o revisar el riesgo de procedencia de los pasos de free-exercise-db antes de abrir la aplicación a terceros, (2) confirmar la dedicación CC0 de `myguide-base`, (3) revisar las traducciones y las excepciones de medición que se marcan como dudosas
- [X] T003 [P] Muestra de desarrollo en `supabase/import/data/ejercicios-muestra.ndjson` (≈ 30 ejercicios en el formato de `contracts/import-pipeline.md`): cubre los cuatro tipos de medición, un ejercicio sin equipamiento, uno sin descripción, uno con traducción `reviewed`, alias, un nombre original distinto del español y las dos fuentes. Prueba primero en `supabase/import/muestra.test.ts` (debe fallar): cada línea es JSON válido con los campos de la tabla y valores dentro de las listas cerradas

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tablas, seguridad, listas cerradas y utilidades que necesitan todas las historias

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase

### Base de datos (skill `database-design`)

- [X] T004 Prueba pgTAP en `supabase/tests/exercises_schema.test.sql` (escribir primero, debe fallar). Debe cubrir `data-model.md`:
  - columnas y tipos; `measurement_type` solo `reps_weight`, `reps_bodyweight`, `duration` o `distance_duration`; `name_status` y `description_status` solo `original`, `machine_translated` o `reviewed`;
  - `primary_muscles`, `secondary_muscles` y `equipment` solo con los códigos de las listas cerradas (cada código se acepta y uno inventado se rechaza); principales y secundarios sin elementos en común; hasta 5 principales y 10 secundarios;
  - `origin = 'imported'` ⇔ `user_id` nulo y fuente e identificador presentes; `origin = 'own'` ⇔ `user_id` presente y sin fuente; `original_name` nulo en lo propio;
  - nombre de 1 a 120 caracteres y sin espacios en los extremos; descripción de hasta 4.000 caracteres; `description_status` nulo si y solo si no hay descripción;
  - hasta 10 alias de 1 a 80 caracteres (`private.valid_aliases`);
  - único `(source_id, source_item_id)` y único `(user_id, client_request_id)`;
  - el disparador fija `search_text` (nombre + nombre original + alias, sin acentos y en minúsculas) y `name_norm`, y también al actualizar;
  - no se pueden cambiar `origin`, `user_id`, `source_id`, `source_item_id` ni `imported_at`;
  - `based_on_exercise_id` usa `on delete set null`: eliminar el ejercicio original deja la copia intacta;
  - **guardián de claves foráneas**: ninguna clave foránea hacia `exercises` es `on delete cascade` (FR-030);
  - eliminar la cuenta borra sus ejercicios propios y deja intactos el catálogo y los de otra cuenta (FR-041).
- [X] T005 Migración `supabase/migrations/20261021000100_exercise_tables.sql`: `public.exercise_sources`, `public.exercises` y `private.exercise_import_runs` con las columnas, restricciones, índices (GIN de trigramas sobre `search_text`, `name_norm` con `text_pattern_ops`, `(user_id)`, `(origin)`) y los disparadores de `data-model.md` (campos de búsqueda con `extensions.immutable_unaccent`, inmutabilidad, `updated_at`); **RLS activado sin políticas** y `revoke all` para `anon` y `authenticated`
- [X] T006 [P] Ampliar `supabase/tests/rls_guardrail.test.sql` (escribir primero, debe fallar mientras la tabla no exista): agregar `exercise_sources` a `reference_tables` (solo lectura, una única política `SELECT`, sin permisos de escritura para el cliente). La tabla `exercises` debe seguir cumpliendo el guardián general (RLS, `user_id`, vigencia de sesión evaluada una vez por consulta)
- [X] T007 [P] Prueba pgTAP en `supabase/tests/exercises_rls.test.sql` (escribir primero, debe fallar). Debe cubrir:
  - la cuenta B no ve, modifica ni borra los ejercicios propios de A; ambas ven el catálogo;
  - el cliente **no puede insertar ni actualizar** `exercises` directamente; sí puede borrar lo propio y no puede borrar el catálogo (FR-028);
  - con la sesión vencida no se ve nada, ni el catálogo; `anon` no accede (FR-039);
  - `exercise_sources` se lee con sesión vigente y no se escribe desde el cliente.
- [X] T008 Migración `supabase/migrations/20261021000200_exercise_rls.sql`: permisos mínimos y políticas de lectura de `exercises` (catálogo y lo propio) y de borrado de lo propio, y de lectura de `exercise_sources`, todo con `(select auth.uid())` y `(select private.is_session_fresh())`
- [X] T009 [P] Prueba pgTAP en `supabase/tests/exercise_sources_seed.test.sql` (escribir primero, debe fallar): existen las fuentes `free-exercise-db` (Unlicense) y `myguide-base` (CC0 1.0), cada una con licencia, dirección de la licencia, atribución y dirección de la fuente no vacías (FR-019)
- [X] T010 Migración `supabase/migrations/20261021000300_exercise_sources_seed.sql`: inserta las dos fuentes con los datos documentados en T002
- [X] T011 [P] Ayudantes de prueba en `supabase/seed.sql` (solo local): `tests.create_exercise(user_id, name, measurement_type, primary_muscles, equipment, description)` y `tests.create_catalog_exercise(source_slug, item_id, name, measurement_type, …)` (con nombre original, alias, músculos, equipamiento, descripción y estados opcionales). Comprobar que `rls_guardrail.test.sql` y las pruebas de rendimiento de políticas siguen en verde

### Listas cerradas y utilidades del frontend (skill `nutrition-domain-rules`)

- [X] T012 [P] Pruebas unitarias en `app/tests/unit/exerciseLists.test.ts` (escribir primero, deben fallar):
  - los 4 tipos de medición, los 18 músculos y los 12 equipamientos con su nombre en español de `research.md` Decisión 5, sin códigos repetidos ni nombres vacíos;
  - **coinciden con la base**: la prueba lee `supabase/migrations/20261021000100_exercise_tables.sql` (si se renombra, el mensaje de error dice qué archivo buscar) y comprueba que cada código aparece en las restricciones y que no hay códigos de más.
- [X] T013 Implementar `app/src/features/exercises/exerciseLists.ts` (constantes tipadas, `muscleLabel`, `equipmentLabel`, `measurementLabel`) para que pasen las pruebas de T012
- [X] T014 [P] Pruebas unitarias en `app/tests/unit/exerciseText.test.ts` (escribir primero, deben fallar): explicación en palabras de cada tipo de medición («Se registra con repeticiones y peso», …); «sin dato» para nulos y listas vacías; «También se conoce como» sin repetidos y sin el nombre mostrado; la descripción: **si todas las líneas no vacías empiezan con «N. » (número y punto), se muestra como lista numerada de pasos; si no, como texto libre con sus saltos de línea** (un ejercicio propio puede tener cualquiera de los dos), sin renumerar dos veces; la línea de procedencia («Del catálogo · fuente · código · importado el dd/mm/aaaa», «Propio», «Propio, basado en …»); etiquetas de traducción («traducción sin revisar» solo para `machine_translated`)
- [X] T015 Implementar `app/src/features/exercises/exerciseText.ts` para que pasen las pruebas de T014
- [X] T016 [P] Ampliar `app/tests/component/session-ui.test.tsx` (escribir primero, debe fallar): con sesión, la cabecera muestra el enlace «Ejercicios» hacia `/ejercicios`, después de «Alimentos»; sin sesión no
- [X] T017 Textos en español de la spec en `app/src/copy/es.ts` (clave `exercises`: pestañas, filtros, estados, formulario, mensajes de validación, procedencia, fuentes), el enlace «Ejercicios» en `app/src/components/AppShell.tsx` y las rutas provisionales de `contracts/ui-routes.md` en `app/src/routes/index.tsx` (bajo `RequireAuth`)
- [X] T018 [P] Generalizar `app/src/features/foods/OriginTabs.tsx` para que reciba las etiquetas de las pestañas (hoy usa los textos de alimentos) y mover `RESULTS_PANEL_ID`/`tabId` a un lugar común; crear primero `app/tests/component/OriginTabs.test.tsx` (debe fallar) con unas pestañas de etiquetas propias: roles, estado, flechas, Inicio y Fin. La búsqueda de alimentos sigue igual

**Checkpoint**: esquema, seguridad, fuentes, listas cerradas y utilidades listos.

---

## Phase 3: User Story 1 - Buscar un ejercicio y ver su detalle (Priority: P1) 🎯 MVP

**Goal**: buscar por nombre, nombre original o sinónimo, filtrar por músculo y equipamiento, y ver el detalle con su procedencia y sus faltantes.

**Independent Test**: con ejercicios de catálogo sembrados, buscar «sentadilla», «squat» y un sinónimo, filtrar por músculo y equipamiento, y abrir un ejercicio completo y uno con faltantes.

### Tests for User Story 1 ⚠️ (escribir primero y verificar que FALLAN)

- [X] T019 [P] [US1] Prueba pgTAP en `supabase/tests/search_exercises.test.sql`. Debe cubrir (`contracts/database-api.md`; FR-001 a FR-005, FR-011 a FR-013):
  - ignora acentos y mayúsculas; coincide con palabras parciales;
  - encuentra por nombre en español, por nombre original y por alias; el resultado muestra siempre el nombre en español; un alias que coincide con el nombre de **otro** ejercicio no los fusiona (aparecen los dos);
  - orden: nombre exacto, prefijo del nombre, coincidencia por alias u original, similitud; desempate estable; sin texto, por nombre;
  - `scope`: `all`, `catalog` y `own`; lo propio de otra cuenta nunca aparece;
  - `muscle` coincide por músculo principal **o** secundario; `equipment` por igualdad; se combinan entre sí, con el texto y con `scope`;
  - paginación por tandas con `total_estimate`;
  - errores: `query_too_short`, `query_required` (sin texto ni filtros), `invalid_scope`, `invalid_filter`;
  - sesión vencida: `session_expired`/sin resultados.
- [X] T020 [P] [US1] Pruebas unitarias en `app/tests/unit/exercisesApi.test.ts`: `searchExercises` envía `q`, `scope`, `muscle`, `equipment`, `page_size` y `page_offset` a `search_exercises` y omite los vacíos; `fetchExercise` consulta por `id` y devuelve `null` si no existe o es ajeno; los errores `query_too_short`, `invalid_filter` y `session_expired` se traducen a mensajes sin mostrar el texto del servidor
- [X] T021 [P] [US1] Pruebas de componente en `app/tests/component/ExerciseSearchPage.test.tsx` (escenarios 1, 2, 7 a 14):
  - estados: «Buscando…» sin parpadeo de resultados viejos, lista, «Ver más» sin perder los anteriores, catálogo vacío, sin resultados con botón «Crear [lo buscado]» hacia `/ejercicios/nuevo?nombre=`, sin resultados **con filtros** (dice cuáles están activos y permite quitarlos, sin botón de crear), fallo de red con «Reintentar» y mensaje sin conexión;
  - menos de 2 caracteres sin filtros muestra la indicación y no busca; con un filtro y sin texto sí busca;
  - pestañas Todos / Del catálogo / Mis ejercicios; el texto, la pestaña y los filtros viven en la URL (`?q=&origen=&musculo=&equipo=`) y sobreviven a ir al detalle y volver;
  - cada resultado muestra nombre (recortado), tipo de medición en palabras, músculo principal y equipamiento o «sin dato», y la marca «Del catálogo» o «Propio»;
  - filtros: dos listas nativas, etiqueta con «Quitar» por filtro activo, cantidad anunciada («N resultados») sin mover el foco.
- [X] T022 [P] [US1] Pruebas de componente en `app/tests/component/ExerciseDetailPage.test.tsx` (escenarios 3 a 6): ejercicio completo (nombre, «También se conoce como», tipo explicado, músculos principales y secundarios, equipamiento, pasos numerados); faltantes como «sin dato» (equipamiento ausente ≠ «Peso corporal»); procedencia con fuente, código y fecha y enlace a `/fuentes`; «traducción sin revisar» solo en lo que corresponde (nombre y descripción por separado); acciones según el origen (del catálogo → «Crear mi versión»; propio → «Editar», «Eliminar», «Crear una copia»); ejercicio inexistente o ajeno → «No encontramos este ejercicio»; fallo con «Reintentar»
- [X] T023 [US1] Prueba e2e en `app/tests/e2e/exercises-search.spec.ts` (escenarios 1 a 14, con ejercicios de catálogo sembrados por SQL con `tests.create_catalog_exercise`): búsqueda sin acentos, detalle completo y con faltantes, procedencia, traducción sin revisar, sin resultados y «Crear», mínimo de caracteres, «Ver más», pestañas con detalle y vuelta, filtros por músculo y equipamiento solos y combinados con texto, filtros sin resultados, búsqueda por nombre original y por sinónimo. Agregar a `app/tests/e2e/support.ts` los ayudantes `seedCatalogExercises` y `clearSeededExercises` (los ejercicios de las pruebas llevan «e2e» en el nombre)

### Implementation for User Story 1

- [X] T024 [US1] Migración `supabase/migrations/20261021000400_search_exercises.sql`: `public.search_exercises(q, scope, muscle, equipment, page_size, page_offset)` `security invoker` (aplica RLS), con la relevancia, los filtros y los errores de `contracts/database-api.md`. Hace pasar T019
- [X] T025 [P] [US1] `app/src/features/exercises/api.ts` (`searchExercises`, `fetchExercise`, tipos `Exercise` y `ExerciseSearchRow`) y `useExerciseSearch.ts` (búsqueda con retardo, pestañas, filtros, tandas y estado en la URL). Hace pasar T020
- [X] T026 [US1] `app/src/features/exercises/ExerciseFilters.tsx` (listas «Todos los músculos» y «Todo el equipamiento», etiquetas que se quitan) y `ExerciseSearchPage.tsx` con los estados de `contracts/ui-routes.md`, reutilizando `OriginTabs` (T018); ruta `/ejercicios`. Hace pasar T021
- [X] T027 [US1] `app/src/features/exercises/useExercise.ts` y `ExerciseDetailPage.tsx` (datos, procedencia con enlace a las fuentes, acciones según el origen, estados de carga y error); ruta `/ejercicios/:id`. Hace pasar T022; el e2e de T023 queda en verde

**Checkpoint**: se puede buscar, filtrar y ver cualquier ejercicio. Escenarios 1 a 14.

---

## Phase 4: User Story 2 - Crear mi propio ejercicio (Priority: P1)

**Goal**: crear un ejercicio propio con nombre y tipo de medición obligatorios y datos opcionales; privado, idempotente y con borrador.

**Independent Test**: crear un ejercicio con solo lo obligatorio y otro completo; buscarlos como «Propio»; comprobar que otra cuenta no los ve.

### Tests for User Story 2 ⚠️

- [X] T028 [P] [US2] Prueba pgTAP en `supabase/tests/create_exercise.test.sql` (FR-022 a FR-025, FR-029, FR-040): crea con solo nombre y tipo; crea completo (músculos, equipamiento, descripción, alias); `origin = 'own'`, dueño de la sesión y textos `original`; idempotente por `request_id` (un reintento tardío no duplica); cada error de `contracts/database-api.md` (`name_required`, `name_too_long`, `measurement_required`, `invalid_measurement`, `invalid_muscle`, `too_many_muscles`, `muscle_repeated`, `invalid_equipment`, `description_too_long`, `too_many_aliases`, `alias_too_long`, `request_required`); espacios recortados; sin sesión vigente `session_expired`; `anon` sin permiso; la cuenta B no ve lo de A
- [X] T029 [P] [US2] Pruebas unitarias en `app/tests/unit/exerciseSchema.test.ts` (las mismas reglas que la base): nombre obligatorio y recortado, tipo obligatorio, límites de músculos, de descripción y de alias, músculos repetidos entre principales y secundarios, «Otros nombres» separados por línea o coma, conversión al formato de `create_exercise`
- [X] T030 [P] [US2] Pruebas de componente en `app/tests/component/ExerciseForm.test.tsx` (escenarios 15 a 21): enviar solo lo obligatorio; enviar completo; errores por campo con foco en el primero; el tipo de medición como botones de radio con su explicación; músculos en `fieldset` con leyenda; **aviso «Ya tienes un ejercicio con ese nombre»** que no impide guardar (se compara el nombre escrito con los propios devueltos por `searchExercises` con `scope=own`, ignorando acentos y mayúsculas, y no avisa al editar un ejercicio contra sí mismo); doble clic envía una sola solicitud; fallo de red o de servidor: «No se guardó», lo escrito se conserva y el reintento reutiliza el `request_id`; sesión vencida: se conserva el borrador; borrador local que vuelve al reabrir y se borra al guardar; `?nombre=` precarga el nombre
- [X] T031 [US2] Prueba e2e en `app/tests/e2e/exercises-create.spec.ts` (escenarios 15 a 22, por la API real): crear con lo obligatorio, crear completo y buscarlo por nombre y por «otro nombre», valores inválidos sin guardar nada, nombre repetido con aviso, doble clic = una fila (`dbQuery`), red cortada, borrador tras recargar, y otra cuenta que no ve el ejercicio

### Implementation for User Story 2

- [X] T032 [US2] Migración `supabase/migrations/20261021000500_create_exercise.sql`: `public.create_exercise(exercise jsonb, request_id uuid)` `security definer` (`search_path` vacío, `auth.uid()`, `private.is_session_fresh()`), idempotente, con las validaciones y errores del contrato; `revoke` a `public`/`anon` y `grant execute` a `authenticated`. Hace pasar T028
- [X] T033 [P] [US2] `app/src/features/exercises/schema.ts` (Zod) y `createExercise` en `api.ts` con `saveRemotely` y `newRequestId`. Hace pasar T029
- [X] T034 [US2] `app/src/features/exercises/ExerciseForm.tsx` (alta y edición: nombre, tipo, músculos, equipamiento, descripción, «Otros nombres»), `ExerciseCreatePage.tsx` y la ruta `/ejercicios/nuevo`, con borrador (`useDraft`) y la comprobación del nombre repetido entre los propios (consulta con `scope=own` y comparación en el cliente, como describe T030). Hace pasar T030; el e2e de T031 queda en verde

**Checkpoint**: se pueden crear ejercicios propios y encontrarlos. Escenarios 15 a 22. US1 y US2 juntas ya son un catálogo usable.

---

## Phase 5: User Story 5 - Cargar y actualizar el catálogo (Priority: P1)

**Goal**: el autor carga free-exercise-db y `myguide-base` con nombre en español, tipo de medición y procedencia; la carga es repetible y respeta propios, copias y traducciones revisadas.

**Independent Test**: ejecutar la carga con la muestra, repetirla (0 duplicados), cambiar un dato de la fuente, y comprobar que propios, copias y traducciones `reviewed` no cambian.

### Tests for User Story 5 ⚠️

- [X] T035 [P] [US5] Prueba pgTAP en `supabase/tests/import_exercises.test.sql` (FR-019, FR-031 a FR-035, SC-009): `import_exercises` crea y actualiza solo filas `imported`; idempotente por `(fuente, source_item_id)`; rechaza con `license_missing` una fuente sin licencia o atribución; rechaza elementos inválidos y los cuenta en `skipped` con motivo; **no reemplaza** nombre, alias ni descripción de una fila `reviewed` por una `machine_translated` (y sí por otra `reviewed`); no toca ejercicios propios ni copias; solo `service_role` puede ejecutarla (ni `anon` ni `authenticated`); `finish_exercise_import` actualiza `last_imported_at`, `exercise_count` y el informe sin datos personales
- [X] T036 [P] [US5] Pruebas Deno en `supabase/import/normalize-exercises.test.ts` (`contracts/import-pipeline.md`): mapeo de músculos y equipamiento a las listas cerradas; equipamiento ausente → `null` (no `body only`); valores sin equivalente omitidos del arreglo y contados; reglas de tipo de medición por categoría (`stretching` → `duration`, `cardio` → `duration`/`distance_duration`, `plyometrics` y `body only` → `reps_bodyweight`, el resto → `reps_weight`); una excepción de `ejercicios-medicion.csv` gana sobre la regla; ejercicio sin tipo determinable → `no_measurement_type`; sin traducción → `no_translation`; nombre vacío o de más de 120 caracteres → `invalid_name`; descripción de más de 4.000 caracteres; pasos unidos y numerados; sin pasos → descripción y estado nulos; alias repetidos o iguales al nombre descartados; identificador repetido (`duplicate_item`); una traducción `reviewed` se conserva
- [X] T037 [P] [US5] Pruebas Deno en `supabase/import/extract-exercises.test.ts`: lee la copia fijada, **se detiene si el SHA-256 no coincide** antes de leer nada, aplica traducciones y excepciones, produce el NDJSON del contrato; la fuente `myguide-base` se lee de su archivo y valida la misma forma
- [X] T038 [P] [US5] Pruebas Deno en `supabase/import/load-exercises.test.ts` (con un cliente doble, como `load.test.ts`): rechaza una fuente sin licencia; carga en lotes de 200; `--dry-run` valida y cuenta sin escribir; `--sin-descripcion` quita descripción y estado; el informe cuenta creados, actualizados y omitidos con sus motivos y no contiene datos personales

### Implementation for User Story 5

- [X] T039 [US5] Migración `supabase/migrations/20261021000600_import_exercises.sql`: `public.import_exercises(source_slug, items jsonb)` y `public.finish_exercise_import(source_slug, report jsonb)`, solo ejecutables por `service_role`, con la regla de no pisar lo `reviewed`. Hace pasar T035
- [X] T040 [P] [US5] `supabase/import/normalize-exercises.ts` (puro): tipos `NormalizedExercise`, mapeos, reglas de medición, validación y motivos de omisión. Hace pasar T036
- [X] T041 [P] [US5] Excepciones de medición: resolver los ≈ 110 ejercicios dudosos de free-exercise-db (equipamiento `other` o sin dato en fuerza, pliometría y cardio) en `supabase/import/data/ejercicios-medicion.csv` (`source_item_id,tipo,motivo`), con el criterio de cada grupo anotado; `normalize-exercises.test.ts` comprueba que ningún ejercicio de la fuente queda sin tipo y que cada excepción apunta a un identificador existente
- [X] T042 [P] [US5] Fuente propia: `supabase/import/data/ejercicios-base.json` con ≈ 20 ejercicios ya en español (caminar, caminata rápida, trotar, correr al aire libre, senderismo, ciclismo al aire libre, natación crol y pecho, subir escaleras, fútbol, pádel, tenis, básquet, baile, yoga, pilates...) con tipo de medición, músculos, equipamiento y descripción breve, todo `original`. Prueba primero en `supabase/import/ejercicios_base.test.ts` (debe fallar): forma válida, valores dentro de las listas cerradas, identificadores únicos y estables
- [X] T043 [US5] `supabase/import/extract-exercises.ts` y `extract-exercises-base.ts` (verificación del SHA-256, traducciones, excepciones) y `supabase/import/load-exercises.ts` (lotes, informe, `--source`, `--dry-run`, `--sin-descripcion`) y los scripts `import:ejercicios-muestra`, `import:ejercicios` e `import:ejercicios:prod` en `package.json`, con los permisos mínimos de Deno como los de `import:muestra`. Hace pasar T037 y T038
- [X] T044 [US5] Traducciones, parte 1 (primera cuarta parte de los identificadores en orden alfabético) en `supabase/import/data/ejercicios-es.json`: por identificador, `nombre`, `sinonimos`, `pasos`, `nombre_estado` y `pasos_estado` (todos `machine_translated`). Pruebas primero en `supabase/import/ejercicios_es.test.ts` (deben fallar): (1) **forma** de las entradas que existan (siempre en verde cuando se cumple): ningún nombre vacío ni igual al nombre en inglés sin marcar, cada paso es texto no vacío, los estados son válidos, cada identificador existe en la fuente; (2) **cobertura total**: todo identificador de la fuente tiene entrada, activada por la constante `TRADUCCION_COMPLETA` (en `false` hasta T047, así `test:import` no queda en rojo mientras se traduce)
- [X] T045 [US5] Traducciones, parte 2 (segunda cuarta parte) en `supabase/import/data/ejercicios-es.json`, con el mismo criterio de T044
- [X] T046 [US5] Traducciones, parte 3 (tercera cuarta parte) en `supabase/import/data/ejercicios-es.json`, con el mismo criterio de T044
- [X] T047 [US5] Traducciones, parte 4 (última cuarta parte) en `supabase/import/data/ejercicios-es.json`, con el mismo criterio de T044. Con esta parte se pone `TRADUCCION_COMPLETA = true` y la prueba de cobertura total queda en verde
- [X] T048 [US5] Carga real en la base local: aplicar migraciones, ejecutar `import:ejercicios-muestra` y `import:ejercicios` (ambas fuentes), repetir la segunda para comprobar 0 duplicados y registrar en `research.md`, sección «Resultados de prototipos»: cantidades creadas y omitidas con sus motivos, tamaño de la tabla y del índice, y el informe de la carga

**Checkpoint**: el catálogo completo está cargado y la carga es repetible. Escenarios 27 y 28.

---

## Phase 6: User Story 3 - Crear mi versión de un ejercicio del catálogo (Priority: P2)

**Goal**: copiar un ejercicio del catálogo (o propio) a uno propio editable, sin alterar el original.

**Independent Test**: copiar un ejercicio del catálogo, cambiar su nombre y descripción; el original y lo que ve otra cuenta no cambian.

### Tests for User Story 3 ⚠️

- [X] T049 [P] [US3] Prueba pgTAP en `supabase/tests/copy_exercise.test.sql` (FR-026, SC-008): copia un ejercicio del catálogo con los mismos datos y textos `original`, sin nombre original ni fuente, con `based_on_exercise_id`; copia uno propio; idempotente por `request_id`; dos `request_id` distintos crean dos copias independientes; un ejercicio ajeno o inexistente → `not_found`; el original no cambia; una nueva importación no toca la copia; eliminar el original deja `based_on_exercise_id` nulo y la copia intacta
- [X] T050 [P] [US3] Pruebas de componente en `app/tests/component/ExerciseCopy.test.tsx` (escenarios 23 y 24): «Crear mi versión» en un ejercicio del catálogo y «Crear una copia» en uno propio llevan a la edición de la copia; la copia dice «basado en [original]»; doble clic crea una sola; fallo de red avisa; copiar dos veces crea dos
- [X] T051 [US3] Prueba e2e en `app/tests/e2e/exercises-copy.spec.ts` (escenarios 23 y 24): copiar, editar nombre y descripción, el original intacto y visto igual por otra cuenta, ambos diferenciados en la búsqueda, dos copias independientes

### Implementation for User Story 3

- [X] T052 [US3] Migración `supabase/migrations/20261021000700_copy_exercise.sql`: `public.copy_exercise(id, request_id)` `security definer`, idempotente. Hace pasar T049
- [X] T053 [US3] `copyExercise` en `api.ts` y las acciones de copia en `ExerciseDetailPage.tsx`. Hace pasar T050; el e2e de T051 queda en verde

**Checkpoint**: escenarios 23 y 24.

---

## Phase 7: User Story 4 - Editar y eliminar mis ejercicios (Priority: P2)

**Goal**: editar y eliminar ejercicios propios (incluidas las copias) sin tocar el catálogo ni el pasado.

**Independent Test**: editar un ejercicio propio y verlo actualizado; eliminarlo y comprobar que desaparece y que sus copias siguen; el catálogo no se puede editar ni eliminar, tampoco por la API.

### Tests for User Story 4 ⚠️

- [X] T054 [P] [US4] Prueba pgTAP en `supabase/tests/update_delete_exercise.test.sql` (FR-027, FR-028, FR-030): `update_exercise` actualiza un ejercicio propio (todos los campos, incluido el tipo de medición) con las mismas validaciones que al crear; sobre uno del catálogo o ajeno → `not_found` y no cambia ninguna fila; no cambia `origin`, dueño ni procedencia; borrar lo propio funciona, borrar el catálogo o lo ajeno no afecta ninguna fila; eliminar un ejercicio con copias deja las copias intactas
- [X] T055 [P] [US4] Pruebas de componente en `app/tests/component/ExerciseEdit.test.tsx` (escenarios 25 y 26): edición de un ejercicio propio con los datos cargados y las mismas validaciones; guardar actualiza el detalle; eliminar con `ConfirmDialog` (foco inicial en «Cancelar», Escape cancela, el foco vuelve al disparador), desaparece de las búsquedas; el catálogo no ofrece «Editar» ni «Eliminar»; fallo de red: aviso y borrador conservado
- [X] T056 [US4] Prueba e2e en `app/tests/e2e/exercises-edit.spec.ts` (escenarios 25 y 26) y `app/tests/e2e/exercises-readonly.spec.ts`: editar y eliminar por la interfaz; con una sesión válida, `insert`, `update` y `delete` sobre el catálogo por la API real son rechazados y los ejercicios de otra cuenta no se pueden modificar

### Implementation for User Story 4

- [X] T057 [US4] Migración `supabase/migrations/20261021000800_update_exercise.sql`: `public.update_exercise(id, exercise jsonb)` `security definer`. Hace pasar T054
- [X] T058 [US4] `updateExercise` y `deleteExercise` en `api.ts`, `ExerciseEditPage.tsx` (reutiliza `ExerciseForm`), la ruta `/ejercicios/:id/editar` y la acción «Eliminar» con confirmación en el detalle. Hace pasar T055; los e2e de T056 quedan en verde

**Checkpoint**: escenarios 25 y 26.

---

## Phase 8: User Story 6 - Ver las fuentes y sus licencias (Priority: P3)

**Goal**: la pantalla de fuentes muestra, además de las de alimentos, las de ejercicios con su licencia y atribución.

**Independent Test**: abrir `/fuentes` y ver las dos secciones; desde la procedencia de un ejercicio llegar a su fuente.

### Tests for User Story 6 ⚠️

- [X] T059 [P] [US6] Ampliar `app/tests/component/SourcesPage.test.tsx` (escenario 29, FR-018): dos secciones «Alimentos» y «Ejercicios», cada fuente con nombre, licencia, atribución, fecha de la última importación y cantidad; estado vacío por sección; fallo de una sección sin ocultar la otra, con «Reintentar»; las pruebas de alimentos existentes siguen en verde
- [X] T060 [US6] Prueba e2e en `app/tests/e2e/exercises-sources.spec.ts` (y ajustar `foods-sources.spec.ts` si la estructura de la pantalla cambia): `/fuentes` lista las fuentes de ejercicios con su licencia y atribución, y desde el detalle de un ejercicio del catálogo un clic lleva a las fuentes

### Implementation for User Story 6

- [X] T061 [US6] `fetchExerciseSources` en `app/src/features/exercises/api.ts` y `app/src/features/foods/SourcesPage.tsx` con las dos secciones (reutilizar `SourceCard`); textos en `copy/es.ts`. Hace pasar T059; el e2e de T060 queda en verde

**Checkpoint**: escenario 29. Todas las historias funcionan.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T062 [P] Accesibilidad en `app/tests/e2e/a11y-exercises.spec.ts` (escenario 31): axe en la búsqueda (con resultados, vacía, con filtros sin resultados), el detalle, el formulario (con errores) y las fuentes; recorrido por teclado de las pestañas, los filtros, los grupos de casillas y de botones de radio y el diálogo de eliminar; el tipo de medición se entiende sin ícono
- [X] T063 [P] Responsive en `app/tests/e2e/responsive-exercises.spec.ts` (escenario 31): teléfono y escritorio sin desplazamiento horizontal, áreas táctiles de 44 px o más (incluidas las casillas de músculos), nombres y descripciones largos sin romper el diseño
- [X] T064 [P] Aislamiento por la API real en `app/tests/e2e/exercises-isolation.spec.ts` (escenario 30, SC-007): con sesiones reales, la cuenta A no lee, inserta, modifica ni borra los ejercicios propios de B; nadie modifica el catálogo; las funciones de carga no son ejecutables por `anon` ni `authenticated`; una petición anónima no accede a nada
- [X] T065 Medición (SC-001 a SC-003, SC-012; escenario 32), sobre la compilación de producción (puerto 4173), registrada en `research.md`: encontrar un ejercicio y ver su detalle (menos de 15 s), crear un ejercicio propio (menos de 1 min) y tiempo de `search_exercises`, con texto, con filtros y con ambos, sobre **2.000 filas** y sobre **20.000 sintéticas** (95 % en menos de 1 s); si no llega, ajustar el índice o el disparador
- [X] T066 Revisión de seguridad dirigida, registrada en `verification.md` (FR-023, FR-028, FR-040):
  - el cliente no inserta ni actualiza `exercises` directamente; nadie modifica el catálogo;
  - las funciones del cliente no aceptan ejercicios ajenos;
  - las funciones de carga solo las ejecuta `service_role`; la clave de servicio no está en `app/` ni en Git;
  - ningún `console.*`, registro ni mensaje de error contiene el contenido de un ejercicio propio;
  - el borrador del formulario se borra al cerrar sesión;
  - `check:secrets`.
  
  Corregir los hallazgos con TDD.
- [X] T067 [P] Documentación:
  - `supabase/README.md`: tablas, funciones, listas cerradas, carga del catálogo de ejercicios y cómo marcar una traducción como revisada;
  - `README.md`: estado;
  - `Documentacion/roadmap-specs.md`: spec 005 y qué queda para la 006;
  - `Documentacion/fuentes-datos.md`: revisar que la sección de ejercicios coincide con lo cargado;
  - `contracts/import-pipeline.md`: dejar anotado el ajuste de la copia fijada en el repositorio.
- [ ] T068 Ejecutar los 32 escenarios del `quickstart.md` y registrar el resultado en `specs/005-catalogo-de-ejercicios/verification.md`
- [ ] T069 Ejecutar `format:check`, `lint`, `typecheck`, `test`, `e2e` (por partes), `test:db`, `test:functions`, `test:import`, `test:config` y `check:secrets`; todo en verde antes de dar la spec por terminada

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T002 (documentación de licencias) debe estar antes de cargar nada (T048)
- **Foundational (Phase 2)**: depende de Setup (T010 usa lo documentado en T002). **Bloquea todas las historias**. Orden en la base: T004 → T005 → T006/T007 → T008 → T009 → T010 → T011; el frontend (T012 a T018) es independiente de la base salvo T012, que lee la migración de T005
- **User Stories (Phase 3 a 8)**: dependen de Foundational
- **Polish (Phase 9)**: depende de las historias deseadas

### User Story Dependencies

- **US1 (P1)**: después de Foundational; sus pruebas siembran ejercicios por SQL, así que no necesita la carga (US5)
- **US2 (P1)**: después de Foundational y de la ruta de detalle de US1 (vuelve al detalle al guardar); su formulario lo reutilizan US3 y US4
- **US5 (P1)**: después de Foundational (tablas y fuentes); independiente de US1 y US2; sus tareas de traducción (T044 a T047) pueden avanzar en paralelo con todo
- **US3 (P2)**: después de US1 y US2 (acciones en el detalle y formulario de edición)
- **US4 (P2)**: después de US2 (reutiliza el formulario) y de US1
- **US6 (P3)**: después de Foundational; necesita el enlace de procedencia de US1

### Within Each User Story

- Las pruebas se escriben primero y deben **fallar** antes de implementar
- Migraciones antes del código que las usa
- Acceso a datos y esquemas antes de pantallas
- `ExerciseDetailPage.tsx` y `api.ts` los tocan US1, US3, US4 y US6: esas tareas son secuenciales

### Parallel Opportunities

- Setup: T001, T002 y T003
- Foundational: T006, T007, T009, T011, T012, T014, T016 y T018
- US1: T019 a T022 (pruebas) y, después, T025
- US5: T035 a T038 (pruebas), T040, T041 y T042; las cuatro partes de traducción en paralelo entre sí si se reparten los identificadores
- US3 y US4 en paralelo una vez hechas US1 y US2, salvo los archivos compartidos
- Polish: T062, T063, T064 y T067

---

## Parallel Example: Foundational

```bash
# Pruebas que se pueden escribir a la vez (deben fallar):
Task: "pgTAP de RLS en supabase/tests/exercises_rls.test.sql"
Task: "pgTAP de fuentes en supabase/tests/exercise_sources_seed.test.sql"
Task: "Pruebas de listas cerradas en app/tests/unit/exerciseLists.test.ts"
Task: "Pruebas de texto en app/tests/unit/exerciseText.test.ts"
Task: "Pruebas de pestañas en app/tests/component/OriginTabs.test.tsx"
```

---

## Implementation Strategy

### MVP primero (US1 + US2 + US5)

1. Setup y Foundational
2. US1: buscar, filtrar y ver (con ejercicios sembrados por SQL)
3. US2: crear ejercicios propios
4. US5: cargar el catálogo real, con las traducciones
5. **DETENERSE Y VALIDAR**: escenarios 1 a 22, 27 y 28 del `quickstart.md`. Ya hay un catálogo real de ≈ 900 ejercicios en español, con búsqueda, filtros y ejercicios propios; es lo mínimo que necesita la spec 006

### Entrega incremental

1. Foundational → base lista
2. US1 → US2 → US5 (MVP)
3. US3 → copias editables
4. US4 → editar y eliminar
5. US6 → fuentes
6. Polish → accesibilidad, aislamiento, medición, seguridad y documentación

### Riesgos conocidos

- **Traducción** (T044 a T047): son ≈ 880 nombres y 3.000 frases; se hace en cuatro tramos para poder revisarlos por separado con `git diff`. Si se corta a medias, `ejercicios_es.test.ts` lo detecta y la carga omite lo que no tenga traducción (`no_translation`)
- **Tipo de medición** (T041): los ≈ 110 casos dudosos se resuelven con criterio anotado; si el autor discrepa, se corrige en el CSV y se recarga
- **Búsqueda con 20.000 filas** (T065): si supera 1 s, se ajusta el índice antes de dar la spec por terminada
- **Licencia** (T002 y `issues-autor`): la revisión de la procedencia de los pasos no bloquea el MVP personal; sí abrir la aplicación a terceros

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- [Story] vincula la tarea con su historia para la trazabilidad
- Cada historia se puede completar y probar por separado (salvo los archivos compartidos, ver arriba)
- Verificar que las pruebas fallen antes de implementar
- Confirmar (commit) después de cada tarea o grupo lógico; marcar `[X]` al terminar cada tarea
- La suite de extremo a extremo se ejecuta por partes si la memoria del equipo no alcanza
- Tareas del autor: `Documentacion/issues-autor/08-ejercicios-licencias.md` (se crea en T002)

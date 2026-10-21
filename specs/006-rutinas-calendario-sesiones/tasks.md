---

description: "Lista de tareas de la spec 006: rutinas, calendario y sesiones de entrenamiento"
---

# Tasks: Rutinas, calendario y sesiones de entrenamiento

**Input**: documentos de diseño en `/specs/006-rutinas-calendario-sesiones/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (`database-api.md`, `ui-routes.md`), quickstart.md. Las specs 001 a 005 están en la rama base (esta rama sale de la 005).

**Tests**: INCLUIDOS. Los exige la Constitution (Principio VIII) y el flujo TDD del proyecto. En cada historia, las pruebas se escriben primero y se verifica que **fallen por la razón correcta** antes de implementar (skill `test-driven-development`). Cada prueba referencia el requisito (FR-xxx) o el escenario del `quickstart.md` que verifica. Skills: `database-design` y `supabase-postgres-best-practices` para la base, `frontend-design`, `vercel-react-best-practices` y `accessibility` para la interfaz.

**Organization**: tareas agrupadas por historia de usuario, numeradas como en `spec.md` (US1 a US6) y ordenadas por prioridad: US1, US2 y US3 (P1), US4 y US5 (P2), US6 (P3). Dentro de cada historia: pruebas, base de datos, capa de acceso y lógica, pantallas. Las pruebas pgTAP empiezan con `delete from public.workout_sessions` y `delete from public.routines` dentro de su transacción (la base local puede tener datos; lección de las specs 002 y 003). Las pruebas que dependen de la hora usan las funciones privadas con `p_now` y `p_zone` (el patrón de la spec 004).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US6)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

- Frontend: `app/src/features/training/`, pruebas en `app/tests/{unit,component,e2e}/`
- Backend: `supabase/migrations/` (prefijo `20261022`), `supabase/tests/` (pgTAP)
- Documentación: `Documentacion/`, `supabase/README.md` y `specs/006-rutinas-calendario-sesiones/`

## Decisiones de implementación que las tareas dan por fijadas

- Tablas: `routines`, `routine_exercises`, `workout_sessions`, `session_plan_items`, `session_exercises`, `session_sets`, `session_date_changes`, con las columnas y restricciones de `data-model.md`.
- Funciones públicas (12): `create_routine`, `update_routine`, `duplicate_routine`, `plan_workout`, `set_workout_routine`, `reschedule_workout`, `cancel_workout`, `start_workout`, `start_workout_from_routine`, `start_planned_workout`, `save_workout`, `exercise_history`. Borrar una rutina o una sesión es un `delete` directo por RLS.
- Migraciones, en este orden (cada una la crea la historia que la usa): `20261022000100_training_tables.sql`, `…000200_training_rls.sql`, `…000300_start_session.sql` (US1), `…000400_save_session.sql` (US1), `…000500_routine_functions.sql` (US2), `…000600_session_from_routine.sql` (US3), `…000700_session_planning.sql` (US4), `…000800_exercise_history.sql` (US5).
- Funciones privadas con hora y zona como parámetros para probarlas con hora simulada: `private.start_workout_at`, `private.plan_workout_at`, `private.reschedule_workout_at`, `private.start_planned_workout_at` (reciben `p_user`, `p_now`, `p_zone`); las públicas las llaman con `now()` y `private.effective_timezone(auth.uid(), client_timezone)`.
- `private.compute_session_modified(session_id)` nace en US1 devolviendo siempre `false` (las sesiones sin plan nunca son «modificadas») y US3 la reemplaza con la regla completa de `data-model.md` con `create or replace`.
- `start_planned_workout(id, session_date, request_id, client_timezone)` permite registrar una planificada vencida en el día en que se hizo (hoy o pasado; nulo = hoy). `start_workout` rechaza una sesión futura; el «hoy» es el del servidor en la zona del perfil. Códigos de error: `session_in_progress` (con el id de la abierta), `stale_revision`, `invalid_transition`, `invalid_date`, `not_found`, `session_expired`, `invalid_routine:<motivo>:<campo>`, `invalid_session:<motivo>:<campo>`.
- Estados de pantalla del editor: «Guardado», «Guardando…», «Sin guardar en el servidor». El autoguardado envía el estado completo con un retardo corto desde el último cambio y una sola solicitud en vuelo.
- Esfuerzo percibido: entero de 1 a 10, uno por ejercicio realizado. Pesos y distancias aceptan coma decimal; la duración se escribe como horas, minutos y segundos y se guarda en segundos.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: confirmar la línea base y dejar listos los ayudantes de siembra

- [X] T001 [P] Ayudantes de siembra solo para local en `supabase/seed.sql` (escriben directo en las tablas, sin pasar por las funciones del cliente): `tests.create_routine(user, name, exercise_ids uuid[], sets int default 3)`, `tests.create_session(user, date, status default 'planned', routine_id default null, with_plan boolean default false)` (si `with_plan`, inserta ítems de plan con instantánea), `tests.add_session_exercise(session_id, exercise_id, plan_item_id default null, is_substitute default false, effort default null)` y `tests.add_session_set(session_exercise_id, reps, weight_kg, duration_s, distance_km)`. Todos devuelven el id y respetan las restricciones de `data-model.md`
- [X] T002 Línea base: con la rama limpia, ejecutar `npm run test:db` y `npm test --prefix app` y confirmar que están en verde antes de empezar (38 archivos y 872 pruebas pgTAP; 64 archivos y 798 pruebas Vitest al cierre de la 005); anotar cualquier diferencia en `research.md`, sección «Resultados de prototipos»

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tablas, seguridad, textos y utilidades que necesitan todas las historias

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase

### Base de datos (skills `database-design`, `supabase-postgres-best-practices`)

- [X] T003 Prueba pgTAP en `supabase/tests/training_schema.test.sql` (escribir primero, debe fallar). Debe cubrir `data-model.md`:
  - columnas y tipos de las siete tablas; `status` solo `planned`, `in_progress`, `completed` o `cancelled`; `measurement_type` solo los cuatro tipos de la spec 005;
  - nombre de rutina de 1 a 80 caracteres sin espacios en los extremos; series planificadas de 1 a 20; posición de 1 a 30 y única por padre; esfuerzo de 1 a 10; notas de 1 a 1.000 (sesión) y de 1 a 500 (ejercicio);
  - objetivos válidos por tipo (`reps_weight`: repeticiones y peso; `reps_bodyweight`: repeticiones; `duration`: duración; `distance_duration`: distancia y duración) y rangos (repeticiones 1 a 999, peso 0 a 999,9, duración 1 a 86.400 s, distancia > 0 hasta 999,9); un peso de 0 es válido;
  - una serie debe tener al menos un valor, y los valores deben corresponder al tipo de medición de la instantánea de su ejercicio (el disparador rechaza, por ejemplo, un peso en un ejercicio de tiempo);
  - **índice único parcial**: una sola sesión `in_progress` por cuenta (dos cuentas sí pueden tener una cada una);
  - coherencia de `started_at` y `finished_at` con el estado; `modified` solo con `completed` y `has_plan`;
  - únicos `(user_id, client_request_id)` en rutinas, sesiones y cambios de fecha;
  - **inmutabilidad**: no cambian `exercise_name` ni `measurement_type` en rutina, plan ni ejercicio realizado; `exercise_id` solo puede pasar a nulo; no cambian `user_id`, `original_date` ni `routine_name` de la sesión; el plan no se actualiza;
  - **guardián de claves foráneas**: ninguna clave foránea hacia `exercises` es `on delete cascade`; eliminar un ejercicio propio deja intactos rutinas, planes y sesiones (con `exercise_id` nulo y el nombre guardado); eliminar una rutina deja las sesiones con `routine_id` nulo;
  - los estados y las marcas se guardan como datos de la sesión, no como estados (FR-008); todo lo que se guarda es origen manual de la persona (FR-040); eliminar un ejercicio no bloquea ni borra nada de rutinas, planes ni sesiones (FR-036);
  - eliminar una sesión borra sus ítems de plan, ejercicios, series y cambios de fecha; eliminar la cuenta borra todo lo suyo y nada de otra cuenta (FR-054);
  - un ejercicio realizado solo puede vincularse a un ítem del plan de su misma sesión, y a lo sumo uno por ítem.
- [X] T004 Migración `supabase/migrations/20261022000100_training_tables.sql`: las siete tablas con columnas, restricciones, índices (`(user_id, session_date)`, único parcial de sesión en curso, únicos de `client_request_id`, `(user_id, exercise_id)` en `session_exercises`) y disparadores de `data-model.md` (`updated_at`, inmutabilidad de instantáneas e identidad, forma de las series por tipo, tope de 30 ejercicios). RLS activado **sin políticas**, sin permisos para `anon` y `authenticated`, todo para `service_role`; `private.compute_session_modified(uuid)` como esqueleto que devuelve `false`. Hace pasar T003
- [X] T005 [P] Ampliar `supabase/tests/rls_guardrail.test.sql` (escribir primero, debe fallar mientras las tablas no existan): confirmar que las siete tablas nuevas cumplen el guardián general (RLS, `user_id`, política con la vigencia de sesión escrita `(select …)`); si el guardián usa una lista explícita, agregarlas. Ninguna es tabla de referencia
- [X] T006 Prueba pgTAP en `supabase/tests/training_rls.test.sql` (escribir primero, debe fallar). Debe cubrir:
  - la cuenta B no ve, modifica ni borra rutinas ni sesiones de A, ni sus ítems, series ni cambios de fecha;
  - el cliente **no puede insertar ni actualizar** ninguna de las siete tablas directamente; sí puede borrar lo propio en `routines` y `workout_sessions`, y no puede borrar directamente las tablas hijas;
  - con la sesión vencida no se ve nada; `anon` no accede a nada (FR-050)
- [X] T007 Migración `supabase/migrations/20261022000200_training_rls.sql`: permisos mínimos (`select` en las siete tablas; `delete` solo en `routines` y `workout_sessions`) y políticas con `(select auth.uid())` y `(select private.is_session_fresh())`. Hace pasar T005 y T006

### Utilidades del frontend

- [X] T008 [P] Pruebas unitarias en `app/tests/unit/trainingText.test.ts` (escribir primero, deben fallar) de las funciones puras de `trainingText.ts`: etiquetas de estado («Planificada», «En curso», «Realizada», «Cancelada») y de marcas («Reprogramada», «Modificada», «Corregida»); campos de una serie por tipo de medición; formato de valores con unidad y coma decimal (`60 kg`, `8 repeticiones`, `1:05:30` para duración, `5,25 km`); resumen de una serie y de un ejercicio («3 series: 8 × 60 kg…»); «sin dato» para un valor ausente (nunca 0); lectura de números con coma o punto y de duraciones («90», «1:30», «1:05:30»); nombre accesible de un día (FR-029, FR-030)
- [X] T009 Implementar `app/src/features/training/trainingText.ts` y las constantes de límites (`app/src/features/training/limits.ts`: 80, 30, 20, 999, 999,9, 86.400, 1.000, 500, esfuerzo 1 a 10). Hace pasar T008
- [X] T010 [P] Pruebas unitarias en `app/tests/unit/trainingSchema.test.ts` (escribir primero, deben fallar) de los esquemas Zod: rutina (nombre, 1 a 30 ejercicios, series 1 a 20, objetivos según el tipo, rangos), serie por tipo de medición (valores permitidos y rangos, serie sin valores no válida, peso 0 válido), ejercicio de sesión (esfuerzo 1 a 10, nota de 500), payload de sesión (nota de 1.000, hasta 30 ejercicios, hasta 20 series), con los mismos límites que la base (FR-002, FR-028, FR-031, FR-032)
- [X] T011 Implementar `app/src/features/training/schema.ts` (esquemas, tipos `RoutinePayload` y `SessionPayload`, conversión del texto del formulario a números y segundos). Hace pasar T010
- [X] T012 [P] Prueba de lenguaje neutral en `app/tests/unit/trainingCopy.test.ts` (escribir primero, debe fallar mientras la clave `training` no exista): recorre todos los textos de `es.training` (cadenas y funciones evaluadas con argumentos de ejemplo) y falla si aparece algún término prohibido (racha, perdiste, perdido, fallaste, falló, culpa, vago, flojo, récord, mejoraste, retrocediste, objetivo cumplido...) o una sugerencia de entrenar con dolor o lesión; verifica que lo no hecho se diga «No realizado» o «Sin registrar» (FR-051, SC-011)
- [X] T013 Textos base en `app/src/copy/es.ts` (clave `training`: navegación, estados y marcas, unidades, «sin dato», mensajes de error por código, indicador de guardado) y el enlace **Entrenamiento** en `app/src/components/AppShell.tsx`; ajustar la prueba del menú si cuenta los enlaces. Hace pasar T012
- [X] T014 [P] Prueba unitaria en `app/tests/unit/trainingErrors.test.ts` (escribir primero, debe fallar) de `trainingErrorMessage`: traduce `session_expired`, `session_in_progress` (devuelve el id de la sesión abierta), `stale_revision`, `invalid_transition`, `invalid_date`, `not_found`, `invalid_routine:<motivo>:<campo>` e `invalid_session:<motivo>:<campo>` a mensajes claros, y devuelve `null` ante lo desconocido; nunca incluye el texto crudo del servidor (FR-049, FR-053)
- [X] T015 Base de `app/src/features/training/api.ts`: tipos (`Routine`, `RoutineExercise`, `WorkoutSession`, `PlanItem`, `SessionExercise`, `SessionSet`, `HistoryEntry`), `trainingErrorMessage` y el cliente de Supabase tipado. Hace pasar T014

**Checkpoint**: tablas y seguridad listas, textos y esquemas listos. Las historias pueden empezar.

---

## Phase 3: User Story 1 - Registrar una sesión de entrenamiento (Priority: P1) 🎯 MVP

**Goal**: iniciar una sesión (hoy o una fecha pasada), agregar ejercicios, anotar series según el tipo de medición, esfuerzo y notas, guardar el avance sin perder nada y terminarla.

**Independent Test**: registrar una sesión de hoy con un ejercicio de cada tipo de medición, con dos series cada uno; recargar a la mitad y recuperar lo escrito; terminarla y verla como «Realizada» con sus unidades. Escenarios 1 a 9 y 43 a 45 del `quickstart.md`.

### Tests for User Story 1 ⚠️

- [X] T016 [P] [US1] Prueba pgTAP en `supabase/tests/start_workout.test.sql` (FR-007, FR-009 a FR-011, FR-047): crea una sesión vacía `in_progress` para hoy y para una fecha pasada, con `started_at`; una fecha futura → `invalid_date`; con otra sesión abierta → `session_in_progress` con el id de esa sesión; dos cuentas pueden tener una cada una; el «hoy» sale de la zona del perfil con hora simulada (`private.start_workout_at`, incluida la medianoche); idempotente por `request_id` (también un reintento tardío; SC-002); sin `request_id` → error; sesión vencida y sin sesión → `session_expired`; `anon` sin permiso
- [X] T017 [P] [US1] Prueba pgTAP en `supabase/tests/save_workout.test.sql` (FR-012 a FR-014, FR-028 a FR-035, FR-038, FR-045, FR-047): reemplazo completo de ejercicios y series; un ejercicio nuevo toma la instantánea del ejercicio visible (catálogo o propio) y uno que ya estaba la conserva; un ejercicio no visible o inexistente → `exercise_not_found`; series con solo los valores del tipo (un peso en un ejercicio de tiempo → `invalid_set`); una serie vacía se descarta; rangos (repeticiones 0 y 1.000, peso negativo, duración 0, distancia 0, esfuerzo 0 y 11); hasta 30 ejercicios y 20 series; notas de 1.000 y 500; el orden del payload es el orden guardado; una fila que no está en el payload se elimina; `stale_revision` sin cambiar nada; la revisión sube en cada guardado; **un `id` de ejercicio que ya existe en otra sesión o en otra cuenta → `duplicate_id` sin revelar nada**; **un `plan_item_id` de otra sesión → `invalid_plan_item`, `is_substitute` sin `plan_item_id` → `invalid_plan_item`, y un ítem del plan solo se vincula a un ejercicio realizado** (se siembra con `tests.create_session(with_plan => true)`); **una sesión iniciada antes de la medianoche y terminada después conserva su `session_date` (hora simulada, FR-010)**; `finish` pasa a `completed` con `finished_at`; una sesión sin plan nunca queda «modificada»; repetir el mismo guardado no duplica nada (SC-002); guardar la misma sesión completada es una corrección (`corrected_at`) que conserva la instantánea; `planned` y `cancelled` → `invalid_transition`; un error a mitad no deja datos a medias; una sesión ajena → `not_found`; `anon` sin permiso
- [X] T018 [P] [US1] Pruebas unitarias en `app/tests/unit/sessionEditorState.test.ts` (deben fallar): el reductor del editor agrega y quita ejercicios y series, reordena, copia la serie anterior, edita esfuerzo y notas, valida con los esquemas, descarta series vacías al armar el payload, y calcula qué está sin guardar (FR-033)
- [X] T019 [P] [US1] Pruebas del hook en `app/tests/unit/useSessionEditor.test.tsx` (con temporizadores simulados; deben fallar): guarda el borrador local en cada cambio; autoguarda con retardo y una sola solicitud en vuelo, siempre con el estado más reciente; el indicador pasa de «Guardando…» a «Guardado» solo cuando el servidor responde, y a «Sin guardar en el servidor» ante un fallo, sin conexión incluida (nunca «Guardado» sin respuesta, FR-046, FR-048); `stale_revision` expone el conflicto con las dos opciones; recupera el borrador al abrir y lo descarta al confirmar o al cerrar sesión (FR-045, SC-005); doble envío no duplica
- [X] T020 [P] [US1] Pruebas de componente en `app/tests/component/SessionEditor.test.tsx` (escenarios 1 a 9; deben fallar): campos y unidades según el tipo de medición; una serie con un dato ausente muestra «sin dato» y nunca 0 (SC-007); el peso 0 se acepta; valores fuera de rango muestran su mensaje; esfuerzo percibido de 1 a 10 con «sin dato»; «Agregar serie», «Copiar la serie anterior», quitar; «Terminar sesión»; el indicador de guardado y su anuncio accesible
- [X] T021 [P] [US1] Pruebas de componente en `app/tests/component/ExercisePickerPanel.test.tsx` (deben fallar): elige un ejercicio con la búsqueda de la spec 005 (propios y del catálogo), muestra el estado vacío con «Crear un ejercicio» cuando no hay, y el panel atrapa el foco, se cierra con Escape y devuelve el foco
- [X] T022 [P] [US1] Pruebas de componente en `app/tests/component/TrainingHomePage.test.tsx` (deben fallar): «Hoy» ofrece empezar una sesión vacía; con una sesión en curso muestra «Continuar la sesión» y no deja crear una segunda (escenario 8); «Registrar un entrenamiento de otra fecha» acepta hoy o una fecha pasada y rechaza una futura; lista las últimas sesiones realizadas; estados de carga, vacío y error
- [X] T023 [US1] Prueba e2e en `app/tests/e2e/training-session.spec.ts` (escenarios 1 a 9 y 43 a 45): sesión con un ejercicio de cada tipo y dos series; dato ausente; peso 0; valores inválidos; terminar y ver la sesión realizada con unidades; registrar la de ayer; segunda sesión en curso; esfuerzo; recargar a la mitad y recuperar; cerrar sesión borra el borrador; cortar la red (aviso de «Sin guardar en el servidor»); dos pestañas con la misma sesión (conflicto de revisión)

### Implementation for User Story 1

- [X] T024 [US1] Migración `supabase/migrations/20261022000300_start_session.sql`: `private.start_workout_at(p_user, p_date, p_request, p_now, p_zone)` y `public.start_workout(session_date, request_id, client_timezone)` según `contracts/database-api.md` (hoy o pasada, una sola en curso, idempotente). Hace pasar T016
- [X] T025 [US1] Migración `supabase/migrations/20261022000400_save_session.sql`: `private.snapshot_exercise`, `private.clean_session_payload` y `public.save_workout(id, payload, expected_revision, finish)` (reemplazo completo, instantánea de los ejercicios nuevos, revisión, `finish`, corrección). Hace pasar T017
- [X] T026 [US1] `api.ts`: `startSession`, `saveSession`, `fetchSession` (con plan, ejercicios, series y cambios de fecha embebidos), `fetchInProgressSession`, `fetchRecentSessions`, `deleteSession`. Cada escritura va por `saveRemotely` y `newRequestId` (FR-047, FR-048)
- [X] T027 [P] [US1] Implementar `app/src/features/training/sessionEditorState.ts` (reductor puro y armado del payload). Hace pasar T018
- [X] T028 [US1] Implementar `useSessionEditor.ts` y `useSession.ts` (borrador con `useDraft`, autoguardado, revisión, conflicto, estado del indicador). Hace pasar T019
- [X] T029 [P] [US1] `ExercisePickerPanel.tsx` en `features/training`: diálogo modal accesible con su propia búsqueda (estado local, sin tocar la dirección de la página) que reutiliza `searchExercises`, `ExerciseFilters` y las constantes de `useExerciseSearch` de la spec 005 (propios y del catálogo, por tandas, con «Crear un ejercicio» si no hay resultados); no hizo falta extraer nada de `ExerciseSearchPage`, así que la spec 005 no cambia. Hace pasar T021
- [X] T030 [US1] Componentes del editor: `SetRow.tsx`, `EffortSelect.tsx`, `SaveIndicator.tsx`, `SessionExerciseCard.tsx` y `SessionEditor.tsx` (un ejercicio por tarjeta en el teléfono, áreas táctiles de 44 px, campos con etiqueta y unidad, errores asociados). Hace pasar T020
- [X] T031 [US1] `SessionPage.tsx` (en curso y realizada, vista básica), `TrainingHomePage.tsx` con `TodayPanel.tsx`, las rutas `/entrenamiento` y `/entrenamiento/sesion/:id` en `app/src/routes/index.tsx` y los textos faltantes en `es.ts`. Hace pasar T022; el e2e de T023 queda en verde

**Checkpoint**: se puede registrar, guardar sin perder datos y terminar una sesión. Escenarios 1 a 9 y 43 a 45. Este es el MVP.

---

## Phase 4: User Story 2 - Armar y mantener mis rutinas (Priority: P1)

**Goal**: crear, editar, duplicar y eliminar rutinas (un catálogo de entrenamientos sin días), con ejercicios, series y objetivos opcionales según el tipo de medición.

**Independent Test**: crear una rutina con tres ejercicios y sus objetivos, editarla, duplicarla y eliminar la copia; la original queda intacta. Escenarios 10 a 17 del `quickstart.md`.

### Tests for User Story 2 ⚠️

- [ ] T032 [P] [US2] Prueba pgTAP en `supabase/tests/routine_functions.test.sql` (FR-001 a FR-006, FR-047): `create_routine` con 1 y con 30 ejercicios; instantánea de cada ejercicio visible (catálogo y propio) y `exercise_not_found` para uno ajeno; nombre vacío o de 81 caracteres; sin ejercicios; 31 ejercicios; series 0 y 21; objetivos que no corresponden al tipo (`invalid_target`); idempotente por `request_id`; `update_routine` reemplaza todo, vuelve a tomar las instantáneas y no toca ninguna sesión; `duplicate_routine` crea una independiente «… (copia)» recortada a 80; borrar una rutina deja sus sesiones con el plan y `routine_id` nulo; una rutina ajena → `not_found`; sesión vencida y `anon`
- [ ] T033 [P] [US2] Pruebas de componente en `app/tests/component/RoutineForm.test.tsx` (escenarios 10 a 12 y 17; deben fallar): nombre, lista reordenable con «Subir/Bajar», series, objetivos según el tipo con unidad, validaciones (nombre, ejercicios, series), «Agregar ejercicio» con la búsqueda, «Reemplazar ejercicio» en un ítem cuyo ejercicio ya no existe, borrador local, doble clic crea una sola, fallo de red avisa y conserva lo escrito, «Guardar» confirma solo con la respuesta del servidor
- [ ] T034 [P] [US2] Pruebas de componente en `app/tests/component/RoutinesPages.test.tsx` (escenarios 13 a 16; deben fallar): lista (nombre y cantidad de ejercicios, vacío, error), detalle que muestra el nombre vigente del ejercicio (y el guardado si ya no existe) con aviso por ítem cuyo ejercicio ya no existe o cambió su tipo de medición («Revisá los objetivos de este ejercicio»; FR-004), duplicar, eliminar con `ConfirmDialog` (foco inicial en «Cancelar», Escape cancela, el texto aclara que las sesiones ya creadas no cambian)
- [ ] T035 [US2] Prueba e2e en `app/tests/e2e/training-routines.spec.ts` (escenarios 10 a 17): crear con tres ejercicios y objetivos, validaciones, editar orden y un objetivo, duplicar, eliminar con sesiones ya creadas, ejercicio propio eliminado, doble clic y corte de red

### Implementation for User Story 2

- [ ] T036 [US2] Migración `supabase/migrations/20261022000500_routine_functions.sql`: `private.clean_routine_input` y `public.create_routine`, `update_routine`, `duplicate_routine` según `contracts/database-api.md`. Hace pasar T032
- [ ] T037 [US2] `api.ts`: `createRoutine`, `updateRoutine`, `duplicateRoutine`, `deleteRoutine`, `fetchRoutines`, `fetchRoutine` (con el ejercicio vigente embebido: nombre y tipo de medición, nulo si ya no existe; contrato de lectura)
- [ ] T038 [US2] `useRoutines.ts` y `useRoutine.ts` (invalidación de consultas tras cada cambio)
- [ ] T039 [US2] `RoutineFormPage.tsx` (alta y edición con `useFieldArray`, borrador local, objetivos por tipo). Hace pasar T033
- [ ] T040 [US2] `RoutinesPage.tsx` y `RoutineDetailPage.tsx`, las rutas `/entrenamiento/rutinas`, `/nueva`, `/:id` y `/:id/editar`, el acceso desde la página de inicio y los textos. Hace pasar T034; el e2e de T035 queda en verde

**Checkpoint**: las rutinas se arman y se mantienen. Escenarios 10 a 17.

---

## Phase 5: User Story 3 - Entrenar con una rutina y ver lo planificado frente a lo realizado (Priority: P1)

**Goal**: iniciar una sesión desde una rutina con su plan, ver plan y realizado por separado, sustituir, agregar o saltear ejercicios, y que la sesión quede «Modificada» solo cuando corresponde.

**Independent Test**: iniciar una sesión desde una rutina de tres ejercicios, hacer el primero tal cual, sustituir el segundo, saltear el tercero y agregar uno; terminarla y comprobar plan, realizado y la marca «Modificada». Escenarios 18 a 27 del `quickstart.md`.

### Tests for User Story 3 ⚠️

- [ ] T041 [P] [US3] Prueba pgTAP en `supabase/tests/session_from_routine.test.sql` (FR-005, FR-015, FR-016, FR-017, FR-037): `start_workout_from_routine` copia los ítems a `session_plan_items` en orden con `has_plan`, `routine_id` y `routine_name`; refresca nombre y tipo desde el ejercicio vigente; si el ejercicio ya no existe usa la instantánea de la rutina; si cambió el tipo de medición copia solo los objetivos compatibles y marca `targets_dropped`; el plan **no cambia** si la rutina se edita o se elimina después; el plan es inmutable (el disparador lo impide); idempotente por `request_id`; errores `session_in_progress`, `invalid_date`, `not_found`; `anon`
- [ ] T042 [P] [US3] Prueba pgTAP en `supabase/tests/session_modified.test.sql` (FR-018, FR-019, FR-020), tabla de casos de la regla de `data-model.md`: idéntica al plan → no modificada; ítem sin ejercicio realizado → modificada; ejercicio con cero series → «no realizado» y modificada; sustituido → modificada; ejercicio agregado con series → modificada; agregado sin series → no cuenta; otra cantidad de series → modificada; distintas repeticiones, peso, duración o distancia frente al objetivo → **no** modificada; sesión sin plan → nunca; corregir una sesión recalcula la marca; un ejercicio realizado solo se vincula a un ítem de su plan
- [ ] T043 [P] [US3] Pruebas unitarias en `app/tests/unit/planDiff.test.ts` (deben fallar): de plan y realizado, qué ítems quedaron «hechos», «no realizados», «sustituidos», «agregados» y en qué difiere la sesión (FR-019, FR-020), con textos neutrales
- [ ] T044 [P] [US3] Pruebas de componente en `app/tests/component/PlanVsDone.test.tsx` (escenarios 18 a 26; deben fallar): plan y realizado en bloques rotulados y separados (SC-006); el objetivo se ve como referencia y nunca como serie anotada; «Sustituir por…» conserva el original y relaciona ("en lugar de X"); «Agregar un ejercicio» fuera del plan; «Sin hacer todavía» y «No realizado»; marca «Modificada» solo con diferencias de ejercicios o de cantidad de series; aviso de objetivos no copiados; sesión sin plan dice «Sin planificación»
- [ ] T045 [P] [US3] Pruebas de componente en `app/tests/component/RoutinePicker.test.tsx` (deben fallar): elegir una rutina del catálogo o «Sesión vacía» desde «Hoy» y empezar; lista vacía invita a crear una rutina
- [ ] T046 [US3] Prueba e2e en `app/tests/e2e/training-plan.spec.ts` (escenarios 18 a 27): sesión desde una rutina, hacer, sustituir, saltear y agregar, terminar, marca «Modificada» y «Realizada» sin marca, diferencias de valores que no marcan, editar y eliminar la rutina después, cambio del tipo de medición de un ejercicio

### Implementation for User Story 3

- [ ] T047 [US3] Migración `supabase/migrations/20261022000600_session_from_routine.sql`: `private.copy_routine_plan(session, routine, now)`, `public.start_workout_from_routine(routine_id, session_date, request_id, client_timezone)` y el reemplazo (`create or replace`) de `private.compute_session_modified` con la regla completa. Hace pasar T041 y T042
- [ ] T048 [US3] `api.ts`: `startSessionFromRoutine`
- [ ] T049 [P] [US3] `planDiff` en `trainingText.ts` y la gestión de plan, sustitución, ítems agregados y «no realizado» en `sessionEditorState.ts`. Hace pasar T043
- [ ] T050 [US3] `PlanVsDone.tsx` y el modo con plan de `SessionEditor` / `SessionExerciseCard` (sustituir, agregar, saltear, objetivos como referencia, aviso de objetivos no copiados, marca «Modificada»). Hace pasar T044
- [ ] T051 [US3] `RoutinePicker.tsx`, «Empezar con una rutina» en `TodayPanel` y en el detalle de la rutina, y los textos. Hace pasar T045; el e2e de T046 queda en verde

**Checkpoint**: se entrena con una rutina y se distingue lo planificado de lo realizado. Escenarios 18 a 27.

---

## Phase 6: User Story 4 - Planificar en el calendario, reprogramar y cancelar (Priority: P2)

**Goal**: calendario mensual, elegir qué rutina toca cada día, mover una sesión planificada sin duplicarla, cancelarla y volver a planificarla.

**Independent Test**: planificar una sesión desde una rutina para dentro de tres días, reprogramarla dos veces, cancelarla y volver a planificarla; hay una sola sesión en todo momento y una realizada no se puede mover. Escenarios 28 a 36 del `quickstart.md`.

### Tests for User Story 4 ⚠️

- [ ] T052 [P] [US4] Prueba pgTAP en `supabase/tests/session_planning.test.sql` (FR-021 a FR-027a, FR-047): `plan_workout` (con y sin rutina, hoy o futura, pasada → `invalid_date`, idempotente); `set_workout_routine` (solo `planned`; reemplaza o quita el plan); `reschedule_workout` (misma sesión, `rescheduled_count`, fila en `session_date_changes`, mismo día no cambia nada, pasada → `invalid_date`, `in_progress` y `completed` → `invalid_transition`, `cancelled` pasa a `planned`, idempotente por `request_id` incluso tras otro movimiento); `cancel_workout` (conserva el plan, idempotente, solo `planned`); `start_planned_workout` (hoy o anterior, conserva el plan; con `session_date` nulo pasa a hoy y con un día pasado a ese día, dejando fila en `session_date_changes`, subiendo `rescheduled_count` y conservando `original_date`; un día futuro o una planificada futura → `invalid_date`; otra abierta → `session_in_progress`; idempotente por `request_id`); sesiones realizadas intactas al mover otras (SC-003); hora simulada y zona; ajena → `not_found`; `anon`
- [ ] T053 [P] [US4] Pruebas unitarias en `app/tests/unit/calendar.test.ts` (deben fallar): cuadrícula del mes (semana desde el lunes, días del mes anterior y siguiente), rango de fechas a consultar, nombre accesible por día («jueves 22 de octubre: 1 sesión realizada, 1 planificada»), resumen del estado de un día, fechas en la zona de la persona, «Sin registrar» para planificadas con fecha pasada
- [ ] T054 [P] [US4] Pruebas de componente en `app/tests/component/CalendarMonth.test.tsx` (escenario 36; deben fallar): días como enlaces con nombre completo, estado con texto o forma además del color, «Mes anterior/siguiente/Hoy», carga, mes vacío, error con «Reintentar», sin conexión
- [ ] T055 [P] [US4] Pruebas de componente en `app/tests/component/TrainingPlanning.test.tsx` (escenarios 28 a 35; deben fallar): `DayPage` (planificar una rutina o sesión vacía en hoy o futura; para una fecha pasada solo registrar; cambiar o quitar la rutina), `ReschedulePanel` (fecha de hoy o futura, marca «Reprogramada» y recorrido), cancelar y «Volver a planificar», «Sin registrar» con sus tres acciones (y «Registrar» pregunta qué día la hizo, por omisión hoy, y rechaza uno futuro), doble clic sin duplicar, fallo de red
- [ ] T056 [US4] Prueba e2e en `app/tests/e2e/training-calendar.spec.ts` (escenarios 28 a 36): planificar un día, cambiar la rutina, la misma rutina en varios días, reprogramar dos veces con su recorrido, no mover una realizada ni a una fecha pasada, cancelar y volver a planificar, planificada vencida, doble clic, mes con varios días y un día con dos sesiones

### Implementation for User Story 4

- [ ] T057 [US4] Migración `supabase/migrations/20261022000700_session_planning.sql`: `private.plan_workout_at`, `private.reschedule_workout_at`, `private.start_planned_workout_at` y las funciones públicas `plan_workout`, `set_workout_routine`, `reschedule_workout`, `cancel_workout` y `start_planned_workout`. Hace pasar T052
- [ ] T058 [US4] `api.ts`: `planSession`, `setSessionRoutine`, `rescheduleSession`, `cancelSession`, `startPlannedSession(id, sessionDate, requestId)`, `fetchMonth`, `fetchSessionsOfDay`
- [ ] T059 [P] [US4] Implementar `app/src/features/training/calendar.ts`. Hace pasar T053
- [ ] T060 [US4] `useCalendarMonth.ts`, `useSessionsOfDay.ts` y `CalendarMonth.tsx` en la página de inicio. Hace pasar T054
- [ ] T061 [US4] `DayPage.tsx`, `ReschedulePanel.tsx`, las vistas planificada y cancelada de `SessionPage`, la ruta `/entrenamiento/dia/:fecha`, «Sin registrar» en el día y en «Hoy», y los textos. Hace pasar T055; el e2e de T056 queda en verde

**Checkpoint**: el calendario funciona y las sesiones se mueven sin duplicarse. Escenarios 28 a 36.

---

## Phase 7: User Story 5 - Ver cómo me fue la última vez con un ejercicio (Priority: P2)

**Goal**: la historia de un ejercicio (las últimas veces, con sus series y esfuerzo), accesible desde el detalle del ejercicio y desde la sesión, y «la última vez» en un paso dentro de una sesión.

**Independent Test**: registrar un ejercicio en tres sesiones y ver su historia de la más reciente a la más antigua; desde una sesión nueva ver la última vez sin salir. Escenarios 37 a 39 del `quickstart.md`.

### Tests for User Story 5 ⚠️

- [ ] T062 [P] [US5] Prueba pgTAP en `supabase/tests/exercise_history.test.sql` (FR-041 a FR-043, SC-009): solo sesiones `completed`, de la más reciente a la más antigua con desempate estable; muestra el nombre guardado en cada sesión (renombrar el ejercicio después no lo cambia); trae las series ordenadas con sus valores y el esfuerzo; `exclude_session_id` omite la sesión actual; paginado con tope de 50; ejercicio sin historia → cero filas; una copia propia es otro ejercicio; un ejercicio eliminado deja sus sesiones visibles en el calendario; aislamiento entre cuentas; sesión vencida y `anon`
- [ ] T063 [P] [US5] Pruebas de componente en `app/tests/component/ExerciseHistoryPage.test.tsx` (escenarios 37 y 39; deben fallar): lista por tandas («Ver más») con fecha, nombre guardado, series con unidades y esfuerzo o «sin dato», enlace a la sesión, estado vacío «Todavía no lo registraste», sin recomendaciones ni valoraciones, estados de carga y error
- [ ] T064 [P] [US5] Pruebas de componente en `app/tests/component/LastTime.test.tsx` (escenario 38; deben fallar): dentro de una sesión en curso, «La última vez» abre en un paso la sesión anterior más reciente del ejercicio sin salir, y un ejercicio sin historia lo dice sin inventar datos
- [ ] T065 [US5] Prueba e2e en `app/tests/e2e/training-history.spec.ts` (escenarios 37 a 39): tres sesiones, historia ordenada, «La última vez» dentro de una sesión, historia vacía, ejercicio renombrado y ejercicio eliminado

### Implementation for User Story 5

- [ ] T066 [US5] Migración `supabase/migrations/20261022000800_exercise_history.sql`: `public.exercise_history` (`security invoker`) según `contracts/database-api.md`. Hace pasar T062
- [ ] T067 [US5] `api.ts` y `useExerciseHistory.ts` (`fetchExerciseHistory`, tandas)
- [ ] T068 [US5] `ExerciseHistoryPage.tsx`, la ruta `/ejercicios/:id/historia`, el enlace «Ver historia» en `app/src/features/exercises/ExerciseDetailPage.tsx` (ajustar sus pruebas de la spec 005), «La última vez» y «Ver historia» en `SessionExerciseCard`, y los textos; sin gráficos ni comparaciones (FR-044). Hace pasar T063 y T064; el e2e de T065 queda en verde

**Checkpoint**: la historia de un ejercicio funciona. Escenarios 37 a 39.

---

## Phase 8: User Story 6 - Corregir o eliminar una sesión registrada (Priority: P3)

**Goal**: corregir una sesión realizada (conservando la instantánea) y eliminar una sesión con confirmación.

**Independent Test**: corregir las repeticiones de una serie de una sesión realizada y comprobar que el nombre y el tipo de medición siguen siendo los guardados; eliminar una sesión y comprobar que desaparece del calendario y de la historia. Escenarios 40 y 41 del `quickstart.md`.

### Tests for User Story 6 ⚠️

- [ ] T069 [P] [US6] Prueba pgTAP en `supabase/tests/session_correct_delete.test.sql` (FR-035, FR-038, FR-039): corregir una sesión realizada fija `corrected_at`, recalcula `modified`, sube la revisión y conserva `exercise_name` y `measurement_type` aunque el ejercicio se haya renombrado, cambiado de tipo o eliminado; agregar, quitar y reordenar series en una corrección; `stale_revision` también en correcciones; eliminar una sesión (propia) borra sus hijos y la quita de la historia; las rutinas, el catálogo y otras sesiones no cambian (SC-004); ajena → no afecta ninguna fila
- [ ] T070 [P] [US6] Pruebas de componente en `app/tests/component/SessionCorrection.test.tsx` (escenarios 40 y 41; deben fallar): «Corregir» vuelve al editor con el mismo guardado y muestra «Corregida» con la fecha; el nombre y el tipo de medición no se pueden editar; «Eliminar» con `ConfirmDialog` (foco inicial en «Cancelar», Escape cancela, el foco vuelve) y aviso claro si falla
- [ ] T071 [US6] Prueba e2e en `app/tests/e2e/training-correct.spec.ts` (escenarios 40 a 42): corregir una serie y una nota, ver «Corregida», eliminar una sesión y verla desaparecer del calendario y de la historia; **editar y eliminar un ejercicio propio, y repetir la importación del catálogo, no cambia ninguna sesión ya creada** (escenario 42)

### Implementation for User Story 6

- [ ] T072 [US6] En `SessionPage.tsx` (vista realizada): «Corregir» (reabre el editor), «Corregida el …», «Eliminar» con confirmación y navegación posterior; textos de error. Hace pasar T070; el e2e de T071 queda en verde (la base ya lo soporta desde US1 y T069 lo fija)

**Checkpoint**: todas las historias funcionan. Escenarios 40 a 42.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T073 [P] Accesibilidad en `app/tests/e2e/a11y-training.spec.ts` (escenario 47, FR-052, SC-012): axe en el inicio con el calendario, un día, la sesión en sus cuatro estados, el editor (con errores y con el panel de agregar ejercicio abierto), las rutinas (lista, detalle y formulario con errores), la historia y los diálogos; recorrido por teclado del calendario, las listas reordenables, las series, el selector de esfuerzo y el diálogo de eliminar; el estado se entiende sin depender del color
- [ ] T074 [P] Responsive en `app/tests/e2e/responsive-training.spec.ts` (escenario 47, FR-052, SC-012): teléfono (375 px) y escritorio sin desplazamiento horizontal, áreas táctiles de 44 px o más (incluidas las filas de series y los días del calendario), nombres de ejercicio y notas largos, 30 ejercicios con 20 series cada uno sin romper el diseño
- [ ] T075 [P] Aislamiento por la API real en `app/tests/e2e/training-isolation.spec.ts` (escenario 46, SC-008): con sesiones reales, la cuenta A no lee, inserta, modifica ni borra rutinas ni sesiones de B (tablas y funciones), no puede iniciar ni guardar la sesión de B, y una petición anónima no accede a nada
- [ ] T076 Medición (SC-001 y SC-010; escenario 48), sobre la compilación de producción (puerto 4173), registrada en `research.md`: **SC-001**: desde «Hoy», empezar con una rutina y anotar la primera serie en menos de 30 s, y registrar una sesión de 3 ejercicios con 3 series en menos de 4 minutos (guion automatizado, con el número de interacciones); **SC-010**: con datos sintéticos de **200 sesiones en un mes** y **500 sesiones de un ejercicio**, tiempo del calendario del mes, de la primera tanda de `exercise_history` y de guardar una sesión de 30 ejercicios con 20 series; si no llega a los topes (2 s, 1 s), ajustar índices o la consulta. El script de datos sintéticos queda en `specs/006-rutinas-calendario-sesiones/mediciones/`
- [ ] T077 Revisión de seguridad dirigida, registrada en `verification.md` (FR-050, FR-053, FR-054):
  - el cliente no inserta ni actualiza ninguna tabla de entrenamiento directamente;
  - las funciones no aceptan rutinas, sesiones ni ejercicios ajenos;
  - las instantáneas son inmutables y no hay `cascade` hacia `exercises`;
  - ningún `console.*`, registro ni mensaje de error contiene el contenido de un entrenamiento;
  - el borrador de la sesión se borra al cerrar sesión;
  - sin inyección de SQL (no hay consultas dinámicas; verificar);
  - `check:secrets`.

  Corregir los hallazgos con TDD.
- [ ] T078 [P] Documentación:
  - `supabase/README.md`: tablas, funciones, estados y transiciones, regla de «modificada», revisión y autoguardado;
  - `README.md`: estado;
  - `Documentacion/roadmap-specs.md`: spec 006 implementada y qué queda para la 012;
  - `specs/012-graficos-progreso-entrenamiento/spec.md`: revisar que sus supuestos coinciden con lo implementado.
- [ ] T079 Ejecutar los 48 escenarios del `quickstart.md` y registrar el resultado en `specs/006-rutinas-calendario-sesiones/verification.md`
- [ ] T080 Ejecutar `format:check`, `lint`, `typecheck`, `test`, `e2e` (por partes; revisar antes la memoria libre, Docker y las funciones servidas), `test:db`, `test:functions`, `test:import`, `test:config` y `check:secrets`; todo en verde antes de dar la spec por terminada

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup. **Bloquea todas las historias**. Orden en la base: T003 → T004 → T005/T006 → T007; el frontend (T008 a T015) es independiente de la base salvo T015, que define los tipos
- **User Stories (Phase 3+)**: dependen de Foundational. US1 abre el camino (editor y guardado); US2, US3, US4 y US5 se apoyan en US1; US6 solo agrega pantallas sobre lo que ya existe
- **Polish (Phase 9)**: depende de las historias deseadas

### User Story Dependencies

- **US1 (P1)**: después de Foundational. Es el MVP: no necesita rutinas ni calendario
- **US2 (P1)**: después de Foundational; independiente de US1 en la base (sus funciones no usan sesiones), pero su pantalla de inicio de entrenamiento nace en US1
- **US3 (P1)**: después de US1 (editor, `save_workout`) y US2 (rutinas)
- **US4 (P2)**: después de US1 y US2 (planifica sesiones desde rutinas) y se integra con US3 (iniciar una sesión planificada con plan)
- **US5 (P2)**: después de US1 (necesita sesiones realizadas); independiente de US2 a US4
- **US6 (P3)**: después de US1 (corrección y borrado usan el guardado y las políticas de borrado)

### Within Each User Story

- Las pruebas se escriben primero y deben **fallar** antes de implementar
- Migraciones antes del código que las usa
- Acceso a datos y lógica pura antes de las pantallas
- `api.ts`, `es.ts`, `SessionPage.tsx`, `SessionEditor.tsx` y `routes/index.tsx` los tocan varias historias: esas tareas son secuenciales

### Parallel Opportunities

- Setup: T001 con T002 (T002 solo lee)
- Foundational: T005, T008, T010, T012 y T014 (pruebas) en paralelo
- Cada historia: todas sus pruebas marcadas [P] en paralelo, y las partes puras ([P]) de la implementación
- US2 y US5 pueden avanzar en paralelo una vez hecha US1, salvo los archivos compartidos
- Polish: T073, T074, T075 y T078

---

## Parallel Example: Foundational

```bash
# Pruebas que se pueden escribir a la vez (deben fallar):
Task: "Pruebas de texto en app/tests/unit/trainingText.test.ts"
Task: "Pruebas de esquemas en app/tests/unit/trainingSchema.test.ts"
Task: "Prueba de lenguaje neutral en app/tests/unit/trainingCopy.test.ts"
Task: "Pruebas de errores en app/tests/unit/trainingErrors.test.ts"
Task: "Guardián de RLS en supabase/tests/rls_guardrail.test.sql"
```

---

## Implementation Strategy

### MVP primero (US1)

1. Setup y Foundational
2. US1: registrar una sesión, guardarla sin perder datos y terminarla
3. **DETENERSE Y VALIDAR**: escenarios 1 a 9 y 43 a 45 del `quickstart.md`. Ya se puede anotar un entrenamiento real

### Entrega incremental

1. Foundational → base lista
2. US1 → MVP (sesiones libres)
3. US2 → rutinas
4. US3 → entrenar con una rutina, plan frente a realizado
5. US4 → calendario, reprogramar y cancelar
6. US5 → historia de un ejercicio
7. US6 → corregir y eliminar
8. Polish → accesibilidad, aislamiento, medición, seguridad, documentación y suite completa

### Riesgos conocidos

- **El editor de sesión** (T018, T019, T027 a T031): la pantalla más compleja del proyecto. La lógica va en un reductor puro y en un hook probados antes de la interfaz; si el autoguardado resulta frágil, se simplifica a guardar al terminar más un botón explícito «Guardar avance», sin tocar el contrato de `save_workout`
- **Regla de «modificada»** (T042): se fija con la tabla de casos antes de implementarla; cualquier caso dudoso se documenta en `data-model.md`
- **Concurrencia entre dispositivos** (T019, T023): la revisión evita pisar en silencio; la resolución del conflicto es una decisión de la persona
- **Cambio del tipo de medición de un ejercicio con rutinas** (T041, T034, T046): tratamiento explícito con `targets_dropped`
- **Tamaño**: son 80 tareas; se commitea al cerrar cada grupo de pruebas y cada capa de implementación

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- [Story] vincula la tarea con su historia para la trazabilidad
- Cada historia se puede completar y probar por separado (salvo los archivos compartidos, ver arriba)
- Verificar que las pruebas fallen antes de implementar
- Confirmar (commit) después de cada tarea o grupo lógico; marcar `[X]` al terminar cada tarea
- La suite de extremo a extremo se ejecuta por partes si la memoria del equipo no alcanza
- Los gráficos de progreso no forman parte de esta spec (spec 012)

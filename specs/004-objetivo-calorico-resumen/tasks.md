---

description: "Lista de tareas de la spec 004: objetivo calórico y resumen diario"
---

# Tasks: Objetivo calórico y resumen diario

**Input**: documentos de diseño en `/specs/004-objetivo-calorico-resumen/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (`database-api.md`, `ui-routes.md`), quickstart.md. Las specs 001 a 003 están en la rama base (la 003 está pendiente de integrar en `main`; esta rama sale de ella).

**Tests**: INCLUIDOS. Los exige la Constitution (Principio VIII) y el flujo TDD del proyecto. En cada historia, las pruebas se escriben primero y se verifica que **fallen por la razón correcta** antes de implementar (skill `test-driven-development`). Cada prueba referencia el requisito (FR-xxx) o el escenario del `quickstart.md` que verifica. Skills: `database-design` (migración, RLS, función), `nutrition-domain-rules` (cálculos, faltantes, lenguaje), `frontend-design` (interfaz), `systematic-debugging` (fallos).

**Organization**: tareas agrupadas por historia de usuario, numeradas como en `spec.md` (US1 a US5). Las pruebas pgTAP no dependen de datos locales: crean sus propios usuarios y filas (lección de las specs 002 y 003) y, si cuentan filas o archivos, filtran por los usuarios de la prueba.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US5)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

- Frontend: `app/src/features/goals/`, pruebas en `app/tests/{unit,component,e2e}/` y `app/tests/support/`
- Backend: `supabase/migrations/` (prefijo `20261020`), `supabase/tests/` (pgTAP)
- Documentación: `Documentacion/`, `supabase/README.md` y `specs/004-objetivo-calorico-resumen/`

## Decisiones de implementación que las tareas dan por fijadas

- `created_at` de `energy_goals` lo fija la función con el parámetro `ahora` (la versión pública pasa `now()`), para que las pruebas con hora simulada puedan ordenar cambios; es la misma regla de `data-model.md` ("`created_at` define cuál cambio es el último").
- Las cifras se muestran con el formateador de kcal de `app/src/features/foods/nutrition.ts` (`es-AR`, con separador de miles también en cuatro cifras: "1.350").
- El tipo del historial es `{ effective_from: string; kcal: number | null; created_at: string }` y el del resumen es el de `data-model.md` (campos del objetivo ausentes cuando `state = 'none'`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: la lista de términos prohibidos y la línea base verde

- [X] T001 [P] Lista de términos prohibidos (Principio IV, `research.md` Decisión 5):
  - Pruebas primero en `app/tests/unit/forbiddenTerms.test.ts` (deben fallar): `findForbidden(texto)` devuelve los términos hallados sin importar mayúsculas ni acentos; detecta "ayuno", "Compensa con ejercicio", "te pasaste", "eso está mal" y "tienes que"; **no** marca "Restan 650 kcal.", "normal", "Registraste 250 kcal más que el objetivo de este día." ni "Si tienes dudas sobre tu alimentación, puedes consultar a un profesional de la salud.".
  - Después `app/tests/support/forbiddenTerms.ts`: exporta `FORBIDDEN_TERMS` (la lista inicial de `research.md`: ayun, saltar, saltea, compens, quemar, quema, ejercicio, entren, culpa, fall, excedi, exceso, pasaste, pasarte, mal, malo, prohib, castig, engord, limit, restring, dieta, deber, "tenes que", "tienes que", "hay que") y `findForbidden`. Cada término coincide **al comienzo de una palabra** (`mal` solo como palabra completa), para que "normal" no se marque.
  - Verificar que `tsconfig.app.json` / `tsconfig.e2e.json` incluyen `tests/support/` (el e2e también la importa).
- [X] T002 [P] Línea base: con la base local arriba, ejecutar `npm run test:db`, `npm test --prefix app`, `npm run lint --prefix app` y `npm run typecheck --prefix app` y registrar que parten en verde (si algo falla, corregirlo antes de seguir, con `systematic-debugging`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tabla, seguridad, cálculos puros, textos y la corrección de la caché que necesitan todas las historias

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase

### Base de datos (skill `database-design`)

- [X] T003 Prueba pgTAP en `supabase/tests/energy_goals_schema.test.sql` (escribir primero, debe fallar). Debe cubrir:
  - columnas y tipos de `data-model.md` (`id` uuid, `user_id`, `effective_from` date, `kcal` integer **nulo permitido**, `client_request_id` uuid, `created_at`);
  - `check (kcal is null or kcal between 1000 and 6000)`: 999 y 6001 se rechazan; 1000, 6000 y nulo se aceptan;
  - `check (effective_from >= date '2000-01-01')`;
  - único `(user_id, client_request_id)`;
  - existe el índice `(user_id, created_at desc)`;
  - `user_id` → `auth.users` con `on delete cascade`: **eliminar la cuenta borra su historial** y deja intacto el de otra cuenta (FR-028).
- [X] T004 Migración `supabase/migrations/20261020000100_energy_goals.sql`: `public.energy_goals` con las columnas, restricciones e índices de `data-model.md`; **RLS activado sin políticas** y `revoke all` para `anon` y `authenticated` (el mismo patrón que `20261019000100_meal_tables.sql`)
- [X] T005 [P] Prueba pgTAP en `supabase/tests/energy_goals_rls.test.sql` (escribir primero, debe fallar). Debe cubrir:
  - la cuenta B no ve, modifica ni borra las filas de A (FR-023);
  - con la sesión vencida no se ve nada; `anon` no accede;
  - el cliente (`authenticated`) **solo puede hacer `select`** de lo propio: `insert`, `update` y `delete` directos fallan (la escritura es solo por `set_energy_goal`).
- [X] T006 Migración `supabase/migrations/20261020000200_energy_goals_rls.sql`: permiso `select` para `authenticated` y política de lectura con `user_id = (select auth.uid())` y `(select private.is_session_fresh())` (evaluada una vez por consulta)
- [X] T007 [P] Ayudantes de prueba en `supabase/seed.sql` (solo local): `tests.create_energy_goal(user_id uuid, effective_from date, kcal integer, created_at timestamptz default now())` y `tests.create_pending_estimate(user_id uuid, log_date date, meal text, energy_kcal numeric)`, que inserta un ítem `origin = 'estimated'`, `status = 'pending'` respetando las reglas del disparador de la spec 003 (lo usan los e2e de US3 y US4). Comprobar que `supabase/tests/rls_guardrail.test.sql` y la prueba de rendimiento de políticas de la spec 002 siguen en verde con la tabla nueva, **sin cambios** en ellas (si fallan, la tabla o la política incumplen la convención: corregir la migración, no la prueba)

### Cálculos puros del frontend (skill `nutrition-domain-rules`)

- [X] T008 [P] Pruebas unitarias en `app/tests/unit/goalHistory.test.ts` (escribir primero, deben fallar). Casos de tabla de `goalOn(history, day)` y `currentGoal(history, today)` (`research.md` Decisiones 1 y 3):
  - sin filas → sin objetivo;
  - el ejemplo de `data-model.md` (2.000 el 1/10, 1.800 y 1.900 el 12/10, nulo el 15/10): antes del 1/10 sin objetivo, 1/10 a 11/10 → 2.000, 12/10 a 14/10 → 1.900, desde el 15/10 sin objetivo;
  - dos cambios el mismo día: gana el de `created_at` más reciente (FR-009), sin importar el orden del arreglo;
  - **zona que retrocede**: un cambio guardado después con `effective_from` menor gana sobre uno guardado antes con `effective_from` mayor para los días en que ambos rigen;
  - fila con `effective_from` posterior al día consultado se ignora; quitar y volver a fijar (FR-010);
  - fecha futura dentro de los 7 días rige con el valor vigente hoy (FR-011);
  - `currentGoal` devuelve valor y "vigente desde" = `effective_from` de la primera fila de la racha consecutiva con el mismo valor (guardar el mismo valor otra vez **no** mueve la fecha), y `none` si el último cambio es nulo.
- [X] T009 Implementar `app/src/features/goals/goalHistory.ts` (tipos `GoalChange`, `goalOn`, `currentGoal`) para que pasen las pruebas de T008
- [X] T010 [P] Pruebas unitarias en `app/tests/unit/daySummary.test.ts` (escribir primero, deben fallar). Casos de tabla de `summarizeDay(entries, goal)` (`data-model.md`, `research.md` Decisión 4):
  - 1.350 con objetivo 2.000 → `under`, restan 650, `percent` 68; la cuenta usa el total ya redondeado;
  - exactamente 2.000 → `met`, restan 0; 2.250 → `over`, `difference` 250;
  - día vacío con objetivo → `registered` 0, restante = objetivo, `under`, `percent` 0;
  - un ítem con energía `0` es dato (no suma a `missing`); `energy_kcal` nulo suma a `missing` y `lowerBound = true`;
  - ítems `pending` suman a `registered` y su parte va en `pending` (redondeada una vez); manuales, del catálogo y confirmados cuentan como confirmados;
  - suma primero y redondeo después (p. ej. 0,4 + 0,4 + 0,4 = 1, no 0);
  - **sin objetivo** (`goal` ausente o nulo): `state = 'none'` y las propiedades `goal`, `remaining`, `difference` y `percent` **no existen** en el resultado (`'goal' in result === false`), con `registered`, `pending` y `missing` correctos (FR-002, SC-009);
  - coincide con el total de energía de `mealTotals` de la spec 003 para los mismos ítems (SC-003);
  - rendimiento: 60 ítems se resumen en menos de 5 ms (riesgo 3 del plan).
- [X] T011 Implementar `app/src/features/goals/daySummary.ts` (`summarizeDay`) para que pasen las pruebas de T010; reutiliza `sumEntries` de `mealTotals.ts` (devuelve la suma sin redondear) y redondea **una sola vez** para `registered` y `pending`
- [X] T012 [P] Pruebas unitarias en `app/tests/unit/goalCopy.test.ts` (escribir primero, deben fallar): recorrer **todos** los textos de `copy.goal` (cadenas y funciones de texto llamadas con valores de ejemplo para cada estado: `under`, `met`, `over`, con y sin ítems sin dato, con estimados, con y sin objetivo, las cuatro validaciones y la nota de menos de 1.200 kcal) y exigir que `findForbidden` devuelva vacío; exigir además que existan los textos de `contracts/ui-routes.md` (frases de los tres estados, "Restan como máximo…", "Registraste al menos…", "Incluye … estimadas…", "Registrado: al menos…", los cuatro mensajes de validación, la nota informativa y el texto del desplegable); y que ningún texto use "tú"-imperativo coercitivo ("debes", "tienes que")
- [X] T013 Textos en español de la spec en `app/src/copy/es.ts` bajo la clave `goal`, con el contenido de `contracts/ui-routes.md` (pantalla, tarjeta, estados, aclaraciones, "Cómo se calcula", validaciones, diálogo de quitar, nota informativa, estados de carga/vacío/error). Las cifras se formatean con el formateador de kcal de `features/foods/nutrition.ts`. Hace pasar T012

### Caché de consultas por sesión (FR-029, `research.md` Decisión 9)

- [X] T014 Prueba de componente en `app/tests/component/AuthProvider.test.tsx` (ampliar; escribir primero, debe fallar), con un `QueryClient` real dentro del proveedor y datos sembrados en la caché:
  - tras `SIGNED_OUT` la caché queda vacía;
  - tras sesión vencida (`session_expired`) la caché queda vacía;
  - tras `SIGNED_IN` con **otro** `user.id` la caché queda vacía antes de que los componentes lean datos nuevos;
  - `SIGNED_IN` / `TOKEN_REFRESHED` del **mismo** usuario no vacía la caché (no se tira la carga por cada renovación de token);
  - una consulta de la cuenta anterior que sigue en curso y resuelve **después** del cierre de sesión no vuelve a llenar la caché.
- [X] T015 Implementar en `app/src/features/auth/AuthProvider.tsx`: usar `useQueryClient()` (el proveedor ya está dentro de `QueryClientProvider` en `main.tsx`) y llamar `queryClient.cancelQueries()` y luego `queryClient.clear()` al cerrar sesión, al vencer la sesión y al cambiar el `user.id`; recordar el último `user.id` en una referencia. No se cambian las claves de caché. Hace pasar T014 y no rompe `AuthProvider.test.tsx` ni `session-ui.test.tsx`

**Checkpoint**: tabla y seguridad listas; `goalOn`, `summarizeDay` y los textos probados; la caché ya no se filtra entre cuentas.

---

## Phase 3: User Story 1 - Fijar mi objetivo de energía diaria (Priority: P1) 🎯 MVP

**Goal**: la persona fija un objetivo (1.000 a 6.000 kcal), lo ve y lo cambia; sin objetivo la app no muestra nada del objetivo.

**Independent Test**: cuenta nueva → el día no muestra objetivo ni restantes; fijar 2.000 → "Objetivo guardado. Rige desde hoy." y el valor vigente se ve al reabrir `/objetivo`.

### Tests for User Story 1 ⚠️ (escribir primero y verificar que FALLAN)

- [X] T016 [P] [US1] Prueba pgTAP en `supabase/tests/set_energy_goal.test.sql`. Debe cubrir (`contracts/database-api.md`; FR-001, FR-003 a FR-006, FR-023, FR-024):
  - fija 2.000 y devuelve `{effective_from, kcal}`; `effective_from` es el "hoy" de la persona;
  - rechaza 999 y 6001 con `invalid_goal:out_of_range:kcal`, y un `request_id` nulo con `invalid_goal:request_required:request_id`; acepta 1.000, 6.000 y `null` (quitar);
  - **idempotencia**: el mismo `request_id` dos veces deja **una** fila y devuelve la misma; un reintento tardío (después de otro cambio) devuelve la fila original y **no** agrega ni pisa nada;
  - con la sesión vencida o sin sesión falla con `session_expired`; `anon` no puede ejecutarla; `authenticated` sí; la versión `private.set_energy_goal_at` no es ejecutable por los roles de la API;
  - la cuenta A no puede crear ni cambiar filas de B (la función solo opera sobre quien llama);
  - sin `client_timezone` ni zona de perfil usa UTC; con `client_timezone` y perfil sin zona usa la del cliente; con zona en el perfil ignora la del cliente.
- [X] T017 [P] [US1] Pruebas unitarias en `app/tests/unit/goalSchema.test.ts` (casos de tabla de la regla de `research.md` Decisión 7; FR-003, FR-004):
  - se leen como número `2000`, `2.000`, `1.250`, `2000,0` (→ 2000) y `" 2000 "`; `12.000` se lee como 12000 y el rango lo rechaza;
  - se rechazan con el mensaje correcto: vacío ("Escribe el objetivo en kcal."), `abc`, `-2000`, `2e3` ("Escribe solo números, por ejemplo 2000."), `1800,5`, `1800.5`, `1.5` ("Escribe el objetivo en kcal enteras, sin decimales.") y `999`, `6001`, `20000` ("El objetivo debe estar entre 1.000 y 6.000 kcal.");
  - 1.000 y 6.000 se aceptan; 1.199 se acepta (la nota informativa es de la interfaz, no del esquema).
- [X] T018 [P] [US1] Pruebas unitarias en `app/tests/unit/goalsApi.test.ts`: `fetchGoalHistory` consulta `energy_goals` con `select effective_from, kcal, created_at`, orden `created_at` descendente y `limit 1000`; `saveGoal(kcal, requestId, timezone)` llama a `set_energy_goal` con `kcal`, `request_id` y `client_timezone`, y `kcal = null` quita; los errores `session_expired` e `invalid_goal:*` se traducen a `WriteError` de `lib/mutation.ts` sin mostrar el texto del servidor
- [X] T019 [P] [US1] Pruebas de componente en `app/tests/component/GoalPage.test.tsx` (escenarios 2 a 7):
  - estados: "Cargando el objetivo…", sin objetivo ("Todavía no fijaste un objetivo"), con objetivo ("Vigente: 2.000 kcal, desde el …"), error de carga con "Reintentar";
  - validaciones por campo con los cuatro mensajes, sin llamar al servidor; `2.000` y `2000,0` se envían como 2000;
  - al guardar muestra "Objetivo guardado. Rige desde hoy." y el valor vigente se actualiza; el historial en caché se invalida;
  - **doble clic**: una sola llamada (mismo `request_id`);
  - fallo de red o del servidor: aviso "No se guardó…", el valor escrito se conserva y reintentar reutiliza el `request_id`;
  - borrador: lo escrito se restaura al volver (`useDraft`, identificador `energy-goal`) y se borra al guardar;
  - **sesión vencida al guardar** (`session_expired`): se pide ingresar de nuevo y el borrador se conserva;
  - `?volver=AAAA-MM-DD` válido vuelve a ese día al terminar; inválido o ausente vuelve a `/comidas`;
  - explicación "Es una referencia que eliges tú. MyGuide no la cambia sola." y aclaración de que rige desde hoy.
- [X] T020 [P] [US1] Pruebas de componente en `app/tests/component/GoalSummary.test.tsx` (parte "sin objetivo"; FR-002, SC-009): con el día sin objetivo se ve solo "Registrado: 1.350 kcal"; con el día de hoy o futuro, el enlace "Fijar un objetivo de energía (opcional)" a `/objetivo?volver=<día>`; con un día pasado, ni el enlace; **en ningún caso** hay restantes, porcentaje, barra, `role="progressbar"` ni textos del objetivo, ni vacíos ni en cero. Ampliar `app/tests/component/DayPage.test.tsx`: la tarjeta aparece arriba del total del día y el total de la spec 003 no cambia
- [X] T021 [US1] Prueba e2e en `app/tests/e2e/goals-set.spec.ts` (escenarios 1 a 7, por la API real): cuenta nueva sin objetivo en el día (con ítems sembrados) → sin restantes, porcentaje ni barra, con la invitación; fijar 2.000 desde la invitación en 3 interacciones; el valor vigente persiste al recargar; 999, 6.001, vacío, `abc` y `1800,5` se rechazan sin guardar; `2.000` y `2000,0` se guardan como 2.000; doble clic deja **una** fila (`dbQuery`); con la red cortada al guardar aparece el aviso y se conserva el valor y reintentar funciona; el borrador vuelve tras recargar y se borra al cerrar sesión

### Implementation for User Story 1

- [X] T022 [P] [US1] Migración `supabase/migrations/20261020000300_set_energy_goal.sql`: `private.set_energy_goal_at(usuario, kcal, request_id, ahora, zona)` (idempotencia por `request_id` incluido el reintento tardío, rango, `effective_from` = la columna **`today`** (no `proposed_date`) de `private.log_day_status_at(usuario, ahora, private.effective_timezone(usuario, client_timezone))`, `created_at = ahora`; la carrera por el índice único devuelve la fila de la ganadora) y `public.set_energy_goal(kcal integer, request_id uuid, client_timezone text default null)` `security definer` con `search_path = ''`, `auth.uid()` y `private.is_session_fresh()`; `revoke` a `public`/`anon` y `grant execute` a `authenticated`. Hace pasar T016
- [X] T023 [P] [US1] `app/src/features/goals/schema.ts` (lectura del número en el orden de `research.md` Decisión 7, rango 1.000 a 6.000 con los mensajes de `copy.goal`) para que pasen las pruebas de T017
- [X] T024 [US1] `app/src/features/goals/api.ts` (`fetchGoalHistory`, `saveGoal` con `saveRemotely` y `newRequestId`) y `app/src/features/goals/useGoalHistory.ts` (consulta con clave `['goals', 'history']`, invalidada al guardar; `retry` heredado; **`staleTime` de 30 s**: navegar entre días dentro de ese lapso no pide nada y volver a enfocar la ventana, ya vencido, vuelve a pedir el historial). Hace pasar T018
- [X] T025 [US1] `app/src/features/goals/GoalPage.tsx` (título, explicación, valor vigente con `currentGoal`, campo "Energía por día (kcal)" con ayuda "Entre 1.000 y 6.000", "Guardar objetivo", aclaración, estados de carga/vacío/error/éxito, borrador con `useDraft`, `?volver`) y la ruta `/objetivo` en `app/src/routes/index.tsx` bajo `RequireAuth`. Hace pasar T019
- [X] T026 [US1] `app/src/features/goals/GoalSummary.tsx` en su variante **sin objetivo** (sección con título accesible "Objetivo del día", "Registrado: …" y la invitación solo hoy/futuro) y montarla en `app/src/features/meals/DayPage.tsx` con una sola línea, arriba del total del día. Hace pasar T020; el e2e de T021 queda en verde

**Checkpoint**: la persona puede fijar y ver su objetivo; sin objetivo, el día no muestra nada de él. Escenarios 1 a 7.

---

## Phase 4: User Story 2 - Ver cuánto llevo y cuánto me queda hoy (Priority: P1)

**Goal**: con objetivo, el día muestra objetivo, registrado, restante, la cuenta y el avance, y se actualiza al instante.

**Independent Test**: objetivo 2.000 y 1.350 kcal → "Restan 650 kcal", "2.000 − 1.350 = 650 kcal", "68 % del objetivo"; agregar un ítem de 200 kcal actualiza todo sin recargar.

### Tests for User Story 2 ⚠️

- [X] T027 [P] [US2] Ampliar `app/tests/component/GoalSummary.test.tsx` (parte "con objetivo", estados `under` y `met`; FR-012, FR-013, FR-021): objetivo, registrado, "Restan 650 kcal", cuenta "2.000 − 1.350 = 650 kcal", "68 % del objetivo" como texto; la barra mide `min(percent, 100)` %, está `aria-hidden` y no es un `progressbar`; `met` dice "Restan 0 kcal. Lo registrado coincide con el objetivo." con la cuenta "2.000 − 2.000 = 0 kcal" y sin frase de exceso; día vacío → 0 registradas y el objetivo completo como restante, sin tono de fallo; enlace "Cambiar objetivo" a `/objetivo?volver=<día>`
- [X] T028 [P] [US2] Ampliar `app/tests/component/DayPage.test.tsx` (FR-014):
  - el resumen se recalcula cuando cambian los ítems del día (agregar, editar, mover y eliminar con los mismos datos de la vista);
  - al navegar al día anterior y volver (dentro del `staleTime` de 30 s), cada día usa **su** objetivo (`goalOn`) y su total, sin pedidos de red extra del historial;
  - el día que se cierra (regla de la una de la madrugada, spec 003) muestra el resumen de ese día con su fecha visible;
  - si falla solo la consulta del historial, el día se ve igual y la tarjeta muestra "No pudimos cargar el objetivo" con "Reintentar" que vuelve a pedir el historial.
- [X] T029 [US2] Prueba e2e en `app/tests/e2e/goals-summary.spec.ts` (escenarios 8 a 12): ítems sembrados por SQL y objetivo fijado por la interfaz; cifras y cuenta de 650; agregar un ítem y ver el cambio sin recargar; ir al día anterior y volver; día vacío con objetivo; a la una de la madrugada (`zoneWhereItIsOneAm`) con el día que se cierra

### Implementation for User Story 2

- [X] T030 [US2] Completar `GoalSummary.tsx` con la variante **con objetivo** (estados `under` y `met`, cuenta visible, porcentaje como texto, barra decorativa, enlace "Cambiar objetivo", estado de error de carga con "Reintentar") alimentada por `useGoalHistory`, `goalOn` y `summarizeDay` sobre los ítems que ya trae `useDay` (sin consultas nuevas por día); ajustar `DayPage.tsx` para pasar el día y los ítems. Hace pasar T027 y T028

**Checkpoint**: escenarios 8 a 12. US1 y US2 juntas son el MVP.

---

## Phase 5: User Story 3 - Entender qué tan firme es la cifra (Priority: P1)

**Goal**: el resumen separa lo estimado sin confirmar, marca los ítems sin dato y explica el cálculo.

**Independent Test**: un día con un ítem sin energía y uno estimado pendiente → el resumen los señala por separado, dice cuántos faltan y el restante lleva su aclaración.

### Tests for User Story 3 ⚠️

- [X] T031 [P] [US3] Ampliar `app/tests/component/GoalSummary.test.tsx` (aclaraciones de incertidumbre; FR-015 a FR-018):
  - `missing > 0`: "Restan como máximo 650 kcal. 2 ítems no tienen dato de energía y no suman." (y en singular "1 ítem no tiene dato de energía y no suma."), también en `met` ("Restan como máximo 0 kcal.");
  - `pending > 0`: "Incluye 300 kcal estimadas que todavía no confirmaste. Lo que resta depende de esa estimación.";
  - sin objetivo y con ítems sin dato: "Registrado: al menos 1.350 kcal. 2 ítems no tienen dato de energía y no suman." (sigue sin restantes ni porcentaje);
  - **todos con energía y confirmados: ninguna aclaración** (FR-017); un ítem con energía 0 no cuenta como faltante;
  - el desplegable "Cómo se calcula" se abre con el teclado y contiene las cuatro explicaciones de `contracts/ui-routes.md`.
- [X] T032 [US3] Prueba e2e en `app/tests/e2e/goals-uncertainty.spec.ts` (escenarios 13 a 16): ítem manual sin energía → "Restan como máximo…" con la cuenta de ítems faltantes; ítem estimado pendiente sembrado por SQL (`origin = 'estimated'`, `status = 'pending'`) → entra en lo registrado y se muestra aparte con su aclaración; día completo y confirmado → ninguna aclaración; abrir "Cómo se calcula"

### Implementation for User Story 3

- [X] T033 [US3] En `GoalSummary.tsx`: aclaraciones "como máximo" / "al menos" según `lowerBound`, subtotal estimado con su aclaración, variante sin objetivo con "al menos", y el desplegable `<details>` "Cómo se calcula" con los textos de `copy.goal`. Hace pasar T031

**Checkpoint**: escenarios 13 a 16.

---

## Phase 6: User Story 4 - Si supero el objetivo, solo se me informa (Priority: P1)

**Goal**: al superar el objetivo se informa la diferencia en lenguaje neutral y sin estilo de alarma; por debajo de 1.200 kcal hay una nota informativa.

**Independent Test**: objetivo 2.000 y 2.250 registradas → "Registraste 250 kcal más que el objetivo de este día.", sin sugerencias, sin color de error ni íconos de advertencia y sin términos prohibidos en el texto de la pantalla.

### Tests for User Story 4 ⚠️

- [X] T034 [P] [US4] Ampliar `app/tests/component/GoalSummary.test.tsx` (estado `over`; FR-019, FR-020, FR-022, SC-005):
  - frase "Registraste 250 kcal más que el objetivo de este día." y cuenta "2.250 − 2.000 = 250 kcal"; con ítems sin dato, "Registraste al menos 250 kcal más…";
  - la barra llega a 100 % y **no cambia** respecto de `under`: mismas clases, sin el color `danger`, sin `role="alert"`, sin íconos de advertencia, sin cambio de peso tipográfico;
  - **todo el texto renderizado** de la tarjeta en cada estado (`none`, `under`, `met`, `over`, con faltantes y con estimados) pasa `findForbidden` (sin leer los nombres que escribe la persona);
  - no hay rachas, puntajes, insignias ni comparaciones.
- [X] T035 [P] [US4] Pruebas de componente de la nota informativa en `app/tests/component/LowGoalNote.test.tsx` y ampliando `GoalPage.test.tsx` / `GoalSummary.test.tsx` (FR-005): con 1.100 kcal se guarda y se muestra la nota ("El objetivo está por debajo de 1.200 kcal. Si tienes dudas sobre tu alimentación, puedes consultar a un profesional de la salud.") tanto después de guardar como al ver el objetivo guardado y en la tarjeta del día; con 1.200 o más no aparece; sin color ni ícono de advertencia y con texto que pasa `findForbidden`
- [X] T036 [US4] Prueba e2e en `app/tests/e2e/goals-over.spec.ts` (escenarios 17 a 20): registrar 2.250 con objetivo 2.000 → frase factual; `findForbidden` sobre el `innerText` de la tarjeta y de `/objetivo`; el color calculado de la barra y del texto del estado no es el de `danger` y no hay íconos de advertencia; exactamente 2.000 → "Restan 0 kcal"; fijar 1.100 muestra la nota; varios días seguidos por encima del objetivo (sembrados) no cambian el objetivo ni muestran avisos, rachas ni castigos

### Implementation for User Story 4

- [X] T037 [US4] En `GoalSummary.tsx`: estado `over` (frase, cuenta, "al menos" cuando falta energía) con los mismos estilos neutros que `under`, sin `danger`, sin íconos y con la barra al tope. Hace pasar T034
- [X] T038 [P] [US4] `app/src/features/goals/LowGoalNote.tsx` (nota para menos de 1.200 kcal, sin color ni ícono de advertencia) e integrarla en `GoalPage.tsx` y `GoalSummary.tsx`. Hace pasar T035

**Checkpoint**: escenarios 17 a 20.

---

## Phase 7: User Story 5 - Revisar, cambiar o quitar el objetivo sin alterar el pasado (Priority: P2)

**Goal**: cambiar rige desde hoy y quitar deja sin objetivo desde hoy; los días anteriores conservan el suyo y la app nunca lo modifica sola.

**Independent Test**: con 2.000 desde hace una semana, cambiar a 1.800 hoy → hoy 1.800 y ayer 2.000; quitar → hoy sin restantes y ayer con su objetivo.

### Tests for User Story 5 ⚠️

- [X] T039 [P] [US5] Prueba pgTAP de caracterización (pasa desde el inicio porque T022 ya implementó la función; fija la regla del historial contra regresiones) en `supabase/tests/energy_goal_history.test.sql` (hora simulada con `private.set_energy_goal_at`; FR-008 a FR-010, SC-004, riesgos 1 y 2 del plan):
  - cambiar de 2.000 a 1.800 agrega una fila y **no modifica** la anterior (el recuento y el contenido de las filas previas no cambian);
  - dos cambios el mismo día: ambas filas existen y la de `created_at` mayor es el último;
  - quitar (`null`) agrega una fila nula sin tocar las anteriores; volver a fijar rige desde ese día;
  - **01:00 del día nuevo en la zona del perfil** mientras se registra el día que se cierra: `effective_from` es el día nuevo;
  - **cambio de zona del perfil** (p. ej. de `Pacific/Auckland` a `America/Argentina/Buenos_Aires`): las filas ya guardadas conservan su `effective_from`, y un cambio posterior con zona que retrocede queda ordenado por `created_at`;
  - la cuenta B no ve el historial de A.
- [X] T040 [P] [US5] Ampliar `app/tests/component/GoalPage.test.tsx` (FR-001, FR-007, FR-010):
  - "Vigente: 1.800 kcal, desde el 12 de octubre" tras un cambio; guardar el mismo valor otra vez no mueve la fecha;
  - "Quitar objetivo" aparece solo si hay objetivo, abre `ConfirmDialog` (foco inicial en "Cancelar", Escape cancela, el foco vuelve al disparador) y al confirmar guarda `kcal = null` y muestra "Objetivo quitado. Rige desde hoy.";
  - tras quitar, la pantalla vuelve a "Todavía no fijaste un objetivo" y se puede fijar de nuevo;
  - ninguna parte de la interfaz llama a `set_energy_goal` por sí sola (la app nunca cambia el valor: se verifica que solo se invoca por la acción explícita de la persona).
- [X] T041 [P] [US5] Ampliar `app/tests/component/DayPage.test.tsx`: con un historial de dos valores, el día de hoy usa el nuevo y el de ayer el anterior; un día anterior a la primera fila muestra solo lo registrado; una fecha futura (hasta 7 días) muestra el objetivo vigente hoy; al recuperar el foco de la ventana, con el historial ya vencido (reloj simulado más allá de los 30 s), se vuelve a pedir (cambio hecho en otra pestaña, `refetchOnWindowFocus`); comprobar que el valor por defecto de `main.tsx` no lo desactiva
- [X] T042 [US5] Prueba e2e en `app/tests/e2e/goals-history.spec.ts` (escenarios 21 a 27): cambiar de 2.000 a 1.800 con filas sembradas hace una semana (`tests.create_energy_goal`) → hoy 1.800 y ayer 2.000; dos cambios el mismo día; quitar y volver a fijar con los días intermedios sin objetivo; días anteriores a la primera vez sin objetivo; fecha futura cercana; cambiar la zona del perfil y comprobar que los días ya vividos conservan su objetivo; cambiar el objetivo a la una de la madrugada con el día que se cierra (`zoneWhereItIsOneAm`)

### Implementation for User Story 5

- [X] T043 [US5] En `GoalPage.tsx`: "Quitar objetivo" con `components/ConfirmDialog.tsx` (guarda `kcal = null` con un `request_id` nuevo), mensaje "Objetivo quitado. Rige desde hoy." y la aclaración "El cambio rige desde hoy. Los días anteriores conservan el objetivo que tenían.". Hace pasar T040
- [X] T044 [US5] Verificar y, si hace falta, ajustar `GoalSummary.tsx` / `DayPage.tsx` / `main.tsx` para que cada día use `goalOn(history, día)` (sin objetivo antes de la primera fila, vigente hoy en fechas futuras) y para que la recuperación de foco vuelva a pedir el historial. Hace pasar T041. Con T039 ya verde por T022, ejecutar T042

**Checkpoint**: escenarios 21 a 27. Todas las historias funcionan.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T045 [P] Accesibilidad en `app/tests/e2e/a11y-goals.spec.ts` (escenario 30):
  - axe en `/objetivo` (sin objetivo, con objetivo, con la nota de menos de 1.200 kcal, con el diálogo de quitar abierto) y en el día con la tarjeta (sin objetivo, `under`, `over`, con faltantes y con estimados);
  - recorrido por teclado: invitación, "Cambiar objetivo", "Cómo se calcula" y el diálogo, con el foco devuelto al disparador;
  - el estado se entiende sin color (comprobación en escala de grises o sin estilos de color).
- [ ] T046 [P] Responsive en `app/tests/e2e/responsive-goals.spec.ts` (escenario 30): 375 px y escritorio sin desplazamiento horizontal, la cuenta no desborda, áreas táctiles de 44 px o más (SC-008)
- [ ] T047 [P] Aislamiento por la API real en `app/tests/e2e/goals-isolation.spec.ts` (escenario 28, SC-007): con sesiones reales, la cuenta A no puede leer, insertar, modificar ni borrar el historial de B por la tabla; `set_energy_goal` solo escribe para quien llama; una petición anónima falla; `private.set_energy_goal_at` responde 406 por la API REST
- [ ] T048 [P] Cambio de cuenta en la misma pestaña en `app/tests/e2e/session-switch.spec.ts` (escenario 31, FR-029, SC-007): la cuenta A ve su objetivo, sus ítems y una foto firmada; cierra sesión y entra la cuenta B **sin recargar** → B no ve nada de A en ningún momento (se registra el DOM desde el inicio de sesión con un observador para detectar un solo cuadro con datos de A); repetir con sesión vencida
- [ ] T049 Medición (SC-001 y SC-002; escenario 29), sobre la compilación de producción (`vite preview`, puerto 4173), registrada en `research.md`: fijar un objetivo por primera vez desde el día en 3 interacciones y menos de 20 s; día con 60 ítems y objetivo en un teléfono emulado (Pixel 7, red móvil limitada) carga completo en menos de 2 s en el percentil 95 (mismo método que `meals-measure.spec.ts`: calentamiento, 30 navegaciones con caché y 20 cargas en frío); costo de `summarizeDay` con 60 ítems
- [ ] T050 Revisión de seguridad dirigida, registrada en `verification.md` (FR-023, FR-027, FR-029):
  - el cliente solo puede leer `energy_goals`; ninguna escritura sin `set_energy_goal`;
  - ningún `console.*`, registro ni mensaje de error contiene el valor del objetivo (buscar en `app/src` y en las migraciones);
  - `saveRemotely` no muestra el texto del servidor;
  - el borrador `energy-goal` se borra al cerrar sesión;
  - la caché se vacía al cambiar de sesión (T014 y T048);
  - `npm run check:secrets --prefix app`.
  
  Corregir los hallazgos con TDD.
- [ ] T051 [P] Documentación:
  - `supabase/README.md`: tabla `energy_goals`, `set_energy_goal`, la regla de resolución por día (sin versión SQL; Decisión 3) y la cascada al eliminar la cuenta;
  - `README.md`: estado;
  - `Documentacion/roadmap-specs.md`: spec 004 integrada y fuera de alcance que queda para 007/008 (referencia calórica, mantenimiento);
  - `specs/003-registro-de-comidas/research.md` o `verification.md`: nota de que el defecto de la caché global se corrigió en la spec 004.
- [ ] T052 Ejecutar los 31 escenarios del `quickstart.md` y registrar el resultado en `specs/004-objetivo-calorico-resumen/verification.md`
- [ ] T053 Ejecutar `format:check`, `lint`, `typecheck`, `test`, `e2e` (por partes), `test:db`, `test:functions`, `test:import`, `test:config` y `check:secrets`; todo en verde antes de dar la spec por terminada

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup (T001 para T012). **Bloquea todas las historias**. Dentro de la fase: T003 → T004 → T005 → T006 → T007 (base de datos, en orden); T008 → T009, T010 → T011, T012 → T013 y T014 → T015 son pares prueba/implementación independientes entre sí
- **User Stories (Phase 3 a 7)**: dependen de Foundational
- **Polish (Phase 8)**: depende de las historias deseadas

### User Story Dependencies

- **US1 (P1)**: después de Foundational; crea la tarjeta (variante sin objetivo), la ruta `/objetivo` y la función de escritura
- **US2 (P1)**: después de US1 (usa `GoalSummary`, `useGoalHistory` y la ruta); su e2e necesita poder fijar un objetivo
- **US3 (P1)**: después de US2 (extiende la misma tarjeta)
- **US4 (P1)**: después de US2 (extiende la misma tarjeta); `LowGoalNote` también toca `GoalPage` de US1
- **US5 (P2)**: después de US1 y US2; sus pruebas de base de datos (T039) dependen solo de T022
- **US3, US4 y US5** son independientes entre sí una vez hecha US2

### Within Each User Story

- Las pruebas se escriben primero y deben **fallar** antes de implementar
- Migraciones antes del código que las usa
- Acceso a datos y esquemas antes de pantallas
- `GoalSummary.tsx` lo tocan US1 a US4: sus tareas son secuenciales (no [P] entre sí)

### Parallel Opportunities

- Setup: T001 y T002
- Foundational: T005, T007, T008, T010, T012 y T014 (pruebas y ayudantes)
- US1: T016 a T020 (pruebas) y, después, T022 y T023 en paralelo
- US2 a US5: todas las pruebas [P] de cada historia
- US3, US4 y US5 pueden avanzar en paralelo tras US2, salvo los archivos compartidos (`GoalSummary.tsx`, `GoalPage.tsx`)
- Polish: T045 a T048 y T051

---

## Parallel Example: Foundational

```bash
# Pruebas que se pueden escribir a la vez (deben fallar):
Task: "pgTAP de rls en supabase/tests/energy_goals_rls.test.sql"
Task: "Pruebas de goalOn y currentGoal en app/tests/unit/goalHistory.test.ts"
Task: "Pruebas de summarizeDay en app/tests/unit/daySummary.test.ts"
Task: "Prueba de textos y términos prohibidos en app/tests/unit/goalCopy.test.ts"
Task: "Prueba de vaciado de caché en app/tests/component/AuthProvider.test.tsx"
```

---

## Implementation Strategy

### MVP primero (US1 + US2)

1. Setup y Foundational
2. US1: fijar y ver el objetivo; sin objetivo, el día no muestra nada de él
3. US2: el resumen con objetivo en la vista del día
4. **DETENERSE Y VALIDAR**: escenarios 1 a 12 del `quickstart.md`. Ya se puede fijar un objetivo y ver cuánto resta, pero **todavía no** se aclara qué tan firme es la cifra (US3) ni cómo se informa un exceso (US4); por eso no conviene dar el MVP por usable hasta cerrar US3 y US4, que también son P1

### Entrega incremental

1. Foundational → base lista (incluye la corrección de la caché entre cuentas)
2. US1 → US2 → US3 → US4 (todo lo P1: resumen honesto y seguro)
3. US5 → historial de cambios sin reescribir el pasado
4. Polish → accesibilidad, aislamiento, medición, seguridad y documentación

### Riesgos conocidos

- **Hora y zona** (plan, riesgo 1): T016 y T039 usan la función con hora simulada; si `log_day_status_at` no admite alguna zona de prueba, ajustar la prueba, no la regla
- **Orden del historial** (riesgo 2): T008 y T039 cubren la zona que retrocede y el reintento tardío
- **Lenguaje** (riesgo 4): T001, T012, T034, T035 y T036 aplican la lista en las tres capas; la lista es una red de seguridad y el texto se revisa a mano
- **Caché** (riesgo 5): T014 y T048; si `clear()` produjera un parpadeo al renovar el token, T014 exige que solo se vacíe al cambiar de usuario

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- [Story] vincula la tarea con su historia para la trazabilidad
- Cada historia se puede completar y probar por separado (salvo la tarjeta compartida, ver arriba)
- Verificar que las pruebas fallen antes de implementar
- Confirmar (commit) después de cada tarea o grupo lógico; marcar `[X]` al terminar cada tarea
- La suite de extremo a extremo se ejecuta por partes si la memoria del equipo no alcanza
- No hay tareas para el autor en `Documentacion/issues-autor/`: esta spec no agrega despliegue, secretos ni datos externos

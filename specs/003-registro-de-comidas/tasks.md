---

description: "Lista de tareas de la spec 003: registro de comidas"
---

# Tasks: Registro de comidas

**Input**: documentos de diseño en `/specs/003-registro-de-comidas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (`database-api.md`, `meal-photo.md`, `ui-routes.md`), quickstart.md. Las specs 001 y 002 están integradas en `main`.

**Tests**: INCLUIDOS. Los exige la Constitution (Principio VIII) y el flujo TDD del proyecto. En cada historia, las pruebas se escriben primero y se verifica que **fallen por la razón correcta** antes de implementar (skill `test-driven-development`). Cada prueba referencia el requisito (FR-xxx) o el escenario del `quickstart.md` que verifica. Skills: `database-design` (migraciones, RLS, Storage), `nutrition-domain-rules` (cálculos, unidades, faltantes, lenguaje), `frontend-design` (interfaz), `systematic-debugging` (fallos).

**Organization**: tareas agrupadas por historia de usuario, numeradas como en `spec.md` (US1 a US7). Las pruebas pgTAP que dependen del catálogo empiezan con `delete from public.foods` dentro de su transacción (la base local tiene el catálogo cargado; lección de la spec 002).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US7)
- Todas las rutas son relativas a la raíz del repositorio

## Path Conventions

- Frontend: `app/src/features/meals/`, pruebas en `app/tests/{unit,component,e2e}/`
- Backend: `supabase/migrations/` (prefijo `20261019`), `supabase/tests/` (pgTAP), `supabase/functions/meal-photo/` (Deno)
- Documentación: `Documentacion/`, `supabase/README.md` y `specs/003-registro-de-comidas/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: prototipos de riesgo y configuración del almacenamiento de fotos

- [ ] T001 Prototipo P1 (research, Decisión 7): en `supabase/functions/meal-photo/jpeg.ts` (borrador), recorrer los segmentos de un JPEG de teléfono real con GPS en su EXIF (fixture en `supabase/functions/meal-photo/fixtures/con-gps.jpg`) y quitar todos los APPn salvo APP0 y todos los COM; comprobar que no queda EXIF (inspeccionar los bytes), que la imagen sigue abriendo y que tarda menos de 1 s. Registrar en `specs/003-registro-de-comidas/research.md`, sección "Resultados de prototipos"
- [ ] T002 [P] Prototipo P2: con Playwright (Chromium de escritorio y emulación de Pixel 7), comprobar qué formatos decodifica `createImageBitmap` (JPEG, PNG, WebP, HEIC) y el tamaño resultante de reducir una foto de 12 MP a 1600 px y codificarla como JPEG de calidad 0,8 (objetivo: menos de 500 KB). Registrar en `research.md` y el comportamiento acordado para HEIC
- [ ] T003 [P] Prototipo P3: en Supabase local, crear el bucket privado `meal-photos` y una política de lectura por carpeta del dueño; comprobar que la persona dueña obtiene una URL firmada, que otra cuenta y una petición anónima no pueden leer ni listar, y que una URL firmada vencida falla. Registrar en `research.md`
- [ ] T004 [P] Configurar el bucket en `supabase/config.toml` (`[storage.buckets.meal-photos]`: `public = false`, `file_size_limit = "3MiB"`, `allowed_mime_types = ["image/jpeg"]`) y la entrada `[functions.meal-photo]` (con `verify_jwt` coherente con las otras funciones). Ampliar `supabase/tests/config.test.ts` (escribir primero, debe fallar) para que exija bucket privado, límite de 3 MiB, solo JPEG y la función configurada. El bucket local sale de `config.toml`; el de producción, de la migración T064
- [ ] T005 [P] Fixtures de fotos en `supabase/functions/meal-photo/fixtures/` y `app/tests/fixtures/`: un JPEG con EXIF y GPS, uno con XMP e IPTC, un PNG, un archivo que no es imagen y un JPEG truncado (generados con un script documentado, sin datos personales)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tablas, seguridad y utilidades que necesitan todas las historias

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase

### Base de datos (skill `database-design`)

- [X] T006 Prueba pgTAP en `supabase/tests/meal_entries_schema.test.sql` (escribir primero, debe fallar). Debe cubrir:
  - `meal` solo `breakfast`, `lunch`, `snack`, `dinner` o `extra`; `origin` solo `catalog`, `own`, `manual` o `estimated`; `status` solo `confirmed` o `pending`, y `pending` solo si `origin = 'estimated'`.
  - `catalog` y `own` exigen `food_id` al crear, instantánea y `quantity` mayor que 0 y hasta 5000; `manual` exige `energy_kcal` y deja nulas `quantity` y la instantánea por 100.
  - `portion_count` mayor que 0 y hasta 50, con `quantity = portion_quantity × portion_count`.
  - El disparador calcula cada valor como `per100_x × quantity / 100` redondeado a 2 decimales, y un `per100_x` nulo deja el valor nulo, nunca 0.
  - No se pueden cambiar `user_id`, `origin` ni la instantánea; `food_id` solo puede pasar a nulo.
  - `food_id` usa `on delete set null`: **eliminar el alimento deja el ítem intacto con `food_id` nulo** (la actualización de la clave foránea no debe chocar con el disparador), y la prueba guardiana de claves foráneas de la spec 002 sigue en verde.
  - Único `(user_id, client_request_id)`; `meal_photos` único `(user_id, log_date, meal)`; `log_day_starts` con PK `(user_id, log_date)`.
- [X] T007 Migración `supabase/migrations/20261019000100_meal_tables.sql`: `public.meal_entries`, `public.log_day_starts` y `public.meal_photos` con las columnas, restricciones, índices (`(user_id, log_date, meal)`, `(user_id, created_at desc)`, `(food_id)`) y el disparador `private.prepare_meal_entry` de `data-model.md`; **RLS activado sin políticas** y `revoke all` para `anon` y `authenticated`
- [X] T008 [P] Prueba pgTAP en `supabase/tests/meal_rls.test.sql` (escribir primero, debe fallar). Debe cubrir, en las tres tablas:
  - La cuenta B no ve, modifica ni borra lo de A.
  - Con la sesión vencida no se ve nada; `anon` no accede.
  - El cliente no puede insertar ni actualizar `meal_entries` directamente (solo por las funciones) y sí puede borrar lo propio.
  - `log_day_starts` solo admite `select` e `insert` propios.
  - `meal_photos` solo admite `select` y `delete` propios desde el cliente.
- [X] T009 Migración `supabase/migrations/20261019000200_meal_rls.sql`: permisos mínimos y políticas de las tres tablas, con `(select auth.uid())` y `(select private.is_session_fresh())`
- [X] T010 Endurecer el guardián (lección T071 de la spec 002). Primero ampliar `supabase/tests/rls_guardrail.test.sql` (debe fallar por las políticas de `profiles`) para que **ninguna** política de `public` llame a `private.is_session_fresh()` sin envolverla en `(select …)`. Después, la migración `supabase/migrations/20261019000300_profiles_rls_session_once.sql` reescribe las políticas de `profiles` con `(select private.is_session_fresh())`, sin cambiar su comportamiento. Las pruebas de la spec 001 siguen en verde
- [X] T011 [P] Ayudantes de prueba en `supabase/seed.sql`: `tests.create_meal_entry(user_id, log_date, meal, food_id, quantity)`, `tests.create_manual_entry(user_id, log_date, meal, description, energy)` y `tests.set_profile_timezone(user_id, timezone)` (solo local)

### Utilidades del frontend (skill `nutrition-domain-rules`)

- [X] T012 [P] Pruebas unitarias en `app/tests/unit/mealTotals.test.ts` (escribir primero, deben fallar):
  - suma por comida y del día de energía, proteínas, carbohidratos y grasas;
  - un nutriente faltante en algún ítem marca el total como incompleto y cuenta cuántos ítems faltan (FR-015);
  - un total sin ningún dato es "sin dato";
  - redondeo para mostrar: energía sin decimales y gramos con un decimal (FR-016), y la suma se hace antes de redondear (SC-006).
- [X] T013 Implementar `app/src/features/meals/mealTotals.ts` para que pasen las pruebas de T012
- [X] T014 [P] Pruebas unitarias en `app/tests/unit/meals.test.ts` (escribir primero, deben fallar):
  - orden y etiquetas de las comidas (FR-008);
  - leer y validar `AAAA-MM-DD`; sumar y restar días sin errores por el horario de verano;
  - "hoy" en una zona horaria dada;
  - formato "lunes 18" y "domingo 17 de octubre";
  - rango de fechas admitido (desde el 1/1/2000 hasta hoy + 7 días).
- [X] T015 Implementar `app/src/features/meals/meals.ts` para que pasen las pruebas de T014
- [X] T016 [P] Ampliar `app/tests/component/session-ui.test.tsx` (escribir primero, debe fallar): con sesión, la cabecera muestra el enlace "Comidas" hacia `/comidas`, antes de "Alimentos"; sin sesión no
- [X] T017 Textos en español de la spec en `app/src/copy/es.ts` (sección `meals`), enlace "Comidas" en `app/src/components/AppShell.tsx` y rutas provisionales de `contracts/ui-routes.md` en `app/src/routes/index.tsx` (bajo `RequireAuth`). Incluye los textos del estado "Estimado, sin confirmar" (FR-012)

**Checkpoint**: esquema, seguridad y utilidades listos.

---

## Phase 3: User Story 1 - Registrar un alimento del catálogo en una comida (Priority: P1) 🎯 MVP

**Goal**: agregar un alimento del catálogo o propio a una comida con una cantidad en g/ml o en porciones, con instantánea tomada en el servidor y recientes con la última cantidad.

**Independent Test**: escenarios 1 a 6 del `quickstart.md`.

### Tests for User Story 1 ⚠️ (escribir primero y verificar que FALLAN)

- [X] T018 [P] [US1] Prueba pgTAP en `supabase/tests/add_meal_entry.test.sql`. Debe cubrir:
  - La instantánea se toma del alimento en el servidor: nombre, marca, base, los 8 valores por 100 y la porción.
  - El origen es `catalog` u `own` según el alimento.
  - Cálculo por cantidad en g o ml y por porciones (por ejemplo, 1,5 × 158 g = 237 g).
  - Un faltante del alimento queda `null` en el ítem.
  - Idempotente por `request_id`.
  - Un alimento eliminado mientras se completaba el formulario → `not_found`. Dos solicitudes distintas casi a la vez crean dos ítems, y una repetida con el mismo `request_id`, uno solo.
  - Fecha: hasta hoy + 7 días en la zona del perfil; sin zona en el perfil, UTC con un día de tolerancia.
  - Errores:
    - del alimento: ajeno o inexistente → `not_found`; porción de otro alimento → `invalid_portion`;
    - de la cantidad: 0, negativa o mayor que 5000 → `invalid_quantity`; porciones 0 o mayores que 50 → `invalid_portion_count`;
    - de la comida y el día: comida inválida → `invalid_meal`; día anterior al 2000 o posterior a hoy + 7 → `invalid_date`.
  - Otra cuenta no ve el ítem; `anon` recibe "permission denied" (FR-001 a FR-005, FR-009, FR-010, FR-012).
- [X] T019 [P] [US1] Prueba pgTAP en `supabase/tests/recent_meal_items.test.sql`. Debe cubrir:
  - Hasta 20 ítems distintos, del más reciente al más viejo, agrupados por alimento o por la descripción normalizada si es manual.
  - Cada uno trae su última cantidad y porción.
  - Excluye los alimentos que ya no existen o que la persona no puede ver.
  - Los valores de los que vienen de un alimento se calculan con el alimento actual.
  - No mezcla cuentas (FR-040).
- [X] T020 [P] [US1] Pruebas unitarias en `app/tests/unit/mealSchema.test.ts`: las reglas de cantidad y porciones de FR-003, con coma y con punto, y mensajes claros por campo
- [X] T021 [P] [US1] Pruebas de componentes en `app/tests/component/QuantityPicker.test.tsx`:
  - alterna entre g (o ml, según la base) y cada porción del alimento;
  - muestra la cantidad equivalente ("1,5 tazas = 237 g");
  - previsualiza energía y macronutrientes para la cantidad, con "sin dato" en los faltantes;
  - etiquetas accesibles.
- [X] T022 [P] [US1] Pruebas de componentes en `app/tests/component/AddEntryPage.test.tsx`:
  - muestra los recientes con la última cantidad precargada y los registra en 2 interacciones;
  - busca con la búsqueda de la spec 002 e incluye los alimentos propios con su marca "Propio";
  - elegir un alimento abre el selector de cantidad;
  - el doble clic hace un solo envío con el mismo `request_id`;
  - un fallo de red conserva el borrador (`meal-add-<fecha>-<comida>`) y no muestra "agregado";
  - el éxito vuelve al día con "Agregado al Almuerzo";
  - la comida de destino viene de `?comida=` y se puede cambiar;
  - un alimento eliminado mientras se completaba el formulario muestra un mensaje claro y conserva el borrador;
  - se puede agregar a un día pasado abierto desde la navegación (registro tardío, FR-027).
- [X] T023 [P] [US1] Prueba de extremo a extremo `app/tests/e2e/meals-add.spec.ts`: escenarios 1 a 6 del `quickstart.md`. **Se ejecuta cuando existe la vista del día (T035)**, porque verifica el resultado allí

### Implementation for User Story 1

- [X] T024 [US1] Migración `supabase/migrations/20261019000400_add_meal_entry.sql`: `private.validate_meal_entry(...)` con las reglas de research (Decisión 8) y `public.add_meal_entry(entry, request_id)` según `contracts/database-api.md`, atómica e idempotente (`security invoker`, `search_path` vacío)
- [X] T025 [US1] Migración `supabase/migrations/20261019000500_recent_meal_items.sql`: `public.recent_meal_items(max)`
- [X] T026 [P] [US1] Acceso a datos en `app/src/features/meals/api.ts`:
  - `addEntry` con `request_id` y `saveRemotely`;
  - `fetchRecents`;
  - `fetchDayEntries(fecha)`;
  - los tipos `MealEntry`, `Meal`, `EntryOrigin` y `RecentItem`.
- [X] T027 [P] [US1] Esquema Zod en `app/src/features/meals/schema.ts` (cantidad, porciones y entrada manual), con `parseDecimal` de `foods/nutrition.ts`
- [X] T028 [US1] Componente `app/src/features/meals/QuantityPicker.tsx`
- [X] T029 [US1] Pantalla `app/src/features/meals/AddEntryPage.tsx`: recientes, búsqueda reutilizada de `features/foods` (sin pisar el parámetro `?comida=`), selector de cantidad, borrador local y guardado confirmado (skill `frontend-design`)
- [X] T030 [US1] Conectar `/comidas/:fecha/agregar` en `app/src/routes/index.tsx`

**Checkpoint**: se puede agregar del catálogo y de los recientes. Pasan T018 a T022; T023 pasa al terminar la vista del día (US2). US1 y US2 se validan juntas.

---

## Phase 4: User Story 2 - Ver el día con sus totales y moverse entre días (Priority: P1)

**Goal**: vista del día con comidas, ítems, subtotales, total con faltantes marcados y navegación entre días.

**Independent Test**: escenarios 7 a 9, 19 y 27 del `quickstart.md`.

### Tests for User Story 2 ⚠️

- [X] T031 [P] [US2] Pruebas de componentes en `app/tests/component/DayPage.test.tsx`:
  - las comidas en orden, cada una con sus ítems (nombre, marca, cantidad, energía y origen) y su subtotal;
  - total del día con unidades, y nutrientes incompletos marcados como tales;
  - estado vacío con "Agregar" por comida;
  - carga sin parpadeo; error con "Reintentar" y aviso de sin conexión;
  - botones "Día anterior" y "Día siguiente" etiquetados, selector de fecha y "Hoy";
  - fecha inválida o fuera de rango → aviso con enlace a "Hoy";
  - un ítem cuyo alimento ya no existe lo indica (FR-013);
  - un ítem "estimado, sin confirmar" (`status = pending`) se muestra con su etiqueta y la nota de posibles errores (FR-012);
  - el día visible se conserva al ir al detalle y volver (FR-014 a FR-018).
- [X] T032 [P] [US2] Prueba de extremo a extremo `app/tests/e2e/meals-day.spec.ts`: escenarios 7, 8, 9, 19 y 27 (60 ítems en un teléfono emulado con red 4G simulada en menos de 2 s; totales correctos)

### Implementation for User Story 2

- [X] T033 [P] [US2] Hook `app/src/features/meals/useDay.ts`: ítems del día y totales con `mealTotals`
- [X] T034 [P] [US2] Componente `app/src/features/meals/MealSection.tsx`: título de la comida, ítems, subtotal y acciones (agregar; el menú de repetir y la foto se completan en US6 y US7)
- [X] T035 [US2] Pantalla `app/src/features/meals/DayPage.tsx` y rutas `/comidas` (por ahora va a hoy; US5 agrega el día propuesto) y `/comidas/:fecha` en `app/src/routes/index.tsx`

**Checkpoint**: registrar y ver el día. US1 + US2 forman el MVP mínimo útil.

---

## Phase 5: User Story 3 - Registrar algo que no está en el catálogo (Priority: P1)

**Goal**: entrada manual con descripción y valores (energía obligatoria), marcada "Manual", que se puede convertir en alimento propio.

**Independent Test**: escenarios 10 a 12 del `quickstart.md`.

### Tests for User Story 3 ⚠️

- [X] T036 [P] [US3] Prueba pgTAP en `supabase/tests/manual_meal_entry.test.sql`. Debe cubrir:
  - `origin = 'manual'` sin alimento.
  - Una descripción vacía da `description_required`; sin energía, `energy_required`.
  - Rangos: energía de 0 a 5000 kcal; gramos de 0 a 1000; sodio de 0 a 50000 mg.
  - Azúcares no mayores que carbohidratos; saturadas no mayores que grasas.
  - Los nutrientes no informados quedan `null`.
  - Idempotente por `request_id` (FR-006, FR-007, FR-012).
- [X] T037 [P] [US3] Pruebas de componentes en `app/tests/component/ManualEntryForm.test.tsx`:
  - crea con solo descripción y energía;
  - errores por campo con foco en el primero;
  - el aviso de coherencia de energía y macronutrientes no bloquea;
  - coma decimal;
  - el doble clic hace un solo envío;
  - un fallo de red conserva el borrador.
- [X] T038 [P] [US3] Prueba de extremo a extremo `app/tests/e2e/meals-manual.spec.ts`: escenarios 10, 11 y 12

### Implementation for User Story 3

- [X] T039 [US3] Componente `app/src/features/meals/ManualEntryForm.tsx` (dentro de `AddEntryPage`, pestaña "Escribir a mano"), reutilizando `energyCoherence` de `foods/nutrition.ts`
- [X] T040 [US3] "Guardar como alimento propio" (FR-023, escenario 12). Primero la prueba unitaria `app/tests/unit/saveAsFood.test.ts` (debe fallar): dado el peso o volumen que representa el ítem, calcula los valores por 100 g o 100 ml (los faltantes siguen faltando), valida contra los rangos de la spec 002 (por ejemplo, macronutrientes que sumen más de 100 por 100 se rechazan con un mensaje) y crea una porción con la cantidad descriptiva. Después `app/src/features/meals/saveAsFood.ts` y `SaveAsFoodPanel.tsx` (un panel dentro de la fila del ítem manual en `MealSection.tsx`); usa `createFood` de la spec 002 con su `request_id`; el ítem no cambia. Su prueba de componente va en `app/tests/component/SaveAsFoodPanel.test.tsx`

**Checkpoint**: se puede registrar cualquier cosa, esté o no en el catálogo.

---

## Phase 6: User Story 4 - Corregir, mover y eliminar lo registrado (Priority: P2)

**Goal**: cambiar cantidad o porción, mover de comida o de día, editar los manuales y eliminar con confirmación; los valores se recalculan desde la instantánea.

**Independent Test**: escenarios 13 a 16 del `quickstart.md`.

### Tests for User Story 4 ⚠️

- [X] T041 [P] [US4] Prueba pgTAP en `supabase/tests/update_meal_entry.test.sql`. Debe cubrir:
  - Cambiar la cantidad recalcula **desde la instantánea** aunque el alimento haya cambiado.
  - Se puede cambiar el número de porciones, mover a otra comida o a otro día dentro del rango, y editar descripción y valores de un manual con las mismas validaciones.
  - Origen, alimento e instantánea no se pueden cambiar.
  - Un ítem ajeno da `not_found` y no cambia nada.
  - Borrar lo propio funciona y lo ajeno no afecta nada.
  - Editar, eliminar o **reimportar** (`import_foods`) el alimento de origen deja el ítem intacto, y al eliminarlo `food_id` pasa a `null` (FR-011, FR-013, FR-019 a FR-022, FR-026, SC-004).
- [X] T042 [P] [US4] Pruebas de componentes en `app/tests/component/EntryDetailPage.test.tsx`:
  - detalle con todos los nutrientes, origen y cantidad;
  - editar la cantidad o la porción, la comida y el día;
  - eliminar con `ConfirmDialog` (Escape cancela);
  - "Este alimento ya no está disponible";
  - "No encontramos este registro";
  - un fallo de red conserva el borrador (`meal-edit-<id>`).
- [X] T043 [P] [US4] Prueba de extremo a extremo `app/tests/e2e/meals-edit.spec.ts`: escenarios 13, 14, 15 y 16

### Implementation for User Story 4

- [X] T044 [US4] Migración `supabase/migrations/20261019000600_update_meal_entry.sql`: `public.update_meal_entry(id, changes)` atómica
- [X] T045 [US4] `updateEntry` y `deleteEntry` en `app/src/features/meals/api.ts` y pantalla `app/src/features/meals/EntryDetailPage.tsx` (usa el diálogo de T040 también desde el detalle de un manual); conectar `/comidas/item/:id`

**Checkpoint**: ciclo de vida completo de un ítem.

---

## Phase 7: User Story 5 - Imputar una comida al día que se está cerrando (Priority: P2)

**Goal**: la regla del día con zona horaria del perfil, la propuesta del día que se cierra sin límite de hora y "Empezar el día de hoy".

**Independent Test**: escenarios 17, 18 y 19 del `quickstart.md`.

### Tests for User Story 5 ⚠️

- [X] T046 [P] [US5] Prueba pgTAP en `supabase/tests/log_day_status.test.sql`, que ejercita `private.log_day_status_at(ahora, zona)` con una hora simulada (la función pública solo la llama con `now()`). Debe cubrir:
  - "Hoy" usa la zona horaria del perfil; sin zona en el perfil, la del cliente.
  - A las 01:00, con ítems ayer, sin ítems hoy y sin marca → `proposed_date = ayer` y `closing = true`.
  - Con un ítem hoy, con la marca de hoy o sin ítems ayer → `proposed_date = hoy`.
  - Sin límite de hora: a las 11:00 también se propone ayer si se cumplen las condiciones.
  - `start_log_day` es idempotente y solo admite el "hoy" del perfil.
  - El cambio de horario de verano no altera el resultado.
  - Cambiar la zona horaria del perfil no mueve ítems ya guardados (FR-024 a FR-027).
- [X] T047 [P] [US5] Pruebas de componentes en `app/tests/component/DayRule.test.tsx`:
  - con `closing = true`, la vista muestra "Registrando en el lunes 18" en una región visible y el botón "Empezar el día de hoy";
  - el formulario de agregar muestra la fecha de destino y permite elegir el día nuevo antes de guardar;
  - `/comidas` lleva al día propuesto.
- [X] T048 [P] [US5] Prueba de extremo a extremo `app/tests/e2e/meals-day-rule.spec.ts` en una zona horaria cuya hora local ahora es 01:xx (el servidor usa su propio reloj, así que no se simula el tiempo): escenarios 17, 18 y 19

### Implementation for User Story 5

- [X] T049 [US5] Migración `supabase/migrations/20261019000700_log_day.sql`: `private.log_day_status_at(ahora, zona)` (sin permiso para el cliente), `public.log_day_status(client_timezone)` (que la llama con `now()`) y `public.start_log_day(day)`. No hay ningún parámetro de hora en la función pública
- [X] T050 [US5] Aviso del día que se cierra en `DayPage.tsx`, selector de la fecha de destino en `AddEntryPage.tsx`, `startLogDay` y `fetchDayStatus` en `api.ts`, y redirección de `/comidas` al día propuesto

**Checkpoint**: la regla del día de la Constitution funciona.

---

## Phase 8: User Story 6 - Repetir una comida de otro día (Priority: P3)

**Goal**: repetir todos los ítems de una comida en otra, recalculando lo que viene de un alimento y copiando lo manual, de forma idempotente.

**Independent Test**: escenarios 20 y 21 del `quickstart.md`.

### Tests for User Story 6 ⚠️

- [X] T051 [P] [US6] Prueba pgTAP en `supabase/tests/repeat_meal.test.sql`. Debe cubrir:
  - Crea un ítem por cada ítem de origen, con la misma cantidad y porciones.
  - Recalcula con una instantánea nueva si el alimento existe y es visible; copia los manuales y los de alimentos que ya no existen.
  - `preview_repeat_meal` cuenta lo que se recalcula y lo que se copia.
  - Idempotente: repetir con el mismo `request_id` no duplica, ni siquiera tras un corte, gracias a la transacción.
  - Los ítems de origen no cambian y los nuevos son independientes.
  - Repetir una comida vacía crea 0 ítems; no se pueden repetir comidas ajenas; día o comida inválidos dan error (FR-028, FR-029).
- [X] T052 [P] [US6] Pruebas de componentes en `app/tests/component/RepeatMeal.test.tsx`:
  - "Repetir en…" desde una comida con ítems;
  - elegir día y comida de destino;
  - la confirmación muestra cuántos ítems se recalculan y cuántos se copian;
  - el doble clic hace un solo envío;
  - éxito con aviso; un fallo de red no da nada por hecho.
- [X] T053 [P] [US6] Prueba de extremo a extremo `app/tests/e2e/meals-repeat.spec.ts`: escenarios 20 y 21

### Implementation for User Story 6

- [X] T054 [US6] Migración `supabase/migrations/20261019000800_repeat_meal.sql`: `public.preview_repeat_meal(...)` y `public.repeat_meal(...)` con `client_request_id` derivado de `(request_id, id de origen)`
- [X] T055 [US6] Flujo "Repetir en…" en `app/src/features/meals/RepeatMealDialog.tsx` (con `ConfirmDialog`), `repeatMeal` y `previewRepeat` en `api.ts`, y la acción en `MealSection.tsx`

**Checkpoint**: repetir comidas ahorra pasos.

---

## Phase 9: User Story 7 - Adjuntar una foto a una comida (Priority: P3)

**Goal**: foto opcional por comida y día, reducida en el navegador, sin metadatos (limpieza en el servidor), privada y vista con URL firmada.

**Independent Test**: escenarios 22 a 25 del `quickstart.md`.

### Tests for User Story 7 ⚠️

- [ ] T056 [P] [US7] Pruebas Deno en `supabase/functions/meal-photo/jpeg.test.ts`:
  - quita APP1 (EXIF y XMP), APP13 (IPTC), otros APPn y COM, y conserva APP0 y los datos de la imagen;
  - la salida empieza en `FF D8` y termina en `FF D9`;
  - un archivo truncado, sin firma JPEG o con un largo de segmento inválido da `invalid_image`;
  - una entrada enorme no se recorre más allá de su tamaño;
  - el fixture con GPS no conserva la cadena `Exif` ni las etiquetas GPS.
- [ ] T057 [P] [US7] Pruebas Deno en `supabase/functions/meal-photo/index.test.ts`, con Storage y la base simulados:
  - sin sesión o con la sesión vencida → `401`; origen no permitido → rechazo;
  - errores de validación: `log_date` o `meal` inválidos → `400`; más de 3 MB → `413`; no JPEG → `415`; JPEG corrupto → `422`; más de 30 fotos por hora por cuenta → `429`;
  - guarda en `<user_id>/<uuid>.jpg` el archivo **limpio**;
  - reemplazar borra la foto anterior; si falla la fila, borra el objeto huérfano;
  - `DELETE` es idempotente;
  - el registro no contiene `user_id`, ruta, fecha ni comida.
- [ ] T058 [P] [US7] Prueba pgTAP en `supabase/tests/meal_photos_storage.test.sql`:
  - políticas de `storage.objects` para el bucket `meal-photos`: la persona dueña puede leer lo de su carpeta con sesión vigente;
  - otra cuenta, `anon` y una sesión vencida no pueden;
  - ningún rol del cliente puede insertar, actualizar, borrar ni listar objetos;
  - el bucket no es público (FR-032).
- [ ] T059 [P] [US7] Pruebas unitarias en `app/tests/unit/photo.test.ts`, con `createImageBitmap` y `canvas` simulados:
  - calcula las dimensiones para que el lado mayor no pase de 1600 px sin agrandar;
  - rechaza lo que no es imagen y lo que pesa más de 15 MB;
  - un HEIC que no se puede decodificar da el mensaje acordado en T002;
  - la salida es JPEG.
- [ ] T060 [P] [US7] Pruebas de componentes en `app/tests/component/MealPhoto.test.tsx`:
  - "Agregar foto"; progreso de subida; miniatura; abrir en grande con texto alternativo;
  - reemplazar y eliminar (con confirmación);
  - errores claros, sin afectar los ítems;
  - sin conexión no se sube nada ni se da por hecho;
  - la URL firmada se renueva al vencer.
- [ ] T061 [P] [US7] Prueba de extremo a extremo `app/tests/e2e/meals-photo.spec.ts`: escenarios 22 a 25. Debe incluir descargar la foto guardada y comprobar que no tiene EXIF ni GPS y que pesa menos que la original, y que otra cuenta y una petición anónima reciben acceso denegado. Además: tras reemplazar o eliminar, la URL firmada de la foto anterior ya no sirve (FR-034), y durante todo el flujo se bloquea cualquier petición que no sea al servidor local sin que nada se intente (FR-035, como el escenario 26 de la spec 002)

### Implementation for User Story 7

- [ ] T062 [US7] `supabase/functions/meal-photo/jpeg.ts` (limpieza de segmentos, pura) a partir del prototipo T001
- [ ] T063 [US7] `supabase/functions/meal-photo/index.ts` según `contracts/meal-photo.md`, reutilizando `_shared` (CORS, sesión, límite de solicitudes con `check_rate_limit` por cuenta y registro técnico sin datos personales)
- [ ] T064 [US7] Migración `supabase/migrations/20261019000900_meal_photos_storage.sql`: bucket `meal-photos` privado (si no existe) y la política de lectura de `storage.objects` por carpeta del dueño con `(select private.is_session_fresh())`; sin políticas de escritura para el cliente
- [ ] T065 [US7] `app/src/features/meals/photo.ts` (reducir y volver a codificar), `uploadPhoto`, `deletePhoto` y `photoUrl` (URL firmada de 10 minutos) en `api.ts`, y componente `app/src/features/meals/MealPhoto.tsx` en `MealSection.tsx`

**Checkpoint**: todas las historias funcionan.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T066 [P] Accesibilidad en `app/tests/e2e/a11y-meals.spec.ts`:
  - axe en el día (con ítems, vacío y con el aviso del día que se cierra), en agregar (recientes, búsqueda y manual), en el detalle de un ítem, en la foto y en el diálogo de repetir;
  - recorrido por teclado de la navegación entre días, el selector de cantidad y los diálogos.
- [ ] T067 [P] Responsive en `app/tests/e2e/responsive-meals.spec.ts`: teléfono y escritorio sin desplazamiento horizontal, áreas táctiles de 44 px o más y nombres largos recortados (SC-008)
- [ ] T068 [P] Aislamiento por la API real en `app/tests/e2e/meals-isolation.spec.ts`: con una sesión válida, la cuenta A no puede leer, insertar, modificar ni borrar ítems, marcas ni fotos de B, ni llamar a las funciones con ítems ajenos (escenario 26)
- [ ] T069 Medición: SC-001 (interacciones y tiempo para agregar un alimento y un reciente), SC-002 (día con 60 ítems en un teléfono emulado) y tiempo y tamaño de la foto (12 MP a menos de 500 KB; función en menos de 2 s); registrar en `research.md`
- [ ] T070 [P] Documentación:
  - `supabase/README.md`: tablas, funciones, bucket, cifrado en reposo y cómo se limpian las fotos;
  - `supabase/README.md` también anota que al eliminar una cuenta hay que borrar los objetos de `meal-photos/<user_id>/` (Decisión 11 de research) y se suma a la lista de pendientes del Principio I;
  - `README.md`: estado;
  - `Documentacion/roadmap-specs.md`;
  - `Documentacion/despliegue.md`: crear el bucket y desplegar `meal-photo` en producción;
  - actualizar `Documentacion/issues-autor/04-despliegue.md`.
- [ ] T071 Ejecutar los 27 escenarios del `quickstart.md` y registrar el resultado en `specs/003-registro-de-comidas/verification.md`
- [ ] T072 Revisión de seguridad dirigida, registrada en `verification.md`:
  - instantánea no manipulable desde el cliente;
  - funciones que no aceptan ítems ni alimentos ajenos;
  - fotos sin metadatos y sin acceso público ni listado;
  - URL firmada de corta duración;
  - límite de subidas;
  - la clave de servicio solo en la función;
  - los archivos de fotos no se borran en cascada con la cuenta (pendiente documentado);
  - `check:secrets`.
  
  Corregir los hallazgos con TDD.
- [ ] T073 Ejecutar `format:check`, `lint`, `typecheck`, `test`, `e2e` (por partes), `test:db`, `test:functions`, `test:import`, `test:config` y `check:secrets`; todo en verde antes de dar la spec por terminada

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 a T003 condicionan la historia 7 (fotos); T004 y T005 son preparatorias
- **Foundational (Phase 2)**: depende de Setup (salvo los prototipos de fotos). **Bloquea todas las historias**
- **User Stories (Phase 3 a 9)**: dependen de Foundational
- **Polish (Phase 10)**: depende de las historias deseadas

### User Story Dependencies

- **US1 (P1)**: después de Foundational; su prueba de extremo a extremo (T023) necesita la vista del día de US2, así que US1 y US2 se validan juntas
- **US2 (P1)**: después de Foundational; se prueba con ítems creados por los ayudantes de T011. Integra el "Agregar" de US1
- **US3 (P1)**: después de US1 (comparte `AddEntryPage`)
- **US4 (P2)**: después de US1 y US2 (el detalle se abre desde el día)
- **US5 (P2)**: después de US1 y US2
- **US6 (P3)**: después de US2 (se repite desde una comida del día)
- **US7 (P3)**: después de US2 y de los prototipos T001 a T003; independiente de US3 a US6

### Within Each User Story

- Las pruebas se escriben primero y deben **fallar** antes de implementar
- Migraciones antes del código que las usa
- Acceso a datos y esquemas antes de pantallas

### Parallel Opportunities

- Setup: T002, T003, T004 y T005
- Foundational: T008, T011, T012, T014 y T016 (pruebas y ayudantes)
- Dentro de cada historia: todas las pruebas marcadas [P]; en US1, `api.ts` y `schema.ts`; en US2, `useDay` y `MealSection`
- US7 (fotos) puede avanzar en paralelo con US3 a US6 una vez terminada US2

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (deben fallar):
Task: "Prueba pgTAP de add_meal_entry en supabase/tests/add_meal_entry.test.sql"
Task: "Prueba pgTAP de recientes en supabase/tests/recent_meal_items.test.sql"
Task: "Pruebas de QuantityPicker en app/tests/component/QuantityPicker.test.tsx"
Task: "Pruebas de AddEntryPage en app/tests/component/AddEntryPage.test.tsx"

# Piezas independientes de US1:
Task: "api.ts del registro"
Task: "schema.ts de cantidad y entrada manual"
```

---

## Implementation Strategy

### MVP primero (US1 + US2 + US3)

1. Setup y Foundational
2. US1: agregar del catálogo y de los recientes
3. US2: ver el día con totales
4. US3: entrada manual
5. **DETENERSE Y VALIDAR**: escenarios 1 a 12, 19, 26 y 27 del `quickstart.md`. Ya se puede registrar todo lo que se come y ver el día; es lo mínimo que necesita la spec 004

### Entrega incremental

1. Foundational → base lista
2. US1 → US2 → US3 (MVP)
3. US4 → corregir lo registrado
4. US5 → regla del día que se cierra
5. US6 → repetir comidas
6. US7 → fotos
7. Polish → accesibilidad, seguridad, medición y documentación

### Si un prototipo falla

- T001 no logra limpiar los metadatos sin decodificar → decodificar y volver a codificar en la función con una biblioteca liviana dentro de los límites del plan gratuito, o posponer la historia 7 sin afectar US1 a US6 (la foto es opcional, Principio III)
- T002 muestra que un navegador no decodifica un formato → rechazarlo con un mensaje claro (lo previsto para HEIC)
- T003 muestra que las URL firmadas no respetan la carpeta del dueño → servir la foto a través de la Edge Function, que verifica la sesión

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes
- [Story] vincula la tarea con su historia para la trazabilidad
- Cada historia se puede completar y probar por separado
- Verificar que las pruebas fallen antes de implementar
- Confirmar (commit) después de cada tarea o grupo lógico
- Detenerse en cada checkpoint para validar la historia
- La suite de extremo a extremo se ejecuta por partes si la memoria del equipo no alcanza

# Implementation Plan: Rutinas, calendario y sesiones de entrenamiento

**Branch**: `006-rutinas-calendario-sesiones` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-rutinas-calendario-sesiones/spec.md`

## Summary

Rutinas reutilizables (un catálogo de entrenamientos sin días asignados), un calendario de sesiones y el registro de lo realizado: series con los valores que corresponden al tipo de medición de cada ejercicio (spec 005), esfuerzo percibido por ejercicio, notas, sustituciones, y la separación estricta entre **lo planificado** y **lo realizado**. Las sesiones planificadas se pueden mover, cancelar y volver a planificar sin duplicarse; las realizadas no cambian de fecha. Cada ejercicio de una sesión guarda una **instantánea** de su nombre y tipo de medición, así que editar o eliminar un ejercicio, una rutina o reimportar el catálogo nunca altera el pasado. La historia de un ejercicio (las últimas veces, con sus series) responde «¿con cuánto hice esto la última vez?», sin recomendaciones ni gráficos (los gráficos están en la spec 012, pendiente).

Enfoque técnico (detalle y alternativas en [research.md](research.md)): las mismas piezas de las specs anteriores. Tablas de usuario con RLS (`routines`, `routine_exercises`, `workout_sessions`, `session_plan_items`, `session_exercises`, `session_sets`, `session_date_changes`); plan y realizado en **tablas distintas**; instantáneas con `exercise_id` `on delete set null` e inmutabilidad por disparadores (el patrón de `meal_entries` de la spec 003); escrituras solo por funciones `security definer` idempotentes (`request_id`, o reemplazo completo con una **revisión** para guardar el contenido de una sesión); «hoy» calculado en el servidor con la zona del perfil; una sola sesión en curso por persona (índice único parcial). En el cliente, un editor de sesión con **borrador local** y **autoguardado** al servidor con indicador de estado, y un calendario propio sin librerías. No hay Edge Functions, dependencias ni servicios externos nuevos.

## Technical Context

**Language/Version**: TypeScript estricto (frontend), SQL (Postgres 17 de Supabase)

**Primary Dependencies**: las de las specs 001 a 005; ninguna nueva. Fechas con `Intl` y utilidades propias (sin librería de fechas ni de calendario).

**Storage**: Postgres de Supabase. Siete tablas nuevas, todas de usuario. Volumen de diseño para un uso personal intenso: unas 5 sesiones por semana × 5 años ≈ 1.300 sesiones, con hasta ~10 ejercicios y ~30 series cada una ⇒ ≈ 40.000 series (unos 10 MB con índices), dentro de los 500 MB del plan gratuito. Sin archivos.

**Testing**: pgTAP (esquema, RLS, funciones, transiciones, regla de «modificada», instantáneas, claves foráneas, aislamiento), Vitest + Testing Library (esquemas, texto, calendario, editor de sesión con autoguardado y revisión, rutinas, historia, lenguaje neutral), Playwright + axe (flujos completos, aislamiento por la API real, accesibilidad, responsive, medición)

**Target Platform**: la misma PWA de la spec 001

**Project Type**: aplicación web (frontend SPA + backend gestionado)

**Performance Goals**: calendario de un mes con 200 sesiones en menos de 2 s y primera tanda de la historia de un ejercicio con 500 sesiones en menos de 1 s (SC-010); guardar una sesión de 30 ejercicios con 20 series cada uno en una sola solicitud.

**Constraints**: sin servicios de terceros; sin modo offline (borrador local hasta confirmación del servidor); los datos faltantes nunca se completan con supuestos; plan y realizado separados; el pasado no se reescribe; lenguaje neutral verificable; sin gráficos, sin calorías, sin recomendaciones.

**Scale/Scope**: 8 pantallas nuevas (inicio con calendario, día, sesión con su editor, mis rutinas, nueva/editar rutina, detalle de rutina, historia de un ejercicio) y 7 tablas; 12 funciones públicas.

## Constitution Check

*GATE: debe pasar antes de la investigación (Fase 0); se vuelve a evaluar tras el diseño (Fase 1).* Evaluado contra la Constitution v1.2.1.

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Privacidad y seguridad** | Rutinas y sesiones son privadas con RLS y pruebas de aislamiento entre cuentas (incluida la petición anónima); las altas y los cambios pasan solo por funciones que verifican la sesión y toman el dueño de `auth.uid()`; el cliente no escribe en las tablas; los registros técnicos no contienen contenido de entrenamientos; todo se elimina con la cuenta (`on delete cascade`). Sin fotos y sin IA. | ✅ Cumple |
| **II. Integridad e idempotencia** | Núcleo de la spec. Planificación y ejecución en tablas separadas; reprogramar no toca lo realizado ni lo reescribe (solo se mueven sesiones planificadas, y queda el recorrido de fechas); instantánea inmutable del nombre y del tipo de medición en plan, rutina y sesión; el ejercicio se referencia por su `id` estable con `on delete set null` (no hay `cascade` hacia `exercises`); todas las creaciones y movimientos son idempotentes por `request_id` y el guardado de contenido por reemplazo completo con revisión (nunca pisa en silencio lo que guardó otro dispositivo); fechas en la zona del perfil resueltas en el servidor. | ✅ Cumple |
| **III. Estimaciones nutricionales transparentes** | No hay estimaciones de nutrición ni de gasto. Los datos de entrenamiento son siempre manuales. | ✅ No aplica |
| **IV. Información de salud responsable** | Sin recomendaciones ni metas automáticas; sin rachas, culpa ni valoración del rendimiento; lo no hecho se dice «No realizado» o «Sin registrar»; nada sugiere entrenar con dolor o lesión. Una prueba recorre todos los textos buscando términos prohibidos. | ✅ Cumple |
| **V. Seguimiento consistente** | Registra ejercicios, series, repeticiones, cargas, esfuerzo percibido, sustituciones y notas; distingue rutina planificada, sesión realizada, modificada, reprogramada y cancelada; el calendario mueve entrenamientos sin perder el historial ni duplicar; una sesión distinta de la planificada no pierde la rutina original; los datos faltantes se muestran como faltantes. Los gráficos con contexto, unidades y comparación de períodos quedan en la spec 012. | ✅ Cumple |
| **VI. Experiencia** | Responsive y accesible (calendario como cuadrícula de enlaces con nombres completos, controles con etiquetas, teclado, 44 px); español y métrico con unidades visibles; estados de carga, vacío, éxito y error; **el borrador de una sesión activa persiste localmente hasta que el servidor confirma**; sin conexión se informa y no se da nada por guardado; tareas frecuentes en pocos pasos («Hoy» + una rutina = empezar). | ✅ Cumple |
| **VII. Arquitectura** | Reglas de negocio (transiciones, «modificada», límites) en funciones SQL probadas, reimpuestas en la base aunque el cliente las valide; lógica del editor en un hook puro y probado; sin dependencias nuevas; contrato de la función de guardado documentado. | ✅ Cumple |
| **VIII. Calidad y SDD** | Spec con criterios comprobables y aclaraciones resueltas; TDD en cada tarea; 48 escenarios en `quickstart.md`; riesgos del editor, la concurrencia y la regla de «modificada» identificados antes de implementar. | ✅ Cumple |
| **IX. Observabilidad** | Ningún registro ni mensaje de error contiene nombres, notas ni valores; los errores devuelven solo códigos y campos. Sin telemetría nueva. | ✅ Cumple |
| **X. Catálogos de referencia** | Los ejercicios se eligen del catálogo de la spec 005 (propios y del catálogo) sin dependencias externas; la procedencia no se duplica en las sesiones (solo nombre y tipo, como pide el Principio II). | ✅ Cumple |
| **Decisiones pendientes** | Ninguna se cierra ni se abre. | ✅ |

**Resultado**: sin violaciones.

**Reevaluación tras el diseño (Fase 1)**: el diseño confirma el resultado. Puntos que se vigilaron: (a) los disparadores de inmutabilidad permiten que `exercise_id` pase a nulo, porque es lo que hace la base al eliminar un ejercicio, y la prueba guardiana de claves foráneas de la spec 005 sigue vigente; (b) el índice único parcial de la sesión en curso evita duplicados entre pestañas; (c) la lectura del calendario no trae series, para cumplir SC-010; (d) el guardián `rls_guardrail` (spec 001) cubre las siete tablas nuevas, todas con `user_id`, RLS y políticas con la vigencia de sesión escrita `(select …)`.

## Project Structure

### Documentation (this feature)

```text
specs/006-rutinas-calendario-sesiones/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database-api.md      # funciones, payload de save_session, lectura y errores
│   └── ui-routes.md         # rutas, pantallas, estados y accesibilidad
├── checklists/requirements.md
└── tasks.md                 # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
app/src/features/training/
├── api.ts                    # rutinas, calendario, sesión, historia (RPC y lecturas)
├── schema.ts                 # Zod: rutina, serie por tipo de medición, payload de sesión (mismas reglas que la base)
├── trainingText.ts           # puras: estados y marcas, unidades, formato de series, diferencias plan/realizado
├── calendar.ts               # puras: cuadrícula del mes, nombres accesibles, rangos de fechas
├── useRoutines.ts · useRoutine.ts
├── useCalendarMonth.ts · useSessionsOfDay.ts · useSession.ts
├── sessionEditorState.ts     # puras: reductor del editor (agregar, quitar, reordenar, validar, diferencias con el plan)
├── useSessionEditor.ts       # hook: borrador local, autoguardado, revisión y conflicto (probado)
├── useExerciseHistory.ts
├── TrainingHomePage.tsx · CalendarMonth.tsx · TodayPanel.tsx
├── DayPage.tsx
├── SessionPage.tsx           # planificada / en curso / realizada / cancelada
├── SessionEditor.tsx · SessionExerciseCard.tsx · SetRow.tsx · EffortSelect.tsx · SaveIndicator.tsx
├── PlanVsDone.tsx            # plan y realizado en bloques separados
├── ExercisePickerPanel.tsx   # reutiliza la búsqueda de features/exercises
├── RoutinesPage.tsx · RoutineDetailPage.tsx · RoutineFormPage.tsx
├── ReschedulePanel.tsx · RoutinePicker.tsx
└── ExerciseHistoryPage.tsx   # ruta /ejercicios/:id/historia
app/src/features/exercises/ExerciseDetailPage.tsx   # enlace «Ver historia»
app/src/components/AppShell.tsx                      # enlace «Entrenamiento»
app/src/copy/es.ts                                   # clave `training`
app/src/routes/index.tsx                             # rutas /entrenamiento y /ejercicios/:id/historia
app/tests/{unit,component,e2e}/

supabase/migrations/          # tablas, RLS, funciones (prefijo 20261022…)
supabase/tests/               # pgTAP de rutinas y sesiones
supabase/seed.sql             # ayudantes tests.create_routine / tests.create_session (solo local)
Documentacion/                # roadmap y README de supabase
```

**Structure Decision**: se agrega `features/training` junto a `features/exercises`. Se reutilizan tal cual `Field`, `ConfirmDialog`, `useDraft`, `saveRemotely`, `newRequestId`, `EmptyState`, `ErrorState`, `LoadingState` y la búsqueda de ejercicios de la spec 005 (que se expone como un panel reutilizable para elegir un ejercicio). La lógica con estado complejo (el editor) vive en un hook separado de los componentes para probarla sin interfaz.

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| Siete tablas nuevas, con plan y realizado separados | El Principio II exige que planificación y ejecución sean conceptos separados; la separación en tablas lo garantiza por construcción | Una tabla con columnas «planificado» y «realizado» mezcla los conceptos y confunde «sin dato» con «no planificado» |
| Instantánea del ejercicio repetida en tres tablas (rutina, plan, realizado) | Cada una es un registro con su propio momento; el pasado no puede depender del ejercicio vivo | Leer el ejercicio vivo reescribiría el historial al editarlo (prohibido por el Principio II) |
| `save_session` como reemplazo completo con revisión, en lugar de operaciones granulares | Es idempotente por construcción, atómico y no necesita cola de operaciones (sincronización diferida, no permitida) | Operaciones granulares multiplican las llamadas y dejan estados parciales ante un corte |
| Calendario propio en lugar de una biblioteca | Accesibilidad y cero dependencias nuevas | Las bibliotecas pesan cientos de KB y traen su propio manejo de fechas y de foco |
| Autoguardado al servidor además del borrador local | La sesión «En curso» debe existir en el servidor para verse en el calendario y no depender de un solo dispositivo | Guardar solo al terminar pierde la sesión ante la pérdida del dispositivo |

## Riesgos y verificaciones previas a implementar

1. **Editor de sesión**: la pantalla más compleja del proyecto (lista anidada con autoguardado, revisión y borrador). Mitigación: hook puro `useSessionEditor` con pruebas de unidad antes de la interfaz; el payload y su validación son los mismos en cliente y servidor.
2. **Regla de «modificada»**: casos límite (ejercicio con cero series, sustituciones, ejercicios agregados vacíos). Se fija con una tabla de casos en pgTAP antes de implementar la función.
3. **Concurrencia entre pestañas o dispositivos**: la revisión evita pisar en silencio; se prueba con dos contextos del navegador.
4. **Zona horaria y medianoche**: función privada con hora y zona como parámetros para probarla con hora simulada (el patrón de la spec 004).
5. **Cambio del tipo de medición de un ejercicio usado en rutinas**: tratamiento explícito (`targets_dropped`, aviso en la rutina), con pruebas.
6. **Calendario accesible**: se verifica con axe y recorrido por teclado; nombres completos por día.
7. **Rendimiento con datos sintéticos** (200 sesiones en un mes, 500 en la historia de un ejercicio): se mide antes de dar la spec por terminada y, si hace falta, se ajusta el índice.
8. **Pruebas dependientes de datos locales**: las pruebas pgTAP borran `workout_sessions` y `routines` dentro de su transacción (lección de las specs 002 y 003).
9. **Tamaño de la spec**: es la más grande hasta ahora; `tasks.md` la dividirá por historias y por capas (base de datos, hook, pantallas) para poder commitear en grupos pequeños.

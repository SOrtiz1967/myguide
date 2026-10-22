# Verificación: Rutinas, calendario y sesiones de entrenamiento

**Spec**: 006-rutinas-calendario-sesiones | **Rama**: `006-rutinas-calendario-sesiones` | **Fecha**: 2026-10-22

## Escenarios del `quickstart.md` (T079)

Los 48 escenarios se validan con pruebas automáticas; el escenario 47 además incluye la revisión de textos. Cada fila dice dónde se comprueba.

| # | Escenario | Dónde se comprueba | Resultado |
|---|---|---|---|
| 1 a 5 | Un ejercicio de cada tipo de medición, datos ausentes, peso 0, valores fuera de rango, terminar | `training-session.spec.ts`, `SessionEditor.test.tsx`, `trainingText.test.ts`, `save_workout.test.sql` | Cumple |
| 6 | Registrar un entrenamiento de ayer | `training-session.spec.ts`, `start_workout.test.sql` | Cumple |
| 7 a 9 | Quitar una serie, una sola sesión en curso, esfuerzo percibido por ejercicio | `training-session.spec.ts`, `start_workout.test.sql` | Cumple |
| 10 a 12 | Crear una rutina con objetivos por tipo; validaciones | `training-routines.spec.ts`, `RoutineForm.test.tsx`, `routine_functions.test.sql` | Cumple |
| 13 y 14 | Editar orden y objetivos; duplicar; eliminar la copia | `training-routines.spec.ts`, `RoutinesPages.test.tsx` | Cumple |
| 15 y 16 | Eliminar una rutina no cambia sesiones; ejercicio eliminado avisa y se reemplaza | `training-routines.spec.ts`, `session_from_routine.test.sql` | Cumple |
| 17 | Doble clic en guardar y corte de red | `training-routines.spec.ts` | Cumple |
| 18 a 21 | Empezar desde una rutina; el plan es referencia; hacerlo tal cual no marca | `training-plan.spec.ts`, `PlanVsDone.test.tsx`, `RoutinePicker.test.tsx`, `session_from_routine.test.sql` | Cumple |
| 22 a 26 | Sustituir, saltear y agregar marcan «Modificada» y se explican; el plan queda guardado | `training-plan.spec.ts`, `planDiff.test.ts`, `session_modified.test.sql` | Cumple |
| 27 | Empezar desde el detalle de la rutina | `training-plan.spec.ts` | Cumple |
| 28 a 30 | Planificar un día, cambiar o quitar la rutina, la misma rutina en varios días, «Hoy» | `training-calendar.spec.ts`, `TrainingPlanning.test.tsx`, `session_planning.test.sql` | Cumple |
| 31 a 33 | Reprogramar dos veces con su recorrido; no mover lo realizado ni a una fecha pasada; cancelar y volver a planificar | `training-calendar.spec.ts`, `session_planning.test.sql` | Cumple |
| 34 | Planificada vencida («Sin registrar») y registrar con «¿Qué día la hiciste?» | `training-calendar.spec.ts`, `TrainingPlanning.test.tsx`, `calendar.test.ts` | Cumple |
| 35 | Doble clic o reintento al planificar, mover o cancelar | `TrainingPlanning.test.tsx`, `session_planning.test.sql` (idempotencia por solicitud) | Cumple |
| 36 | Calendario del mes y un día con dos sesiones | `training-calendar.spec.ts`, `CalendarMonth.test.tsx`, `calendar.test.ts` | Cumple |
| 37 a 39 | Historia de un ejercicio, «La última vez», vacía, renombrado y eliminado | `training-history.spec.ts`, `ExerciseHistoryPage.test.tsx`, `LastTime.test.tsx`, `exercise_history.test.sql` | Cumple |
| 40 y 41 | Corregir y eliminar una sesión | `training-correct.spec.ts`, `SessionCorrection.test.tsx`, `session_correct_delete.test.sql` | Cumple |
| 42 | Editar o eliminar un ejercicio, o repetir la importación, no cambia las sesiones | `training-correct.spec.ts`, `training_schema.test.sql` (disparadores de instantánea) | Cumple |
| 43 a 45 | Recargar y cerrar sesión; cortar la red; dos pestañas | `training-session.spec.ts`, `useSessionEditor.test.tsx`, `sessionEditorState.test.ts` | Cumple |
| 46 | La cuenta B y la petición anónima | `training-isolation.spec.ts`, `training_rls.test.sql` | Cumple |
| 47 | Teléfono y escritorio, teclado, axe; revisión de textos | `a11y-training.spec.ts`, `responsive-training.spec.ts`, `trainingCopy.test.ts` (lenguaje neutral) | Cumple |
| 48 | Mediciones de SC-001 y SC-010 | `training-measure.spec.ts`; resultados en `research.md` (sección «Mediciones») | Cumple |

La prueba de responsive encontró tres desbordes reales en teléfono con nombres de ejercicio muy largos (la lista de diferencias, la historia y la etiqueta del esfuerzo percibido) y se corrigieron con `break-words`.

## Revisión de seguridad dirigida (T077)

| Punto | Cómo se verificó | Resultado |
|---|---|---|
| El cliente no inserta ni actualiza ninguna tabla de entrenamiento | `grep` de `.insert(`, `.update(`, `.upsert(` en `app/src`: ninguna coincidencia en `features/training`. Solo hay dos `delete` (rutinas y sesiones propias, que permite la RLS). `training_rls.test.sql` y `training-isolation.spec.ts` confirman que `insert` y `update` directos fallan para todas las tablas | Cumple |
| Las funciones no aceptan rutinas, sesiones ni ejercicios ajenos | `training-isolation.spec.ts` llama con el token de B a 10 funciones con identificadores de A y todas rechazan; los pgTAP de cada función prueban `not_found` con identificadores ajenos | Cumple |
| Las instantáneas son inmutables y no hay `cascade` hacia `exercises` | Las tres claves foráneas a `exercises` son `on delete set null`; los disparadores `protect_training_snapshot`, `protect_plan_item` y `protect_session_identity` están probados en `training_schema.test.sql` | Cumple |
| Ningún `console.*`, registro ni mensaje de error contiene el contenido de un entrenamiento | `grep` de `console.` en `app/src`: sin coincidencias. Los errores del servidor se traducen a textos propios (`trainingErrorMessage`) y los mensajes de las funciones no incluyen contenido de la persona (probado en `trainingErrors.test.ts`) | Cumple |
| El borrador de la sesión se borra al cerrar sesión | Escenario 43 de `training-session.spec.ts` | Cumple |
| Sin inyección de SQL | Ninguna función de las migraciones 000100 a 000800 usa SQL dinámico (`execute`/`format`) | Cumple |
| `check:secrets` | `npm run check:secrets`: sin secretos en el bundle ni en el repositorio (635 archivos) | Cumple |

Hallazgos corregidos en esta spec: `exercise_history` se implementó como `security definer` con filtro explícito por cuenta (el contrato decía `security invoker`; el contrato se actualizó) para poder responder `session_expired` con la misma regla que el resto de las funciones.

Otro hallazgo de proceso: `npx tsc --noEmit -p .` no revisaba nada (el `tsconfig.json` solo tiene referencias); el typecheck real es `npm run typecheck` (`tsc -b`) y encontró 20 errores de tipos acumulados, todos corregidos.

## Pruebas finales (T080)

| Comando | Resultado |
|---|---|
| `npm run format:check` (app) | Sin diferencias |
| `npm run lint` (app) | Sin avisos |
| `npm run typecheck` (app) | Sin errores |
| `npm test` (app) | 84 archivos, 1 023 pruebas en verde |
| `npm run test:db` | 48 archivos, 1 286 pruebas en verde |
| `npm run test:functions` | 101 pruebas en verde |
| `npm run test:import` | 105 pruebas en verde |
| `npm run test:config` | 12 pruebas en verde |
| `npm run check:secrets` (app) | Sin secretos |
| `npm run e2e` (por partes, proyecto `desktop`) | Ver abajo |

### E2E por partes (proyecto `desktop`)

| Parte | Resultado |
|---|---|
| Cuentas, perfil, ejercicios y alimentos | 72 en verde |
| Metas y comidas | 58 en verde y 1 fallo (`meals-measure-photo`, medición de tiempo de la spec 003 sensible a la carga de la máquina); pasa sola (2 en verde) |
| Entrenamiento (`training-*`), `a11y-training` y `responsive-training` | Cada archivo pasó en verde por separado al escribirlo (calendario, historia, corregir y eliminar, aislamiento, accesibilidad, responsive y mediciones). **La corrida conjunta fue interrumpida por poca memoria libre y no se repitió** |
| Proyectos `mobile` (`a11y.spec.ts`, `responsive.spec.ts`) y `pwa` | **Pendientes de correr** en esta ronda |

**Pendiente para dar T080 por cerrada**: repetir la parte de entrenamiento en una sola corrida y correr los proyectos `mobile` y `pwa`, cuando haya memoria libre.

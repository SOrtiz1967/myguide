# Tareas: Plan semanal de entrenamiento y pestaña Entrenamiento rehecha

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261028000100_weekly_plan.sql`: tabla `weekly_plan_days` con RLS (`weekday` entre 1 y 7, una fila por día y persona, `routine_id` con `on delete set null`, `routine_name` de 1 a 80 caracteres), disparador que sincroniza el nombre, `set_weekly_plan_day`, `mark_workout_done` y `workout_sessions.marked_complete`.
- [x] T002 Prueba pgTAP `supabase/tests/weekly_plan.test.sql` (asignar, reemplazar, quitar, validar día, aislamiento, renombrar y eliminar rutina, marcar, idempotencia, fecha futura, quitar la marca al cargar una serie).

## Fase 2: Historia 1 — Armar el plan semanal

- [x] T003 [US1] `app/src/features/training/api.ts`: `fetchWeeklyPlan`, `setWeeklyPlanDay`, `markWorkoutDone` y errores `invalid_plan`.
- [x] T004 [US1] `useWeeklyPlan.ts` y `WeeklyPlanPanel.tsx`: siete selectores con las rutinas, aviso de rutina eliminada, estado vacío y mensajes.

## Fase 3: Historias 2 y 3 — Hoy: marcar y cargar

- [x] T005 [US2] `useMarkWorkoutDone.ts` y `WorkoutDayActions.tsx`: rutina que toca, «Marcar como completado», «Hice otro entrenamiento», «Cargar entrenamiento», día futuro y sesión en curso.
- [x] T006 [US3] `RoutinePicker.tsx` y `useStartFromRoutine.ts`: «marcar como hecha» por rutina y fecha de la sesión.
- [x] T007 [US2] `app/src/features/home/TrainingBlock.tsx` y `app/src/features/week/DayPanel.tsx` con las acciones del día.
- [x] T008 [US2] `SessionSummaryView.tsx` y `trainingText.ts`: marca «Marcada como completada, sin detalle», sin «no realizado».

## Fase 4: Historia 4 — Pestaña Entrenamiento

- [x] T009 [US4] `TrainingHomePage.tsx` con el bloque de hoy, el plan semanal, las rutinas, el calendario y las últimas sesiones, con las piezas de la spec 017.

## Fase 5: Historia 5 — Semana con plan

- [x] T010 [US5] `week.ts` y `useWeek.ts`: «Plan», «Sin registro» y «Hecho» según el plan.

## Fase 6: Pruebas y cierre

- [x] T011 Pruebas de componentes `WeeklyPlan.test.tsx`, de estado `weekPlanState.test.ts` y ajuste de las pruebas existentes de inicio, semana y entrenamiento.
- [x] T012 Prueba e2e `app/tests/e2e/training-weekly-plan.spec.ts` y recorrido de las pruebas de entrenamiento existentes.
- [x] T013 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [x] T014 Corrida completa de Playwright: 292 de 292 pasan (2026-11-06).
- [x] T015 Actualizar `Documentacion/roadmap-specs.md` y `README.md`.

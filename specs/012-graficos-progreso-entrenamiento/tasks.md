# Tareas: Gráficos de progreso de entrenamiento

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261101000300_exercise_progress.sql`: `public.exercise_progress`.
- [x] T002 Prueba pgTAP `supabase/tests/exercise_progress.test.sql`.

## Fase 2: Lógica pura

- [x] T003 [US1] `app/src/features/training/progress/measures.ts` y `periods.ts` con sus pruebas unitarias (valores calculados a mano).
- [x] T004 [US1] `series.ts` (puntos, tendencia, series excluidas, esfuerzo) con sus pruebas.
- [x] T005 [US2] Comparación de períodos en `series.ts` con sus pruebas.
- [x] T006 [US3] `activity.ts` (semanas y meses) con sus pruebas.

## Fase 3: Aplicación

- [x] T007 `progress/api.ts`, `useProgress.ts` y copy `es.trainingProgress`.
- [x] T008 [US1] `ProgressChart.tsx`: puntos, línea de tendencia, lectura, teclado y tabla alternativa.
- [x] T009 [US1] `ExerciseProgressPage.tsx`: medida, período, avisos, series excluidas y esfuerzo percibido (US4); ruta `/ejercicios/:id/evolucion` y enlace desde la historia.
- [x] T010 [US2] `ComparePanel.tsx`.
- [x] T011 [US3] `ActivityBars.tsx`, `ActivitySummaryPage.tsx`, ruta `/entrenamiento/resumen` y enlace desde el entrenamiento.

## Fase 4: Pruebas y cierre

- [x] T012 Pruebas de componentes `app/tests/component/TrainingProgress.test.tsx`.
- [x] T013 Prueba e2e `app/tests/e2e/training-progress.spec.ts` (recorrido y accesibilidad a 375 y 1280 px). Corrida el 2026-11-06 con la base, `functions serve` y el preview: pasa.
- [x] T014 Actualizar `Documentacion/roadmap-specs.md`, `README.md` y `supabase/README.md`.
- [x] T015 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.

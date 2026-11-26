# Tareas: Analizador de rutina

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126001900_dismissed_observations.sql`: tabla `routine_observation_dismissals` (`user_id`, `scope_key` `routine:<id>` o `week`, `observation_key`, `data_hash`; textos de 1–80 caracteres; RLS de lectura propia, sin escritura directa) y función `dismiss_observation(scope_key, observation_key, data_hash, request_id)` (`security definer`, `private.is_session_fresh()`, idempotente). Error `invalid_observation:<motivo>:<campo>`. Tabla en `export_my_data()` y borrado en cascada. El resto se lee de `routines`, `routine_exercises`, `exercises` y `weekly_plan_days`.
- [ ] T002 Prueba pgTAP `supabase/tests/dismissed_observations.test.sql`: esquema, RLS, textos, idempotencia, aislamiento; guardián de RLS en verde.

## Fase 2: Historia 1 — Análisis de una rutina (P1)

- [ ] T003 [US1] Extraer `app/src/features/training/muscleSets.ts` (series directas e indirectas por grupo, regla de la spec 031) y reutilizarlo desde `volume/` para que ambas pantallas coincidan; ajustar las pruebas de la 031.
- [ ] T004 [US1] `analyzer/duration.ts` (puro): 45 segundos de ejecución por serie, descanso de 90 s para compuestos con carga y 60 s para aislamiento (la evidencia de descanso es débil, ver `research.md`) y 5 minutos de calentamiento; se muestra como rango ±20 % con la fórmula visible.
- [ ] T005 [US1] `analyzer/analyzeRoutine.ts` y `config.ts` (puros, sin IA): series directas e indirectas por grupo, ejercicios repetidos, ejercicios sin músculos, duración estimada; rutinas armadas a mano (equilibrada, concentrada en brazos, sin músculos, con cardio, vacía) en `app/tests/unit/analyzeRoutine.test.ts`.
- [ ] T006 [US1] `analyzer/analyzeWeek.ts`: con rutinas asignadas a días en el plan semanal (spec 018), series y frecuencia semanal por grupo, descanso entre sesiones del mismo grupo y comparación con los grupos prioritarios y la disponibilidad declarada (spec 025) si existe; sin plan semanal solo se ofrece el nivel de rutina; no penalizar entrenar un músculo una vez por semana si el volumen es adecuado; prueba `app/tests/unit/analyzeWeek.test.ts`.
- [ ] T007 [US1] `RoutineAnalysisPage.tsx` (ruta `/entrenamiento/rutinas/:id/analisis`), `WeekAnalysisCard.tsx` y enlace desde `RoutineDetailPage.tsx`; gráficos con tabla alternativa y 360 px.

## Fase 3: Historia 2 — Observaciones, no órdenes (P1)

- [ ] T008 [US2] `analyzer/observations.ts`: reglas con plantillas, sin IA — distribución desigual (un grupo con más del doble que otro de igual prioridad), grupo prioritario con pocas series, frecuencia semanal de 1 con muchas series, ejercicios repetidos, sesiones consecutivas con el mismo grupo grande, ejercicios sin músculos y duración mayor a la disponibilidad; el equilibrio push/pull y la duración máxima de sesión se declaran como heurísticas; cada observación lleva dato, comparación y una opción neutral; una rutina sin observaciones no se llama «óptima».
- [ ] T009 [US2] `ObservationList.tsx` y `api.ts`: ocultar con `dismiss_observation` (reaparece si cambia el `data_hash` de la rutina o el plan); el analizador nunca modifica la rutina; copy neutral en `app/src/copy/es.ts` sin «debés», «tenés que» ni «ideal».

## Fase 4: Pruebas y cierre

- [ ] T010 Prueba de componentes `app/tests/component/RoutineAnalysisPage.test.tsx` y revisión de textos.
- [ ] T011 Prueba e2e `app/tests/e2e/routine-analysis.spec.ts` (ver, ocultar, navegar, sin plan semanal, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T012 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T013 Playwright de entrenamiento y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

# Tareas: Adherencia al entrenamiento

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio. **Depende de** la tabla `training_periods` de la spec 033.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126001700_weekly_plan_versions.sql`: tabla `weekly_plan_versions` (`user_id`, `effective_from`, `days jsonb` con una entrada por día ISO 1–7 con `routine_id`, `routine_name` y `planned_sets`; inmutable, RLS de lectura propia, sin escritura directa); disparador sobre `weekly_plan_days` que agrega una versión en cada cambio sin modificar `set_weekly_plan_day`; relleno inicial con el plan actual de cada persona con fecha de la migración (el pasado no se reconstruye); función de solo lectura `public.adherence_weeks(from_date, to_date)` (máximo 52 semanas ISO; `week_start, planned_days, planned_sets, completed_planned_days, completed_sets, extra_sessions, cancelled_planned, has_plan_version`; excluye los días dentro de `training_periods`; error `session_expired`). Reglas: planificado = días con rutina en la versión vigente más sesiones con plan agendadas a mano que no caen en un día contado; realizado = sesión `completed` por `original_date` dentro de la semana (reprogramada a otra semana cumple la de su fecha real); las realizadas sin plan cuentan en frecuencia y no en el porcentaje; las `cancelled` cuentan como planificadas no realizadas.
- [ ] T002 Migración `supabase/migrations/20261126001800_weekly_plan_versions_privacy.sql`: tabla en `export_my_data()` y borrado en cascada.
- [ ] T003 Prueba pgTAP `supabase/tests/weekly_plan_versions.test.sql`: disparador, relleno, cambio de plan a mitad de período, sesiones reprogramadas, canceladas y extras, pausas, aislamiento; guardián de RLS en verde.

## Fase 2: Historia 1 — Cuánto cumplí de lo planificado (P1)

- [ ] T004 [US1] `app/src/features/training/adherence/adherence.ts` (puro, determinista, sin IA): porcentaje de sesiones con un decimal, frecuencia real y consistencia semanal para 4, 8 o 12 semanas; semana en curso incompleta y excluida del promedio cerrado; menos de 3 semanas cerradas → «pocos datos»; semanas sin versión del plan → «sin plan semanal registrado»; el porcentaje puede superar 100 % y se indica; prueba `app/tests/unit/adherence.test.ts`.
- [ ] T005 [US1] `api.ts`, `useAdherence.ts` y copy en `app/src/copy/es.ts`: texto neutral sin rachas ni culpa; la regla de qué sesiones cuentan (reprogramadas, modificadas, canceladas) visible; meta mínima de 2 sesiones de fuerza por semana (OMS) y corte opcional como convención de diseño (p. ej. 80 %), nunca como umbral científico; sin rankings ni racha que se reinicie a cero; una cancelación es un evento neutro y reprogramable.
- [ ] T006 [US1] `AdherencePage.tsx`, `AdherenceChart.tsx` (con tabla alternativa) y `AdherenceSummary.tsx`; ruta `/entrenamiento/adherencia` en `app/src/routes/index.tsx`; bloque resumido en `ActivitySummaryPage.tsx` (spec 012); la persona puede marcar pausas con el control de la spec 033.

## Fase 3: Historia 2 — Series planificadas contra realizadas (P2)

- [ ] T007 [US2] Series planificadas (`session_plan_items.sets` y `planned_sets` del plan para días sin sesión) contra realizadas (series con valores de sesiones `completed`) en `adherence.ts` y `AdherencePage.tsx`; prueba en `adherence.test.ts`.

## Fase 4: Pruebas y cierre

- [ ] T008 Prueba de componentes `app/tests/component/AdherencePage.test.tsx`.
- [ ] T009 Prueba e2e `app/tests/e2e/adherence.spec.ts` (cuatro semanas con un cambio de plan en la tercera, sin que cambie el porcentaje de semanas cerradas; aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T010 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T011 Playwright de entrenamiento y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

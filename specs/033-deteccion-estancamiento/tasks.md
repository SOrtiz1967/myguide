# Tareas: Detección de estancamiento

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126001300_training_periods.sql`: tablas `training_periods` (`kind` ∈ `deload`, `pause`; `start_date`, `end_date`, `note`; inicio ≤ fin, máximo 90 días, sin solapamiento del mismo tipo; compartida con la spec 035) y `stagnation_dismissals` (`exercise_id`, `dismissed_at`, `session_count`), con `user_id`, RLS de lectura propia y sin escritura directa; funciones `save_training_period(kind, start_date, end_date, note, request_id)`, `delete_training_period(id)` y `dismiss_stagnation(exercise_id, session_count, request_id)` (`security definer`, `private.is_session_fresh()`, idempotentes). Error `invalid_period:<motivo>:<campo>`. Sin cambios en tablas existentes.
- [ ] T002 Migración `supabase/migrations/20261126001400_training_periods_privacy.sql`: tablas en `export_my_data()` y borrado en cascada.
- [ ] T003 Prueba pgTAP `supabase/tests/training_periods.test.sql`: esquema, RLS, fechas, solapamientos, idempotencia, aislamiento; guardián de RLS en verde.

## Fase 2: Historia 1 — Qué ejercicios están estancados (P1)

- [ ] T004 [US1] `app/src/features/training/stagnation/config.ts`: constantes documentadas (5 sesiones, 12 semanas, mejora clara = un incremento de peso o una repetición más en la serie principal o un aumento de volumen mayor al ruido de medición de ~4 %, ver `research.md`; el 2 % del plan queda por debajo del ruido y se reemplaza) declaradas como criterio de producto, no como umbral científico; el mínimo escala con el nivel de experiencia.
- [ ] T005 [US1] `detectStagnation.ts` (puro, determinista, sin IA) sobre las series de `exercise_progress`: últimas N sesiones realizadas fuera de períodos de descarga o pausa contra la mejor sesión previa en peso, repeticiones, volumen o esfuerzo; mismo peso y repeticiones con menor esfuerzo (spec 029) cuenta como mejora; con datos insuficientes informa y no marca; prueba `app/tests/unit/detectStagnation.test.ts` (estancamiento claro, mejora reciente, pausa larga, descarga marcada, esfuerzo mejorando, pocos datos).
- [ ] T006 [US1] `api.ts`, `useStagnation.ts` y copy neutral en `app/src/copy/es.ts` («posible estancamiento», «sin progreso reciente», sesiones comparadas, período y criterio), sin culpar ni diagnosticar.
- [ ] T007 [US1] `StagnationPage.tsx` (ruta `/entrenamiento/estancamiento`), `StagnationCard.tsx` en `ExerciseProgressPage.tsx` y `PeriodMarker.tsx` para marcar descarga o pausa en el calendario de entrenamiento (`TrainingHomePage.tsx`); descartar un aviso lo oculta hasta 3 sesiones nuevas más sin mejora.

## Fase 3: Historia 2 — Factores observables sin causalidad (P1)

- [ ] T008 [US2] `observableFactors.ts` (puro): sueño (spec 007), volumen semanal del grupo principal (spec 031), esfuerzo promedio, balance energético (specs 004 y 010), frecuencia y recuperación declarada (spec 034), para el tramo del estancamiento contra las 4 semanas anteriores; aparece solo con datos suficientes en ambos períodos y diferencia sobre el umbral; los faltantes se muestran como faltantes; prueba `app/tests/unit/observableFactors.test.ts` y revisión de textos (sin «causa», «por eso» ni «debido a»).

## Fase 4: Pruebas y cierre

- [ ] T009 Prueba de componentes `app/tests/component/StagnationCard.test.tsx`.
- [ ] T010 Prueba e2e `app/tests/e2e/stagnation.spec.ts` (ver, descartar, marcar descarga, pocos datos, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T011 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T012 Playwright de entrenamiento y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

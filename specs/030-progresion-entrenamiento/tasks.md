# Tareas: Progresión de entrenamiento

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126000900_progression_settings.sql`: tabla `exercise_progression_settings` (una fila por persona y ejercicio: `rep_min`, `rep_max`, `increment_kg`, `enabled`; `user_id`, RLS de lectura propia, sin escritura directa) y función `save_progression_setting(exercise_id, rep_min, rep_max, increment_kg, enabled, request_id)` (`security definer`, `private.is_session_fresh()`, idempotente; 1 ≤ rep_min < rep_max ≤ 50, incremento 0–20 kg en pasos de 0,25, ejercicio existente y visible). Error `invalid_progression:<motivo>:<campo>`. Sin cambios en tablas existentes.
- [ ] T002 Migración `supabase/migrations/20261126001000_progression_privacy.sql`: tabla en `export_my_data()` y borrado en cascada.
- [ ] T003 Prueba pgTAP `supabase/tests/progression_settings.test.sql`: esquema, RLS, rangos, idempotencia, ejercicio ajeno; guardián de RLS en verde.

## Fase 2: Historia 1 — Objetivo sugerido por ejercicio (P1)

- [ ] T004 [US1] `app/src/features/training/progression/defaults.ts`: rango 8–12 repeticiones e incremento de 2,5 kg para carga externa; 8–15 sin incremento de peso para peso corporal; por duración o distancia solo «superar el valor anterior».
- [ ] T005 [US1] `suggestNext.ts` (puro, determinista, sin IA): doble progresión; sube el peso si en las últimas dos sesiones el peso fue el mismo y todas las series llegaron al máximo del rango (incremento de carga entre 2–10 % según la regla ACSM, o el mínimo disponible, ver `research.md`); si no, mantener y buscar más repeticiones; bajar solo tras dos sesiones seguidas por debajo del mínimo (reducción del 5 al 10 %); con esfuerzo por serie promedio de 9,5 o más (spec 029) no sube el peso; historial mínimo de dos sesiones en las últimas 8 semanas, declarado como criterio de producto, si no «sin información suficiente»; la sugerencia no se guarda. Prueba `app/tests/unit/suggestNext.test.ts` con al menos diez historiales armados a mano (duración, sin carga, una sola sesión).
- [ ] T006 [US1] `useSuggestion.ts` (lee `exercise_history` de las últimas sesiones) y `SuggestionCard.tsx` con «por qué», ignorable, 44 px, sin desplazamiento horizontal a 360 px; copy neutral en `app/src/copy/es.ts` («podés intentar…»); nunca reescribe `target_weight_kg` ni `target_reps` del plan.
- [ ] T007 [US1] Integrar la tarjeta en `SessionExerciseCard.tsx` y `ExerciseHistoryPage.tsx`; nota neutral por recuperación declarada baja si existe la spec 034, sin cambiar el número sugerido.

## Fase 3: Historia 2 — Definir el rango y el criterio (P2)

- [ ] T008 [US2] `useProgressionSetting.ts` y `ProgressionSettingForm.tsx`: editar rango, incremento y activación por ejercicio con `save_progression_setting`, errores junto al campo y sin mostrar guardado hasta la confirmación del servidor.

## Fase 4: Pruebas y cierre

- [ ] T009 Prueba de componentes `app/tests/component/SuggestionCard.test.tsx`.
- [ ] T010 Prueba e2e `app/tests/e2e/progression.spec.ts` (ver, aceptar, editar e ignorar la sugerencia; aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T011 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T012 Playwright de entrenamiento y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

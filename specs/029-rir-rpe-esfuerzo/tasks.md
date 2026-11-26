# Tareas: RIR/RPE y esfuerzo por serie

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126000800_set_effort.sql`: columnas `session_sets.effort_rpe numeric(3,1)` (1,0 a 10,0 en pasos de 0,5, nula por defecto) y `session_sets.note text` (1–200 caracteres); actualizar `private.clean_session_set` para aceptar `effort_rpe` y `note` (fuera de rango lanza `invalid_session:invalid_effort:sets`); actualizar `exercise_progress` y `exercise_history` para devolverlas con `jsonb_strip_nulls`. Retrocompatible: las series existentes quedan con `null` y `session_exercises.effort` no se toca.
- [ ] T002 Prueba pgTAP `supabase/tests/set_effort.test.sql`: rango, pasos de 0,5, nota, series viejas intactas, retrocompatibilidad de `save_session`, `exercise_progress` y `exercise_history`; guardián de RLS en verde.

## Fase 2: Historia 1 — Registrar el esfuerzo de cada serie (P1)

- [ ] T003 [US1] `app/src/features/training/effortScale.ts`: conversiones RIR↔RPE (`RIR = 10 − RPE`; RIR 0–9 ↔ RPE 10–1), etiquetas («RIR 2 ≈ RPE 8»), rango principal RIR 0–4 (RPE 6–10) y RIR mayor a 4 como «ligero/aproximado»; prueba `app/tests/unit/effortScale.test.ts`.
- [ ] T004 [US1] Ampliar `schema.ts`, `api.ts` y `sessionEditorState.ts` en `app/src/features/training/` con `effort_rpe` y `note` por serie; el esfuerzo faltante queda `null`, nunca se completa; copiar una sesión o rutina no copia el esfuerzo.
- [ ] T005 [US1] `SetEffortPicker.tsx` y su integración en la fila de serie de `SessionExerciseCard.tsx`: botón «Esfuerzo» colapsado, opciones táctiles de 44 px, un toque adicional como máximo, último valor de la sesión para repetir, accesible por teclado y sin desplazamiento horizontal en 360 px; el esfuerzo por ejercicio se rotula «Esfuerzo del ejercicio».
- [ ] T006 [US1] Copy en `app/src/copy/es.ts`: ayuda con margen de error de alrededor de ±1 repetición; llegar al fallo no es requisito; sin juicios.

## Fase 3: Historia 2 — Escala y visualización (P1)

- [ ] T007 [US2] Preferencia de escala: leer `athlete_preferences.effort_scale` (spec 025) con `rir` por defecto mientras no exista; cambiar de escala solo cambia cómo se muestra y se carga, sin alterar datos guardados.
- [ ] T008 [US2] `HistoryEntryView.tsx` y `progress/{series,ProgressChart}.ts(x)`: mostrar «27,5 kg × 10 · 2 RIR» en la escala elegida, usar el esfuerzo por serie cuando existe y el del ejercicio cuando no, «sin dato» si falta, y nunca tratar como equivalentes series con distinto esfuerzo.

## Fase 4: Pruebas y cierre

- [ ] T009 Pruebas de componentes `app/tests/component/SetEffortPicker.test.tsx` y ajuste de las de sesión e historial.
- [ ] T010 Prueba e2e `app/tests/e2e/set-effort.spec.ts` (cargar, guardar, reabrir, cambiar de escala, series previas sin esfuerzo, dos series iguales con distinto esfuerzo) y accesibilidad a 375 y 1280 px.
- [ ] T011 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T012 Playwright de entrenamiento (sesión, historial, progreso); actualizar `Documentacion/roadmap-specs.md` y `README.md`.

# Tareas: Volumen muscular

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126001100_muscle_volume.sql`: agregar `session_exercises.primary_muscles text[]` y `secondary_muscles text[]`; disparador que las llena en el alta del ejercicio de sesión desde el catálogo; relleno único de las filas existentes con el valor actual del ejercicio (documentar la limitación); funciones de solo lectura `public.muscle_volume(from_date, to_date)` (máximo 52 semanas; `week_start, muscle, direct_sets, indirect_sets, session_days, direct_session_days, sessions_with_sets`; serie directa para cada músculo primario e indirecta para cada secundario; solo ejercicios `reps_weight` y `reps_bodyweight` de sesiones `completed`; semanas ISO sobre `session_date`) y `public.muscle_volume_weeks(from_date, to_date)` (`week_start, sessions, sets_without_muscle`). `security definer`, `stable`, error `session_expired`.
- [ ] T002 Prueba pgTAP `supabase/tests/muscle_volume.test.sql`: disparador, relleno, conteo directo e indirecto, dos músculos primarios, sesiones no realizadas, ejercicios por duración, ejercicios eliminados y semana cerrada que no cambia al editar el catálogo; guardián de RLS en verde.

## Fase 2: Historia 1 — Series por grupo muscular (P1)

- [ ] T003 [US1] `app/src/features/training/volume/muscleGroups.ts`: agrupación en el cliente (pecho, espalda, hombros, bíceps, tríceps, antebrazos, cuádriceps, isquiotibiales, glúteos, pantorrillas, aductores/abductores, abdominales, cuello); `full_body` se informa aparte; ejercicios sin músculos como «sin grupo».
- [ ] T004 [US1] `volume.ts` (puro) con series directas, indirectas (ponderación 0,5 a confirmar, ver `research.md`), frecuencia directa e indirecta y series por sesión; distinguir 0 series de «sin datos»; semana en curso marcada y excluida de las comparaciones cerradas; prueba `app/tests/unit/volume.test.ts`.
- [ ] T005 [US1] `api.ts`, `useVolume.ts` y copy `volume` en `app/src/copy/es.ts`: textos que informan el dato y sugieren revisarlo, con rango orientativo 10–20 series duras por músculo y semana y sin techo duro, sin cantidades «necesarias» ni causalidad; aviso de que todas las series registradas cuentan porque no hay marca de calentamiento.
- [ ] T006 [US1] `VolumePage.tsx`, `VolumeChart.tsx` (barras por semana con tabla alternativa) y `MuscleRow.tsx`; ruta `/entrenamiento/volumen` en `app/src/routes/index.tsx`; enlace desde `TrainingHomePage.tsx` y desde el resumen de actividad (spec 012); 360 px y teclado.

## Fase 3: Historia 2 — Comparar con semanas anteriores (P1)

- [ ] T007 [US2] Comparación contra el promedio de las últimas 4 semanas cerradas con mínimo de 3 semanas con sesiones («sin información suficiente» si no) y tendencia con textos neutrales; prueba en `volume.test.ts`.

## Fase 4: Pruebas y cierre

- [ ] T008 Prueba de componentes `app/tests/component/VolumePage.test.tsx`.
- [ ] T009 Prueba e2e `app/tests/e2e/muscle-volume.spec.ts` (tres semanas de sesiones, semana en curso, sin datos, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T010 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T011 Playwright de entrenamiento y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

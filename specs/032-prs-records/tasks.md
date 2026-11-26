# Tareas: PRs y récords

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126001200_exercise_records.sql`: función de solo lectura `public.exercise_records(exercise_id uuid)` (`stable`, `security definer`, valida dueño y sesión fresca; error `session_expired`) que recorre en orden cronológico las series de sesiones `completed` (tope de las 2.000 más recientes) y devuelve los eventos de récord `record_type, rep_range, value, weight_kg, reps, session_id, session_date, set_position, is_baseline`: `max_weight`, `reps_at_weight` (peso exacto), `best_set_volume`, `best_session_volume`, `best_e1rm` (solo series de 1 a 10 repeticiones), `best_in_range` (rangos 1–5, 6–10, 11–15), y `best_duration`/`best_distance` para ejercicios por duración o distancia. El primer evento de cada tipo y rango es `is_baseline`; un valor igual al máximo anterior no es récord; dos series que baten el récord en la misma sesión generan un solo evento por tipo. Sin tablas nuevas.
- [ ] T002 Prueba pgTAP `supabase/tests/exercise_records.test.sql`: primer registro sin récord, empate, un solo evento por sesión y tipo, corrección que elimina el récord, ejercicios por duración, guardar dos veces la misma sesión sin duplicados, aislamiento; guardián de RLS en verde.

## Fase 2: Historia 1 — Aviso al lograr un récord (P1)

- [ ] T003 [US1] `app/src/features/training/records/estimate1rm.ts`: Epley (`peso × (1 + reps / 30)`) y Brzycki (`peso × 36 / (37 − reps)`) — comprobar ambas fórmulas en la fuente original antes de fijarlas (ver `research.md`); solo con 1–10 repeticiones (mejor hasta 6), nunca con más de 12, con margen de incertidumbre (±5 % con 2–5 reps, ±5–10 % con 6–10) y aviso aparte en peso muerto; prueba `app/tests/unit/estimate1rm.test.ts`.
- [ ] T004 [US1] `recordTypes.ts`, `recordText.ts`, `api.ts` y `useRecords.ts`: leer eventos y aplicar el criterio de «progreso significativo» por 1RM estimado de al menos 4–5 % (5 % o más si el e1RM viene de más de 5 repeticiones o el ejercicio es nuevo); un peso real mayor al anterior es récord sin umbral; copy neutral en `app/src/copy/es.ts`, sin comparaciones con otras personas.
- [ ] T005 [US1] `NewRecordBanner.tsx` en `SessionSummaryView.tsx`: muestra los eventos cuyo `session_id` es la sesión recién guardada; el primer registro figura como «punto de partida» y no como récord; aviso sobrio con rol de estado para lectores de pantalla.

## Fase 3: Historia 2 — Consultar mis récords (P1)

- [ ] T006 [US2] `RecordsPanel.tsx` en `ExerciseProgressPage.tsx` (spec 012): lista de récords por tipo con valor, fecha y sesión de origen; el 1RM estimado se rotula como estimación con método y margen; esfuerzo por serie junto al récord si existe (spec 029) sin usarlo para decidir qué es récord; sin rankings ni insignias; 360 px sin desplazamiento horizontal.

## Fase 4: Pruebas y cierre

- [ ] T007 Prueba de componentes `app/tests/component/RecordsPanel.test.tsx`.
- [ ] T008 Prueba e2e `app/tests/e2e/records.spec.ts` (aviso al guardar, lista en el ejercicio, sin duplicados, corrección, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T009 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T010 Playwright de entrenamiento y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

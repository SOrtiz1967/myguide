# Plan de implementación: PRs y récords personales

**Rama**: `032-prs-records` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

Los récords son una **lectura derivada del historial de series** y no una tabla propia. Una función de base recorre en orden cronológico las series de las sesiones realizadas de un ejercicio y devuelve los **eventos de récord** (cada vez que un valor supera al máximo anterior, por tipo). Como la sesión confirmada es inmutable salvo corrección explícita (la sesión lleva `corrected_at`), recalcular siempre da el mismo resultado, es idempotente y se corrige solo cuando se corrige o elimina el registro original: se cumplen «se conservan históricamente» y «solo cambian por corrección explícita» sin duplicar datos. El aviso «Nuevo récord» sale de comparar los eventos que pertenecen a la sesión que se acaba de guardar.

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126001200_exercise_records.sql` con `public.exercise_records(exercise_id uuid)` (solo lectura, `stable`, `security definer`, con dueño y sesión verificados). Sin tablas nuevas.
- **Aplicación**: `app/src/features/training/records/` con `recordTypes.ts`, `estimate1rm.ts` (puro), `useRecords`, `RecordsPanel` (en el detalle del ejercicio y en la evolución), `NewRecordBanner` (al terminar la sesión) y los textos. Se muestran en `ExerciseProgressPage` (spec 012) y en `SessionSummaryView`.
- **Pruebas**: pgTAP con historiales armados a mano (primer registro sin récord, empate, corrección que elimina el récord, ejercicios por duración), Vitest para estimación de 1RM y formato, Playwright para ver el aviso al guardar y la lista en el ejercicio.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: sin tablas nuevas; la función solo lee lo propio. |
| II | Se cumple: los récords son derivados del historial inmutable; corregir un registro recalcula, eliminarlo también, ninguno se inventa ni se duplica. |
| IV | Se cumple: aviso sobrio, sin comparaciones con otras personas ni presión. |
| V | Se cumple: la estimación de 1RM se rotula como estimación con su método; un primer registro no se anuncia como récord. |
| VI | Se cumple: aviso con rol de estado para lectores de pantalla, 360 px. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Derivar, no persistir.** Persistir récords exigiría mantenerlos sincronizados con correcciones y eliminaciones; derivarlos desde las series evita esa clase de errores y mantiene un solo origen de verdad.
- **Tipos de récord** (por ejercicio de tipo `reps_weight` o `reps_bodyweight`):
  1. `max_weight`: mayor peso con al menos 1 repetición.
  2. `reps_at_weight`: más repeticiones con el mismo peso (se detecta por peso exacto).
  3. `best_set_volume`: mayor peso × repeticiones en una serie.
  4. `best_session_volume`: mayor suma de peso × repeticiones del ejercicio en una sesión.
  5. `best_e1rm`: mayor 1RM estimado (Epley: `peso × (1 + reps / 30)`, solo para series de 1 a 10 repeticiones).
  6. `best_in_range`: mayor peso dentro de cada rango de repeticiones (1–5, 6–10, 11–15).
  Para ejercicios por duración o distancia: `best_duration` y `best_distance`.
- **Primer registro.** El primer evento de cada tipo no se anuncia como récord (no hay base de comparación) y figura como «punto de partida».
- **Desempate.** Un valor igual al máximo anterior no es récord. Dos series que baten el récord en la misma sesión generan un solo evento por tipo (el mejor de la sesión).
- **Esfuerzo.** Si hay esfuerzo por serie (spec 029), se muestra junto al récord; no se usa para decidir qué es récord (dato objetivo, FR de la spec).
- **Aviso al guardar.** `SessionSummaryView` llama a `exercise_records` para los ejercicios de la sesión y muestra los eventos cuya `session_id` es la actual.
- **Sin rankings ni insignias.**

## Contratos (función de base)

- `exercise_records(exercise_id uuid) returns table (record_type text, rep_range text, value numeric, weight_kg numeric, reps integer, session_id uuid, session_date date, set_position integer, is_baseline boolean)`: eventos en orden cronológico; `is_baseline` marca el primer evento de cada tipo y rango. Considera solo sesiones `completed`. Tope: las 2.000 sesiones más recientes (igual que `exercise_progress`). Error `session_expired` si la sesión venció.

## Estructura de archivos

```text
supabase/migrations/20261126001200_exercise_records.sql
supabase/tests/exercise_records.test.sql
app/src/features/training/records/{recordTypes,estimate1rm,useRecords,api,recordText}.ts(x)
app/src/features/training/records/{RecordsPanel,NewRecordBanner}.tsx
app/src/features/training/{SessionSummaryView,ExerciseProgressPage}.tsx
app/src/copy/es.ts
app/tests/{unit/estimate1rm.test.ts,component/RecordsPanel.test.tsx,e2e/records.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de entrenamiento y accesibilidad. Guardar dos veces la misma sesión no debe producir eventos duplicados; corregir una serie debe recalcular.

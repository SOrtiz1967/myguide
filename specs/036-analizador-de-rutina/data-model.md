# Modelo de datos: Analizador de rutina

## routine_observation_dismissals

Observaciones que la persona ocultó. Una fila por alcance y observación; ocultar de nuevo actualiza la fila.

| Columna | Tipo | Notas |
| --- | --- | --- |
| user_id | uuid | `references auth.users on delete cascade` |
| scope_key | text | `routine:<uuid>` o `week`; 1 a 80 caracteres |
| observation_key | text | identifica la regla (por ejemplo `uneven_volume`); 1 a 80 caracteres |
| data_hash | text | huella de los datos analizados cuando se ocultó |
| dismissed_at | timestamptz | |

Clave primaria `(user_id, scope_key, observation_key)`. RLS con lectura propia y sesión fresca; la escritura es `dismiss_observation` (`security definer`).

## Sin cambios

`routines`, `routine_exercises`, `exercises` y `weekly_plan_days` no cambian. El análisis es un valor derivado y no se persiste.

## Tipos derivados (cliente)

- **RoutineAnalysis**: `{ muscleSets, duration, repeatedExercises, ungrouped, observations }`.
- **WeekAnalysis**: `{ muscleSetsPerWeek, frequencyPerMuscle, restBetween, matchWithPriorities, observations }`.
- **DurationEstimate**: `{ minMinutes, maxMinutes, assumptions }`.
- **Observation**: `{ key, text, evidence, hidden }`.

## Reglas

- Un ejercicio sin músculos se lista como «sin grupo» y no se cuenta.
- Una observación oculta reaparece si cambia el `data_hash` de su alcance.
- El análisis no escribe en rutinas ni sesiones.
- `export_my_data()` incluye `routine_observation_dismissals`.

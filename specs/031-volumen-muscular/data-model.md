# Modelo de datos: Volumen por grupo muscular

## Cambios en `session_exercises` (spec 006)

| Columna | Tipo | Notas |
| --- | --- | --- |
| primary_muscles | text[] | por defecto `'{}'`; mismos valores y límite (hasta 5) que `exercises.primary_muscles` |
| secondary_muscles | text[] | por defecto `'{}'`; hasta 10 |

- **Disparador** `private.snapshot_session_exercise_muscles` (antes del alta): si `exercise_id` no es nulo, copia los músculos del ejercicio.
- **Relleno único**: para las filas existentes con `exercise_id` no nulo, copia los músculos actuales del ejercicio. Las filas con `exercise_id` nulo quedan con listas vacías («sin grupo»).
- Mismas restricciones que el catálogo: valores dentro de la lista, sin solapamiento entre primarios y secundarios.

Sin cambios de RLS ni de permisos: la escritura sigue pasando por `save_session`; el disparador es interno.

## Lecturas (sin tablas nuevas)

- `muscle_volume(from_date, to_date)`: una fila por (semana, músculo) con `direct_sets`, `indirect_sets`, `session_days`, `direct_session_days` y `sessions_with_sets`. Considera solo sesiones `completed` y ejercicios `reps_weight` o `reps_bodyweight`.
- `muscle_volume_weeks(from_date, to_date)`: una fila por semana con sesiones completadas y `sets_without_muscle` (series de ejercicios sin músculos cargados).

## Tipos derivados (cliente)

- **MuscleWeek**: `{ weekStart, group, direct, indirect, days, directDays, inProgress }`.
- **VolumeComparison**: promedio de las últimas 4 semanas cerradas por grupo, variación y estado (`ok`, `insufficient`).

## Reglas

- Series de sesiones `planned`, `in_progress` o `cancelled` no cuentan.
- Distinguir «0 series» (hubo sesiones esa semana) de «sin datos» (no hubo): lo decide `muscle_volume_weeks`.
- Un cambio en el catálogo no altera semanas ya registradas.

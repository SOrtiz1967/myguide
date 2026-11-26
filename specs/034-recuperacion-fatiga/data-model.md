# Modelo de datos: Recuperación y fatiga

## session_checks

Una fila por sesión de la persona. Todos los campos de contenido son opcionales; una fila sin ningún valor no se guarda.

| Columna | Tipo | Notas |
| --- | --- | --- |
| session_id | uuid pk | `references workout_sessions on delete cascade` |
| user_id | uuid | `references auth.users on delete cascade`; debe coincidir con el de la sesión |
| pre_sleep | smallint, nulo | 1 a 5, sueño percibido |
| pre_energy | smallint, nulo | 1 a 5 |
| pre_fatigue | smallint, nulo | 1 a 5 |
| pre_stress | smallint, nulo | 1 a 5 |
| pre_aches | text[], nulo | zonas de una lista cerrada, hasta 5 |
| pre_note | text, nulo | 1 a 200 caracteres |
| post_performance | smallint, nulo | 1 a 5, rendimiento percibido |
| post_difficulty | smallint, nulo | 1 a 5 |
| post_completed | boolean, nulo | si completó lo que quería hacer |
| post_note | text, nulo | 1 a 200 caracteres |
| client_request_id | uuid | único con `user_id` |
| created_at, updated_at | timestamptz | |

RLS: lectura propia con sesión fresca; sin permisos de escritura para el cliente; la escritura es `save_session_check`. Un disparador comprueba que `user_id` coincide con el dueño de la sesión.

## Tipos derivados (cliente)

- **SessionPerformance**: `{ sessionId, date, index | null, exercisesUsed }`.
- **RecoveryPattern**: `{ factor, sessions, withFactor, withoutFactor, medianWith, medianWithout, periodDays, text }`.
- **PersistentSignal**: `{ kind: 'fatigue' | 'recovery', checks, spanDays }`.

## Lecturas

- Los patrones combinan `session_checks`, `daily_activity` (sueño registrado, spec 007), `workout_sessions` y `exercise_progress` (spec 012).

## Reglas

- Cada dato lleva su fuente: «declarado» (chequeo) o «registrado» (spec 007).
- Un dato faltante se muestra como faltante; no entra en los patrones.
- `export_my_data()` incluye `session_checks`.
- Sin datos de salud en logs ni en telemetría.

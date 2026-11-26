# Modelo de datos: Progresión automática de entrenamiento

## exercise_progression_settings

Una fila por persona y ejercicio; se actualiza (no es historial: es una preferencia, no un dato registrado).

| Columna | Tipo | Notas |
| --- | --- | --- |
| user_id | uuid | `references auth.users on delete cascade` |
| exercise_id | uuid | `references exercises on delete cascade` |
| rep_min | smallint | 1 a 49 |
| rep_max | smallint | mayor que `rep_min`, hasta 50 |
| increment_kg | numeric(4,2) | 0 a 20, múltiplos de 0,25 |
| enabled | boolean | por defecto verdadero |
| updated_at | timestamptz | |

Clave primaria `(user_id, exercise_id)`. RLS con lectura propia y sesión fresca; la escritura es `save_progression_setting` (`security definer`).

## Sin cambios

`session_plan_items`, `session_sets` y `workout_sessions` no cambian. La sugerencia es un valor derivado.

## Tipos derivados (cliente)

- **ProgressionSuggestion**: `{ status: 'insufficient' | 'maintain' | 'raise_weight' | 'reduce_option', weightKg, repRange, goalText, evidence }`.
- **Evidence**: sesiones usadas (fecha, series con peso y repeticiones, esfuerzo si hay) y la regla aplicada, en texto neutral.

## Reglas

- La sugerencia nunca se persiste.
- Eliminar un ejercicio propio elimina su criterio (cascada).
- `export_my_data()` incluye `exercise_progression_settings`.

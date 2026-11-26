# Modelo de datos: PRs y récords personales

## Sin tablas ni columnas nuevas

Los récords se derivan de `session_sets`, `session_exercises` y `workout_sessions` (spec 006) mediante la función de lectura `exercise_records(exercise_id)`.

## Resultado de `exercise_records`

| Columna | Tipo | Notas |
| --- | --- | --- |
| record_type | text | `max_weight`, `reps_at_weight`, `best_set_volume`, `best_session_volume`, `best_e1rm`, `best_in_range`, `best_duration`, `best_distance` |
| rep_range | text, nulo | `1-5`, `6-10`, `11-15` para `best_in_range`; el peso para `reps_at_weight` va en `weight_kg` |
| value | numeric | el valor del récord (kg, repeticiones, volumen, segundos o km según el tipo) |
| weight_kg | numeric, nulo | peso de la serie que lo originó |
| reps | integer, nulo | repeticiones de esa serie |
| session_id | uuid | sesión de origen |
| session_date | date | |
| set_position | integer | posición de la serie |
| is_baseline | boolean | primer evento del tipo (y rango): punto de partida, no récord anunciable |

Los eventos vienen en orden cronológico; el récord vigente de cada tipo es el último evento de ese tipo.

## Criterios de la función

- Solo sesiones `completed` del dueño; series con los valores necesarios para el tipo.
- Un valor igual al máximo anterior no genera evento.
- Una sesión genera como máximo un evento por tipo y rango (el mejor).
- Ejercicios eliminados (`exercise_id` nulo) no tienen récords consultables.

## Tipos derivados (cliente)

- **RecordEvent**: fila anterior mapeada a un tipo del cliente con su texto.
- **NewRecords**: eventos de la sesión actual que no son punto de partida, para el aviso.

## Reglas

- Corregir o eliminar una serie o sesión recalcula los récords en la siguiente lectura.
- Guardar dos veces la misma sesión no genera eventos duplicados (la fuente no cambia).
- Sin permisos nuevos: `exercise_records` es de solo lectura y verifica la sesión fresca.

# Modelo de datos: Adherencia al entrenamiento

## weekly_plan_versions (historial inmutable)

Una fila por cambio del plan semanal; nunca se actualiza ni se borra (salvo la cascada al eliminar la cuenta). La versión vigente en una fecha D es la de `created_at` más reciente con `effective_from <= D`.

| Columna | Tipo | Notas |
| --- | --- | --- |
| id | uuid pk | |
| user_id | uuid | `references auth.users on delete cascade` |
| effective_from | date | el «hoy» de la persona al cambiar el plan |
| days | jsonb | objeto con claves `"1"` a `"7"`; cada valor `{routine_id, routine_name, planned_sets}` o `null` si el día no tiene rutina |
| created_at | timestamptz | |

Escritura: solo por el disparador `private.record_weekly_plan_version` (después de insertar, actualizar o eliminar en `weekly_plan_days`, una vez por sentencia). RLS: lectura propia con sesión fresca; sin permisos de escritura para el cliente.

El relleno inicial crea una versión con el plan actual de cada persona que lo tenga, con `effective_from` igual a la fecha de la migración.

## Uso de tablas existentes

- `training_periods` (spec 033): pausas excluidas del cálculo.
- `workout_sessions`, `session_plan_items`, `session_sets` (spec 006): sesiones, series planificadas y realizadas.
- `weekly_plan_days` (spec 018): la plantilla actual; no cambia.

## Resultado de `adherence_weeks`

| Columna | Notas |
| --- | --- |
| week_start | lunes de la semana |
| planned_days | días planificados (plan vigente + sesiones con plan a mano) fuera de pausas |
| planned_sets | series planificadas |
| completed_planned_days | días planificados cumplidos |
| completed_sets | series realizadas de sesiones completadas |
| extra_sessions | sesiones realizadas sin plan |
| cancelled_planned | planificadas canceladas |
| has_plan_version | falso si la semana es anterior a la primera versión del plan |

## Tipos derivados (cliente)

- **AdherencePeriod**: `{ weeks, plannedDays, completedDays, percent, plannedSets, completedSets, extra, inProgressWeek }`.
- **WeeklyConsistency**: serie de `{ weekStart, percent | null, frequency }`.

## Reglas

- La semana en curso se marca incompleta y no entra en el promedio cerrado.
- Cambiar el plan no modifica el resultado de semanas ya cerradas.
- `export_my_data()` incluye `weekly_plan_versions`.

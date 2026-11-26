# Plan de implementación: Adherencia al entrenamiento

**Rama**: `035-adherencia-entrenamiento` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

La adherencia compara lo **planificado** con lo **realizado** semana por semana. Hay un problema de datos que la spec asume resuelto y no lo está: el plan semanal de la spec 018 (`weekly_plan_days`) es una plantilla que se sobrescribe, así que hoy no se puede saber qué plan regía en una semana pasada. Esta spec agrega un **historial de versiones del plan semanal** (una fila inmutable por cambio, escrita por un disparador sobre `weekly_plan_days`, con el detalle de series planificadas por día) y una función de lectura `adherence_weeks` que, para cada semana, devuelve lo planificado y lo realizado. El porcentaje, la frecuencia y la consistencia se calculan en el cliente. Las pausas se leen de `training_periods` (spec 033).

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126001700_weekly_plan_versions.sql` con `weekly_plan_versions`, un disparador sobre `weekly_plan_days` que agrega una versión en cada cambio (sin cambiar `set_weekly_plan_day`), un relleno inicial con el plan actual de cada persona (con fecha de hoy) y la función `adherence_weeks(from_date, to_date)`. **Depende de** la tabla `training_periods` de la spec 033.
- **Aplicación**: `app/src/features/training/adherence/` con `adherence.ts` (puro), `useAdherence`, `AdherencePage` (ruta `/entrenamiento/adherencia`) y un bloque resumido en el resumen de actividad (spec 012).
- **Pruebas**: pgTAP para el disparador, el relleno y la función (cambios de plan a mitad de período, sesiones reprogramadas y canceladas, extras, pausas); Vitest para el cálculo; Playwright para la pantalla y la accesibilidad.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: tabla con `user_id`, RLS propia, solo lectura para el cliente; entra en exportación y eliminación. |
| II | Se cumple: el historial del plan es inmutable; cambiar el plan no reescribe semanas cerradas. |
| IV | Se cumple: texto neutral, sin rachas ni culpa, el porcentaje solo describe; las pausas no cuentan. |
| V | Se cumple: la semana en curso se marca incompleta; con pocos datos no se concluye; el plan de cada semana es el que regía ese día. |
| VI | Se cumple: gráfico con tabla alternativa, 360 px. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Versiones del plan.** `weekly_plan_versions(user_id, effective_from, days jsonb)`: `days` es un objeto con una entrada por día ISO (1 a 7) con `routine_id`, `routine_name` y `planned_sets` (suma de series de la rutina en ese momento). La versión vigente en la fecha D es la de `created_at` más reciente con `effective_from <= D`. El relleno inicial usa el plan actual desde la fecha de la migración: **no se reconstruye el pasado**; las semanas anteriores al lanzamiento usan solo sesiones planificadas a mano y se informa «sin plan semanal registrado».
- **Qué cuenta como planificado en una semana.** (a) Los días con rutina en la versión del plan vigente, y (b) las sesiones con plan (`has_plan`) agendadas a mano esa semana (por su fecha original) que no caen en un día ya contado. Una pausa o semana de descarga marcada excluye ese período del cálculo.
- **Qué cuenta como realizado.** Una sesión `completed` cuyo `original_date` cae en la semana de un día planificado la cumple aunque se haya reprogramado dentro de la misma semana; una sesión reprogramada a otra semana cumple la semana de la fecha en que se realizó. Las sesiones realizadas sin plan cuentan en la frecuencia real y no en el porcentaje, y se informan como «sin planificar». Las `cancelled` se cuentan como planificadas no realizadas (con texto neutral).
- **Series planificadas contra realizadas.** Planificadas: `session_plan_items.sets` de las sesiones con plan, y `planned_sets` del plan para los días sin sesión; realizadas: series con valores de sesiones `completed`.
- **Porcentaje.** `realizadas / planificadas` por período, con un decimal; puede superar el 100 % en series realizadas y se indica; semana en curso excluida del promedio cerrado.
- **Consistencia semanal.** Serie por semana del porcentaje y de la frecuencia real; con menos de 3 semanas cerradas, «pocos datos».
- **Períodos disponibles**: 4, 8 y 12 semanas (elegible).

## Contratos (función de base)

- `adherence_weeks(from_date date, to_date date) returns table (week_start date, planned_days smallint, planned_sets integer, completed_planned_days smallint, completed_sets integer, extra_sessions smallint, cancelled_planned smallint, has_plan_version boolean)`: máximo 52 semanas; semanas ISO; excluye de los conteos los días dentro de `training_periods`. Error `session_expired` si la sesión venció.

## Estructura de archivos

```text
supabase/migrations/20261126001700_weekly_plan_versions.sql
supabase/migrations/20261126001800_weekly_plan_versions_privacy.sql
supabase/tests/weekly_plan_versions.test.sql
app/src/features/training/adherence/{adherence,useAdherence,api}.ts(x)
app/src/features/training/adherence/{AdherencePage,AdherenceChart,AdherenceSummary}.tsx
app/src/features/training/ActivitySummaryPage.tsx
app/src/routes/index.tsx
app/src/copy/es.ts
app/tests/{unit/adherence.test.ts,component/AdherencePage.test.tsx,e2e/adherence.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de entrenamiento y accesibilidad. Verificar a mano un escenario de cuatro semanas con un cambio de plan en la tercera.

# Plan de implementación: Plan semanal de entrenamiento y pestaña Entrenamiento rehecha

**Rama**: `018-plan-semanal-entrenamiento` | **Fecha**: 2026-10-28 | **Spec**: [spec.md](spec.md)

## Resumen

El plan semanal se guarda como una tabla chica (una fila por día de la semana y persona) que apunta a una rutina. No genera sesiones: la aplicación lo lee y decide qué «toca» cada día. «Marcar como completado» es una función de la base que crea una sesión realizada con el plan de la rutina y ninguna serie; la marca se quita sola cuando la sesión recibe su primera serie. La pantalla de entrenamiento y el bloque del inicio se arman con las piezas de la spec 017.

## Contexto técnico

- Base de datos: una migración (`supabase/migrations/20261028000100_weekly_plan.sql`) con la tabla `weekly_plan_days`, el disparador que recuerda el nombre de la rutina, las funciones `set_weekly_plan_day` y `mark_workout_done` y la columna `workout_sessions.marked_complete`. Sin servicios nuevos ni dependencias.
- Aplicación: TypeScript y React como hasta ahora; datos con TanStack Query; las escrituras llaman a funciones del servidor.
- Pruebas: pgTAP para la base, Vitest para componentes y estado de la semana, Playwright para el recorrido completo.

## Revisión de la Constitution

| Principio                              | Resultado                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| I (privacidad y propiedad)             | Se cumple: la tabla tiene RLS, `user_id` y política de lectura propia; las escrituras pasan por funciones con el dueño y la sesión verificados. |
| II (datos separados, sin inventar)     | Se cumple: la sesión marcada guarda el plan como planificado y ninguna serie realizada; nada planificado se muestra como realizado.             |
| IV (reporte neutral, sin juicio)       | Se cumple: «Sin registro» y «Plan» en texto y forma; sin rachas ni días «perdidos»; un día sin rutina es solo un día sin rutina.                |
| V (sin conclusiones firmes de un dato) | No aplica: no hay análisis.                                                                                                                     |
| VI (mobile-first, accesibilidad)       | Se cumple: selectores con etiqueta, botones táctiles de 44 px, axe a 375 y 1280 px.                                                             |

No hay violaciones que justificar.

## Decisiones de diseño

- **Plan = plantilla leída en el momento.** Evita sesiones fantasma, «sin registrar» acumulados y migraciones al cambiar el plan. El estado de un día sin sesión se deduce: «Plan» hasta hoy inclusive y «Sin registro» después (FR-017).
- **Una rutina por día de la semana** (clave primaria `(user_id, weekday)`); los entrenamientos adicionales se cargan con «Cargar entrenamiento».
- **Rutina eliminada:** la clave foránea pone `routine_id` en nulo y la fila conserva `routine_name`, que un disparador mantiene al renombrar la rutina.
- **Marcar como completado:** `mark_workout_done(routine_id, session_date, request_id, client_timezone)`. Crea la sesión en estado `completed` con `has_plan`, copia el plan con `copy_routine_plan`, `modified = false` y `marked_complete = true`. Idempotente por `request_id`. Un disparador sobre `session_sets` baja `marked_complete` al insertar la primera serie.
- **Pantalla:** `WorkoutDayActions` concentra las acciones de un día (marcar, otro entrenamiento, cargar) y la usan el inicio de hoy (`TrainingBlock`) y el panel de un día pasado (`DayPanel`); `WeeklyPlanPanel` edita el plan con un selector por día.
- **Semana del inicio:** `trainingState` recibe si el día tiene rutina asignada; una sesión planificada a mano o cancelada manda sobre el plan (FR-018).

## Estructura de archivos

```text
supabase/migrations/20261028000100_weekly_plan.sql
supabase/tests/weekly_plan.test.sql
app/src/features/training/{WeeklyPlanPanel,WorkoutDayActions,useWeeklyPlan,useMarkWorkoutDone}.ts(x)
app/src/features/training/{api,RoutinePicker,TrainingHomePage,SessionSummaryView,trainingText,useStartFromRoutine}.ts(x)
app/src/features/home/TrainingBlock.tsx
app/src/features/week/{week,useWeek,DayPanel}.ts(x)
app/src/copy/es.ts
app/tests/{component/WeeklyPlan.test.tsx,unit/weekPlanState.test.ts,e2e/training-weekly-plan.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo, Playwright de entrenamiento (sesión, calendario, plan, rutinas, accesibilidad) y de la nueva spec, una parte por vez.

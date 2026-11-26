# Plan de implementación: Volumen por grupo muscular

**Rama**: `031-volumen-muscular` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

El catálogo de ejercicios (spec 005) ya tiene `primary_muscles` y `secondary_muscles`, pero la sesión (spec 006) guarda una instantánea del nombre y del tipo de medición del ejercicio **y no de sus músculos**. Para cumplir con que las semanas cerradas no cambien si luego se edita el catálogo, esta spec agrega a `session_exercises` una instantánea de los músculos (con relleno de lo ya registrado desde el ejercicio actual) y una lectura agregada `muscle_volume` que devuelve, por semana y músculo, series directas, series indirectas y días con series. La comparación con las últimas 4 semanas, la tendencia y los textos se calculan en el cliente.

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126001100_muscle_volume.sql` que (1) agrega `session_exercises.primary_muscles text[]` y `secondary_muscles text[]`, (2) las llena con un disparador en el alta del ejercicio de sesión y con un relleno único de las filas existentes, y (3) crea `public.muscle_volume(from_date date, to_date date)` (solo lectura, `security definer`, `stable`).
- **Aplicación**: `app/src/features/training/volume/` con la agrupación de músculos (`muscleGroups.ts`), el cálculo de comparación y tendencia (`volume.ts`, puro), la pantalla `VolumePage` (ruta `/entrenamiento/volumen`) y el gráfico de barras por semana. Se enlaza desde `/entrenamiento` y desde el resumen de actividad (spec 012).
- **Pruebas**: pgTAP para el disparador, el relleno y la función (conteo directo e indirecto, sesiones no realizadas, ejercicios por duración, ejercicios eliminados); Vitest para comparación, tendencia y textos; Playwright para la pantalla completa y accesibilidad.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: columnas nuevas de una tabla con RLS; la función valida dueño y sesión fresca y devuelve solo lo propio. |
| II | Se cumple: la instantánea de músculos hace que una semana cerrada no cambie si se edita el ejercicio; el relleno inicial usa el valor actual y se documenta. |
| IV | Se cumple: los textos informan el dato y sugieren revisar, sin cifras «necesarias». |
| V | Se cumple: se distingue 0 series de «sin datos», semanas incompletas indicadas, sin causalidad. |
| VI | Se cumple: gráfico con tabla alternativa, 360 px, accesible por teclado. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Agrupación de músculos.** Los 18 valores del catálogo se agrupan para la pantalla en: pecho, espalda (dorsales, espalda media, trapecios, lumbares), hombros, bíceps, tríceps, antebrazos, cuádriceps, isquiotibiales, glúteos, pantorrillas, aductores/abductores, abdominales y cuello. `full_body` no cuenta como grupo (se informa aparte). La agrupación vive en el cliente para poder cambiarla sin migración; la base devuelve los músculos del catálogo sin agrupar.
- **Regla de conteo.** Cada serie cuenta como **directa** para cada músculo primario del ejercicio y como **indirecta** para cada secundario. Un ejercicio con dos músculos primarios suma una serie directa a cada uno (se indica en pantalla).
- **Qué cuenta como serie.** Solo series de ejercicios de tipo `reps_weight` y `reps_bodyweight` de sesiones `completed`. Duración y distancia no cuentan. Como no existe una marca de calentamiento, todas las series registradas cuentan; la limitación se explica en pantalla y se evalúa una marca de calentamiento como mejora futura.
- **Semanas.** De lunes a domingo (ISO), sobre `session_date`. La semana en curso se marca «en curso» y se excluye de las comparaciones cerradas.
- **Frecuencia.** Cantidad de días distintos de la semana con al menos una serie directa o indirecta del músculo; se muestra por separado la frecuencia directa.
- **Volumen por sesión.** Series directas del músculo dividido por las sesiones de la semana que lo trabajaron.
- **Comparación.** Contra el promedio de las últimas 4 semanas cerradas, con mínimo de 3 semanas con sesiones; si no, «sin información suficiente».
- **Ejercicios sin músculos** (propios sin cargar o eliminados antes del relleno): se listan aparte como «sin grupo» con la cantidad de series.
- **Textos.** Solo informan el dato y sugieren revisarlo según el objetivo y el rendimiento; nunca fijan una cantidad necesaria.

## Contratos (función de base)

- `muscle_volume(from_date date, to_date date) returns table (week_start date, muscle text, direct_sets integer, indirect_sets integer, session_days smallint, direct_session_days smallint, sessions_with_sets smallint)`: máximo 52 semanas por llamada. Devuelve una fila por semana y músculo con series; las semanas sin sesiones completas no aparecen (el cliente las distingue de «0 series» con `training_weeks()` o con el conteo de sesiones, ver `data-model.md`). Error `session_expired` si la sesión venció.
- `muscle_volume_weeks(from_date date, to_date date) returns table (week_start date, sessions smallint, sets_without_muscle integer)`: semanas con sesiones completas y las series sin grupo.

## Estructura de archivos

```text
supabase/migrations/20261126001100_muscle_volume.sql
supabase/tests/muscle_volume.test.sql
app/src/features/training/volume/{muscleGroups,volume,useVolume,api}.ts(x)
app/src/features/training/volume/{VolumePage,VolumeChart,MuscleRow}.tsx
app/src/features/training/TrainingHomePage.tsx
app/src/routes/index.tsx
app/src/copy/es.ts
app/tests/{unit/volume.test.ts,component/VolumePage.test.tsx,e2e/muscle-volume.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de entrenamiento y accesibilidad. Verificar a mano con tres semanas de sesiones el conteo directo e indirecto y la semana en curso.

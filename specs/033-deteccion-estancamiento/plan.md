# Plan de implementación: Detección de estancamiento

**Rama**: `033-deteccion-estancamiento` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

La detección es una función pura del cliente sobre las series que ya devuelve `exercise_progress` (spec 012): compara las últimas N sesiones realizadas de un ejercicio con la mejor sesión previa y decide si hubo «mejora clara». Los factores observables del mismo período (sueño, volumen, esfuerzo, balance energético, frecuencia, recuperación declarada) se arman con datos que ya existen (`daily_activity`, `trends_nutrition`, `muscle_volume`, esfuerzo por serie) y se presentan como coincidencias, nunca como causas. Lo único que se persiste son dos marcas de la persona: **períodos de descarga o pausa** (para que no cuenten) y **avisos descartados**. Esas marcas se guardan en una tabla compartida de períodos que también usará la spec 035.

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126001300_training_periods.sql` con `training_periods` (descarga o pausa, con fechas) y `stagnation_dismissals` (aviso descartado por ejercicio), y las funciones `save_training_period`, `delete_training_period` y `dismiss_stagnation`. Sin cambios en tablas existentes.
- **Aplicación**: `app/src/features/training/stagnation/` con `detectStagnation()` y `observableFactors()` (puros), `useStagnation`, `StagnationPage` (ruta `/entrenamiento/estancamiento`), una tarjeta en el detalle del ejercicio y el control de descarga en el calendario de entrenamiento.
- **Pruebas**: Vitest con historiales armados a mano (estancamiento claro, mejora reciente, pausa larga, descarga marcada, esfuerzo mejorando con igual peso, pocos datos) y de textos (sin lenguaje causal), pgTAP para las tablas y funciones, Playwright para ver, descartar y marcar descarga.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: tablas con `user_id`, RLS propia y escritura por funciones con sesión fresca; entran en exportación y eliminación. Sin servicios externos. |
| II | Se cumple: la detección es derivada y no modifica registros; descartar o marcar descarga solo agrega marcas. |
| IV | Se cumple: observación neutral, sin culpar ni diagnosticar; descartable. |
| V | Se cumple: no se concluye con pocas sesiones; los factores son patrones observados con período y cantidad de datos, sin causalidad; los datos faltantes se muestran como faltantes. |
| VI | Se cumple: pantalla accesible, 360 px. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Definición de estancamiento.** Un ejercicio está «posible estancamiento» si en sus últimas **5 sesiones realizadas** (dentro de las últimas 12 semanas, sin contar períodos de descarga o pausa) ninguna superó a la mejor sesión anterior a ese tramo en alguna de estas medidas: mayor peso, más repeticiones en el mejor peso, mejor volumen de la sesión o, si hay esfuerzo, igual rendimiento con menor esfuerzo. Las constantes (5 sesiones, 12 semanas) viven en un archivo de configuración documentado.
- **Mejora clara.** Un aumento mínimo de peso de un incremento (por defecto 2,5 kg), o una repetición más en la serie principal, o un 2 % más de volumen de sesión. Menos que eso se considera «similar».
- **Esfuerzo mejorando.** Mismo peso y repeticiones con menor esfuerzo percibido (spec 029) cuenta como mejora y evita el aviso, indicándolo.
- **Factores observables.** Cada uno se calcula para el tramo del estancamiento y se compara con las cuatro semanas anteriores: sueño promedio (spec 007), volumen semanal del grupo principal (spec 031), esfuerzo promedio, balance energético medio contra el objetivo (specs 004 y 010), cambio en la frecuencia del ejercicio y recuperación declarada (spec 034). Un factor aparece solo si hay datos suficientes en **ambos** períodos y la diferencia supera un umbral; el texto dice «También se observa…» con el período y la cantidad de registros.
- **Semanas de descarga y pausas.** `training_periods(kind in ('deload', 'pause'), start_date, end_date)`. La persona las marca; las sesiones dentro no cuentan para la detección. Sin solapamientos del mismo tipo.
- **Descartar.** `stagnation_dismissals(exercise_id, dismissed_at, session_count)`; un aviso descartado reaparece solo si pasan 3 sesiones nuevas más sin mejora.
- **Sin acciones automáticas.** No cambia la rutina ni la progresión; solo informa.

## Contratos (funciones de base)

- `save_training_period(kind text, start_date date, end_date date, note text, request_id uuid) returns uuid`: valida fechas (inicio ≤ fin, máximo 90 días), sin solapamiento con otro período del mismo tipo. Error `invalid_period:<motivo>:<campo>`.
- `delete_training_period(id uuid)`.
- `dismiss_stagnation(exercise_id uuid, session_count integer, request_id uuid)`.

## Estructura de archivos

```text
supabase/migrations/20261126001300_training_periods.sql
supabase/migrations/20261126001400_training_periods_privacy.sql
supabase/tests/training_periods.test.sql
app/src/features/training/stagnation/{detectStagnation,observableFactors,config,useStagnation,api}.ts(x)
app/src/features/training/stagnation/{StagnationPage,StagnationCard,PeriodMarker}.tsx
app/src/features/training/{ExerciseProgressPage,TrainingHomePage}.tsx
app/src/copy/es.ts
app/tests/{unit/detectStagnation.test.ts,unit/observableFactors.test.ts,component/StagnationCard.test.tsx,e2e/stagnation.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de entrenamiento y accesibilidad. Revisión de textos: ninguna cadena de esta spec debe contener «causa», «por eso», «debido a» ni lenguaje de orden.

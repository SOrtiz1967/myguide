# Plan de implementación: Gráficos de progreso de entrenamiento

**Rama**: `012-graficos-entrenamiento` | **Fecha**: 2026-11-01 | **Spec**: [spec.md](spec.md)

## Resumen

Dos pantallas nuevas: la evolución de un ejercicio (`/ejercicios/:id/evolucion`, con medidas según el tipo de medición, períodos, comparación y esfuerzo percibido) y el resumen de actividad (`/entrenamiento/resumen`, sesiones realizadas por semana y por mes). Una función de base de datos, `exercise_progress`, entrega las series crudas de las sesiones realizadas de un ejercicio; todo el cálculo (medidas, períodos, comparación, conteos) vive en funciones puras del navegador, así se prueba contra números calculados a mano. El gráfico es un SVG propio que sigue el estilo del peso (spec 020). Sin dependencias nuevas ni cambios de tablas.

## Contexto técnico

- **Base de datos:** `supabase/migrations/20261101000300_exercise_progress.sql`: `public.exercise_progress(exercise_id uuid) returns table(session_id, session_date, exercise_name, measurement_type, effort, sets jsonb)`. `security definer`, sesión vigente, solo sesiones `completed` de la cuenta, orden cronológico, tope de 2.000 sesiones (las más recientes). Una fila por ejercicio de sesión: dos veces el mismo ejercicio en una sesión son dos filas. Las series se devuelven con `jsonb_strip_nulls`, así un dato faltante queda ausente (nunca cero).
- **Resumen de actividad:** sin función nueva; el navegador lee `workout_sessions` (`status = 'completed'`, solo `session_date`) por RLS desde el inicio del período.
- **Lógica pura (`app/src/features/training/progress/`):**
  - `measures.ts`: medidas por tipo, `computeMeasure(measure, sets)` → `{ value, used, excluded }` y formato de valores y unidades.
  - `periods.ts`: períodos (4 semanas, 12 semanas, 6 meses, 1 año, todo), `periodRange`, `previousRange` (mismo largo, inmediatamente anterior), filtro.
  - `series.ts`: puntos por sesión, línea de tendencia solo con 3 o más sesiones con dato, resumen de series excluidas, comparación (promedio por sesión de cada período, diferencia con signo, mínimo 2 sesiones con dato).
  - `activity.ts`: semanas (lunes a domingo) y meses con conteos, ceros incluidos.
- **Aplicación:** `api.ts` (lecturas), `useExerciseProgress.ts`, `useActivity.ts`, `ProgressChart.tsx` (SVG con teclado, lectura y tabla alternativa), `ExerciseProgressPage.tsx` (medida, período, gráfico, comparar), `ComparePanel.tsx`, `ActivitySummaryPage.tsx` y `ActivityBars.tsx`. Enlaces desde `ExerciseHistoryPage` («Ver evolución») y `TrainingHomePage` («Resumen de actividad»). Copy `es.trainingProgress`.
- **Pruebas:** pgTAP (`exercise_progress`), Vitest unitario (cada medida contra valores calculados a mano, períodos, tendencia, comparación, semanas), Vitest de componentes y Playwright (recorrido y accesibilidad).

## Revisión de la Constitution

| Principio                      | Resultado                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| II (integridad e instantáneas) | Se cumple: se usa el nombre y el tipo guardados en cada sesión; renombrar o borrar un ejercicio no cambia ningún punto.    |
| IV (sin juicios)               | Se cumple: sin récords, rachas, metas ni valoraciones; la diferencia es un número con su unidad.                           |
| V (datos, no conclusiones)     | Se cumple: tendencia solo con 3 o más sesiones; comparación solo con 2 o más por período; datos faltantes como «sin dato». |
| VI (accesible)                 | Se cumple: tabla equivalente, teclado, forma además de color, axe a 375 y 1280 px.                                         |

No hay violaciones que justificar.

## Decisiones de diseño

- **Cálculo en el navegador sobre series crudas**, no en SQL: es la única forma de que una prueba independiente (hecha a mano) valide cada número, y evita duplicar reglas de medida en dos lugares.
- **Valor de un período en la comparación = promedio por sesión** de la medida; se muestra la cantidad de sesiones junto al valor. Es simple de explicar y no depende de cuántas sesiones tuvo cada período.
- **Una sesión sin dato utilizable** no es un punto del gráfico: se lista aparte como «sin dato» (no se grafica como cero) y no cuenta para la tendencia.
- **Semanas de lunes a domingo** (igual que el plan semanal) en la zona de la persona: `session_date` ya es un día local.
- **Sin biblioteca de gráficos:** SVG propio, igual que el peso.

## Estructura de archivos

```text
supabase/migrations/20261101000300_exercise_progress.sql
supabase/tests/exercise_progress.test.sql
app/src/features/training/progress/{measures,periods,series,activity}.ts
app/src/features/training/progress/{api,useProgress}.ts
app/src/features/training/progress/{ProgressChart,ComparePanel,ExerciseProgressPage,ActivityBars,ActivitySummaryPage}.tsx
app/src/features/training/{ExerciseHistoryPage,TrainingHomePage}.tsx · app/src/routes/index.tsx · app/src/copy/es.ts
app/tests/unit/{progressMeasures,progressSeries,progressActivity}.test.ts
app/tests/component/TrainingProgress.test.tsx · app/tests/e2e/training-progress.spec.ts
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de la evolución, el resumen y la accesibilidad, una parte por vez.

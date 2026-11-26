# Modelo de datos: Dashboard de progreso integral

## Sin tablas, columnas ni funciones nuevas

El dashboard solo lee. Todo lo que muestra es derivado de datos y cálculos de otras specs.

## Lecturas que consume (por bloque)

| Bloque | Métrica | Fuente |
| --- | --- | --- |
| Entrenamiento | sesiones realizadas, adherencia | `adherence_weeks` (spec 035) |
| Entrenamiento | récords del período | `exercise_records` (spec 032) |
| Entrenamiento | volumen por grupo | `muscle_volume` (spec 031) |
| Entrenamiento | ejercicios con progreso y estancados | `exercise_progress` (spec 012), detección de la spec 033 |
| Nutrición | calorías y proteína promedio | `trends_nutrition` (spec 010) |
| Nutrición | adherencia a macros | objetivo de la spec 027 y totales de la spec 026 |
| Nutrición | distribución por comida | `meal_entries` (spec 003) vía totales por comida de la spec 026 |
| Recuperación | sueño | `daily_activity` (spec 007) |
| Recuperación | energía y fatiga | `session_checks` (spec 034) |
| Evolución | peso, medidas, tendencia | `body_measurements` (spec 008), evolución del peso (spec 020) |
| Evolución | fotos | solo conteo de `progress_photos` (spec 019) |

## Tipos derivados (cliente)

- **DashboardPeriod**: `7 | 30 | 90`, con fechas de inicio y fin en la zona de la persona.
- **BlockResult**: `{ status: 'ok' | 'empty' | 'error' | 'unavailable', metrics: Metric[] }`.
- **Metric**: `{ key, label, value, unit, period, sampleSize, source, incomplete, detailPath }`.
- **Summary**: `{ indicators: Indicator[], reading: string | null }`, con `reading` en `null` si hay datos insuficientes.

## Reglas

- Un dato faltante es «sin datos», nunca 0 ni supuesto.
- Cada métrica lleva unidad, período, cantidad de registros y fuente.
- Períodos incompletos se indican.
- El dashboard no escribe nada; ningún cambio en `export_my_data()`.

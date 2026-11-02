# Plan de implementación: Tendencias, mantenimiento y cruces de datos

**Rama**: `010-tendencias-correlaciones` | **Fecha**: 2026-11-01 | **Spec**: [spec.md](spec.md) | **Investigación**: `research_notes/Análisis de datos de progreso/analisis_datos.md`

## Resumen

Una pantalla nueva, `/tendencias`, con tres secciones. Dos funciones de lectura en la base entregan datos agregados y acotados (nutrición por día y series por semana y grupo muscular); el resto sale de lecturas que ya existen (pesos, sueño, historial del objetivo). Todo el cálculo (promedios semanales, días dentro del rango, proteína por kilo, mantenimiento y su rango, sueño semanal) vive en funciones puras del navegador, así cada número se prueba contra valores calculados a mano. Sin tablas ni columnas nuevas y sin dependencias nuevas. Los gráficos son SVG propio en el estilo del peso (spec 020) y de la evolución de ejercicios (spec 012).

## Contexto técnico

- **Base de datos:** `supabase/migrations/20261101000400_trends.sql` con dos funciones de solo lectura, `security definer`, `stable`, que exigen sesión vigente y filtran por `auth.uid()` (patrón de `exercise_progress`). Contrato en [contracts/trends.md](contracts/trends.md).
  - `trends_nutrition(from_date, to_date)`: una fila por día con al menos una entrada confirmada. Suma por nutriente y cuántas entradas lo informan. Tope: 400 días de rango; así la respuesta no pasa de 400 filas (el servidor corta en 1.000).
  - `trends_training_sets(from_date, to_date)`: una fila por semana (lunes) con un `jsonb` de series por grupo muscular principal. Solo sesiones `completed`. Un ejercicio sin músculo principal o ya sin catálogo cuenta en `sin_grupo`. Tope: 400 días de rango, unas 58 filas.
- **Lecturas que ya existen:** `fetchWeightsBetween` (peso), una lectura nueva de `daily_activity` por rango para el sueño (hoy solo hay `fetchLastSleep`), `useGoalHistory` y `goalOn` (objetivo de cada día).
- **Lógica pura (`app/src/features/trends/`):**
  - `weeks.ts`: semanas de lunes a domingo, marca de semana en curso y rangos por período (4 y 12 semanas, 6 meses, 1 año).
  - `nutrition.ts`: de las filas diarias a las semanas: promedio por nutriente sobre los días que lo informan (con cuántos días), días con registro, días dentro de ±10 % del objetivo de ese día, proteína por kilo con el último peso hasta el fin del período.
  - `maintenance.ts`: ventana de 21 días terminados, requisitos de datos, tendencia del peso, estimación y rango.
  - `sleep.ts`: sueño semanal (promedio de horas por noche y noches con dato).
  - `training.ts`: series por semana de un grupo (o todos) y lista de grupos disponibles.
- **Aplicación:** `api.ts`, `useTrends.ts` (consultas con TanStack Query), `TrendsPage.tsx`, `NutritionSection.tsx`, `MaintenanceSection.tsx`, `TrainingSleepSection.tsx`, `WeekBars.tsx` (barras semanales con teclado y tabla) y `StackedWeeks.tsx` (dos paneles con un eje de semanas común). Ruta `/tendencias`, ítem «Tendencias» en «Más» de `AppShell`, enlace desde el inicio y copy `es.trends`.
- **Pruebas:** pgTAP (`trends`), Vitest unitario de cada módulo puro contra números hechos a mano, Vitest de componentes y Playwright (recorrido y accesibilidad a 375 y 1280 px).

## Decisiones de cálculo

- **Día con registro:** al menos una entrada `confirmed` con `energy_kcal` informado. Las `pending` (spec 009) no cuentan. Un día sin entradas, o solo con entradas sin calorías, es «sin dato».
- **Promedio de un nutriente:** suma por día de lo informado, promediada sobre los días en que ese nutriente tiene al menos una entrada que lo informa; se muestra con la cantidad de esos días. Un día con entradas que no informan el nutriente queda fuera de ese promedio (nunca suma cero).
- **Rango de ±10 %:** un día cuenta si `0,9 × objetivo ≤ kcal del día ≤ 1,1 × objetivo`, con el objetivo que regía ese día (`goalOn`). Sin objetivo ese día, el día no entra al conteo y no se compara. Se informa «n de m días con registro» donde m son los días con registro y objetivo.
- **Proteína por kilo:** promedio de proteína de los días con proteína informada en el período dividido por el último peso con fecha menor o igual al fin del período; se muestra el peso y su fecha. Sin peso, «sin dato».
- **Semanas:** lunes a domingo (igual que el plan semanal y la spec 012). La semana en curso se marca y solo tiene los días ya pasados o de hoy.
- **Mantenimiento:**
  - Ventana: los 21 días terminados, de `hoy − 21` a `hoy − 1`. Hoy no entra porque su registro está incompleto.
  - Requisitos: al menos 14 días con calorías, al menos 4 pesajes en la ventana, al menos uno en los primeros 7 días (`hoy − 21` a `hoy − 15`) y uno en los últimos 7 (`hoy − 7` a `hoy − 1`).
  - Peso de partida: promedio de los pesajes del bloque inicial; de llegada: promedio de los del bloque final. Cada uno se ubica en la fecha promedio de sus pesajes. `días = fecha final − fecha inicial` (siempre mayor o igual a 8).
  - Estimación: `promedio de kcal por día − (peso final − peso inicial) × 7.700 / días`.
  - Rango: la variación diaria de un pesaje (agua, sal, comida en el estómago) se toma de 0,5 kg, una convención declarada y no una medición: en la práctica va de unos cientos de gramos a cerca de 1 kg. La incertidumbre del cambio es `√(0,25 / n_inicial + 0,25 / n_final)` kg y el rango es la estimación `±` esa incertidumbre `× 7.700 / días`, redondeado a la decena de kcal. Se dice en pantalla cómo se arma. No incluye el sesgo por comida sin registrar, que se explica aparte.
  - Faltantes: se listan por separado los días con calorías que faltan, los pesajes que faltan y los extremos sin pesaje.
- **Sueño semanal:** promedio de los minutos de los días con dato de la semana, mostrado en horas y minutos, con noches con dato; semana sin ningún dato, «sin dato».
- **Grupos musculares:** se leen de `exercises.primary_muscles` por el `exercise_id` actual de la sesión. Cada serie cuenta una vez por grupo principal; `full_body` es un grupo más («Cuerpo completo»). Un ejercicio borrado del catálogo o sin músculo cuenta en «Sin grupo». «Todos los grupos» cuenta cada serie una sola vez, no la suma por grupo. Se avisa en pantalla que las semanas pasadas siguen al catálogo actual.
- **Una serie:** cualquier fila de `session_sets` de una sesión realizada (las series vacías no se guardan, spec 006).

## Revisión de la Constitution

| Principio                      | Resultado                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| I (privacidad)                 | Se cumple: funciones filtradas por `auth.uid()` y sesión vigente; sin datos personales en logs.                                                    |
| II (integridad)                | Se cumple: solo lectura; no se modifica nada. Excepción declarada: los grupos musculares siguen al catálogo (asunción de la spec).                  |
| III (estimaciones)             | Se cumple: la estimación de mantenimiento declara método, convención, incertidumbre y sesgos, y se llama «estimación de lo que registraste».       |
| IV (sin juicios)               | Se cumple: sin metas, adherencia, «déficit/superávit», recomendaciones, ni rojo y verde de juicio; el objetivo solo lo cambia la persona.          |
| V (datos, no conclusiones)     | Se cumple: umbrales de datos para el mantenimiento, «sin dato» en vez de cero, sin correlaciones ni causalidad, series separadas con eje común.    |
| VI (accesible)                 | Se cumple: tabla equivalente, teclado, forma además de color, axe a 375 y 1280 px.                                                                 |
| VII (arquitectura)             | Se cumple: lógica pura separada de la presentación y de la lectura; sin dependencias nuevas.                                                       |

No hay violaciones que justificar.

## Decisiones de diseño

- **Agregar en la base solo lo que no cabe en una respuesta:** las comidas de un año son miles de filas (el servidor corta en 1.000) y las series por músculo exigen unir con el catálogo. El resto de los cálculos sigue en el navegador, donde se prueban a mano.
- **Rango en vez de cifra:** una cifra única sugiere una exactitud que no existe. El ancho viene de una fórmula simple y declarada, no de una constante opaca.
- **Dos paneles con un eje común en lugar de un gráfico con dos ejes verticales:** evita sugerir una relación entre escalas distintas (Principio V).
- **Sin comparar con rangos recomendados de volumen:** la bibliografía discrepa y la comparación sería un juicio (Principio IV).

## Estructura de archivos

```text
supabase/migrations/20261101000400_trends.sql
supabase/tests/trends.test.sql
app/src/features/trends/{weeks,nutrition,maintenance,sleep,training}.ts
app/src/features/trends/{api,useTrends}.ts
app/src/features/trends/{TrendsPage,NutritionSection,MaintenanceSection,TrainingSleepSection,WeekBars,StackedWeeks}.tsx
app/src/routes/index.tsx · app/src/components/AppShell.tsx · app/src/components/NavIcon.tsx · app/src/copy/es.ts
app/tests/unit/{trendsWeeks,trendsNutrition,trendsMaintenance,trendsSleep,trendsTraining}.test.ts
app/tests/component/Trends.test.tsx · app/tests/e2e/trends.spec.ts
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de la pantalla y la accesibilidad, una parte por vez.

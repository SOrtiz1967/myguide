# Plan de implementación: Evolución del peso

**Rama**: `020-evolucion-del-peso` | **Fecha**: 2026-10-30 | **Spec**: [spec.md](spec.md)

## Resumen

Un bloque nuevo en «Medidas» dibuja los pesos del período con un gráfico SVG propio y el promedio de 7 días. El cálculo es una función pura en el navegador (período, filtro de ayunas, promedio con mínimo de 3 registros, huecos de más de 7 días, cifras). La única novedad en la base es la marca opcional «en ayunas» del peso, que entra por los mismos `save_measurement` y `update_measurement` con un parámetro nuevo al final. No hay dependencias nuevas.

## Contexto técnico

- Base de datos: `supabase/migrations/20261030000200_weight_fasting.sql`: columna `body_measurements.fasting` (solo peso, restricción de tabla y validación en las funciones), `measurement_json` con la marca y las funciones de guardar y corregir recreadas con el parámetro `fasting` por omisión falso (las llamadas anteriores siguen valiendo).
- Aplicación: `features/measures/weightSeries.ts` (cálculo puro), `WeightChart.tsx` (SVG accesible con cursor, leyenda y tabla alternativa), `WeightEvolution.tsx` (selector de período, filtro de ayunas, cifras, estados), `useFastingFilter.ts` (preferencia del navegador), la casilla en `MeasuresPage.tsx` y la marca en el historial. Consulta con `fetchWeightsBetween` ya existente (se amplía con la columna).
- Pruebas: pgTAP, Vitest (cálculo y componentes), Playwright (recorrido y accesibilidad).

## Revisión de la Constitution

| Principio                           | Resultado                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| I (privacidad)                      | Se cumple: mismos permisos de la spec 008; el peso no se registra en logs ni sale del servidor propio.                              |
| IV (reporte neutral, sin juicio)    | Se cumple: solo cifras descriptivas; sin rojo ni verde, sin metas ni frases de cambio.                                              |
| V (sin conclusiones de pocos datos) | Se cumple: promedio solo con 3 o más registros por ventana; un registro no se presenta como evolución; los huecos no se rellenan.   |
| VI (mobile-first, accesibilidad)    | Se cumple: gráfico responsivo, valores por teclado y en tabla, forma además de color, contraste de marcas verificado en una prueba. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Dónde:** dentro de `/medidas`, sobre el historial, solo con el peso elegido; evita una pantalla y una entrada nueva.
- **Promedio:** ventana de 7 días de calendario que termina en cada día con peso, mínimo 3 registros; línea con cortes cuando el hueco entre puntos con promedio supera 7 días.
- **Eje vertical:** rango de datos con margen del 10 % (mínimo ±0,5 kg), con marcas redondeadas; texto «El eje no empieza en cero».
- **Marcas del gráfico:** puntos en la tinta apagada del sistema, línea del promedio en el acento (`#4f8dff`), ambas con contraste ≥ 3:1 sobre la superficie; distintas por forma (punto y línea). Los puntos llevan un aro del color de la superficie. Un punto mide 4 px de radio (3 px con más de 120 registros).
- **Interacción:** cursor vertical que se ajusta a la fecha con peso más cercana con el puntero y con las flechas del teclado en el gráfico enfocado; el valor se lee en un panel de texto bajo el gráfico (`role="status"`) y en una tabla alternativa plegable.
- **Preferencia de ayunas:** `localStorage` con clave propia, envuelto en `try/catch`.
- **Marca de ayunas:** parámetro nuevo al final de las funciones para no romper las llamadas existentes; la prueba de la spec 008 solo cambia la firma que verifica en un permiso.

## Estructura de archivos

```text
supabase/migrations/20261030000200_weight_fasting.sql
supabase/tests/weight_fasting.test.sql
supabase/tests/body_measurements.test.sql      (firma en un permiso)
app/src/features/measures/{weightSeries.ts,WeightChart.tsx,WeightEvolution.tsx,useFastingFilter.ts}
app/src/features/measures/{api.ts,MeasuresPage.tsx,measures.ts}
app/src/copy/es.ts
app/tests/{unit/weightSeries.test.ts,component/WeightEvolution.test.tsx,e2e/weight-evolution.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo, Playwright del bloque (recorrido, accesibilidad a 375 y 1280 px) y de la spec 008, una parte por vez.

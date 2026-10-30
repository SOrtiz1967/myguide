# Tareas: Evolución del peso

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261030000200_weight_fasting.sql`: columna `fasting` (solo peso), `measurement_json` con la marca y `save_measurement`/`update_measurement` con el parámetro `fasting` al final.
- [x] T002 Prueba pgTAP `supabase/tests/weight_fasting.test.sql` y ajuste de la firma en `supabase/tests/body_measurements.test.sql`.

## Fase 2: Cálculo y datos

- [x] T003 [US1] `app/src/features/measures/weightSeries.ts`: períodos, filtro de ayunas, promedio de 7 días (mínimo 3, sin interpolar, cortes de más de 7 días), cifras (cantidad, último, mínimo y máximo), eje con margen.
- [x] T004 [US1] `app/src/features/measures/api.ts`: la marca `fasting` en `Measurement`, `saveMeasurement` y `updateMeasurement`; `fetchWeightsBetween` con la columna.
- [x] T005 [US1] Copy `measures.evolution` y `measures.fasting` en `app/src/copy/es.ts`, neutral y con tuteo.

## Fase 3: Historias 1, 2 y 4 — Gráfico, pocos datos y cifras

- [x] T006 [US1] `WeightChart.tsx`: SVG responsivo con puntos, línea del promedio con cortes, eje con unidad, leyenda, cursor por puntero y teclado, tabla alternativa.
- [x] T007 [US1][US2][US4] `WeightEvolution.tsx`: selector de período, estados vacío, de un registro, de carga y de error, cifras del período.
- [x] T008 [US1] Integrar el bloque en `MeasuresPage.tsx` con el peso elegido y refrescar el gráfico al guardar, corregir o eliminar.

## Fase 4: Historia 3 — Peso en ayunas

- [x] T009 [US3] Casilla «Lo medí en ayunas» al registrar y corregir el peso, «En ayunas» en el historial y el filtro «Todos los pesos / Solo en ayunas» con preferencia del navegador.

## Fase 5: Pruebas y cierre

- [x] T010 Pruebas unitarias `app/tests/unit/weightSeries.test.ts` (límites de 2 y 3 registros, huecos, ayunas, eje, cifras) y de contraste de las marcas.
- [x] T011 Pruebas de componentes `app/tests/component/WeightEvolution.test.tsx` y ajuste de las de `MeasuresPage`.
- [x] T012 Prueba e2e `app/tests/e2e/weight-evolution.spec.ts` y de accesibilidad a 375 y 1280 px.
- [x] T013 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [x] T014 Playwright de la 020 (3 e2e: recorrido y accesibilidad a 375 y 1280 px) y de las specs 008, 016 y 013 (medidas, onboarding, inicio), una parte por vez; la corrida completa de todas las specs sigue pendiente.
- [x] T015 Actualizar `Documentacion/roadmap-specs.md` y `README.md`.

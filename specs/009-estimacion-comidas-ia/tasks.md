# Tareas: Estimación de comidas con IA

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [contracts/estimate-meal.md](contracts/estimate-meal.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261101000100_ai_estimates.sql`: tabla `ai_estimates` y función `public.add_estimated_entries`.
- [x] T002 Prueba pgTAP `supabase/tests/ai_estimates.test.sql`.

## Fase 2: Servidor

- [x] T003 [US1] `supabase/functions/_shared/estimate.ts` con el esquema y la validación estricta de la respuesta, y su prueba con respuestas válidas e inválidas.
- [x] T004 [US1] `supabase/functions/_shared/gemini.ts` (adaptador con `fetch` inyectable, tiempo de espera de 20 s, cuota agotada) y su prueba con respuestas simuladas.
- [x] T005 [US1] `supabase/functions/estimate-meal/{handler,index}.ts` y su prueba: autenticación, validación, caché por solicitud, límites, errores y registros sin contenido.
- [x] T006 `supabase/config.toml` y `supabase/tests/config.test.ts`: `[functions.estimate-meal] verify_jwt = false`.

## Fase 3: Historias 1, 2 y 4 — Texto, corrección y fallos

- [x] T007 [US1] `app/src/features/meals/ai/{api,estimate,useEstimate}.ts` y copy `es.meals.ai`.
- [x] T008 [US1] `EstimatePanel.tsx`: texto, espera anunciada, cancelar, errores específicos y conservar lo escrito.
- [x] T009 [US2] `EstimateReview.tsx`: ítems editables, quitar, agregar, destino y confirmar con idempotencia.
- [x] T010 [US1] Integrar «Describir con IA» en `AddEntryPage.tsx`; etiqueta «Estimado por IA».

## Fase 4: Historia 3 — Un alimento a mano

- [x] T011 [US3] «Calcular con IA» en `ManualEntryForm.tsx` y guardado como estimado; extender «guardar como alimento propio» a ítems estimados.

## Fase 5: Pruebas

- [x] T012 Pruebas unitarias y de componentes (`app/tests/unit/estimate.test.ts`, `app/tests/component/EstimateMeal.test.tsx`).
- [x] T013 Prueba e2e `app/tests/e2e/estimate-meal.spec.ts` (recorrido, caída de la IA, cálculo en la carga a mano y accesibilidad a 375 y 1280 px) con la respuesta de la función simulada en el navegador. Corrida el 2026-11-06 con la base, `functions serve` y el preview: pasa.
- [x] T014 Correr pgTAP, Deno, lint, formato, typecheck y Vitest completos; leer el resultado.

## Fase 6: Historia 6 — Foto del plato

- [x] T015 [US6] Soporte de foto en `estimate-meal` y en el adaptador, con prueba.
- [x] T016 [US6] «Estimar desde una foto» en la pantalla y prueba.

## Fase 7: Cierre

- [x] T017 Actualizar `Documentacion/roadmap-specs.md`, `README.md`, `supabase/README.md` y `Documentacion/despliegue.md`.

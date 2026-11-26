# Tareas: Recomendaciones personalizadas

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126002000_recommendation_prefs.sql`: tablas `recommendation_preferences` (una fila por persona con `hidden_areas text[]` de lista cerrada) y `recommendation_dismissals` (`rule_key` de 1–80 caracteres, `data_hash`, fecha; único por persona y regla), con `user_id`, RLS de lectura propia y sin escritura directa; funciones `save_recommendation_preferences(hidden_areas, request_id)` y `dismiss_recommendation(rule_key, data_hash, request_id)` (`security definer`, `private.is_session_fresh()`, idempotentes; si ya existe actualiza huella y fecha).
- [ ] T002 Migración `supabase/migrations/20261126002100_recommendation_prefs_privacy.sql`: tablas en `export_my_data()` y borrado en cascada.
- [ ] T003 Prueba pgTAP `supabase/tests/recommendation_prefs.test.sql`: esquema, RLS, áreas fuera de lista, idempotencia, actualización de huella; guardián de RLS en verde.

## Fase 2: Historia 1 — Recomendaciones de la semana (P1)

- [ ] T004 [US1] `app/src/features/recommendations/{types,config,confidence}.ts`: `Recommendation { key, area, headline, origin: {metric, value, comparedTo, period, sampleSize}, confidence, action, dataHash }`; confianza alta con al menos 4 semanas y 10 registros, media con 2 semanas y 6 registros, baja solo si la regla lo permite y con aviso; por debajo del mínimo de cada regla no se genera; cada regla declara si es evidencia (rango citado), convención de práctica o decisión de producto.
- [ ] T005 [US1] Reglas puras en `app/src/features/recommendations/rules/`: `progression.ts` (030), `records.ts` (032), `stagnation.ts` (033), `volume.ts` (031), `recovery.ts` (034 y 007), `adherence.ts` (035); cada una `(ctx) => Recommendation | null`, no se ejecuta si su spec no existe o faltan datos, y descarta toda variación de 1RM estimado o de peso que no supere el ruido de medición (CV del 1RM ~4,2 %; peso ~0,35 % semanal); pruebas `app/tests/unit/rules.*.test.ts` (con datos, sin datos, borde de umbral).
- [ ] T006 [US1] `buildRecommendations.ts` (puro): máximo 5 visibles, ordenadas por confianza y recencia, a lo sumo 2 por área; ante contradicción (subir carga y recuperación baja) se muestra la de mayor confianza y la otra como contexto; sin datos suficientes no se genera ninguna; prueba `app/tests/unit/buildRecommendations.test.ts`.
- [ ] T007 [US1] `useRecommendationContext.ts`, `useRecommendations.ts` y `api.ts` (reúnen lecturas existentes con TanStack Query; sin conexión muestran las últimas calculadas con su fecha); `RecommendationsPage.tsx` (ruta `/recomendaciones`), `RecommendationCard.tsx` con dato de origen, período, confianza y acción, y una tarjeta resumida en `HomePage.tsx`; copy neutral en `app/src/copy/es.ts`.
- [ ] T008 [US1] Si la spec 034 detecta una señal persistente, mostrar su nota neutral con sugerencia de apoyo profesional sin convertirla en recomendación de entrenamiento.

## Fase 3: Historia 2 — Nutrición sin presión (P1)

- [ ] T009 [US2] `rules/nutrition.ts`: proteína promedio por debajo del rango objetivo (027) con su incertidumbre, y registro incompleto de comidas durante varios días (neutral, sin juicio); nunca ayuno, compensación ni recorte tras un exceso (Principio IV); distinguir estimado de confirmado; lenguaje en rangos, confirmación de la persona y opción de ocultar calorías; prueba en `rules.nutrition.test.ts`.

## Fase 4: Historia 3 — Controlar qué recomendaciones recibo (P2)

- [ ] T010 [US3] `AreaFilters.tsx`: ocultar áreas (entrenamiento, volumen, recuperación, nutrición) con aviso de que están ocultas y reactivación; ignorar una recomendación con `dismiss_recommendation` (no reaparece mientras su `dataHash` no cambie de forma relevante: más que un umbral en la métrica o 2 semanas más de datos).

## Fase 5: Pruebas y cierre

- [ ] T011 Prueba de componentes `app/tests/component/RecommendationCard.test.tsx` y revisión de textos (sin lenguaje de orden, culpa, compensación ni causalidad).
- [ ] T012 Prueba e2e `app/tests/e2e/recommendations.spec.ts` (ver, ignorar, ocultar área, sin datos, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T013 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T014 Playwright de recomendaciones y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

# Tareas: Dashboard de progreso integral

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio. Sin migraciones: solo lee lo que producen las specs previas.

## Fase 1: Base

- [ ] T001 `app/src/features/dashboard/period.ts` y `config.ts`: períodos de 7, 30 y 90 días terminando hoy en la zona de la persona, período en la URL (`?periodo=30`) y umbral documentado de «peso estable» (±0,5 % sobre el promedio móvil de 7 días de la spec 020, con un mínimo de pesajes en la ventana; criterio de producto, ver `research.md`).
- [ ] T002 `app/src/features/dashboard/useDashboardData.ts`: lecturas en paralelo con un solo `useQueries` (`trends_nutrition`, `trends_training_sets`, `muscle_volume`, `adherence_weeks`, `exercise_records`, `session_checks`, mediciones y actividad) que tolera fallos por bloque, con reintento por bloque.

## Fase 2: Historia 1 — Ver cómo voy en 7, 30 o 90 días (P1)

- [ ] T003 [US1] Bloques puros en `app/src/features/dashboard/blocks/`: `trainingBlock.ts` (sesiones, adherencia, series, récords, estancamientos), `nutritionBlock.ts` (calorías, proteína, macros con su rango e incertidumbre y la distinción estimado/confirmado), `recoveryBlock.ts` (sueño, pasos, recuperación declarada) y `evolutionBlock.ts` (peso con promedio de 7 días, medidas y cantidad de fotos como enlace sin mostrarlas ni interpretarlas); cada uno llama a la misma función pura que su pantalla de detalle, sin duplicar lógica; cada métrica con unidad, período, cantidad de registros, fuente (manual o integración) y períodos incompletos indicados; un bloque se omite si su spec de origen no existe; prueba `app/tests/unit/blocks.*.test.ts` con y sin datos.
- [ ] T004 [US1] `DashboardPage.tsx` (ruta `/progreso` en `app/src/routes/index.tsx`), `PeriodSelector.tsx`, `BlockCard.tsx` y `MetricRow.tsx`; gráficos con tabla alternativa, 360 px y teclado; datos faltantes como «sin datos» con acceso a registrarlos, nunca inventados; enlace desde el menú (`AppShell.tsx`) y desde «Hoy»; la persona puede ocultar peso y calorías.

## Fase 3: Historia 2 — Resumen sin afirmaciones causales (P1)

- [ ] T005 [US2] `summary.ts`: resumen con plantillas («Peso: estable. Entrenamiento: 12/13 sesiones…») y lectura prudente solo con datos suficientes en al menos dos bloques; lenguaje descriptivo («mientras», «al mismo tiempo»), nunca «porque», «gracias a» ni «debido a»; sin tendencias con una sola medición de peso, foto o sesión; prueba `app/tests/unit/summary.test.ts` y copy en `app/src/copy/es.ts`.

## Fase 4: Historia 3 — Navegar al detalle (P2)

- [ ] T006 [US3] Cada métrica enlaza a su pantalla de detalle conservando el período y se puede volver con el mismo período; prueba de coherencia: cada indicador coincide con su detalle.

## Fase 5: Pruebas y cierre

- [ ] T007 Prueba de componentes `app/tests/component/DashboardPage.test.tsx` (con y sin módulos, error por bloque).
- [ ] T008 Prueba e2e `app/tests/e2e/dashboard.spec.ts` (cambio de período, navegación al detalle, aislamiento) y accesibilidad a 375 y 1280 px; el dashboard de 30 días se muestra en menos de 3 segundos con un año de datos.
- [ ] T009 Correr lint, formato, typecheck y Vitest completos; leer el resultado; revisión de textos sin lenguaje causal.
- [ ] T010 Playwright del dashboard y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

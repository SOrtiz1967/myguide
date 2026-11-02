# Tareas: Tendencias, mantenimiento y cruces de datos

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [contracts/trends.md](contracts/trends.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261101000400_trends.sql`: `public.trends_nutrition` y `public.trends_training_sets` según el contrato.
- [ ] T002 Prueba pgTAP `supabase/tests/trends.test.sql` (suma y conteos por día, `pending` fuera, semana de lunes, músculos y `sin_grupo`, ejercicio borrado del catálogo, rango inválido, sesión vencida, aislamiento entre cuentas).

## Fase 2: Lógica pura

- [ ] T003 [US1] `app/src/features/trends/weeks.ts` y su prueba `app/tests/unit/trendsWeeks.test.ts`.
- [ ] T004 [US1] `app/src/features/trends/nutrition.ts` (promedios semanales, días dentro de ±10 % con el objetivo de cada día, proteína por kilo) y `app/tests/unit/trendsNutrition.test.ts` con valores hechos a mano.
- [ ] T005 [US2] `app/src/features/trends/maintenance.ts` (ventana, requisitos, tendencia, estimación y rango) y `app/tests/unit/trendsMaintenance.test.ts` con un caso calculado a mano y los casos de datos insuficientes.
- [ ] T006 [US3] `app/src/features/trends/sleep.ts` y `training.ts` con `app/tests/unit/trendsSleep.test.ts` y `trendsTraining.test.ts`.

## Fase 3: Aplicación

- [ ] T007 `app/src/features/trends/api.ts`, lectura de sueño por rango, `useTrends.ts` y copy `es.trends`.
- [ ] T008 [US1] `WeekBars.tsx` y `NutritionSection.tsx`.
- [ ] T009 [US2] `MaintenanceSection.tsx` (rango, ventana, método, sesgos y faltantes).
- [ ] T010 [US3] `StackedWeeks.tsx` y `TrainingSleepSection.tsx`.
- [ ] T011 `TrendsPage.tsx`, ruta `/tendencias`, ítem «Tendencias» en «Más» de `AppShell.tsx`, ícono en `NavIcon.tsx` y enlace desde el inicio.

## Fase 4: Pruebas y cierre

- [ ] T012 Pruebas de componentes `app/tests/component/Trends.test.tsx` (incluye que ningún texto contiene lenguaje de juicio, correlación ni causalidad).
- [ ] T013 Prueba e2e `app/tests/e2e/trends.spec.ts` (recorrido y accesibilidad a 375 y 1280 px).
- [ ] T014 Actualizar `Documentacion/roadmap-specs.md`, `README.md`, `supabase/README.md` y `Documentacion/fuentes-datos.md` si aplica.
- [ ] T015 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.

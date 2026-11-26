# Tareas: Plan alimentario

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126000600_meal_plans.sql`: tablas `meal_plans` (un plan por persona y día, `day_type`, instantánea) y `meal_plan_items` (nombre y valores nutricionales del momento), con `user_id`, RLS de lectura propia y sin escritura directa; funciones `save_meal_plan(plan_date, day_type, meals jsonb, request_id)` (1–8 comidas, 1–12 alimentos por comida, cantidades 1–5000 g/ml, valores no negativos, tipo de día en la lista; reemplaza el plan del día de forma atómica; idempotente; `private.is_session_fresh()`) y `delete_meal_plan(plan_date)`. Error `invalid_meal_plan:<motivo>:<campo>`.
- [ ] T002 Migración `supabase/migrations/20261126000700_meal_plans_privacy.sql`: tablas en `export_my_data()` y borrado en cascada.
- [ ] T003 Prueba pgTAP `supabase/tests/meal_plans.test.sql`: esquema, RLS, rangos, reemplazo atómico, idempotencia, instantánea y borrado; guardián de RLS en verde.

## Fase 2: Historia 1 — Propuesta de comidas para el día (P1)

- [ ] T004 [US1] `app/src/features/meal-plan/dayType.ts`: tipo de día derivado del plan semanal (spec 018): sin rutina → descanso, con rutina → entrenamiento, cambiable por la persona; regla única y visible.
- [ ] T005 [US1] `mealShares.ts` y `generatePlan.ts`: generador puro y determinista, sin IA; reparto por comida (3: 30/40/30; 4: 25/35/10/30, ajustable); candidatos propios, recientes y disponibles, excluyendo los evitados del perfil de atleta (spec 025); sistema lineal pequeño por macro dominante con redondeo a 5 g o porciones; tolerancia ±10 % en energía y ±15 % por macro y, si no se alcanza, mostrar la desviación y su motivo.
- [ ] T006 [US1] Variación por tipo de día: el objetivo de energía es el promedio semanal; el ajuste de +5 % en días de entrenamiento queda **desactivado por defecto**, es opcional y se etiqueta como opción de planificación sin respaldo científico directo (FR-013 y `research.md`); proteína y grasas no cambian, la diferencia sale de carbohidratos con su motivo visible; el plan de un día nunca depende del día anterior.
- [ ] T007 [US1] Prueba `app/tests/unit/generatePlan.test.ts` con casos calculados a mano: totales dentro del rango (100 % con alimentos suficientes), ningún alimento excluido, promedio semanal igual al objetivo, orientación de proteína por comida solo como guía.
- [ ] T008 [US1] `PlanPreferences.tsx` y `MealPlanPage.tsx` (cantidad de comidas, horarios, horario de entrenamiento, alimentos disponibles y excluidos, presupuesto como orden de preferencia, no costo) con copy neutral en `app/src/copy/es.ts`; borrador local en el dispositivo; propuesta en menos de 2 minutos.

## Fase 3: Historia 2 — Editar, sustituir y confirmar (P1)

- [ ] T009 [US2] `substitutes.ts` (`suggestSubstitutes()`: mismo macro dominante y perfil similar, recalcula el resto) y `SubstitutePicker.tsx`; `PlanMealCard.tsx` con edición de cantidades y recálculo inmediato sin recargar.
- [ ] T010 [US2] `api.ts` y `useMealPlan.ts`: confirmar con `save_meal_plan` y `client_request_id`, no mostrar como hecho hasta la confirmación; planificado y consumido separados (el registro de comidas de la spec 003 nunca se lee ni se escribe desde el plan); sin lenguaje de compensación ni de culpa; si falla la IA o el servicio, armar a mano.

## Fase 4: Historia 3 — Plan semanal y lista de compras (P3)

- [ ] T011 [US3] `shoppingList.ts` (función pura sobre planes confirmados de un rango, suma por `food_id` o nombre de instantánea, redondeo hacia arriba, sin guardarse) con prueba `app/tests/unit/shoppingList.test.ts`; `ShoppingListPage.tsx`.
- [ ] T012 [US3] Acceso desde el día de comidas y desde el plan semanal de entrenamiento (spec 018) y vista semanal del plan.

## Fase 5: Pruebas y cierre

- [ ] T013 Prueba de componentes `app/tests/component/MealPlanPage.test.tsx`.
- [ ] T014 Prueba e2e `app/tests/e2e/meal-plan.spec.ts` (generar, editar, sustituir, confirmar, lista, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T015 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado; revisar a mano que ningún texto sugiere compensar.
- [ ] T016 Playwright del plan y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

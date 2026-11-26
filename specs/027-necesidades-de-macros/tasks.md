# Tareas: Necesidades de macros

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126000400_macro_goals.sql`: tabla `macro_goals` (historial inmutable con `user_id`, rangos mínimo y máximo de proteína, grasas y carbohidratos, `method`, `inputs jsonb`, `client_request_id`, RLS de lectura propia, sin escritura directa) y función `set_macro_goal` (`security definer`, `private.is_session_fresh()`, idempotente; mínimo ≤ máximo; proteína 30–400 g, grasas 20–250 g, carbohidratos 0–900 g; todo nulo quita el objetivo). Error `invalid_macro_goal:<motivo>:<campo>`. No tocar `energy_goals`.
- [ ] T002 Migración `supabase/migrations/20261126000500_macro_goals_privacy.sql`: `macro_goals` en `export_my_data()` y borrado en cascada.
- [ ] T003 Prueba pgTAP `supabase/tests/macro_goals.test.sql`: esquema, RLS, rangos, idempotencia, historial y quitar objetivo; guardián de RLS en verde.

## Fase 2: Historia 1 — Propuesta de calorías y macros (P1)

- [ ] T004 [US1] `app/src/features/plan/macros.ts`: `macroTargets()` puro y determinista, sin IA; proteína 1,6–2,2 g/kg (ganar músculo) o 1,8–2,4 g/kg (perder grasa y recomposición), con 1,4–2,0 g/kg como rango base verificado y más de 2,2 g/kg solo como opción (ver `research.md`); grasas 0,6–1,0 g/kg con piso del 20 % y tope del 35 % de la energía; carbohidratos como el resto en los extremos del rango; suma de 4/9/4 kcal/g dentro del rango de energía, y si no hay solución se prioriza la energía y se informa.
- [ ] T005 [US1] Ampliar `app/src/features/plan/calorie.ts` con `proteinRangeG`, `fatRangeG` y `carbsRangeG` en `PlanResult` sin cambiar la energía de la spec 015; pruebas `app/tests/unit/macros.test.ts` con al menos cinco perfiles calculados a mano (incluidos IMC bajo y perder grasa).
- [ ] T006 [US1] `app/src/features/goals/{macroGoal,useMacroGoal,api}.ts`: leer el objetivo vigente y llamar a `set_macro_goal` con `client_request_id`; el resumen diario (spec 004) y el día de comidas (spec 026) leen el hook.
- [ ] T007 [US1] Copy en `app/src/copy/es.ts` y `MacroProposal.tsx` en `PlanPage.tsx`: método, supuestos, fecha, rango y datos usados (Principio V); sin «deberías»; confirmación explícita antes de guardar.

## Fase 3: Historia 3 — Avisos de seguridad (P1)

- [ ] T008 [US3] Aplicar pisos y excepción por IMC de la spec 015 y límite de 18 años en `macros.ts` y en `MacroProposal.tsx`, con nota informativa neutral; prueba de perfiles extremos en `macros.test.ts`.

## Fase 4: Historia 2 — Revisar con datos reales (P2)

- [ ] T009 [US2] `app/src/features/plan/reviewGoal.ts`: `reviewGoal(inputs)` puro; mínimo 6 semanas, 8 pesajes y 70 % de días con comida; promedio móvil de 7 días con banda de ±0,5 % para «peso estable»; devuelve «sin información suficiente», «coherente» o «sugerir revisar» con su evidencia; prueba `app/tests/unit/reviewGoal.test.ts`.
- [ ] T010 [US2] `GoalReview.tsx` y `useGoalReview.ts` (reutilizan `trends_nutrition` y el mantenimiento estimado de la spec 010); solo ofrece abrir la propuesta con valores nuevos, sin cambiar nada sin confirmación.

## Fase 5: Pruebas y cierre

- [ ] T011 Prueba de componentes `app/tests/component/MacroProposal.test.tsx`.
- [ ] T012 Prueba e2e `app/tests/e2e/macro-goal.spec.ts` (propuesta, confirmación, historial, revisión, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T013 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T014 Playwright de plan y objetivo; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

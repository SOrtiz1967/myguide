# Tareas: Macros por comida

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [ ] T001 Migración `supabase/migrations/20261126000300_meal_estimate_original.sql`: columna `meal_entries.original_estimate jsonb` (nula salvo en comidas estimadas; objeto con las mismas claves de valores y tope de 4 KB) y ajuste de `add_estimated_entries(entries jsonb, request_id uuid)` (spec 009) para aceptar y guardar la clave `original` por ítem. Hereda la RLS de `meal_entries`; sin tablas nuevas.
- [ ] T002 Prueba pgTAP `supabase/tests/meal_estimate_original.test.sql`: columna, validación del objeto, tope de tamaño, idempotencia y aislamiento; guardián de RLS en verde.

## Fase 2: Historia 1 — Macros de cada comida (P1)

- [ ] T003 [US1] Ampliar `app/src/features/meals/mealTotals.ts` (puro, determinista): total por comida y por día con la regla «sin dato ≠ 0», marca «parcial» con la cuenta de ítems que aportan («3 de 4») y «sin dato» cuando ninguno aporta; calorías enteras y macros con un decimal en pantalla; prueba `app/tests/unit/mealTotals.test.ts`.
- [ ] T004 [US1] `macroLabels.ts` y copy `meals` en `app/src/copy/es.ts`: origen del valor (`catalog` → «de fuente», `own` → «propio», `manual` → «escrito por vos», `estimated` → «estimado»); confirmar una estimación no la convierte en dato de fuente.
- [ ] T005 [US1] `MealSection.tsx`: tabla accesible por comida (encabezados, 360 px sin desplazamiento horizontal) con calorías, proteínas, carbohidratos, grasas y, solo si hay dato, azúcares, fibra y sodio; la suma por comida coincide con el total del día.

## Fase 3: Historia 2 — Progreso diario de macros (P1)

- [ ] T006 [US2] `app/src/features/goals/useMacroGoal.ts`: devuelve `null` hasta que exista la spec 027 y luego el objetivo vigente.
- [ ] T007 [US2] `MacroProgress.tsx` en `DayPage.tsx`: «92 / 140 g» con objetivo (valor o rango); sin objetivo solo lo consumido y un enlace a definirlo; superar el objetivo se informa sin juicio ni compensación (Principio IV); la proteína por comida solo como guía suave si existe (0,25–0,4 g/kg).

## Fase 4: Historia 3 — Comidas estimadas con IA (P2)

- [ ] T008 [US3] Guardar `original_estimate` al confirmar una estimación y recalcular proporcionalmente respecto de ella al editar una cantidad, sin llamar a la IA; permitir volver a la estimación original; el ítem conserva la marca «estimado».

## Fase 5: Pruebas y cierre

- [ ] T009 Pruebas de componentes `app/tests/component/MealSection.test.tsx` y `MacroProgress.test.tsx`.
- [ ] T010 Prueba e2e `app/tests/e2e/meal-macros.spec.ts` (día completo, sin dato ≠ 0, estimado, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T011 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T012 Playwright de comidas y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

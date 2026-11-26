# Plan de implementación: Estimación de necesidades de macros según objetivo

**Rama**: `027-necesidades-de-macros` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

La spec 015 ya calcula en el cliente (función pura en `app/src/features/plan/calorie.ts`) el metabolismo en reposo con Mifflin-St Jeor, el mantenimiento, el objetivo con su rango y la proteína sugerida, y la spec 004 guarda el objetivo en `energy_goals` con `set_energy_goal`. Esta spec **extiende ese cálculo** para devolver rangos de proteína, grasas y carbohidratos, y agrega una tabla de historial de objetivos de macros con la misma forma que `energy_goals`. La revisión con datos reales compara el objetivo contra la tendencia de peso y el consumo registrado, reutilizando las lecturas de la spec 010 (`trends_nutrition`, mantenimiento estimado).

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126000400_macro_goals.sql` con la tabla `macro_goals` (historial inmutable) y la función `set_macro_goal`. No se toca `energy_goals`: la energía sigue guardándose con `set_energy_goal` y el objetivo de macros referencia su valor al confirmarse.
- **Aplicación**: ampliar `calorie.ts` con `macroTargets()` (puro y determinista, sin IA) y agregar `app/src/features/plan/{MacroProposal,GoalReview,useGoalReview,macroGoal}.ts(x)`. El resumen diario (spec 004) y el día de comidas (spec 026) leen el objetivo vigente con un hook.
- **Pruebas**: Vitest con casos calculados a mano para `macroTargets` y la regla de revisión (incluidos pisos y datos insuficientes), pgTAP para la tabla y la función, Playwright para propuesta, confirmación y revisión.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: tabla con `user_id`, RLS con lectura propia y escritura solo por función con sesión fresca; entra en exportación y eliminación (spec 011). |
| II | Se cumple: historial por filas, cada cambio agrega una fila; los días pasados conservan el objetivo que regía. |
| III | Se cumple: las cifras son estimaciones con rango, método y entradas visibles. |
| IV | Se cumple: sin déficits agresivos, pisos de la spec 015, textos neutrales, sin ajuste automático; todo cambio exige confirmación. |
| V | Se cumple: método documentado y revisable; con pocos datos se dice «sin información suficiente» en lugar de mostrar un número. |
| VI | Se cumple: tarjetas con encabezados, 360 px, accesible por teclado. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Un solo cálculo, ampliado.** `calorie.ts` conserva su interfaz y agrega a `PlanResult` los campos `proteinRangeG`, `fatRangeG` y `carbsRangeG`. La energía no cambia (spec 015), así no se rompen los objetivos ya confirmados ni las pruebas existentes.
- **Rangos de macros.** Proteína: se mantiene el rango de la 015 (1,6–2,2 g/kg para ganar músculo; 1,8–2,4 g/kg para perder grasa y recomposición). Grasas: entre 0,6 y 1,0 g/kg, con piso del 20 % de la energía y tope del 35 % (rango de referencia de ingesta para adultos). Carbohidratos: el resto de la energía una vez descontadas proteína y grasas, calculado en los extremos del rango para dar un rango. Las fuentes y el detalle se documentan en `research.md`.
- **Coherencia.** El rango de carbohidratos se calcula para que la suma de calorías de proteína (4 kcal/g), grasas (9 kcal/g) y carbohidratos (4 kcal/g) quede dentro del rango de energía; si no hay solución con los límites de cada macro, se prioriza la energía y se informa.
- **Persistencia.** `macro_goals` guarda el rango confirmado (mínimos y máximos), el método y las entradas usadas en `inputs jsonb`. Cada confirmación es una fila nueva; quitar el objetivo guarda una fila con valores nulos, igual que `energy_goals`.
- **Revisión con datos reales.** Función pura `reviewGoal(inputs)` en el cliente: requiere al menos 6 semanas de datos, al menos 8 pesajes en ese período y al menos el 70 % de los días con comida registrada; compara la tendencia de peso (promedio de 7 días) con la esperada por el objetivo y devuelve «sin información suficiente», «coherente» o «sugerir revisar», con la evidencia. No reacciona a uno o dos pesajes.
- **Confirmación obligatoria.** Nada cambia sin que la persona confirme; la revisión solo ofrece abrir la propuesta con valores nuevos.
- **Seguridad.** Se aplican los pisos y la excepción por IMC de la spec 015 y el límite de edad (18 años); el servidor valida rangos coherentes en `set_macro_goal`.

## Contratos (funciones de base)

- `set_macro_goal(protein_min_g int, protein_max_g int, fat_min_g int, fat_max_g int, carbs_min_g int, carbs_max_g int, method text, inputs jsonb, request_id uuid) returns table (effective_from date, ...)`: fija el día con el «hoy» de la persona, valida que cada mínimo sea menor o igual que su máximo y rangos razonables (proteína 30–400 g, grasas 20–250 g, carbohidratos 0–900 g). Error `invalid_macro_goal:<motivo>:<campo>`.
- Pasar todos los valores en nulo quita el objetivo de macros.

## Estructura de archivos

```text
supabase/migrations/20261126000400_macro_goals.sql
supabase/migrations/20261126000500_macro_goals_privacy.sql   # export_my_data()
supabase/tests/macro_goals.test.sql
app/src/features/plan/{calorie,macros,reviewGoal}.ts
app/src/features/plan/{MacroProposal,GoalReview,PlanPage,useGoalReview}.tsx
app/src/features/goals/{macroGoal,useMacroGoal,api}.ts
app/src/copy/es.ts
app/tests/{unit/macros.test.ts,unit/reviewGoal.test.ts,component/MacroProposal.test.tsx,e2e/macro-goal.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de plan y objetivo. Comparar a mano al menos cinco perfiles (incluidos IMC bajo y objetivo de perder grasa) contra los valores de las pruebas.

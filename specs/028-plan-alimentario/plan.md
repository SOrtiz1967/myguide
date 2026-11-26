# Plan de implementación: Plan alimentario por día y actividad

**Rama**: `028-plan-alimentario` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

La propuesta de comidas se genera en el cliente con un algoritmo **determinista** (sin IA): reparte el objetivo de macros del día (spec 027) entre las comidas según el tipo de día, elige para cada comida alimentos candidatos del catálogo y resuelve las cantidades para acercarse a los macros de esa comida. El borrador vive en el dispositivo (borrador local, como el recorrido de la spec 014) y recién al confirmarlo se guarda en el servidor como un plan con **instantánea** de nombres y valores. La lista de compras se deriva de los planes confirmados. Planificado y consumido son tablas distintas: el registro de comidas (spec 003) nunca se lee ni se escribe desde el plan.

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126000600_meal_plans.sql` con `meal_plans` (un plan por persona y día) y `meal_plan_items` (alimentos de cada comida), y las funciones `save_meal_plan` y `delete_meal_plan`. Sin servicios nuevos.
- **Aplicación**: nueva carpeta `app/src/features/meal-plan/` con el generador puro `generatePlan()`, el sustituidor `suggestSubstitutes()`, la lista `shoppingList()`, las pantallas del plan del día y la lista, y un acceso desde el día de comidas y desde el plan semanal de entrenamiento (spec 018).
- **IA**: opcional y fuera del camino crítico. El generador funciona sin ella; la IA, si se habilita más adelante, solo podría proponer combinaciones de alimentos que el sistema valida y recalcula. No se implementa en esta spec.
- **Pruebas**: Vitest con casos calculados a mano (totales dentro del rango, exclusiones, sustitución, lista de compras), pgTAP para tablas y funciones, Playwright para generar, editar, confirmar y listar.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: tablas con `user_id`, RLS con lectura propia, escritura por funciones con sesión fresca; entran en exportación y eliminación. Ningún dato sale a servicios externos. |
| II | Se cumple: el plan guarda instantánea de nombres y valores; lo registrado (spec 003) prevalece y nunca se modifica desde el plan. |
| III | Se cumple: calorías y macros calculados desde los valores del catálogo con cantidades explícitas; los totales se muestran con su rango de objetivo. |
| IV | Se cumple: el plan se presenta como propuesta editable; sin dieta médica, sin compensaciones ni «día de castigo»; el semanal promedia el objetivo en lugar de recortar tras un exceso. |
| V | Se cumple: los tipos de día se derivan del plan de entrenamiento y la persona los puede cambiar. |
| VI | Se cumple: pantallas accesibles, 360 px, edición sin arrastrar. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Tipo de día.** Se deriva del plan semanal (spec 018): sin rutina → descanso; con rutina → entrenamiento; la persona puede marcar «entrenamiento intenso» o «alta/baja actividad». La regla es única y se muestra.
- **Variación entre tipos de día sin compensar.** El objetivo de energía vigente se interpreta como el **promedio semanal**. El día de entrenamiento suma una fracción fija (+5 %) y el de descanso resta la fracción necesaria para que el promedio de la semana siga siendo el objetivo. Las diferencias salen de carbohidratos; proteína y grasas se mantienen. Cada día muestra el motivo («día de entrenamiento: más carbohidratos alrededor del entrenamiento»). El plan de un día nunca depende de lo que se comió el día anterior (FR-008).
- **Reparto por comida.** Porcentajes predeterminados por cantidad de comidas (por ejemplo 3: 30/40/30; 4: 25/35/10/30), con las comidas de entrenamiento (pre y post) concentrando más carbohidratos. La persona puede ajustar los porcentajes.
- **Candidatos.** Alimentos propios, alimentos usados recientemente (`recent_meal_items`) y alimentos «disponibles» elegidos por la persona; se excluyen los evitados del perfil de atleta (spec 025). Cada alimento se clasifica por su macro dominante (proteína, carbohidrato, grasa) a partir de sus valores `per100`.
- **Resolución de cantidades.** Para cada comida se elige una fuente por macro dominante y se resuelve un sistema lineal pequeño para acercarse a los macros objetivo de esa comida; las cantidades se redondean a pasos prácticos (5 g; porciones del alimento si las hay). Si el catálogo no permite cubrir un macro dentro de ±10 %, se informa la limitación en lugar de forzar valores.
- **Sustituciones.** Equivalentes = alimentos con el mismo macro dominante y perfil similar (diferencia por 100 g menor a un umbral); al sustituir se mantiene el aporte del macro dominante y se recalcula el resto.
- **Borrador local, plan confirmado en servidor.** `save_meal_plan` es idempotente por `request_id`, guarda el plan completo con instantáneas y reemplaza el plan confirmado del mismo día.
- **Lista de compras.** Función pura sobre planes confirmados de un rango de fechas: suma cantidades por alimento (por `food_id` o nombre de instantánea), redondea hacia arriba a pasos prácticos y se recalcula al cambiar los planes. No se guarda.
- **Presupuesto.** Solo una preferencia declarada (sin precios en el catálogo): se usa para ordenar candidatos por orden de preferencia de la persona, no por costo. Se aclara en pantalla.

## Contratos (funciones de base)

- `save_meal_plan(plan_date date, day_type text, meals jsonb, request_id uuid) returns uuid`: valida 1 a 8 comidas, 1 a 12 alimentos por comida, cantidades 1 a 5000 g/ml, valores no negativos, tipo de día en la lista. Reemplaza el plan confirmado del día de forma atómica. Error `invalid_meal_plan:<motivo>:<campo>`.
- `delete_meal_plan(plan_date date) returns void`.

## Estructura de archivos

```text
supabase/migrations/20261126000600_meal_plans.sql
supabase/migrations/20261126000700_meal_plans_privacy.sql
supabase/tests/meal_plans.test.sql
app/src/features/meal-plan/{generatePlan,dayType,substitutes,shoppingList,mealShares}.ts
app/src/features/meal-plan/{MealPlanPage,PlanPreferences,PlanMealCard,SubstitutePicker,ShoppingListPage,api,useMealPlan}.ts(x)
app/src/copy/es.ts
app/tests/{unit/generatePlan.test.ts,unit/shoppingList.test.ts,component/MealPlanPage.test.tsx,e2e/meal-plan.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright del plan y accesibilidad. Revisar a mano que el promedio semanal de energía coincide con el objetivo y que ningún texto sugiere compensar.

# Plan de implementación: Macros por comida

**Rama**: `026-macros-por-comida` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

Cada registro de comida (`meal_entries`, spec 003) ya guarda calorías, proteínas, carbohidratos, grasas, azúcares, fibra y sodio calculados para su cantidad, con instantánea del alimento y `null` cuando falta el dato. Por eso esta spec es sobre todo de **presentación y totales**: agrupar por comida del día, sumar con la regla «sin dato ≠ 0», mostrar el progreso contra un objetivo de macros si existe (spec 027) y marcar el origen de cada valor. El único cambio de datos es conservar la estimación original de la IA para poder volver a ella tras editar cantidades (FR-006).

## Contexto técnico

- **Base de datos**: una migración chica `supabase/migrations/20261126000300_meal_estimate_original.sql` que agrega `meal_entries.original_estimate jsonb` (la estimación de la IA tal como se confirmó; nula en el resto). Sin tablas nuevas. La suma por comida y por día se hace en el cliente con una función pura (como `mealTotals.ts`), sin funciones nuevas en la base.
- **Aplicación**: ampliar `app/src/features/meals/mealTotals.ts` y `MealSection.tsx`, y un componente `MacroProgress` para el día. El objetivo de macros se lee con un hook que devuelve `null` mientras la spec 027 no exista.
- **Pruebas**: Vitest para totales (sin dato, parciales, origen), Vitest de componentes para `MealSection` y `MacroProgress`, pgTAP para la columna nueva y Playwright para el día completo y accesibilidad.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: sin tablas nuevas; la columna nueva hereda la RLS de `meal_entries`. |
| II (historial) | Se cumple: los valores se muestran de la instantánea ya guardada; editar un alimento del catálogo no cambia lo registrado. |
| III (estimaciones transparentes) | Se cumple: cada valor muestra su origen (estimado, de fuente o confirmado); la estimación original se conserva; los macros se recalculan de forma determinista y la IA no calcula totales (FR-007). |
| IV | Se cumple: superar un objetivo se informa sin juicio ni sugerencias de compensar. |
| VI | Se cumple: tabla accesible con encabezados, 360 px sin desplazamiento horizontal. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Suma con «sin dato».** Un total por macro es la suma de los valores presentes y lleva una marca «parcial» con la cuenta de ítems que aportan el dato (por ejemplo «3 de 4»). Si ningún ítem aporta el dato, el total es «sin dato», nunca 0.
- **Origen del valor.** El campo `origin` (`catalog`, `own`, `manual`, `estimated`) y `status` ya existen. Se muestran como: `catalog` → «de fuente», `own` → «propio», `manual` → «escrito por vos», `estimated` → «estimado». Una comida estimada y confirmada conserva la marca de estimada; confirmar no la convierte en dato de fuente (Principio III).
- **Recalcular al editar una cantidad.** Los alimentos de catálogo y propios ya recalculan con `per100_*` y la cantidad. Los ítems estimados recalculan proporcionalmente respecto de `original_estimate` (cantidad original → valores originales) sin llamar a la IA.
- **Precisión.** Calorías enteras, macros con un decimal como máximo en pantalla (el dato guardado conserva su precisión).
- **Progreso diario.** `MacroProgress` recibe consumido y objetivo (valor o rango) y muestra «92 / 140 g». Sin objetivo muestra solo lo consumido y un enlace a definirlo.
- **Fibra y sodio.** Se muestran solo cuando algún ítem tiene el dato; si es parcial, con la marca.

## Contratos

Sin funciones nuevas. `add_estimated_entries(entries jsonb, request_id uuid)` (spec 009) pasa a guardar `original_estimate` por ítem (cada elemento de `entries` acepta la clave `original`, validada como objeto con las mismas claves de valores y tope de 4 KB).

## Estructura de archivos

```text
supabase/migrations/20261126000300_meal_estimate_original.sql
supabase/tests/meal_estimate_original.test.sql
app/src/features/meals/{mealTotals,MealSection,DayPage,macroLabels}.ts(x)
app/src/features/meals/MacroProgress.tsx
app/src/features/goals/useMacroGoal.ts              # devuelve null hasta la spec 027
app/src/copy/es.ts
app/tests/{unit/mealTotals.test.ts,component/MealSection.test.tsx,component/MacroProgress.test.tsx,e2e/meal-macros.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de comidas y accesibilidad. Comprobar a mano que la suma por comida coincide con el total del día y que ningún macro sin dato aparece como 0.

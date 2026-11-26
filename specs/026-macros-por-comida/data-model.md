# Modelo de datos: Macros por comida

## Cambio en `meal_entries` (spec 003)

| Columna | Tipo | Notas |
| --- | --- | --- |
| original_estimate | jsonb, nulo | Estimación de la IA tal como se confirmó: `{name, quantity, quantity_unit, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg}`. Nula salvo en ítems de origen `estimated`. Tope 4 KB. |

Restricción: `original_estimate is null or origin = 'estimated'`.

Sin cambios de RLS: la política de lectura propia de `meal_entries` ya cubre la columna. La escritura sigue pasando por `add_estimated_entries` y `update_meal_entry`.

## Tipos derivados (no persistidos, en el cliente)

- **MacroTotal**: `{ value: number | null, contributing: number, total: number }`. `value` es `null` si `contributing = 0`; es «parcial» si `contributing < total`.
- **MealTotals**: un `MacroTotal` por macro (energía, proteína, carbohidratos, grasas, fibra, sodio) para una comida del día.
- **DayMacroProgress**: consumido por macro y, si hay objetivo vigente, objetivo o rango y diferencia.

## Reglas

- La suma de los `MealTotals` de las comidas de un día es igual al total del día.
- Un ítem sin un macro no suma 0 a ese macro.
- Los valores históricos no cambian si cambia el catálogo (la instantánea está en el ítem).

# Modelo de datos: Plan alimentario por día y actividad

Tablas con `user_id uuid not null references auth.users on delete cascade`, RLS activado, lectura propia con sesión fresca y escritura solo por funciones `security definer`.

## meal_plans

| Columna | Tipo | Notas |
| --- | --- | --- |
| id | uuid pk | |
| user_id | uuid | |
| plan_date | date | un plan confirmado por persona y día (`unique (user_id, plan_date)`) |
| day_type | text | `rest`, `training`, `intense_training`, `high_activity`, `low_activity` |
| energy_kcal, protein_g, carbs_g, fat_g | numeric | totales del plan al confirmar |
| target_snapshot | jsonb | objetivo de macros y energía usados (para el historial) |
| client_request_id | uuid | único con `user_id` |
| created_at, updated_at | timestamptz | |

## meal_plan_items

| Columna | Tipo | Notas |
| --- | --- | --- |
| id | uuid pk | |
| plan_id | uuid | `references meal_plans on delete cascade` |
| user_id | uuid | |
| meal_slot | smallint | 1 a 8, orden de la comida |
| meal_label | text | nombre libre o estándar (desayuno, almuerzo, pre-entreno...) |
| meal_time | time, nulo | horario previsto |
| position | smallint | orden dentro de la comida |
| food_id | uuid, nulo | `on delete set null` |
| food_name | text | instantánea |
| quantity | numeric(8, 2) | gramos o mililitros, 1 a 5000 |
| energy_kcal, protein_g, carbs_g, fat_g | numeric | calculados para la cantidad con instantánea |

`unique (plan_id, meal_slot, position)`.

## Tipos derivados (cliente)

- **PlanDraft**: borrador local con comidas, alimentos, desviaciones respecto del objetivo y motivo del tipo de día.
- **ShoppingItem**: `{ name, foodId?, quantity, unit }` sumado de planes confirmados.
- **PlanPreferences**: cantidad de comidas, horarios, alimentos disponibles y excluidos (se apoya en el perfil de atleta, spec 025).

## Reglas

- El plan nunca escribe en `meal_entries` ni lee lo consumido para ajustarse.
- Confirmar un día ya confirmado reemplaza el plan anterior (el reemplazo conserva la instantánea nueva; no hay historial de planes).
- `export_my_data()` incluye `meal_plans` y `meal_plan_items`.

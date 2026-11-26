# Modelo de datos: Necesidades de macros según objetivo

## macro_goals (historial inmutable)

Una fila por cambio, nunca se actualiza ni se borra (salvo la cascada al eliminar la cuenta). El objetivo de un día D es la fila de `created_at` más reciente con `effective_from <= D`; si sus valores son nulos, D no tiene objetivo de macros. Mismo patrón que `energy_goals` (spec 004).

| Columna | Tipo | Notas |
| --- | --- | --- |
| id | uuid pk | |
| user_id | uuid | `references auth.users on delete cascade` |
| effective_from | date | el «hoy» de la persona, fijado por el servidor |
| protein_min_g, protein_max_g | integer, nulos | 30 a 400 |
| fat_min_g, fat_max_g | integer, nulos | 20 a 250 |
| carbs_min_g, carbs_max_g | integer, nulos | 0 a 900 |
| method | text | `formula_015`, `manual` |
| inputs | jsonb | entradas usadas (peso, altura, edad, objetivo, factor, sesiones y su base), tope 2 KB |
| client_request_id | uuid | único con `user_id` |
| created_at | timestamptz | |

Restricciones: cada mínimo menor o igual que su máximo; o todos los valores nulos o todos presentes; `method` en la lista.

Seguridad: RLS con lectura propia y sesión fresca, sin permisos de escritura para el cliente; la escritura es `set_macro_goal` (`security definer`).

## Tipos derivados (cliente)

- **MacroTargets**: rangos por macro, método y entradas.
- **GoalReview**: `{ status: 'insufficient' | 'coherent' | 'suggest_review', evidence }` con período, semanas, pesajes, días con comida, tendencia de peso observada y esperada.

## Relaciones

- `energy_goals` (spec 004) sigue siendo la fuente de la energía del día.
- `meal_entries` (spec 003) aporta lo consumido; `body_measurements` (spec 008), el peso.
- `profiles` y las tablas del perfil de atleta (spec 025) aportan las entradas.

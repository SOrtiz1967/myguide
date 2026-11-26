# Modelo de datos: Perfil de atleta

Todas las tablas: `user_id uuid not null references auth.users on delete cascade`, RLS activado, lectura propia con sesión fresca, sin escritura directa del cliente (la hace una función `security definer`).

## athlete_goals (historial)

| Columna | Tipo | Notas |
| --- | --- | --- |
| id | uuid pk | |
| user_id | uuid | |
| effective_from | date | desde cuándo rige; la fija el servidor |
| goals | jsonb | lista de `{kind, priority, label?}`; 1 a 3, prioridades 1 a 3 sin repetir |
| client_request_id | uuid | único con `user_id` |
| created_at | timestamptz | define cuál es el último |

`kind` ∈ hypertrophy, strength, gradual_fat_loss, maintenance, recomposition, performance, fitness, custom. `label` solo para `custom` (1 a 60 caracteres).

## athlete_availability (historial)

| Columna | Tipo | Notas |
| --- | --- | --- |
| effective_from | date | |
| days_per_week | smallint | 1 a 7 |
| session_minutes | smallint | 15 a 240, nulo permitido |
| usual_time | text | `morning`, `afternoon`, `evening`, `varies` o nulo |
| place | text | `gym`, `home`, `other` o nulo |
| equipment | text[] | lista cerrada, hasta 10 |
| client_request_id, created_at | | igual que arriba |

## athlete_preferences (una fila por persona)

`priority_muscles text[]` (músculos del catálogo, hasta 5), `meals_per_day smallint` (1 a 8), `usual_sleep_minutes integer` (60 a 960), `perceived_recovery smallint` (1 a 5), `approx_steps integer` (0 a 100000), `effort_scale text` (`rir` o `rpe`, por defecto `rir`), `updated_at`. Todo nulo salvo la escala.

## athlete_item_preferences

`id`, `kind` (`exercise_favorite`, `exercise_avoided`, `food_avoided`), `exercise_id` o `food_id` (exactamente uno según el `kind`, `on delete cascade`), único por (`user_id`, `kind`, ítem).

## Reglas

- Un ejercicio no puede ser favorito y evitado a la vez.
- Los registros de otras specs no leen estas tablas al guardarse: no hay efecto retroactivo.
- `export_my_data()` incluye las cuatro tablas.

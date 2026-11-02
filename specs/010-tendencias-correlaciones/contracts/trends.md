# Contrato: funciones de lectura de Tendencias

Ambas son `security definer`, `stable`, `search_path = ''`, de solo lectura. Sin sesión vigente (`auth.uid()` nulo o `private.is_session_fresh()` falso) fallan con `session_expired` (código `42501`). Solo otorgan `execute` a `authenticated`. Filtran siempre por `auth.uid()`.

## `public.trends_nutrition(from_date date, to_date date)`

Una fila por día con al menos una entrada `confirmed` de la cuenta en el rango.

| Columna         | Tipo    | Significado                                               |
| --------------- | ------- | --------------------------------------------------------- |
| `log_date`      | date    | El día.                                                   |
| `entries`       | integer | Entradas confirmadas del día.                             |
| `energy_kcal`   | numeric | Suma de lo informado; nulo si ninguna entrada lo informa. |
| `energy_count`  | integer | Entradas que informan calorías.                           |
| `protein_g`     | numeric | Ídem para proteína.                                       |
| `protein_count` | integer |                                                           |
| `carbs_g`       | numeric | Ídem para carbohidratos.                                  |
| `carbs_count`   | integer |                                                           |
| `fat_g`         | numeric | Ídem para grasas.                                         |
| `fat_count`     | integer |                                                           |

Errores: `invalid_trends:range:from_date` si `from_date` es nulo, posterior a `to_date`, o el rango supera 400 días.

Orden: `log_date` ascendente.

## `public.trends_training_sets(from_date date, to_date date)`

Una fila por semana (lunes) con al menos una serie en sesiones `completed` de la cuenta, con `session_date` en el rango.

| Columna      | Tipo    | Significado                                                                                                                                                                                    |
| ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `week_start` | date    | El lunes de la semana (`date_trunc('week', session_date)`).                                                                                                                                    |
| `total_sets` | integer | Series de la semana, cada una contada una sola vez.                                                                                                                                            |
| `by_muscle`  | jsonb   | Objeto `{ "<músculo>": <series>, ... }`. Una serie cuenta una vez por cada músculo principal de su ejercicio. `sin_grupo` reúne las series de ejercicios sin músculo principal o sin catálogo. |

Los músculos son los del catálogo (`chest`, `lats`, `full_body`, etc.). Errores: los mismos que la anterior.

Orden: `week_start` ascendente.

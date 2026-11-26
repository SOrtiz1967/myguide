# Modelo de datos: Detección de estancamiento

Tablas con `user_id uuid not null references auth.users on delete cascade`, RLS activado, lectura propia con sesión fresca y escritura solo por funciones `security definer`.

## training_periods

Períodos que la persona marca para que no cuenten en la detección (esta spec) ni en la adherencia (spec 035).

| Columna | Tipo | Notas |
| --- | --- | --- |
| id | uuid pk | |
| user_id | uuid | |
| kind | text | `deload` (semana de descarga) o `pause` (vacaciones, lesión, pausa) |
| start_date | date | |
| end_date | date | mayor o igual que `start_date`; máximo 90 días de duración |
| note | text, nulo | 1 a 200 caracteres |
| client_request_id | uuid | único con `user_id` |
| created_at | timestamptz | |

Restricción de exclusión: sin solapamiento de fechas del mismo `kind` y `user_id`.

## stagnation_dismissals

| Columna | Tipo | Notas |
| --- | --- | --- |
| user_id | uuid | |
| exercise_id | uuid | `references exercises on delete cascade` |
| dismissed_at | timestamptz | |
| session_count | integer | cantidad de sesiones realizadas del ejercicio al descartar |

Clave primaria `(user_id, exercise_id)`; descartar de nuevo actualiza la fila.

## Tipos derivados (cliente)

- **StagnationNotice**: `{ exerciseId, sessions, from, to, comparedTo, criterion, status }`.
- **ObservableFactor**: `{ kind, current, previous, periodDays, sampleSize, text }` con `kind` en `sleep`, `volume`, `effort`, `energy_balance`, `frequency`, `recovery`.

## Reglas

- La detección no se persiste.
- Las sesiones dentro de un período de descarga o pausa no cuentan.
- Datos faltantes: el factor se omite; nunca se rellena.
- `export_my_data()` incluye `training_periods` y `stagnation_dismissals`.

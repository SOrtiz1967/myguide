# Modelo de datos: RIR/RPE y esfuerzo por serie

## Cambios en `session_sets` (spec 006)

| Columna | Tipo | Notas |
| --- | --- | --- |
| effort_rpe | numeric(3,1), nulo | 1,0 a 10,0; `check (effort_rpe is null or (effort_rpe between 1 and 10 and (effort_rpe * 2) = trunc(effort_rpe * 2)))` |
| note | text, nulo | 1 a 200 caracteres |

La restricción `session_sets_value_check` (al menos un valor entre repeticiones, peso, duración, distancia) **no cambia**: una serie con solo esfuerzo no es válida.

Sin cambios de RLS: la escritura sigue pasando por `save_session`.

## Sin cambios

- `session_exercises.effort` (esfuerzo del ejercicio, 1 a 10) se conserva tal cual.
- Las series existentes quedan con `effort_rpe` y `note` en `null`.

## Tipos derivados (cliente)

- **EffortScale**: `'rir' | 'rpe'`, preferencia de la persona (perfil de atleta, spec 025).
- **EffortDisplay**: `{ rpe: number, rir: number | null, label: string }` calculado con `10 − RPE` para valores de RIR de 0 a 9.

## Lecturas

`exercise_progress` y `exercise_history` devuelven en cada serie `effort_rpe` y `note` solo cuando existen.

## Reglas

- Cambiar la escala preferida no modifica datos guardados.
- Dos series con igual peso y repeticiones y distinto `effort_rpe` se muestran como distintas.

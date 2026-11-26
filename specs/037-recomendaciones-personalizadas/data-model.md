# Modelo de datos: Recomendaciones personalizadas

Tablas con `user_id uuid not null references auth.users on delete cascade`, RLS activado, lectura propia con sesión fresca y escritura solo por funciones `security definer`.

## recommendation_preferences

Una fila por persona.

| Columna | Tipo | Notas |
| --- | --- | --- |
| user_id | uuid pk | |
| hidden_areas | text[] | lista cerrada: `training`, `volume`, `recovery`, `nutrition`; sin repetidos |
| updated_at | timestamptz | |

## recommendation_dismissals

| Columna | Tipo | Notas |
| --- | --- | --- |
| user_id | uuid | |
| rule_key | text | 1 a 80 caracteres |
| data_hash | text | huella de los datos cuando se ignoró |
| dismissed_at | timestamptz | |

Clave primaria `(user_id, rule_key)`; ignorar de nuevo actualiza la fila.

## Tipos derivados (cliente, no persistidos)

- **Recommendation**: `{ key, area, headline, origin, confidence, action, dataHash }`.
  - `origin`: `{ metric, value, comparedTo, period, sampleSize }`.
  - `area`: `training`, `volume`, `recovery`, `nutrition`.
  - `confidence`: `high`, `medium`, `low`.
- **RecommendationContext**: resultados de las lecturas de las specs 007, 010, 026, 027, 030 a 035; cada campo es opcional si la spec no está disponible.

## Reglas

- Las recomendaciones no se guardan; se recalculan con los datos vigentes.
- Una recomendación ignorada reaparece solo si cambia el `data_hash` de forma relevante.
- Ocultar un área solo oculta la presentación; no impide que las specs de origen sigan funcionando.
- `export_my_data()` incluye ambas tablas.

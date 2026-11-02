# Contrato: `estimate-meal` y `add_estimated_entries`

## Función `estimate-meal`

`POST {FUNCTIONS_URL}/estimate-meal`. Requiere `Authorization: Bearer <jwt>` de una sesión vigente (30 días de actividad) y un origen permitido.

### Solicitud (texto)

`Content-Type: application/json`

```json
{
  "request_id": "uuid v4",
  "text": "2 milanesas al horno con puré y una manzana"
}
```

- `request_id`: identifica el intento. Un mismo `request_id` con el mismo texto devuelve el mismo resultado durante 24 horas sin llamar al proveedor ni contar cuota.
- `text`: 1 a 500 caracteres tras recortar.

### Solicitud (foto, historia 6)

`Content-Type: multipart/form-data` con `request_id` y `photo` (JPEG, hasta 3 MiB). La foto se limpia de metadatos antes de enviarse y no se guarda.

### Respuesta 200

```json
{
  "items": [
    {
      "name": "Milanesa de carne al horno",
      "quantity_text": "2 unidades",
      "energy_kcal": 520,
      "protein_g": 44,
      "carbs_g": 30,
      "fat_g": 24
    }
  ],
  "cached": false
}
```

- 1 a 12 ítems. `name` 1 a 200 caracteres; `quantity_text` `null` o hasta 60; `energy_kcal` de 0 a 5000; `protein_g`, `carbs_g` y `fat_g` `null` o de 0 a 1000. Los valores son para la cantidad indicada y se redondean a un decimal.
- `cached: true` cuando sale del resultado guardado.

### Errores

Cuerpo `{ "code": "<motivo>" }`.

| HTTP | `code`             | Cuándo                                                                       |
| ---- | ------------------ | ---------------------------------------------------------------------------- |
| 400  | `invalid_request`  | Cuerpo mal formado, `request_id` inválido o texto vacío o de más de 500.     |
| 401  | `unauthorized`     | Sin token, token inválido o sesión vencida.                                  |
| 403  | `forbidden_origin` | Origen no permitido.                                                         |
| 413  | `too_large`        | Foto de más de 3 MiB.                                                        |
| 415  | `unsupported_type` | La foto no es JPEG.                                                          |
| 422  | `no_items`         | La IA no encontró ningún alimento en el texto.                               |
| 422  | `invalid_image`    | La foto está dañada o truncada.                                              |
| 429  | `rate_limited`     | Más de 5 consultas por minuto.                                               |
| 429  | `daily_limit`      | Más de 30 consultas en 24 horas.                                             |
| 429  | `quota_exhausted`  | El proveedor informó que su cuota se agotó.                                  |
| 502  | `ai_invalid`       | La respuesta del proveedor no cumplió el esquema o los rangos (se descarta). |
| 502  | `ai_failed`        | Error del proveedor o de red.                                                |
| 503  | `ai_unavailable`   | No hay clave configurada.                                                    |
| 504  | `ai_timeout`       | El proveedor tardó más de 20 segundos.                                       |

Los errores `rate_limited`, `daily_limit`, `quota_exhausted`, `ai_failed`, `ai_invalid` y `ai_timeout` no se guardan en el resultado: un reintento con el mismo `request_id` vuelve a consultar.

### Registros

`estimate_meal` con `request_id` interno (no el de la solicitud), `method`, `status`, `result`, `ms`, `items` (cantidad) y `kind` (`text` o `photo`). Nunca el texto, la foto, los ítems, los valores ni el identificador de la persona.

## Función `public.add_estimated_entries(entries jsonb, request_id uuid) returns uuid[]`

`security definer`, solo `authenticated`, sesión vigente. Una sola transacción.

```json
{
  "log_date": "2026-11-01",
  "meal": "lunch",
  "items": [
    {
      "description": "Milanesa de carne al horno",
      "quantity_text": "2 unidades",
      "energy_kcal": 520,
      "protein_g": 44,
      "carbs_g": 30,
      "sugars_g": null,
      "fat_g": 24,
      "saturated_fat_g": null,
      "fiber_g": null,
      "sodium_mg": null
    }
  ]
}
```

- Devuelve los identificadores de los ítems creados, en el orden recibido.
- Cada ítem se guarda con `origin = 'estimated'` y `status = 'confirmed'`, con las mismas validaciones que el alta manual (`private.validate_manual_values`).
- Idempotente: el `client_request_id` de cada ítem se deriva de `request_id` y de su posición; repetir la llamada devuelve los mismos identificadores sin duplicar.
- Errores (`errcode 22023`): `invalid_entry:invalid_meal:meal`, `invalid_entry:invalid_items:items` (menos de 1 o más de 12), `invalid_entry:description_required:description`, `invalid_entry:out_of_range:<campo>`, y los de fecha de `parse_log_date`. Sesión vencida: `session_expired` (`42501`).

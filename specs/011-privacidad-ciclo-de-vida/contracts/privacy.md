# Contrato: `export_my_data` y `delete-account`

## `public.export_my_data() returns jsonb`

`security definer`, solo `authenticated`, sesión vigente (si no, `session_expired`, `42501`).

```json
{
  "format_version": 1,
  "exported_at": "2026-11-01T12:00:00Z",
  "account": { "email": "persona@ejemplo.com" },
  "tables": {
    "profiles": [{ "user_id": "…", "timezone": "…" }],
    "meal_entries": [],
    "progress_photos": []
  }
}
```

- `tables` tiene una clave por cada tabla de `public` con `user_id`, salvo `ai_estimates`. Cada valor es la lista de filas de la cuenta (`to_jsonb`), con los datos faltantes como `null`.
- No incluye contraseñas, tokens, claves ni el catálogo común de `food_sources` y `exercise_sources`. Los alimentos y ejercicios propios sí, porque llevan `user_id`.

## Función `delete-account`

`POST {FUNCTIONS_URL}/delete-account`. Requiere `Authorization: Bearer <jwt>` de una sesión vigente y un origen permitido.

Solicitud: `{ "password": "…" }`.

Respuesta 200: `{ "deleted": true }`.

| HTTP | `code`             | Cuándo                                                              |
| ---- | ------------------ | ------------------------------------------------------------------- |
| 400  | `invalid_request`  | Sin contraseña o cuerpo mal formado.                                |
| 401  | `unauthorized`     | Sin token, token inválido, sesión vencida o la cuenta ya no existe. |
| 403  | `forbidden_origin` | Origen no permitido.                                                |
| 403  | `invalid_password` | La contraseña no es la de la cuenta (no se borra nada).             |
| 429  | `rate_limited`     | Más de 5 intentos por hora.                                         |
| 500  | `storage_error`    | No se pudieron borrar los archivos; la cuenta sigue existiendo.     |
| 500  | `delete_failed`    | No se pudo eliminar la cuenta; reintentar es seguro.                |

Orden: archivos de `meal-photos/<id>/` y `progress-photos/<id>/` → cuenta (y con ella todas sus filas por cascada).

Registros: `delete_account` con `request_id` interno, `status`, `result` y `ms`. Nunca la persona, el correo, la contraseña ni rutas.

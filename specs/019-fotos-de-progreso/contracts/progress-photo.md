# Contrato: Edge Function `progress-photo` y función `update_progress_photo`

**Feature**: 019-fotos-de-progreso | Principios I, V, VI y IX

Única vía para guardar y eliminar fotos de progreso. Corre con la clave de servicio, que solo vive en el servidor. Misma forma que `meal-photo` (spec 003).

## `POST /functions/v1/progress-photo`

- **Autenticación**: `Authorization: Bearer <JWT de la sesión>`; el token se verifica con Auth y la sesión debe seguir vigente (30 días de actividad). Si no, `401`.
- **Cuerpo**: `multipart/form-data` con `taken_on` (AAAA-MM-DD), `pose` (opcional: `front` | `side` | `back` | `other`) y `photo` (el JPEG ya reducido en el navegador).
- **Validaciones**: origen permitido; `photo` empieza con `FF D8 FF`, pesa como mucho 3 MB y se puede recorrer como JPEG; `taken_on` entre 2000-01-01 y mañana (con margen por la zona horaria); `pose` válida si viene; la cuenta tiene menos de 200 fotos.
- **Limpieza**: igual que `meal-photo` (código compartido `_shared/jpeg.ts`): se eliminan todos los APPn salvo APP0 y todos los COM.
- **Efecto**: 1) guarda el resultado en `progress-photos/<user_id>/<uuid>.jpg`; 2) inserta la fila en `progress_photos`; 3) si la fila falla, borra el objeto.
- **Respuesta `200`**: `{ id, taken_on, pose, width, height, bytes }`.
- **Errores**: `400 invalid_request`, `401 unauthorized`, `403 forbidden_origin`, `409 limit_reached`, `413 too_large`, `415 unsupported_type`, `422 invalid_image`, `429 rate_limited` (más de 30 por hora por cuenta), `500 storage_error`.

## `DELETE /functions/v1/progress-photo?id=<uuid>`

Borra la fila y el objeto de esa foto si es de la cuenta. Idempotente: si no existe, `204` igual. Un `id` mal formado es `400 invalid_request`.

## `public.update_progress_photo(p_id uuid, p_taken_on date, p_pose text default null)`

Corrige fecha y pose de una foto propia sin tocar el archivo. `security definer`, exige sesión vigente. Errores (`raise exception` con código): `photo_not_found` si no existe o no es suya, `invalid_date` si la fecha está fuera de rango, `invalid_pose` si la pose no es válida. Devuelve la fila actualizada.

## Ver una foto (sin la función)

El cliente lee las filas de `progress_photos` (RLS, solo las propias y con sesión vigente) y pide enlaces firmados de 10 minutos con `storage.from('progress-photos').createSignedUrls(paths, 600)`. La política de Storage solo permite lo de la propia carpeta.

## Registro (Principio IX)

Se registra: identificador de solicitud, método, estado, resultado, bytes antes y después de limpiar y duración. **No** se registra: la persona, la ruta, la fecha, la pose, el contenido ni los metadatos quitados.

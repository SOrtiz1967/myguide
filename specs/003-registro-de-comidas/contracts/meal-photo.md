# Contrato: Edge Function `meal-photo`

**Feature**: 003-registro-de-comidas | Principios I, VI y IX

Única vía para guardar, reemplazar o eliminar la foto de una comida. Corre con la clave de servicio, que solo vive en el servidor.

## `POST /functions/v1/meal-photo`

- **Autenticación**: `Authorization: Bearer <JWT de la sesión>`. Sin sesión válida o vigente: `401`.
- **Cuerpo**: `multipart/form-data` con los campos `log_date` (AAAA-MM-DD), `meal` (`breakfast` | `lunch` | `snack` | `dinner` | `extra`) y `photo` (el JPEG ya reducido en el navegador).
- **Validaciones**:
  - `photo` empieza con la firma JPEG (`FF D8 FF`) y termina en `FF D9`.
  - Pesa como mucho 3 MB.
  - `log_date` y `meal` son válidos, con los mismos rangos que los ítems.
  - Origen permitido (`ALLOWED_ORIGINS`, como en la spec 001).
- **Limpieza**: recorre los segmentos del JPEG y elimina todos los APPn salvo APP0 (JFIF), y todos los COM. Así no quedan EXIF, GPS, XMP, IPTC ni comentarios. Si el archivo no se puede recorrer como JPEG, responde `422 invalid_image`.
- **Efecto**:
  1. Guarda el resultado en `meal-photos/<user_id>/<uuid>.jpg` (`contentType: image/jpeg`, sin caché pública).
  2. Inserta o reemplaza la fila de `meal_photos` para `(user_id, log_date, meal)`.
  3. Si había una foto anterior, borra su objeto.
  4. Si la fila no se pudo guardar, borra el objeto recién subido para no dejar huérfanos.
- **Respuesta `200`**: `{ id, log_date, meal, width, height, bytes }`.
- **Errores**:

  | Código | Cuerpo |
  |---|---|
  | `400` | `invalid_request` |
  | `401` | `unauthorized` |
  | `413` | `too_large` |
  | `415` | `unsupported_type` |
  | `422` | `invalid_image` |
  | `429` | `rate_limited` (más de 30 fotos por hora por cuenta) |
  | `500` | `storage_error`, con un mensaje genérico |

## `DELETE /functions/v1/meal-photo?log_date=…&meal=…`

Borra el objeto y la fila de la foto de esa comida de la cuenta. Es idempotente: si no hay foto, responde `204` igual.

## Ver una foto (sin la función)

El cliente lee la fila de `meal_photos` (RLS) y pide una URL firmada de 10 minutos con `storage.from('meal-photos').createSignedUrl(path, 600)`. La política de Storage solo deja firmar los objetos de la propia carpeta y con sesión vigente.

## Registro (Principio IX)

Se registra: identificador de solicitud, resultado, motivo de rechazo, bytes antes y después de limpiar, y duración. **No** se registra: `user_id`, la ruta, la fecha ni la comida, el contenido ni los metadatos quitados.

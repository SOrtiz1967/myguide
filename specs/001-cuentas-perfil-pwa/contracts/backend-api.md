# Contrato: superficie de backend

**Feature**: 001-cuentas-perfil-pwa

Define lo que el frontend puede pedirle al backend. Las operaciones de autenticación las provee Supabase Auth; aquí se documentan las que esta spec agrega o restringe.

## 1. Autenticación (Supabase Auth, con configuración fijada por esta spec)

| Operación | Entrada | Resultado | Requisitos |
|---|---|---|---|
| Registrar | Edge Function `register` (ver sección 2): correo, contraseña, token Turnstile, versión del aviso | cuenta y perfil creados; el cliente inicia sesión a continuación | FR-001, FR-002, FR-007, FR-008, FR-029. `409` con mensaje claro si el correo ya existe. |
| Iniciar sesión | correo, contraseña (directo contra Auth, **sin captcha**) | sesión | FR-003, FR-005, FR-006, FR-025. Error uniforme ante credenciales inválidas. Tras iniciar, el cliente llama a `start_session()`. |
| Cerrar sesión | — | sesión terminada; el cliente borra `draft:*` | FR-003, FR-022 |
| Cambiar contraseña | contraseña actual, contraseña nueva | contraseña actualizada; las demás sesiones se cierran | FR-028, FR-030. Rechaza si la actual es incorrecta. |
| Solicitar recuperación | Edge Function `request-password-reset` (ver sección 2): correo, token Turnstile | respuesta siempre neutral | FR-004, FR-005, FR-008, FR-027 (no se envía si el correo no está confirmado) |
| Restablecer contraseña | enlace de recuperación, contraseña nueva | contraseña actualizada; **todas** las sesiones se cierran | FR-004, FR-030 |

**Configuración obligatoria de Auth**: confirmación nativa de correo **desactivada**; registro nativo **desactivado** (`enable_signup = false`; las cuentas se crean solo con `register`); captcha nativo **desactivado** (el token de Turnstile se verifica en las funciones); longitud mínima de contraseña 10; límite de intentos de inicio de sesión **por IP** en el valor más estricto razonable (sin bloqueo por cuenta, ver `research.md`, Decisión 6); el correo no es modificable por el cliente (barrera en la base de datos, `research.md`, Decisión 13).

## 2. Edge Functions

### `POST /functions/v1/register`

- **Auth**: ninguna; exige token Turnstile.
- **Entrada**: `{ "email": string, "password": string, "turnstileToken": string, "privacyNoticeVersion": string }`
- **Efecto**: verifica Turnstile; valida correo, contraseña (10 a 72 caracteres) y que la versión del aviso figure como vigente; crea la cuenta con la API de administración (`email_confirm: true`); el disparador crea el perfil. Dispara el envío de la confirmación sin hacer fallar el alta si el correo no sale.
- **Respuestas**: `201` creada; `400` datos inválidos; `409` correo ya registrado (mensaje claro, decisión del autor); `403` Turnstile rechazó la verificación; `503` Turnstile no disponible (aviso para reintentar); `429` límite por IP.
- **Requisitos**: FR-001, FR-002, FR-007, FR-008, FR-025, FR-026, FR-029.

### `POST /functions/v1/send-verification`

- **Auth**: requiere sesión válida.
- **Entrada**: ninguna (usa la identidad de la sesión).
- **Efecto**: invalida tokens pendientes, crea uno nuevo (24 h) y envía el enlace por correo.
- **Respuestas**: `204` enviado; `429` si se pidió hace menos de 60 segundos o se superó el máximo diario; `409` si el correo ya está confirmado; `502` si el proveedor de correo falló o agotó el tiempo (la interfaz ofrece reintentar; el fallo se registra con su causa y sin datos personales).
- **Requisitos**: FR-026.

### `GET /functions/v1/confirm-email?token=<token>`

- **Auth**: ninguna (el token es la credencial).
- **Efecto**: valida hash, vigencia y que no esté usado; marca `used_at` y `profiles.email_verified_at`.
- **Respuestas**: redirige a `/correo-confirmado` si es válido, o a `/correo-no-valido` si venció, ya se usó o no existe (sin distinguir causas).
- **Requisitos**: FR-026.

### `POST /functions/v1/request-password-reset`

- **Auth**: ninguna; exige token Turnstile.
- **Entrada**: `{ "email": string, "turnstileToken": string }`
- **Efecto**: verifica Turnstile; si la cuenta existe y su correo está confirmado, dispara la recuperación de Auth. En cualquier caso responde igual.
- **Respuestas**: `202` siempre, con el mismo cuerpo y tiempo de respuesta aproximado, tanto si existe como si no, y tanto si está confirmado como si no (la interfaz explica la regla de confirmación de forma general); `403` Turnstile rechazó la verificación; `503` Turnstile no disponible; `429` límite por IP. Un fallo del proveedor de correo se registra y no cambia la respuesta `202`.
- **Requisitos**: FR-004, FR-005, FR-008, FR-025, FR-027.
- **Nota**: el endpoint nativo de recuperación sigue accesible con la clave pública; queda cubierto solo por el límite por IP (residual documentado en `research.md`, Decisión 6).

## 3. Funciones RPC de Postgres

| Función | Entrada | Resultado |
|---|---|---|
| `touch_session()` | — | `ok`, o error `session_expired` si pasaron más de 30 días sin actividad |
| `start_session()` | — | `ok` si el token proviene de un inicio de sesión con contraseña reciente; `error` en otro caso |

Cuando el cliente recibe `session_expired`, cierra la sesión local, borra `draft:*` y muestra el inicio de sesión (FR-003).

## 4. Acceso a tablas (RLS)

| Tabla | `select` | `insert` | `update` | `delete` |
|---|---|---|---|---|
| `public.profiles` | propio | no (lo crea el disparador del alta) | propio, solo columnas editables: `birth_date`, `sex`, `height_cm`, `timezone` | no |
| `private.email_verification_tokens` | no | no | no | no (solo Edge Functions con la clave de servicio) |

- Todo acceso exige sesión (`anon` no accede a nada) y sesión fresca (`private.is_session_fresh()`).
- Una fila ajena se comporta como inexistente (resultado vacío o `404`), sin revelar su existencia (FR-011).

## 5. Variables de entorno

| Variable | Dónde | Pública |
|---|---|---|
| `VITE_SUPABASE_URL` | frontend | sí |
| `VITE_SUPABASE_ANON_KEY` | frontend | sí (clave pública diseñada para el navegador; el acceso lo limita RLS) |
| `VITE_TURNSTILE_SITE_KEY` | frontend | sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | **no** |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | Auth y Edge Functions | **no** |
| `TURNSTILE_SECRET_KEY` | Auth y Edge Functions | **no** |

Ninguna variable secreta puede tener el prefijo `VITE_` ni aparecer en el bundle ni en el repositorio (Principio I, criterio verificable).

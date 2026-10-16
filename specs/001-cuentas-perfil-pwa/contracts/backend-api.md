# Contrato: superficie de backend

**Feature**: 001-cuentas-perfil-pwa

Define lo que el frontend puede pedirle al backend. Las operaciones de autenticación las provee Supabase Auth; aquí se documentan las que esta spec agrega o restringe.

## 1. Autenticación (Supabase Auth, con configuración fijada por esta spec)

| Operación | Entrada | Resultado | Requisitos |
|---|---|---|---|
| Registrar | correo, contraseña, token Turnstile, metadato `privacy_notice_version` | sesión iniciada; perfil creado | FR-001, FR-002, FR-008, FR-029. Falla si falta `privacy_notice_version`. |
| Iniciar sesión | correo, contraseña, token Turnstile | sesión | FR-003, FR-005, FR-006. Error uniforme ante credenciales inválidas. Tras iniciar, el cliente llama a `start_session()`. |
| Cerrar sesión | — | sesión terminada; el cliente borra `draft:*` | FR-003, FR-022 |
| Cambiar contraseña | contraseña actual, contraseña nueva | contraseña actualizada; las demás sesiones se cierran | FR-028, FR-030. Rechaza si la actual es incorrecta. |
| Solicitar recuperación | correo, token Turnstile | respuesta siempre neutral | FR-004, FR-005, FR-027 (no se envía si el correo no está confirmado) |
| Restablecer contraseña | enlace de recuperación, contraseña nueva | contraseña actualizada; **todas** las sesiones se cierran | FR-004, FR-030 |

**Configuración obligatoria de Auth**: confirmación nativa de correo **desactivada**; longitud mínima de contraseña 10; Turnstile activado; límites de intentos conservadores; cambio de correo **deshabilitado** para clientes.

## 2. Edge Functions

### `POST /functions/v1/send-verification`

- **Auth**: requiere sesión válida.
- **Entrada**: ninguna (usa la identidad de la sesión).
- **Efecto**: invalida tokens pendientes, crea uno nuevo (24 h) y envía el enlace por correo.
- **Respuestas**: `204` enviado; `429` si se pidió hace menos de 60 segundos o se superó el máximo diario; `409` si el correo ya está confirmado.
- **Requisitos**: FR-026.

### `GET /functions/v1/confirm-email?token=<token>`

- **Auth**: ninguna (el token es la credencial).
- **Efecto**: valida hash, vigencia y que no esté usado; marca `used_at` y `profiles.email_verified_at`.
- **Respuestas**: redirige a `/correo-confirmado` si es válido, o a `/correo-no-valido` si venció, ya se usó o no existe (sin distinguir causas).
- **Requisitos**: FR-026.

### `POST /functions/v1/request-password-reset` *(solo si el Auth Hook de correo no está disponible; ver `research.md`, Decisión 3)*

- **Auth**: ninguna; exige token Turnstile.
- **Entrada**: `{ "email": string }`
- **Efecto**: si la cuenta existe y su correo está confirmado, dispara la recuperación de Auth. En cualquier caso responde igual.
- **Respuesta**: `202` siempre, con el mismo cuerpo y tiempo de respuesta aproximado.
- **Requisitos**: FR-004, FR-005, FR-027.

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

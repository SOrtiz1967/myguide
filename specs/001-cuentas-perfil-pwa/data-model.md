# Data Model: Cuentas, perfil y base de la PWA

**Feature**: 001-cuentas-perfil-pwa | Base de datos: Postgres (Supabase)

## Convención de propiedad (aplica a todas las specs futuras)

Toda tabla de datos de usuario MUST:

1. Tener `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`.
2. Tener RLS activado y políticas separadas para `select`, `insert`, `update`, `delete`, todas con `user_id = auth.uid()` **y** `private.is_session_fresh()`.
3. Tener pruebas pgTAP que verifican que la cuenta B no lee, modifica ni elimina filas de la cuenta A, y que `anon` no accede a nada.
4. Nunca depender de un `user_id` enviado por el cliente: se asigna por defecto en el servidor y las políticas `insert`/`update` lo validan.

Esto implementa FR-009 a FR-012 y es el contrato de propiedad de los registros que heredan las specs 002 a 011.

## Entidades

### Cuenta (`auth.users`, gestionada por Supabase Auth)

Correo, credencial (hash gestionado por Auth) y fecha de creación. **No se modifica directamente**; el correo no es editable en el MVP (FR-028).

### Perfil (`public.profiles`)

Relación 1 a 1 con la cuenta.

| Columna | Tipo | Reglas |
|---|---|---|
| `user_id` | uuid, PK | referencia a `auth.users`, borrado en cascada |
| `birth_date` | date, nulo | no futura y no anterior a 120 años atrás (solo validación de coherencia; no hay verificación de edad ni restricción por edad en el MVP) |
| `sex` | text, nulo | `female`, `male` o nulo (no informado, FR-017); la interfaz muestra "Prefiero no indicarlo" |
| `height_cm` | numeric(4,1), nulo | entre 50 y 250 |
| `timezone` | text, nulo | nombre IANA válido; nulo hasta que la persona lo confirma (FR-016) |
| `unit_system` | text, no nulo | siempre `metric` en el MVP (check) |
| `privacy_notice_version` | text, no nulo | versión aceptada al registrarse (FR-029) |
| `privacy_notice_accepted_at` | timestamptz, no nulo | fecha de aceptación |
| `email_verified_at` | timestamptz, nulo | nulo = sin confirmar (FR-026) |
| `last_active_at` | timestamptz, no nulo | actualizado por `touch_session()`; base del vencimiento de 30 días (FR-003) |
| `created_at`, `updated_at` | timestamptz | `updated_at` por disparador |

- **Creación**: un disparador sobre `auth.users` crea el perfil con `privacy_notice_version` tomado de los metadatos del alta. **Si falta, el alta falla**, por lo que no se puede crear una cuenta sin haber aceptado el aviso (FR-029). Idempotente (`on conflict do nothing`).
- **Acceso del cliente**: `select` y `update` del propio perfil. **Sin** `insert` ni `delete` desde el cliente. Las columnas `user_id`, `email_verified_at`, `privacy_notice_*`, `last_active_at` MUST NOT ser modificables por el cliente (privilegios por columna o disparador de protección).
- **Completitud**: el perfil se considera completo cuando `birth_date`, `height_cm` y `timezone` están informados; `sex` es opcional. La completitud se deriva, no se guarda.

### Solicitud de confirmación de correo (`private.email_verification_tokens`)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, no nulo | referencia a `auth.users`, borrado en cascada |
| `token_hash` | text, no nulo, único | solo se guarda el hash; el token en claro viaja únicamente en el enlace |
| `expires_at` | timestamptz, no nulo | 24 horas desde la emisión |
| `used_at` | timestamptz, nulo | un solo uso |
| `created_at` | timestamptz | base del límite de reenvío |

- **Acceso**: esquema `private`, sin acceso para `anon` ni `authenticated`; solo las Edge Functions con la clave de servicio.
- **Estados**: emitido → usado, o emitido → vencido. Emitir uno nuevo invalida los anteriores pendientes.

### Sesión (`auth.sessions`, gestionada por Supabase Auth)

Se crea al iniciar sesión, expira por inactividad según Decisión 4 de `research.md`, y se cierra por cierre explícito, cambio de contraseña (las demás, FR-030) o recuperación (todas, FR-030).

### Solicitud de recuperación de acceso

Gestionada por Supabase Auth (enlace temporal de un solo uso). Esta spec no agrega tablas propias; solo la regla de no emitirla para correos sin confirmar (FR-027).

### Borrador local (solo en el navegador)

No es una tabla. Clave `draft:v1:<userId>:<formId>` en `localStorage`; contenido validado con Zod al restaurar; se elimina al confirmar el servidor, al cerrar sesión y al caducar la sesión (FR-021, FR-022).

## Funciones de base de datos

| Función | Quién la invoca | Qué hace |
|---|---|---|
| `private.is_session_fresh()` | políticas RLS | `true` si `last_active_at` del usuario actual es de hace menos de 30 días |
| `public.touch_session()` | cliente autenticado | actualiza `last_active_at` si la sesión sigue fresca; si no, devuelve error de sesión vencida |
| `public.start_session()` | cliente, tras un inicio de sesión | reinicia `last_active_at` solo si el JWT corresponde a un inicio de sesión con contraseña de los últimos minutos (`amr`) |

## Transiciones relevantes

- **Perfil**: creado (incompleto) → completo → editado. No hay eliminación en esta spec (spec 011).
- **Confirmación de correo**: sin confirmar → confirmada (irreversible en el MVP).
- **Sesión**: activa → renovada → vencida por inactividad | cerrada | cerrada por cambio de contraseña.

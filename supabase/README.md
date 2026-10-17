# Backend (Supabase)

Backend de MyGuide como código: migraciones, funciones de borde (Edge Functions) y pruebas. Decisiones y alternativas: [`specs/001-cuentas-perfil-pwa/research.md`](../specs/001-cuentas-perfil-pwa/research.md).

## Estructura

| Carpeta | Contenido |
|---|---|
| `migrations/` | Esquema, RLS, funciones y disparadores. Una migración por cambio lógico, en orden cronológico. |
| `functions/` | Edge Functions (Deno): `register`, `request-password-reset`, `send-verification`, `confirm-email` y utilidades en `_shared/`. Cada una separa la lógica probada (`handler.ts`) de su conexión real (`index.ts`). |
| `tests/` | Pruebas pgTAP (`*.test.sql`) y la prueba de invariantes de configuración (`config.test.ts`). |
| `seed.sql` | Ayudantes de prueba en el esquema `tests`. **Solo local**: no se aplica a producción. |
| `config.toml` | Configuración de Auth y de las funciones. Las decisiones de seguridad están comentadas al final. |

## Entorno local

Requisitos: Docker Desktop en ejecución. La CLI de Supabase y Deno se instalan como dependencias de desarrollo (`npm install` en la raíz).

```powershell
npx supabase start                                   # base de datos, Auth, Storage y buzón de correo de pruebas
npx supabase functions serve --env-file supabase/.env.local   # Edge Functions
```

El buzón de correo local (Mailpit) está en <http://127.0.0.1:54324>: ahí llegan los correos de confirmación y recuperación en desarrollo. No se envía nada real.

## Variables de entorno de servidor (secretos)

Los secretos **nunca** van en `app/`, en variables `VITE_*` ni en el repositorio. Cada archivo está en `.gitignore`.

| Archivo | Para qué | Se sube a Git |
|---|---|---|
| `supabase/.env.local` | Funciones en desarrollo: SMTP hacia el buzón local y la clave de **prueba** de Turnstile | No |
| `supabase/.env` | Credenciales **reales** (Brevo y Turnstile). Copiar de `supabase/.env.example` | No |
| `app/.env.local` | Solo variables públicas del frontend (`VITE_*`) | No |

| Variable | Descripción | Dónde se obtiene |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT` | Servidor SMTP (`smtp-relay.brevo.com`, `587`) | Brevo → Settings → SMTP & API |
| `SMTP_USER` | Login SMTP, con la forma `xxxx@smtp-brevo.com` (no es el correo de registro) | Brevo → Settings → SMTP & API → SMTP |
| `SMTP_PASSWORD` | **Clave SMTP** (no la API key) | Brevo → "Generate SMTP key" |
| `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | Remitente verificado | Brevo → Settings → Senders, Domains, IPs |
| `TURNSTILE_SECRET_KEY` | Clave secreta del widget | Cloudflare → Turnstile → widget → Settings |
| `ALLOWED_ORIGINS`, `SITE_URL`, `FUNCTIONS_URL` | Origen del frontend y URL pública de las funciones | Según el entorno |

Para pruebas se usan las claves de prueba oficiales de Cloudflare: sitio `1x00000000000000000000AA`, secreto `1x0000000000000000000000000000000AA` (el captcha siempre aprueba).

### Límites de intentos elegidos

- Inicio de sesión: **10 intentos por IP cada 5 minutos** (`[auth.rate_limit] sign_in_sign_ups`). No hay bloqueo por cuenta: ese hook es de planes Teams/Enterprise (ver `research.md`, Decisión 6).
- Registro y recuperación: 10 solicitudes por IP por hora (función SQL `check_rate_limit`).
- Reenvío de confirmación: 60 segundos entre envíos y 5 por día por cuenta.

## Pruebas

```powershell
npm run test:db          # pgTAP: aislamiento entre cuentas, sesión, restricciones y soporte de funciones
npm run test:functions   # Deno: manejadores, validación, Turnstile, tokens, correo y registro técnico
npm run test:config      # invariantes de seguridad de config.toml
```

## Convención de propiedad (obligatoria para toda tabla de usuario)

Aplica a las specs 002 a 011. Detalle en [`data-model.md`](../specs/001-cuentas-perfil-pwa/data-model.md). Lo hace cumplir `tests/rls_guardrail.test.sql`: **falla** si una tabla de `public` no cumple.

### Lista de verificación de una tabla nueva

- [ ] Tiene `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`.
- [ ] `alter table ... enable row level security` y `revoke all ... from anon, authenticated`.
- [ ] Políticas separadas de `select`, `insert`, `update` y `delete` con `user_id = (select auth.uid())` **y** `private.is_session_fresh()`.
- [ ] Permisos mínimos por columna (`grant select ...`, `grant update (columnas) ...`); nunca `grant all`.
- [ ] Ninguna política usa `using (true)` ni concede acceso a `anon`.
- [ ] Restricciones de integridad en la base (`check`, `unique`, `not null`), no solo en el cliente.
- [ ] Pruebas pgTAP de aislamiento: la cuenta B no lee, modifica ni borra filas de A; `anon` no accede; una sesión vencida no ve nada.
- [ ] Si guarda historial, guarda también un *snapshot* de los valores relevantes (Principio II) y planificado/ejecutado son tablas distintas.
- [ ] Skill `database-design` aplicada a la revisión.

### Plantilla de políticas

```sql
alter table public.<tabla> enable row level security;
revoke all on public.<tabla> from anon, authenticated;

grant select, insert on public.<tabla> to authenticated;
grant update (<columnas_editables>) on public.<tabla> to authenticated;

create policy <tabla>_select_own on public.<tabla>
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh());

create policy <tabla>_insert_own on public.<tabla>
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_session_fresh());

create policy <tabla>_update_own on public.<tabla>
  for update to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh())
  with check (user_id = (select auth.uid()) and private.is_session_fresh());

create policy <tabla>_delete_own on public.<tabla>
  for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_session_fresh());
```

### Plantilla de prueba pgTAP

Usa los ayudantes de `seed.sql` (`tests.create_user`, `tests.authenticate_as`, `tests.authenticate_as_anon`, `tests.clear_authentication`). Un ejemplo completo está en `tests/profiles_rls.test.sql`.

## Funciones de servicio

Las funciones `public.check_rate_limit`, `issue_email_token`, `consume_email_token`, `email_token_stats`, `mark_email_verified`, `find_user_by_email` e `is_privacy_notice_current` solo las puede ejecutar `service_role` (las Edge Functions). Están en `public` porque `supabase-js` solo expone ese esquema por RPC; ni `anon` ni `authenticated` tienen permiso de ejecución.

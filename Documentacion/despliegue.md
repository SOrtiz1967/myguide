# Guía de despliegue (gratuito)

Cubre el despliegue de las specs 001 a 003. Los límites de los planes gratuitos cambian: **confírmalos en las páginas oficiales** antes de depender de ellos (valores consultados el 2026-10-16 en fuentes públicas).

## Servicios y límites

| Servicio | Uso | Plan | Límites relevantes |
|---|---|---|---|
| Supabase | Auth, Postgres, Edge Functions, Storage (fotos de comidas) | Free | 500 MB de base de datos, 1 GB de archivos (cada foto pesa unos 200 a 700 KB), 5 GB de egreso, 50.000 usuarios activos al mes. **El proyecto se pausa tras 1 semana sin actividad.** El correo integrado permite 2 mensajes por hora y no sirve para uso real. |
| Cloudflare Pages | Frontend (PWA) | Free | 500 compilaciones al mes, 20 min por compilación; ancho de banda estático sin límite documentado. |
| Brevo | Correo transaccional (SMTP) | Free | Alrededor de 300 correos por día (confirmar la cuota vigente). |
| Cloudflare Turnstile | Captcha en registro y recuperación | Free | Sin costo. |

## 1. Supabase (producción)

1. Crear el proyecto en <https://supabase.com/dashboard> (región cercana a ti).
2. Enlazar la CLI: `npx supabase login` y `npx supabase link --project-ref <ref>`.
3. Aplicar el esquema: `npx supabase db push`. **No** se aplica `seed.sql` (es solo local).
4. Replicar en el panel (**Authentication**) la configuración de `supabase/config.toml`, porque el panel no la toma del archivo:
   - **Sign In / Providers → Email**: dejar activo el ingreso con correo y contraseña; **desactivar** "Confirm email" (la confirmación es propia y no bloqueante).
   - **Sign In / Providers**: **desactivar "Allow new users to sign up"** (las cuentas se crean solo con la función `register`).
   - **Password**: longitud mínima **10**.
   - **Rate limits**: "Sign-ups and sign-ins" en **10** cada 5 minutos por IP.
   - **Captcha protection**: **desactivada** (Turnstile se verifica dentro de las funciones).
   - **URL Configuration**: *Site URL* = la URL de Cloudflare Pages; agregarla también a *Redirect URLs*.
   - **SMTP Settings**: activar SMTP propio con los datos de Brevo (ver `supabase/README.md`); es lo que usa Auth para el correo de recuperación.
5. Cargar los secretos de las funciones (no se muestran ni se guardan en el repositorio):

   ```powershell
   npx supabase secrets set --env-file supabase/.env
   npx supabase secrets set SITE_URL=https://<tu-sitio>.pages.dev ALLOWED_ORIGINS=https://<tu-sitio>.pages.dev FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1
   ```

6. Publicar las funciones: `npx supabase functions deploy`. Esto incluye `meal-photo` (spec 003), que **no** usa la verificación automática de JWT (`verify_jwt = false` en `config.toml`: verifica el token ella misma). Comprobar en el panel (Edge Functions → `meal-photo`) que *Verify JWT* quedó apagado; si no, el preflight de CORS del navegador falla.
7. **Fotos de comidas (spec 003):** el bucket `meal-photos` lo crea la migración `20261019000900_meal_photos_storage.sql` al hacer `db push`. Comprobar en el panel (Storage) que existe, que es **privado** (sin «Public bucket»), de 3 MiB y que solo admite `image/jpeg`. No hay que crear políticas a mano. La función `meal-photo` usa la clave de servicio que Supabase le inyecta (`SUPABASE_SERVICE_ROLE_KEY`): no hay que cargarla como secreto ni ponerla en ningún archivo del repositorio. `ALLOWED_ORIGINS` (paso 5) debe incluir el dominio de producción, o la función responde `forbidden_origin`.

## 2. Turnstile

En el panel de Cloudflare → Turnstile, editar el widget de MyGuide y agregar el dominio de producción a *Hostnames*. La *Site key* va en el frontend; la *Secret key* solo en `supabase/.env`.

## 3. Cloudflare Pages (frontend)

1. Conectar el repositorio de GitHub.
2. Configuración de compilación:
   - **Root directory**: `app`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node**: versión 24 (variable `NODE_VERSION=24`)
3. Variables de entorno (**solo públicas**):
   - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = la clave *anon* / *publishable* (Settings → API)
   - `VITE_TURNSTILE_SITE_KEY` = la *Site key* real
4. **Nunca** poner aquí la clave de servicio, las credenciales SMTP ni la *Secret key* de Turnstile.

## 4. Verificación posterior al despliegue

Ejecutar los escenarios críticos del [`quickstart.md`](../specs/001-cuentas-perfil-pwa/quickstart.md) en producción: registro con aviso de privacidad (1, 2), confirmación de correo (2), recuperación (3, 4), aislamiento entre cuentas (7, 8), instalación como PWA y mensaje sin conexión (14), y revisar el bundle con `npm run check:secrets --prefix app`.

Para la spec 003, en producción: agregar una comida, ver el día, adjuntar una foto desde el teléfono y comprobar que se muestra, y que la dirección de la foto abierta en una ventana privada (sin sesión) no la muestra. Son los escenarios 1, 22, 23 y 26 de [`specs/003-registro-de-comidas/quickstart.md`](../specs/003-registro-de-comidas/quickstart.md).

## Operación

### Si Supabase pausa el proyecto por inactividad

El plan gratuito pausa los proyectos tras una semana sin actividad. Con uso diario no ocurre. Si pasa: abrir el panel de Supabase y pulsar **Restore project**; los datos se conservan. Mientras esté pausado la aplicación muestra errores de carga.

### Deuda documentada

- **Eliminar una cuenta no borra sus fotos (spec 003, Principio I):** las filas de `meal_photos` se borran en cascada, pero los archivos de `meal-photos/<user_id>/` quedan en Storage. Cuando se construya la eliminación de cuentas, debe borrarlos con la API de Storage antes de borrar la cuenta. Ver `supabase/README.md`.
- **Retención de logs (Principio IX):** aún no hay un plazo definido para los registros de las Edge Functions. Hasta la spec 011 rige el plazo por defecto del proveedor. Los registros no contienen correos, tokens ni contraseñas (los depura `functions/_shared/log.ts`).
- **Bloqueo por cuenta en el inicio de sesión:** solo hay límite por IP; el bloqueo por cuenta requiere un plan superior.
- **Confirmación de correo no bloqueante:** reevaluar si pasa a ser obligatoria antes de abrir la aplicación a otras personas. El registro es abierto, por lo que la **spec 011 es obligatoria** antes de publicar.

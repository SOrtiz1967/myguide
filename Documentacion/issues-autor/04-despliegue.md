# Despliegue inicial en producción (Supabase + Cloudflare Pages)

**Spec 001, tarea T077.** Publicar la app para usarla desde el teléfono. Todo con planes gratuitos. Conviene hacerlo **después** del issue 03 (correo real).

**Tiempo estimado:** 45 a 60 minutos la primera vez.

**Guía paso a paso:** [`Documentacion/despliegue.md`](../despliegue.md). Resumen:

## 1. Supabase (base de datos, cuentas y funciones)

1. Crear el proyecto en <https://supabase.com/dashboard> (región más cercana: São Paulo).
2. Vincular y aplicar las migraciones (incluye las de la spec 002):
   ```powershell
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```
3. Cargar los secretos de las funciones (correo de Brevo y Turnstile) y desplegarlas. Ver la guía.
4. En Authentication → URL Configuration, poner la dirección pública del sitio.

## 2. Turnstile

Agregar el dominio del sitio de Cloudflare Pages a la lista de dominios permitidos del widget.

## 3. Cloudflare Pages (la app)

1. Conectar el repositorio de GitHub (requiere el issue 01).
2. Configuración de compilación: carpeta `app`, comando `npm run build`, salida `dist`.
3. Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y la clave **pública** de Turnstile. **Nunca** la clave `service_role`.

## 4. Verificación

- [ ] Registrarse, confirmar el correo y entrar desde el teléfono.
- [ ] Instalar la app (Agregar a pantalla de inicio).
- [ ] Completar el perfil.
- [ ] Abrir `/alimentos`: debe funcionar, aunque el catálogo esté vacío hasta el issue 05.
- [ ] Avisarme el resultado para registrarlo y cerrar T077.

**Ojo:** el plan gratuito de Supabase pausa el proyecto después de una semana sin uso. Cómo reactivarlo: sección "Operación" de la guía.

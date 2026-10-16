# Research: Cuentas, perfil y base de la PWA

**Feature**: 001-cuentas-perfil-pwa | **Fecha**: 2026-10-16

Resuelve las decisiones técnicas pendientes #1 (framework y despliegue) y #2 (backend, autenticación, base de datos, almacenamiento) de la Constitution. Las decisiones #3 al #9 no se tocan aquí.

Criterio rector fijado por el autor: **que el sistema completo pueda hostearse gratis**, con el menor código propio posible.

## Decisión 1: Stack general

- **Decisión**: SPA con **Vite + React + TypeScript** como PWA, desplegada en **Cloudflare Pages**; backend gestionado con **Supabase** (Auth, Postgres con RLS, Storage privado, Edge Functions).
- **Razón**:
  - El aislamiento entre cuentas (Principio I, FR-009 a FR-012) se hace cumplir **en la base de datos** con políticas RLS, no solo en código de aplicación. Un error en el frontend o en una función no abre datos ajenos.
  - Auth con sesiones, recuperación de contraseña y límites de intentos ya resueltos, lo que reduce la superficie de seguridad que hay que escribir y mantener.
  - Storage privado con URLs firmadas y Edge Functions para secretos e IA cubren las specs 008 y 009 sin cambiar de plataforma.
  - Postgres estándar: los datos y las migraciones son portables si se abandona Supabase.
  - Desarrollo local completo con Docker (ya instalado), por lo que las pruebas de permisos corren sin tocar la nube.
- **Alternativas evaluadas**:
  - *Next.js + Postgres administrado + Better Auth*: más control, pero hay que construir y mantener sesiones, correos y validación de propiedad; el soporte de PWA es menos directo; el hosting gratuito de funciones server-side es más frágil.
  - *Vite + API Node propia*: máxima portabilidad, pero requiere hostear un servidor siempre activo (no hay opción gratuita fiable) y agrega la mayor superficie de seguridad.
  - *Todo en Cloudflare (Pages + Workers + D1 + R2)*: hosting gratis muy generoso, pero hay que escribir la autenticación completa; descartado por el costo de desarrollo y el riesgo de seguridad.

## Decisión 2: Hosting gratuito y sus límites

Datos verificados el 2026-10-16 en fuentes públicas; **confirmar en las páginas oficiales antes de depender de ellos**.

| Servicio | Plan | Límites relevantes | Impacto en el MVP |
|---|---|---|---|
| Supabase | Free | 500 MB de base de datos, 1 GB de archivos, 5 GB de egreso, 50.000 usuarios activos al mes, 2 proyectos activos | Suficiente para uso personal. El almacenamiento de 1 GB obliga a comprimir fotos (spec 008) y a filtrar los catálogos importados (specs 002 y 005). |
| Supabase | Free | **El proyecto se pausa tras 1 semana sin actividad** | Con uso diario no ocurre. Si se pausa, se reactiva desde el panel. Documentar el procedimiento; evaluar un ping programado si se vuelve un problema. |
| Supabase | Free | Servicio de correo integrado: **2 mensajes por hora**, sin garantía de entrega, solo para pruebas | **No sirve** para confirmación ni recuperación reales. Hace falta SMTP propio (ver Decisión 5). |
| Cloudflare Pages | Free | 500 builds al mes, 1 build simultáneo, 20 min por build; ancho de banda de contenido estático sin límite documentado | Más que suficiente. |

- **Riesgo**: los límites y planes gratuitos cambian. Mitigación: ninguna decisión de código depende de ellos; solo el despliegue.

## Decisión 3: Confirmación de correo no bloqueante (FR-004, FR-026, FR-027)

- **Hallazgo**: Supabase Auth ofrece confirmación de correo **bloqueante** (no deja iniciar sesión hasta confirmar) o ninguna. No existe el modo "entra de inmediato pero con recordatorio" que eligió el autor en la clarificación.
- **Decisión**: mantener la confirmación de Supabase **desactivada** e implementar la confirmación propia:
  - Tabla `email_verification_tokens` (solo accesible con la clave de servicio) y columna `profiles.email_verified_at`.
  - Edge Function `send-verification` (autenticada, con límite de frecuencia por usuario) y Edge Function `confirm-email` (abierta, valida el token de un solo uso y que no venció).
  - Bloqueo de recuperación para correos sin confirmar (FR-027): la interfaz usa siempre la Edge Function `request-password-reset` (ver Decisión 6). Como refuerzo opcional, se evalúa un **Auth Hook de envío de correo** que descarte la recuperación si `email_verified_at` es nulo, para cubrir también las llamadas directas al endpoint nativo.
- **Residual aceptado**: sin el hook, quien llame directamente a la API de Supabase podría pedir un correo de recuperación para una cuenta no confirmada. El correo llega al dueño real de esa dirección, no a quien lo pidió, por lo que no abre acceso; solo contradice el texto de FR-027. Queda documentado y se verifica en el prototipo.
- **Alternativa evaluada**: usar la confirmación bloqueante nativa (mucho menos código). Se descartó porque contradice la decisión explícita del autor. Si el costo de la lógica propia resulta alto en la implementación, esta es la alternativa a reconsiderar con el autor.

## Decisión 4: Vencimiento de sesión por inactividad de 30 días (FR-003)

- **Hallazgo**: el límite de inactividad de sesiones de Supabase es una función del plan de pago. En el plan gratuito, el token de renovación no vence por inactividad.
- **Decisión**: aplicarlo en la base de datos:
  - `profiles.last_active_at`, actualizado por la función `touch_session()` al abrir la aplicación y al renovar el token.
  - Una función auxiliar `private.is_session_fresh()` usada por **todas** las políticas RLS: si pasaron más de 30 días sin actividad, el token deja de dar acceso a datos.
  - `start_session()` reinicia el contador, y solo se acepta si el token proviene de un inicio de sesión con contraseña muy reciente (el campo `amr` del JWT registra el método y la hora). Así un token de renovación robado y vencido no puede revivir la sesión.
- **Riesgo técnico #1**: depende de que `amr` esté disponible y confiable en el JWT. **Es lo primero que se prototipa y se prueba** (tarea inicial). **Respaldo**: aplicar el vencimiento solo en el cliente (cierra sesión local) y documentar la limitación.

## Decisión 5: Correo transaccional

- **Decisión**: SMTP externo gratuito, configurable por variables de entorno, detrás de una interfaz mínima. Candidato: **Brevo** (plan gratuito con unos 300 correos diarios y remitente verificable sin dominio propio). Alternativa: Resend, que exige verificar un dominio propio para enviar a terceros.
- **Validar antes de implementar**: cuota vigente del plan gratuito, y que el remitente sin dominio propio no caiga en la carpeta de spam.
- **Tope de uso**: límites de envío por usuario y por IP para proteger la cuota gratuita.

## Decisión 6: Contraseñas, intentos y abuso (FR-002, FR-006, FR-008)

- **Contraseñas**: mínimo **10 caracteres**, sin reglas de composición obligatorias (criterio vigente del NIST), máximo 72. Validación en el cliente y configuración equivalente en Auth.
- **Intentos fallidos (FR-006)**: solo el **límite por IP nativo de Auth**, ajustado al valor más estricto razonable (valor concreto fijado y documentado en `supabase/config.toml` en la tarea T005). **No hay bloqueo por cuenta**: el endpoint de autenticación de Supabase es público y la clave `anon` va en el bundle, por lo que cualquier contador propio se podría evitar llamando al endpoint directo. El bloqueo por cuenta nativo (hook de verificación de contraseña) es de plan de pago; queda como mejora futura. Decisión del autor tras evaluar tres opciones (solo IP, contraseña con pepper, contador de mejor esfuerzo).
- **Captcha (FR-008)**: **Cloudflare Turnstile** (gratuito) **solo en registro y recuperación**; el inicio de sesión no lo usa para no depender de un servicio externo (FR-025). El captcha nativo de Supabase se activa en todos los endpoints a la vez (a confirmar en el prototipo T007), por lo que se deja **desactivado** y el token se verifica en las Edge Functions `register` y `request-password-reset`. Si Turnstile no responde, la operación se bloquea con un aviso claro (el inicio de sesión no se afecta).
- **Registro por función**: con el registro nativo desactivado (`enable_signup = false`), `register` valida Turnstile, rechaza versiones del aviso de privacidad no vigentes, detecta el correo repetido (`409` con mensaje claro, Decisión 10) y crea la cuenta con la API de administración (`email_confirm: true`, porque la confirmación propia no es bloqueante). El cliente inicia sesión después con la contraseña.
- **Recuperación por función**: `request-password-reset` valida Turnstile, comprueba que el correo esté confirmado y recién entonces dispara la recuperación de Auth; responde siempre igual. **Residual**: el endpoint nativo `/recover` sigue accesible con la clave pública; queda protegido solo por el límite por IP y el correo llega al dueño real de la cuenta. Se documenta y se evalúa con el Auth Hook de envío (T008).
- **Aviso**: la verificación contra contraseñas filtradas es una función de pago; no se usa. Se acepta la limitación.

## Decisión 7: Frontend

- **Decisión**: React + TypeScript estricto, **React Router** para rutas, **TanStack Query** para estado de servidor, **React Hook Form + Zod** para formularios y validación, **Tailwind CSS** con elementos HTML nativos para accesibilidad, **vite-plugin-pwa** configurado solo para la carcasa de la aplicación (sin caché de datos ni cola de sincronización).
- **Pruebas**: Vitest + Testing Library (unidad y componentes), Playwright (extremo a extremo y PWA sin conexión), pgTAP vía `supabase test db` (permisos RLS).
- **Calidad**: ESLint, Prettier, `tsc --noEmit` (Principio VIII).
- **Sin librería de internacionalización**: la interfaz es solo en español (Principio VI); los textos viven en módulos centralizados para poder externalizarlos luego.
- **Alternativa evaluada**: librerías de componentes (shadcn/Radix, MUI). Se posponen: se evitan dependencias innecesarias (Principio VII) y se reevalúa si la accesibilidad de componentes complejos lo exige.

## Decisión 8: Borradores locales (FR-021, FR-022)

- **Decisión**: `localStorage` con clave `draft:v1:<userId>:<formId>`, versión de esquema en la clave, serialización validada con Zod al restaurar. Se borra al confirmar el servidor y **todo** el espacio `draft:*` se elimina al cerrar sesión o al caducar la sesión.
- **Datos sensibles**: los borradores de perfil contienen datos personales; por eso la limpieza al cerrar sesión es un requisito verificable, no una conveniencia.

## Decisión 9: PWA sin conexión (FR-018 a FR-020)

- **Decisión**: el service worker solo precachea la carcasa (HTML, JS, CSS, íconos) y sirve una página `offline` cuando falla la red en navegaciones. **No** intercepta ni cachea llamadas de datos. La interfaz detecta fallos de red en cada escritura y muestra el error sin marcar nada como guardado.
- **Pruebas**: Playwright con la red simulada como caída.

## Decisión 10: Registro duplicado y enumeración de correos (FR-005)

- **Hallazgo**: como la cuenta se puede usar de inmediato, el registro con un correo ya existente tiene que responder algo distinto del éxito; esto permite deducir qué correos tienen cuenta. Es inherente a cualquier alta con acceso inmediato.
- **Decisión del autor**: mensaje claro "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña" (respuesta `409` de `register`). Revela que el correo existe. **Residual aceptado** para el MVP, mitigado por Turnstile y límite por IP; coherente con reevaluar la confirmación obligatoria antes de publicar.
- **Inicio de sesión y recuperación** sí cumplen FR-005 completamente (mensajes uniformes). El registro es la única excepción, documentada en la spec.

## Decisión 11: Idempotencia de alta (FR-007)

- **Decisión**: la unicidad del correo la garantiza Auth; la interfaz deshabilita el envío mientras hay una solicitud en curso, y un reintento de red sobre un alta ya hecha recibe el `409` de la Decisión 10 (la cuenta sigue siendo una sola). La creación de `profiles` es idempotente (`ON CONFLICT DO NOTHING` en el disparador).

## Decisión 12: Fallos de servicios externos (Principio VII)

- **Correo (SMTP)**: si el envío falla, la cuenta se crea igual y es utilizable; la interfaz informa que el correo no pudo enviarse y ofrece reintentar. El fallo se registra con causa técnica (`smtp_timeout`, `smtp_rejected`, etc.) sin correos ni tokens. Hay un tiempo de espera explícito y un máximo de reintentos por solicitud.
- **Turnstile**: si no responde o devuelve un error del servicio (no un rechazo del usuario), registro y recuperación se bloquean con un aviso claro para reintentar. El inicio de sesión no se afecta.
- **Límite de cuota del SMTP gratuito**: se trata como un fallo del proveedor; se informa y se registra, sin descartar la operación principal.
- **Pruebas**: simulacros de cada fallo (tiempo de espera, rechazo, respuesta malformada) en las pruebas de las Edge Functions.

## Decisión 13: El correo no se puede cambiar (FR-028)

- **Hallazgo**: no está verificado que Supabase permita deshabilitar `updateUser({ email })` por configuración.
- **Decisión**: no confiar en un interruptor. Se agrega una **barrera en la base de datos** (disparador `before update` sobre `auth.users` que rechaza cambios de `email` hechos por roles distintos del administrador) y una prueba pgTAP que intenta el cambio como usuario autenticado. Se confirma en el prototipo T007.

## Decisión 14: Versión del aviso de privacidad (FR-029)

- **Decisión**: las versiones vigentes viven en una tabla de solo lectura `private.privacy_notice_versions`; `register` y el disparador de alta rechazan cualquier versión que no figure como vigente.

## Preguntas abiertas para fases posteriores

- Confirmar disponibilidad del Auth Hook de correo en el plan gratuito (Decisión 3).
- Confirmar `amr` en el JWT y el comportamiento de renovación (Decisión 4).
- Confirmar cuota y entregabilidad del SMTP gratuito (Decisión 5).
- Cómo se evita que Supabase Free pause el proyecto si el uso baja (Decisión 2).

# Verificación de la spec 001

**Fecha:** 2026-10-17 · **Entorno:** Supabase local (CLI 2.121.0), Chromium (Playwright 1.64.1), correo al buzón local de pruebas.

## Resultado de los comandos (T080)

| Comando | Resultado |
|---|---|
| `npm run format:check --prefix app` | ✅ |
| `npm run lint --prefix app` | ✅ sin advertencias |
| `npm run typecheck --prefix app` | ✅ |
| `npm test --prefix app` (unidad y componentes) | ✅ 145 pruebas |
| `npm run test:db` (pgTAP) | ✅ 82 pruebas |
| `npm run test:functions` (Deno) | ✅ 73 pruebas |
| `npm run test:config` | ✅ 9 pruebas |
| `npm run check:secrets --prefix app` | ✅ 214 archivos del repositorio y el bundle, sin secretos |
| `npm run e2e --prefix app` | ✅ 46 pruebas (ver nota) |

**Nota sobre la suite de extremo a extremo:** una corrida completa de una sola vez fue interrumpida por el sistema por falta de memoria. Las 46 pruebas se ejecutaron en varias corridas con todas las especificaciones (`auth`, `access`, `profile`, `a11y`, `responsive`, `pwa-install`, `pwa-offline`) en verde. Las fallas intermedias que aparecieron (mensaje de guardado, ARIA del captcha, selectores ambiguos) están corregidas y repetidas.

## Escenarios del `quickstart.md` (T078)

| # | Escenario | Verificado con |
|---|---|---|
| 1 | Registro sin marcar el aviso | e2e `auth.spec` |
| 2 | Alta con datos válidos, banner de correo sin confirmar | e2e `auth.spec` |
| 3 | Recuperación con correo sin confirmar: sin correo | e2e `auth.spec` + Deno |
| 4 | Confirmar y recuperar; se cierran todas las sesiones | e2e `auth.spec` |
| 5 | Contraseña errónea y correo inexistente: mismo mensaje | e2e `auth.spec` |
| 6 | Cambio de contraseña cierra las otras sesiones | e2e `auth.spec` |
| 7 | Aislamiento entre cuentas | e2e `access.spec` (API real) + pgTAP |
| 8 | Sin sesión: redirige y no pide datos | e2e `access.spec` + componente |
| 9 | Completar el perfil y recargar | e2e `profile.spec` |
| 10 | Sexo sin informar | e2e `profile.spec` + pgTAP |
| 11 | Zona horaria: propone, no cambia sola | e2e `profile.spec` |
| 12 | Recargar con un borrador | e2e `profile.spec` |
| 13 | Cerrar sesión purga los borradores | e2e `profile.spec` + componente |
| 14 | Sin conexión: aviso y nada se da por guardado | e2e `pwa-offline.spec` |
| 15 | 31 días de inactividad | e2e `access.spec` + pgTAP |
| 16 | Doble clic en "Crear cuenta" | e2e `auth.spec` |
| 17 | Sin secretos en bundle y repositorio | `check:secrets` |
| 18 | Correo repetido | e2e `auth.spec` + Deno |
| 19 | Turnstile no disponible | Deno (`register`, `request-password-reset`) + componente |
| 20 | Falla el proveedor de correo | Deno + prueba de humo con el servidor real |
| 21 | Cambiar el correo desde el cliente | pgTAP `email_immutable` + prueba de humo |
| 22 | Límite de intentos por IP | `config.test.ts` (configuración); el contador lo aplica Supabase Auth |
| 23 | Versión del aviso no vigente | Deno + pgTAP + prueba de humo |

**Criterios de éxito:** SC-003 (aislamiento 100 %), SC-005 (borradores), SC-006 (sin conexión), SC-007 (teléfono y escritorio), SC-008 (instalable), SC-009 (una sola cuenta) verificados con las pruebas anteriores. SC-001/SC-002/SC-004 (tiempos de uso) son de experiencia de usuario y se miden con uso real. La carga de la carcasa se midió: **menos de 3 s con 4G simulado**.

## Revisión de seguridad (T079)

Revisión dirigida del cambio completo (la skill `security-review` exige un remoto `origin` que este repositorio aún no tiene).

| Área | Resultado |
|---|---|
| Secretos en el frontend | ✅ Ninguna clave de servicio, SMTP ni de Turnstile; el entorno rechaza variables `VITE_*` con aspecto de secreto (probado). |
| Inyección en la interfaz | ✅ Sin `innerHTML`, `dangerouslySetInnerHTML`, `eval` ni `document.write`. El HTML del correo escapa el enlace (probado). |
| Autorización | ✅ RLS en toda tabla de `public` con guardián automático; privilegios por columna; `anon` sin acceso; sesión vencida sin acceso; probado con dos cuentas contra la API real. |
| Funciones `security definer` | ✅ Las 11 fijan `search_path = ''`; ninguna es ejecutable por `public`, `anon` ni `authenticated` salvo las de sesión, que solo actúan sobre `auth.uid()`. |
| Tokens de confirmación | ✅ 256 bits, solo se guarda el hash, un solo uso atómico, vencen a las 24 h, no distinguen la causa del fallo. |
| Enumeración de correos | ✅ Ingreso y recuperación uniformes. **Corregido:** la recuperación ya no tarda más cuando la cuenta existe (el envío va en segundo plano). Residual aceptado por el autor: el registro revela que un correo existe. |
| Límite de solicitudes | ✅ **Corregido:** el límite por IP tomaba la primera entrada de `X-Forwarded-For`, que el cliente puede inventar. Ahora usa `cf-connecting-ip` y, si no, la última entrada. |
| Cambio de correo | ✅ Barrera en la base de datos (el cliente podía iniciarlo con `updateUser`). |
| CORS y funciones públicas | ✅ Origen permitido por configuración; solo `register`, `request-password-reset` y `confirm-email` se abren sin sesión, verificado por `config.test.ts`. |
| Registros técnicos | ✅ El registrador elimina correos, tokens y claves; los fallos se registran por causa. |
| PWA | ✅ El service worker no registra rutas de datos y la prueba confirma que el caché solo contiene la propia aplicación. |

### Riesgos residuales (documentados)

1. Solo hay límite de intentos de inicio de sesión por IP; el bloqueo por cuenta requiere un plan de Supabase superior.
2. El endpoint nativo de recuperación sigue accesible con la clave pública (protegido solo por el límite por IP); el correo llega al dueño real. Un Auth Hook de envío (T031) lo cerraría.
3. El registro con un correo existente revela su existencia (decisión del autor para el MVP).
4. La confirmación de correo no es bloqueante: reevaluar antes de publicar. Con registro abierto, la spec 011 es obligatoria.
5. Sin plazo de retención de logs definido (spec 011).
6. La entregabilidad del correo real (Brevo) está sin probar (T009).

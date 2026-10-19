# Probar el envío real de correos con Brevo

**Spec 001, tarea T009.** En desarrollo los correos (confirmar la cuenta, recuperar la contraseña) llegan a un buzón local de pruebas. Antes de publicar la app hay que confirmar que Brevo los entrega de verdad y que no caen en spam. Las cuentas de Brevo y Turnstile ya están creadas y `supabase/.env` está completo.

**Tiempo estimado:** 15 minutos.

## Pasos

1. Levantar el entorno con el correo **real** (usa `supabase/.env` en lugar de `.env.local`):
   ```powershell
   npx supabase start
   npx supabase functions serve --env-file supabase/.env
   npm run dev --prefix app
   ```
2. En <http://localhost:5173/registro>, crear una cuenta con **un correo tuyo real** (por ejemplo Gmail).
3. Revisar:
   - [ ] ¿Llegó el correo de confirmación? ¿En cuánto tiempo?
   - [ ] ¿Llegó a la bandeja de entrada o a spam?
   - [ ] ¿El remitente y el asunto se ven bien, en español?
   - [ ] ¿El enlace de confirmación funciona?
4. Probar también "¿Olvidaste tu contraseña?" con ese mismo correo (ya confirmado).
5. En el panel de Brevo, anotar la **cuota diaria gratuita vigente** (Usage / Plan).
6. Volver a la configuración de desarrollo: detener `functions serve` y volver a levantarlo con `--env-file supabase/.env.local`.

## Si cae en spam

En Brevo: Senders, Domains & Dedicated IPs → autenticar el dominio del remitente (registros SPF y DKIM). Sin un dominio propio, Gmail suele marcar como spam a los remitentes nuevos; es normal y se anota como riesgo.

## Listo cuando

- [ ] Me pasás los resultados (llegó sí/no, bandeja o spam, demora, cuota) y yo los registro en `specs/001-cuentas-perfil-pwa/research.md` y cierro T009.

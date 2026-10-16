# Quickstart: validar la spec 001

**Feature**: 001-cuentas-perfil-pwa

Guía para levantar el entorno y comprobar de punta a punta que la spec funciona. Los detalles de datos están en `data-model.md` y los de interfaz en `contracts/`.

## Requisitos previos

- Node.js 24 o superior y npm
- Docker Desktop en ejecución (para Supabase local)
- Supabase CLI (se usa con `npx supabase`, sin instalación global)

## Puesta en marcha

```powershell
npm install --prefix app
npx supabase start          # base de datos, Auth y Storage locales; incluye un buzón de correo de pruebas
copy app\.env.example app\.env.local   # completar con las URLs y claves locales que imprime el comando anterior
npm run dev --prefix app
```

El buzón de correo local de Supabase recibe los correos de confirmación y recuperación; no se envía nada real en desarrollo.

## Comandos de verificación (Principio VIII)

```powershell
npm run format:check --prefix app
npm run lint --prefix app
npm run typecheck --prefix app
npm test --prefix app          # unidad y componentes
npx supabase test db           # permisos RLS y funciones de sesión
npm run e2e --prefix app       # flujos de punta a punta y modo sin conexión
```

## Escenarios de validación

| # | Escenario | Historia | Resultado esperado |
|---|---|---|---|
| 1 | Registrarse sin marcar el aviso de privacidad | 1 | El alta no se envía y se indica el motivo |
| 2 | Registrarse con datos válidos y aviso aceptado | 1 | Cuenta creada, sesión iniciada, banner de correo sin confirmar |
| 3 | Pedir recuperación con el correo sin confirmar | 1 | Respuesta neutral y **ningún correo** en el buzón local |
| 4 | Confirmar el correo desde el enlace del buzón local y pedir recuperación | 1 | Llega el correo de recuperación; al usarlo se fija la contraseña y se cierran todas las sesiones |
| 5 | Iniciar sesión con contraseña errónea y con correo inexistente | 1 | El mismo mensaje en ambos casos |
| 6 | Cambiar la contraseña desde el perfil con otra sesión abierta | 1 | La otra sesión queda cerrada; la actual sigue |
| 7 | Cuenta A intenta leer o modificar el perfil de la cuenta B | 2 | Rechazado sin revelar información (prueba pgTAP) |
| 8 | Llamar a la API sin sesión | 2 | Sin datos; la interfaz redirige a ingresar |
| 9 | Completar el perfil y recargar | 3 | Valores persistidos con su unidad (cm) |
| 10 | Dejar el sexo sin informar | 3 | Se guarda como no informado |
| 11 | Zona horaria del dispositivo distinta de la guardada | 3 | Se ofrece cambiarla; no cambia sola |
| 12 | Escribir en el perfil, recargar la pestaña | 4 | El borrador se recupera |
| 13 | Cerrar sesión con un borrador pendiente | 4 | No queda ningún `draft:*` en el navegador |
| 14 | Abrir la aplicación instalada sin conexión e intentar guardar | 4 | Mensaje de no disponible; nada se muestra como guardado |
| 15 | Simular 31 días de inactividad (ajustando `last_active_at`) | 1, 2 | La sesión no da acceso a datos y pide ingresar de nuevo |
| 16 | Doble clic en "Crear cuenta" | 1 | Una sola cuenta |
| 17 | Revisar el bundle del frontend y el repositorio | — | Sin secretos (clave de servicio, SMTP, secreto de Turnstile) |
| 18 | Registrarse con un correo que ya tiene cuenta | 1 | Mensaje "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña"; no se crea otra cuenta |
| 19 | Simular que Turnstile no responde al registrarse y al pedir recuperación | 1 | La operación se bloquea con aviso para reintentar; el inicio de sesión sigue funcionando |
| 20 | Simular que el proveedor de correo falla al registrarse | 1 | La cuenta se crea y se usa; aviso de que el correo no salió, con opción de reintentar; el fallo se registra sin datos personales |
| 21 | Intentar cambiar el correo con `updateUser({ email })` estando autenticado | 1 | Rechazado; el correo no cambia |
| 22 | Superar el límite de intentos de inicio de sesión desde una IP | 1 | Los intentos siguientes se rechazan temporalmente con el mismo mensaje uniforme |
| 23 | Registrarse con una versión del aviso de privacidad no vigente | 1 | Rechazado |

## Criterio de terminado

Todos los comandos de verificación pasan y los 23 escenarios se cumplen. Las pruebas automatizadas referencian el requisito o escenario que verifican (Principio VIII).

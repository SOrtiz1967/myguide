# Contrato: rutas y estados de la interfaz

**Feature**: 001-cuentas-perfil-pwa

Toda la interfaz está en español. Cada pantalla define sus cuatro estados (FR-023); "vacío" aplica solo donde hay contenido que mostrar.

## Rutas

| Ruta | Acceso | Propósito | Historia |
|---|---|---|---|
| `/registro` | pública | crear cuenta: correo, contraseña, aviso de privacidad con casilla obligatoria, Turnstile | 1 |
| `/ingresar` | pública | iniciar sesión | 1 |
| `/recuperar` | pública | solicitar recuperación (respuesta neutral) | 1 |
| `/restablecer` | enlace de recuperación | fijar contraseña nueva | 1 |
| `/correo-confirmado` | pública | resultado de confirmar el correo | 1 |
| `/correo-no-valido` | pública | enlace vencido o usado; ofrece reenviar si hay sesión | 1 |
| `/` | privada | inicio; guía a completar el perfil si está incompleto | 3 |
| `/perfil` | privada | ver y editar perfil; cambiar contraseña | 1, 3 |
| `/sin-conexion` | pública (carcasa) | mensaje de no disponibilidad sin conexión | 4 |

Una ruta privada sin sesión redirige a `/ingresar` sin cargar datos. Una sesión vencida muestra `/ingresar` con un aviso, conservando los borradores hasta el cierre de sesión explícito o la caducidad (ver `research.md`, Decisión 8).

## Estados por pantalla

| Pantalla | Carga | Vacío | Éxito | Error |
|---|---|---|---|---|
| Registro / Ingreso / Recuperar | botón deshabilitado con indicador | n/a | entra a la app, o mensaje neutral de recuperación | mensaje claro por campo; error uniforme de credenciales; límite de intentos |
| Perfil | esqueleto de carga | perfil sin completar, con explicación de qué falta | "Perfil guardado" | errores de validación por campo; fallo de red con el borrador conservado |
| Cambio de contraseña | botón deshabilitado | n/a | "Contraseña actualizada; cerramos tus otras sesiones" | contraseña actual incorrecta; contraseña nueva inválida |
| Recordatorio de correo sin confirmar | n/a | se oculta cuando está confirmado | "Te enviamos el enlace" | límite de reenvío alcanzado |

## Componentes transversales

- **Aviso sin conexión**: visible cuando falla la red; nunca muestra un dato como guardado si no llegó al servidor (FR-020).
- **Recordatorio de correo sin confirmar**: banner persistente con "Reenviar enlace" (FR-026).
- **Zona horaria**: si la del dispositivo difiere de la guardada, se ofrece cambiarla; nunca se cambia sin confirmación (FR-016).
- **Formularios**: borrador local con restauración visible ("Recuperamos lo que estabas escribiendo") y botón para descartarlo.

## Accesibilidad (FR-024)

- Todos los controles con etiqueta asociada; errores vinculados a su campo y anunciados.
- Navegación completa por teclado; foco visible y orden lógico.
- Verificación automática con axe en las pantallas principales.

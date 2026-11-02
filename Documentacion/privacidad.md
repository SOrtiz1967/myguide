# Privacidad y ciclo de vida de los datos

Política operativa de MyGuide (spec 011). Resume qué datos se guardan, quién los trata, cuánto se conservan y cómo se exportan y eliminan. La pantalla `/privacidad` («Tus datos») muestra lo esencial de este documento a cada persona.

Este documento describe el comportamiento del producto. **No es asesoramiento legal**: antes de abrir la aplicación a otras personas, el autor debe revisarlo con quien corresponda según su jurisdicción.

## Qué datos se guardan

| Dato                                                                                        | Dónde                                            | Quién lo puede ver                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| Correo, contraseña (solo su huella), sesión                                                 | Supabase Auth                                    | Solo la cuenta (la huella, nadie)      |
| Perfil, objetivo, recordatorios                                                             | Base de datos (Supabase)                         | Solo la cuenta                         |
| Comidas, alimentos propios, entrenamientos, rutinas, sueño, actividad, medidas, suplementos | Base de datos (Supabase)                         | Solo la cuenta                         |
| Fotos de comidas y de progreso                                                              | Almacenamiento privado (Supabase), sin metadatos | Solo la cuenta (URL firmada de 10 min) |
| Resultados temporales de la IA                                                              | Base de datos, solo rol de servicio              | Nadie desde la aplicación              |

Toda tabla con datos de una cuenta tiene seguridad por filas: la cuenta solo lee y escribe lo suyo.

## Quién trata los datos

| Servicio             | Para qué                                            | Qué recibe                                                                                            |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Supabase             | Cuenta, base de datos, archivos, funciones          | Todo lo anterior                                                                                      |
| Brevo                | Correos de confirmación y de recuperación           | El correo y el enlace                                                                                 |
| Cloudflare Turnstile | Comprobar que quien se registra es una persona      | Datos técnicos del navegador, sin cuenta                                                              |
| Google Gemini        | Estimar comidas con IA (solo si la persona lo pide) | El texto o la foto de esa comida (sin metadatos); nunca fotos de progreso, medidas ni datos de perfil |
| Cloudflare Pages     | Servir la aplicación                                | Solicitudes HTTP habituales                                                                           |

No hay publicidad, analítica de uso ni venta de datos.

## Retención

| Qué                                          | Plazo                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registros de la persona                      | Hasta que ella los elimine o elimine su cuenta                                                                                                    |
| Resultados temporales de la IA               | 24 horas (se borran al guardar un resultado nuevo)                                                                                                |
| Marcas del límite de uso (`rate_limit_hits`) | 1 día (se borran en cada consulta)                                                                                                                |
| Registros técnicos de las funciones          | Sin datos personales (Principio IX). Los conserva el panel de Supabase: hasta 7 días en el plan gratuito. La aplicación no los copia a otro lugar |
| Copias de seguridad del proveedor            | Lo eliminado puede permanecer en ellas **hasta 30 días** (cota conservadora; **confirmar con el plan contratado**)                                |

Las copias de seguridad no se consultan ni se restauran para recuperar cuentas eliminadas. Si una falla grave obligara a restaurar una copia, lo que ya se eliminó se vuelve a eliminar antes de reabrir el servicio.

## Exportación

Desde `/privacidad` la persona descarga:

- **JSON**: todos los registros de su cuenta (`export_my_data()`), con la fecha de exportación y la versión del formato. Los datos faltantes salen como `null`. No incluye contraseñas, tokens ni el catálogo común.
- **ZIP de fotos**: las fotos de comidas y de progreso, con nombre por fecha.

Se arman en el navegador con los permisos de la persona; el servidor no guarda ninguna exportación. Una prueba (`privacy_lifecycle.test.sql`) falla si una tabla nueva con datos de la cuenta no está en la exportación.

## Eliminación

- **Registros sueltos**: cada pantalla permite eliminar los propios (comidas, medidas, fotos, suplementos, rutinas, sesiones, alimentos y ejercicios propios, etc.).
- **Cuenta completa**: desde `/privacidad`, con la contraseña actual y una frase escrita. La función `delete-account` borra primero los archivos de `meal-photos/<id>/` y `progress-photos/<id>/` y después la cuenta; todas las tablas con `user_id` dependen de la cuenta con borrado en cascada (lo comprueba una prueba). Es definitivo, sin período de gracia. Si falla algo, la cuenta no se elimina a medias y se puede reintentar.

## Monitoreo

El panel de Supabase (registros de funciones, uso de base de datos y almacenamiento) y las alertas por correo del proveedor. No se agrega una herramienta externa. Los registros estructurados de las funciones incluyen el resultado, la duración y el motivo de cada fallo, y nunca datos personales, textos de comidas, correos, contraseñas ni rutas de archivos.

## Aviso de privacidad versionado

El registro muestra un resumen y guarda la versión aceptada (`profiles.privacy_notice_version`). La versión vigente es `2026-11-01`. Un cambio que altere el uso de los datos exige una versión nueva y volver a pedir la aceptación.

## Pendientes del autor antes de publicar

- Confirmar el plazo real de las copias de seguridad y de los registros del plan de Supabase contratado y ajustar los números de este documento y de `app/src/copy/es.ts` (`es.privacy`).
- Revisión legal del aviso y de la licencia de los datos importados (ver `fuentes-datos.md`).
- Decidir si la confirmación de correo pasa a ser obligatoria al abrir la aplicación (ver `despliegue.md`).

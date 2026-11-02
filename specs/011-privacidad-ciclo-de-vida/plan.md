# Plan de implementación: Privacidad y ciclo de vida de los datos

**Rama**: `011-privacidad-ciclo-de-vida` | **Fecha**: 2026-11-01 | **Spec**: [spec.md](spec.md) | **Contrato**: [contracts/privacy.md](contracts/privacy.md)

## Resumen

Una pantalla `/privacidad` («Tus datos») con tres bloques: resumen de privacidad, descargas y eliminación de cuenta. La exportación JSON sale de una función de base de datos, `export_my_data()`, que reúne las filas de la cuenta de todas las tablas; el ZIP de fotos se arma en el navegador con un escritor de ZIP propio (sin compresión, las fotos ya son JPEG) a partir de los archivos que la persona ya puede leer. La eliminación pasa por una Edge Function nueva, `delete-account`, que verifica la contraseña, borra los archivos de ambas carpetas y después la cuenta; las tablas ya dependen de la cuenta con borrado en cascada. Pruebas guardianas impiden que una tabla futura quede fuera de la exportación o sin cascada. Se publica una versión nueva del aviso de privacidad y un documento de política.

## Contexto técnico

- **Base de datos:** `supabase/migrations/20261101000200_privacy_lifecycle.sql`:
  - `public.export_my_data() returns jsonb`: `security definer`, exige sesión vigente; devuelve `{format_version, exported_at, account:{email}, tables:{<tabla>:[filas]}}` leyendo, para una lista fija de tablas, las filas con `user_id = auth.uid()`. Excluye `ai_estimates` (temporal) y el catálogo común. Los valores faltantes salen como `null`.
  - Nueva versión vigente del aviso (`2026-11-01`) en `private.privacy_notice_versions`.
  - Sin otros cambios de esquema: todas las tablas con `user_id` ya dependen de `auth.users` con `on delete cascade` (comprobado).
- **Pruebas guardianas (pgTAP):** `supabase/tests/privacy_lifecycle.test.sql`: toda tabla de `public` con `user_id` tiene clave foránea a `auth.users` con cascada; toda tabla con `user_id` (salvo `ai_estimates`) es una clave de `export_my_data()`; la exportación solo trae lo propio; sesión vencida falla; borrar el usuario deja 0 filas en todas las tablas.
- **Función `delete-account`:** `supabase/functions/delete-account/{handler.ts,index.ts,index.test.ts}`; `verify_jwt = false` (verifica dentro, como las demás). Pasos: origen → token y sesión vigente → límite de 5 por hora → contraseña (cliente anónimo `signInWithPassword` con el correo de la cuenta) → borrar archivos de `meal-photos/<id>/` y `progress-photos/<id>/` (listar y borrar por tandas) → `auth.admin.deleteUser`. Si falla el borrado de archivos, no se toca la cuenta. Registros: `delete_account`, estado, resultado y duración; nunca la persona ni rutas.
- **Aplicación (`app/src/features/privacy/`):** `api.ts` (exportación, listado de fotos, descarga de archivos, eliminación), `zip.ts` (escritor ZIP con CRC-32), `exportData.ts` (nombres de archivo y armado), `PrivacyPage.tsx`, `PrivacySummary.tsx`, `ExportSection.tsx`, `DeleteAccountSection.tsx`. Ruta `/privacidad`; entrada «Tus datos» en «Más» y enlace en el perfil. Tras eliminar: cierre de sesión local y aviso en el ingreso.
- **Aviso de privacidad:** `app/src/copy/privacy-notice.ts` pasa a la versión `2026-11-01`.
- **Limpieza de temporales:** `estimate-meal` borra los resultados de IA vencidos de todas las cuentas al guardar uno nuevo (antes solo los de la cuenta).
- **Documentación:** `Documentacion/privacidad.md`, `Documentacion/despliegue.md`, `supabase/README.md`, `README.md`, roadmap.

## Revisión de la Constitution

| Principio                 | Resultado                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I (privacidad)            | Se cumple: exportación y eliminación completa definidas e implementadas, archivos incluidos; informa qué queda en copias de seguridad; secretos en servidor. |
| II (integridad)           | Se cumple: la eliminación es idempotente y no deja cuentas a medias.                                                                                       |
| IV (sin culpa ni presión) | Se cumple: textos neutrales; eliminar no se presenta como castigo ni se insiste en retener.                                                                |
| VI (accesible)            | Se cumple: formularios, diálogos y avance operables por teclado; axe a 375 y 1280 px.                                                                      |
| IX (observabilidad)       | Se cumple: registros sin datos personales; plazos y herramienta de monitoreo documentados.                                                                 |

No hay violaciones que justificar.

## Decisiones de diseño

- **Exportar en el navegador con permisos de la persona**, no con un servicio con clave de servicio: menos superficie, nada que se guarde en el servidor.
- **`export_my_data` con lista fija de tablas** más una prueba guardiana de cobertura: agregar una tabla sin exportarla rompe la prueba.
- **ZIP propio sin compresión:** evita una dependencia; las fotos ya están comprimidas.
- **Contraseña + frase de confirmación**, sin correo de confirmación: suficiente para el MVP.
- **Archivos antes que cuenta:** si algo falla a mitad, la persona conserva el acceso y puede reintentar; lo contrario dejaría archivos huérfanos sin dueño.
- **Sin período de gracia.**

## Verificación

pgTAP completo, Deno de funciones y configuración, lint, formato, typecheck, Vitest completo y Playwright de privacidad (exportación, eliminación de punta a punta con fotos, aislamiento y accesibilidad), una parte por vez.

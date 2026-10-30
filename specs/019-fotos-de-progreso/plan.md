# Plan de implementación: Fotos de progreso

**Rama**: `019-fotos-de-progreso` | **Fecha**: 2026-10-30 | **Spec**: [spec.md](spec.md)

## Resumen

Se repite el camino de las fotos de las comidas (spec 003) con un bucket, una tabla y una función propios: el navegador reduce y vuelve a codificar la imagen, la Edge Function `progress-photo` verifica que sea JPEG, le quita todos los metadatos con el mismo código de limpieza, la guarda en un bucket privado y registra la fila. La lista lee las filas con RLS y pide enlaces firmados de 10 minutos. Corregir fecha y pose es una función SQL. La comparación es una vista del navegador que no guarda nada. No hay dependencias nuevas.

## Contexto técnico

- Base de datos: una migración (`supabase/migrations/20261030000100_progress_photos.sql`) con la tabla `progress_photos`, el bucket privado `progress-photos` con su política de lectura y la función `update_progress_photo`.
- Servidor: Edge Function `progress-photo` (POST y DELETE) con la lógica en `handler.ts` y la conexión en `index.ts`, como `meal-photo`. La limpieza de JPEG (`jpeg.ts`) pasa a `_shared/jpeg.ts` y `meal-photo/jpeg.ts` la reexporta, así las pruebas y el despliegue de `meal-photo` no cambian.
- Aplicación: `features/progress-photos/` con API, consultas de TanStack Query, página, formulario de subida, lista por fecha, visor y comparación. Reutiliza `preparePhoto` de `features/meals/photo.ts`. Ruta `/fotos` en «Más».
- Pruebas: pgTAP (tabla, RLS, bucket, función), Deno (limpieza compartida y manejador), Vitest (componentes), Playwright (recorrido, aislamiento y accesibilidad).

## Revisión de la Constitution

| Principio                        | Resultado                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I (privacidad y propiedad)       | Se cumple: bucket privado, solo la función escribe, lectura por enlaces firmados de la propia carpeta con sesión vigente, EXIF eliminado en el servidor, sin envío a IA. |
| IV (reporte neutral, sin juicio) | Se cumple: sin texto sobre el cuerpo ni su cambio; el aviso de poses distintas es neutral.                                                                               |
| V (sin conclusiones de un dato)  | Se cumple: la comparación es una vista de dos fotos con aclaración de que no es una medición; la pose opcional ayuda a comparar condiciones similares.                   |
| VI (mobile-first, accesibilidad) | Se cumple: lista y comparación apilan a 375 px, todo operable por teclado, texto alternativo neutral, axe a 375 y 1280 px.                                               |
| IX (observabilidad sin datos)    | Se cumple: el registro lleva resultado, bytes y duración; no lleva persona, ruta, fecha ni pose.                                                                         |

No hay violaciones que justificar.

## Decisiones de diseño

- **Bucket y tabla propios, no `meal-photos`.** Otro ciclo de vida (eliminación de cuenta, límites, cuotas) y otro significado; mezclarlos complicaría la spec 011.
- **Misma limpieza en el servidor.** `_shared/jpeg.ts` ya está probada con fixtures (GPS, XMP, IPTC, comentario, truncado); no se escribe otra.
- **Fecha y pose declaradas por la persona.** Los metadatos se eliminan, así que no hay otra fuente; se corrigen con `update_progress_photo(p_id, p_taken_on, p_pose)`: `security definer`, exige sesión vigente y dueño, valida rango (2000-01-01 a mañana) y pose, sin tocar el archivo.
- **Todas las escrituras de archivos y filas por la función.** `progress_photos` solo tiene `select` propio para el navegador; insertar y borrar solo con la clave de servicio; actualizar solo con la función SQL.
- **Tope de 200 fotos** contado por la función al subir (`409 limit_reached`), sin borrar nada solo.
- **Subida atómica.** Primero el objeto, después la fila; si la fila falla se borra el objeto. Al eliminar, primero la fila y después el objeto de mejor esfuerzo (igual que `meal-photo`).
- **Sin pose obligatoria** (`pose` nulo = «Sin indicar»). Al comparar, poses distintas o ausentes muestran un aviso neutral.
- **Enlaces firmados por lote** (`createSignedUrls`) solo de lo visible en la lista; se renuevan solos al vencer.
- **Comparación sin estado en la base**: se guardan solo los dos ids elegidos en la URL (`?a=…&b=…`) para poder recargar o volver atrás.

## Estructura de archivos

```text
supabase/migrations/20261030000100_progress_photos.sql
supabase/tests/progress_photos.test.sql
supabase/functions/_shared/jpeg.ts            (movido desde meal-photo/jpeg.ts)
supabase/functions/meal-photo/jpeg.ts         (reexporta)
supabase/functions/progress-photo/{handler.ts,index.ts,index.test.ts}
supabase/config.toml                          (bucket y función)
supabase/tests/config.test.ts
specs/019-fotos-de-progreso/contracts/progress-photo.md
app/src/features/progress-photos/{api,useProgressPhotos,ProgressPhotosPage,UploadForm,PhotoGallery,PhotoViewer,ComparePanel,photoText}.ts(x)
app/src/components/NavIcon.tsx                (ícono «camera»)
app/src/components/AppShell.tsx               (entrada «Fotos» en «Más»)
app/src/routes/index.tsx                      (ruta /fotos)
app/src/copy/es.ts                            (progressPhotos)
app/tests/{unit,component,e2e}/…              (pruebas de la spec)
```

## Verificación

pgTAP completo, `npm run test:functions`, `npm run test:config`, lint, formato, typecheck, Vitest completo, y Playwright de fotos (subida, lista, corrección, eliminación, comparación, aislamiento y accesibilidad) y de las specs 003 y 008, una parte por vez.

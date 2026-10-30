# Tareas: Fotos de progreso

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [contracts/progress-photo.md](contracts/progress-photo.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos y almacenamiento

- [x] T001 Migración `supabase/migrations/20261030000100_progress_photos.sql`: tabla `progress_photos` (`id`, `user_id` con borrado en cascada, `taken_on date`, `pose` nulo o `front|side|back|other`, `storage_path` de 1 a 300 caracteres, `width` y `height` mayores que cero, `bytes` entre 1 y 3145728, `created_at`), índice `(user_id, taken_on desc)`, RLS con lectura propia y sesión vigente, `grant select` solo al navegador; bucket privado `progress-photos` (JPEG, 3 MiB) con política de lectura de la propia carpeta; función `update_progress_photo`.
- [x] T002 Prueba pgTAP `supabase/tests/progress_photos.test.sql`: estructura y restricciones, aislamiento entre cuentas, sin escritura directa del navegador, política del bucket, función (corregir fecha y pose, fecha fuera de rango, pose inválida, foto ajena, sesión vencida).
- [x] T003 `supabase/config.toml` (bucket y función `progress-photo` con `verify_jwt = false`) y `supabase/tests/config.test.ts`.

## Fase 2: Función de servidor

- [x] T004 Mover `supabase/functions/meal-photo/jpeg.ts` a `supabase/functions/_shared/jpeg.ts` y dejar `meal-photo/jpeg.ts` como reexportación; las pruebas existentes pasan sin cambios.
- [x] T005 `supabase/functions/progress-photo/handler.ts` e `index.ts`: POST (validar, limpiar, subir, registrar, tope de 200, límite de 30 por hora), DELETE por id, registro sin datos personales.
- [x] T006 Prueba Deno `supabase/functions/progress-photo/index.test.ts` con Storage y base simulados (casos del contrato, limpieza de GPS/XMP/IPTC/comentario, huérfanos, tope, idempotencia, registro sin datos personales).

## Fase 3: Historia 1 — Subir una foto

- [x] T007 [US1] `app/src/features/progress-photos/api.ts`: `fetchProgressPhotos`, `progressPhotoUrls`, `uploadProgressPhoto`, `updateProgressPhoto`, `deleteProgressPhoto` y errores de la función.
- [x] T008 [US1] Copy `progressPhotos` en `app/src/copy/es.ts` (títulos, estados, errores de imagen y de la función, aclaraciones y poses), neutral y con tuteo.
- [x] T009 [US1] `UploadForm.tsx` y `useProgressPhotos.ts`: elegir archivo, fecha (por defecto hoy) y pose, reducir con `preparePhoto`, subir, bloquear el doble toque, avisar sin conexión y tope.

## Fase 4: Historias 2 y 4 — Ver, corregir, eliminar y privacidad

- [x] T010 [US2] `PhotoGallery.tsx`: lista por fecha de la más reciente a la más antigua, miniaturas con enlaces firmados por lote que se renuevan solos, estados de carga, vacío y error.
- [x] T011 [US2] `PhotoViewer.tsx`: foto en grande, corregir fecha y pose, eliminar con confirmación.
- [x] T012 [US2] `ProgressPhotosPage.tsx`, ruta `/fotos` en `app/src/routes/index.tsx`, ícono «camera» en `NavIcon.tsx` y entrada «Fotos» en «Más» de `AppShell.tsx`.

## Fase 5: Historia 3 — Comparar

- [x] T013 [US3] `ComparePanel.tsx`: elegir dos fotos desde la lista, vista lado a lado (apilada a 375 px), fecha, pose y días de diferencia, aviso neutral de poses distintas, texto fijo de aclaración, ids en la URL.

## Fase 6: Pruebas y cierre

- [x] T014 Pruebas de componentes `app/tests/component/ProgressPhotos.test.tsx` y unitarias del texto y de los días de diferencia.
- [x] T015 Prueba e2e `app/tests/e2e/progress-photos.spec.ts` (subida con GPS, orden, corrección, comparación, eliminación con archivo y aislamiento entre cuentas; el vencimiento del enlace firmado ya lo prueba la spec 003) y a11y a 375 y 1280 px.
- [x] T016 Correr pgTAP, `test:functions`, `test:config`, lint, formato, typecheck y Vitest completos; leer el resultado.
- [x] T017 Playwright de fotos (4 e2e y 3 de accesibilidad) y de las specs 003 y 008 (fotos de comidas, medidas, inicio, sistema), una parte por vez; la corrida completa de todas las specs sigue pendiente con la de la 017 y la 018.
- [x] T018 Actualizar `Documentacion/roadmap-specs.md` (019, 011 y 008), `README.md`, `supabase/README.md` y `Documentacion/despliegue.md` si corresponde.

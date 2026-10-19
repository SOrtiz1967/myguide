# Verificación de la spec 003

**Fecha:** 2026-10-19 · **Entorno:** Supabase local (CLI 2.121.0, Postgres 17), Chromium (Playwright; escritorio y Pixel 7 emulado), Deno 2.

## Resultado de los comandos (T073)

| Comando | Resultado |
|---|---|
| `npm run format:check --prefix app` | ✅ |
| `npm run lint --prefix app` | ✅ sin advertencias |
| `npm run typecheck --prefix app` | ✅ |
| `npm test --prefix app` (unidad y componentes) | ✅ 464 pruebas en 45 archivos |
| `npm run test:db` (pgTAP) | ✅ 536 pruebas en 26 archivos |
| `npm run test:functions` (Deno) | ✅ 101 pruebas |
| `npm run test:import` (Deno) | ✅ 42 pruebas |
| `npm run test:config` | ✅ 12 pruebas |
| `npm run check:secrets --prefix app` | ✅ bundle (12 archivos) y repositorio (406 archivos), sin secretos |
| e2e, cuentas y perfil (spec 001, proyecto `desktop`) | ✅ 27 pruebas |
| e2e, alimentos (spec 002, proyecto `desktop`) | ✅ 30 pruebas |
| e2e, comidas, parte 1 (agregar, día, manual, editar, regla del día) | ✅ 19 pruebas |
| e2e, comidas, parte 2 (repetir, foto, accesibilidad, responsive, aislamiento, mediciones) | ✅ 19 pruebas |
| e2e, proyecto `mobile` | ✅ 24 pruebas |
| e2e, proyecto `pwa` | ✅ 6 pruebas |

**Nota sobre la suite de extremo a extremo:** se ejecutó por partes (un grupo de archivos por corrida) para no agotar la memoria del equipo; en total son 125 pruebas y todas pasan. Las de las specs 001 y 002 se volvieron a correr para descartar regresiones (la cabecera, la navegación y los diálogos son componentes compartidos). Los e2e de comidas corren sobre el servidor de desarrollo; las mediciones de rendimiento (`meals-measure.spec.ts`), sobre la compilación de producción.

## Escenarios del `quickstart.md` (T071)

| # | Escenario | Verificado con |
|---|---|---|
| 1 | Agregar "Arroz, 150 g" al almuerzo | e2e `meals-add` + pgTAP `add_meal_entry` + componente `AddEntryPage` |
| 2 | 1,5 tazas de un alimento con porciones | e2e `meals-add` + pgTAP `add_meal_entry` |
| 3 | Alimento sin dato de fibra | e2e `meals-add` + unidad `totals` |
| 4 | Doble clic en "Agregar" | e2e `meals-add` + pgTAP (idempotencia) |
| 5 | Cortar la red al agregar | e2e `meals-add` + componente (borrador conservado) |
| 6 | Volver a registrar un reciente | e2e `meals-add` (2 toques) + pgTAP `recent_meal_items` |
| 7 | Ver el día con dos comidas | e2e `meals-day` + unidad `totals` |
| 8 | Día anterior y volver a "Hoy" | e2e `meals-day` + componente `DayPage` |
| 9 | Día sin registros | e2e `meals-day` + componente |
| 10 | Entrada manual "Torta, 350 kcal" | e2e `meals-manual` + pgTAP `manual_meal_entry` |
| 11 | Entrada manual con valores imposibles | e2e `meals-manual` + pgTAP + unidad |
| 12 | Guardar una entrada manual como alimento propio | e2e `meals-manual` |
| 13 | Cambiar la cantidad de 100 g a 200 g | e2e `meals-edit` + pgTAP `update_meal_entry` + componente `EntryDetailPage` |
| 14 | Mover un ítem a la cena y a otro día | e2e `meals-edit` + pgTAP |
| 15 | Eliminar un ítem (cancelar y confirmar) | e2e `meals-edit` + componente + `a11y-meals` (teclado del diálogo) |
| 16 | Editar y eliminar el alimento de un ítem registrado | e2e `meals-edit` + pgTAP (SC-004) |
| 17 | Registrar a la 01:00 sin nada en el día nuevo | e2e `meals-day-rule` + pgTAP `log_day_status` (hora simulada) + componente `DayRule` |
| 18 | "Empezar el día de hoy" | e2e `meals-day-rule` + pgTAP |
| 19 | Cambiar la zona horaria del perfil | e2e `meals-day` y `meals-day-rule` + pgTAP |
| 20 | Repetir el desayuno de ayer en hoy | e2e `meals-repeat` + pgTAP `repeat_meal` + componente `RepeatMeal` |
| 21 | Doble clic en "Repetir" | e2e `meals-repeat` + pgTAP (idempotencia) |
| 22 | Foto con GPS en su EXIF | e2e `meals-photo` + Deno `jpeg.test` e `index.test` (también por una subida directa sin reducción del navegador) |
| 23 | Otra cuenta o petición anónima pide la foto | e2e `meals-photo` + pgTAP `meal_photos_storage` |
| 24 | Reemplazar y eliminar la foto | e2e `meals-photo` + Deno `index.test` + componente `MealPhoto` |
| 25 | Archivo que no es imagen o de más de 15 MB | e2e `meals-photo` + unidad `photo` + componente |
| 26 | Otra cuenta intenta leer o modificar mis ítems | e2e `meals-isolation` (API real con sesión válida) + pgTAP `meal_rls`, `add_meal_entry`, `update_meal_entry`, `repeat_meal` |
| 27 | Día con 60 ítems en un teléfono | e2e `meals-day` + `meals-measure` (p95 de 0,64 s dentro de la app y 1,2 s en frío; ver `research.md`) |

Criterios de éxito medidos (T069, detalle en `research.md`): SC-001 cumple (4 y 2 interacciones, 1,6 s y 0,75 s); SC-002 cumple; foto de 12 MP a 200 KB (ruido típico) y función en 1,3 s; SC-008 con `a11y-meals` y `responsive-meals` (axe sin problemas graves en todas las pantallas, sin desplazamiento horizontal, áreas táctiles de 44 px o más).

## Revisión de seguridad dirigida (T072)

| Punto revisado | Resultado | Evidencia |
|---|---|---|
| La instantánea no se puede manipular desde el cliente | ✅ el cliente solo tiene `select` y `delete` sobre `meal_entries` (ni `insert` ni `update`); las funciones calculan la instantánea con un disparador desde el alimento visible y rechazan cambiar origen o instantánea | consulta de privilegios sobre la base local; pgTAP `meal_entries_schema`, `update_meal_entry` ("el origen y la instantánea no se pueden cambiar desde el cliente") |
| Las funciones no aceptan ítems ni alimentos ajenos | ✅ se comportan como inexistentes (`not_found`); `repeat_meal` y la vista previa no ven lo de otra cuenta; `start_log_day` solo admite el «hoy» de la cuenta | e2e `meals-isolation` por la API real; pgTAP `add_meal_entry`, `update_meal_entry`, `repeat_meal`, `log_day_status` |
| Marcas del día y registros de fotos de otra cuenta | ✅ no se leen, no se insertan, no se borran | e2e `meals-isolation`; pgTAP `meal_rls` |
| Permisos de ejecución | ✅ `anon` no ejecuta ninguna función de comidas; `private.log_day_status_at` no la ejecuta ningún rol de la API | consulta de privilegios; pgTAP `log_day_status` |
| Fotos sin metadatos | ✅ el servidor quita todos los `APPn` (salvo `APP0` sin miniatura), `COM` y lo que sigue al marcador final, aunque el navegador no lo haya hecho | Deno `jpeg.test`; e2e `meals-photo` (subida directa de un JPEG con GPS) |
| Fotos sin acceso público ni de otras cuentas | ✅ bucket privado, 3 MiB, solo JPEG; una única política de lectura de la carpeta propia con sesión vigente; sin políticas de escritura; la ruta pública y la autenticada de otra cuenta dan error | consulta de bucket y políticas; pgTAP `meal_photos_storage`; e2e `meals-photo` (escenario 23) |
| URL firmada de corta duración | ✅ la app la pide por 600 s y la renueva a los 540 s; una URL firmada por 2 s ya no sirve a los 3,5 s; la anterior deja de servir tras reemplazar o eliminar | componente `MealPhoto`; e2e `meals-photo` |
| Límite de subidas | ✅ 3 MiB por foto (función y bucket), 15 MB de origen en el navegador, 30 fotos por hora por cuenta, solo JPEG | Deno `index.test` (413, 415, 429); pgTAP; unidad `photo` |
| Origen y sesión de la función | ✅ rechaza orígenes no permitidos antes de hacer nada, verifica el token con Auth y la actividad de los últimos 30 días | Deno `index.test` (401, origen); en las mediciones, una página servida desde otro origen recibió `forbidden_origin` |
| La clave de servicio solo en la función | ✅ aparece únicamente en `_shared/admin.ts` (servidor); no en `app/src` ni en el bundle | `grep`; `check:secrets` |
| Registros de la función | ✅ no incluyen cuenta, ruta, fecha ni comida | Deno `index.test` (Principio IX) |
| El esquema `private` no se expone | ✅ la API solo expone `public` y `graphql_public`; llamar una función de `private` por REST da 406 | prueba manual contra la API local |
| Los archivos de fotos no se borran en cascada con la cuenta | ⚠️ pendiente documentado (no hay eliminación de cuentas todavía) | `supabase/README.md`, `Documentacion/despliegue.md`, `research.md` (Decisión 11) |

### Hallazgos y observaciones

1. **Prueba pgTAP dependiente de datos locales (medio).** `meal_photos_storage` contaba todos los objetos del bucket como superusuario y fallaba en cuanto las corridas de e2e dejaban fotos (los archivos no se borran por SQL). Corregido: ahora cuenta solo las carpetas de sus dos cuentas. Es el mismo tipo de defecto que ya se había corregido en la spec 002.
2. **Permiso de ejecución por defecto del disparador `private.prepare_meal_entry` (bajo, sin cambio).** Conserva `EXECUTE` para `anon` y `authenticated`, igual que los demás disparadores del proyecto. No es alcanzable: `anon` no tiene uso del esquema `private`, el esquema no se expone por la API y Postgres no permite llamar un disparador directamente.
3. **Listado de la carpeta propia (informativo).** La política de lectura permite a la persona listar sus propios objetos; no hay forma de listar los de otra cuenta ni de forma anónima (FR-032).
4. **Margen de la función de fotos (informativo).** Tarda 1,3 s contra un tope de 2 s. Si en producción se acerca al límite, mirar primero el arranque en frío de la función.
5. **Cargas en frío lentas con la máquina cargada (informativo).** En corridas con otras tareas pesadas aparecieron muestras de 2 a 5 s por respuestas sueltas de Supabase local; no se repitieron. Detalle en `research.md`.

## Pendiente (no bloquea esta spec, requiere acción del autor)

| Tarea | Estado |
|---|---|
| Despliegue en producción: crear el bucket (lo hace la migración `20261019000900`), desplegar `meal-photo` con *Verify JWT* apagado y agregar el dominio a `ALLOWED_ORIGINS` | Pasos en `Documentacion/despliegue.md`; el autor lo hace con el issue 04 |
| Eliminar los archivos de `meal-photos/<user_id>/` al eliminar una cuenta | Debe construirse junto con la eliminación de cuentas (Principio I); documentado |
| Probar una foto real de teléfono (HEIC y JPEG) en el dispositivo | Escenario 22 con una cámara real; lo verificado fue con imágenes sintéticas y con el decodificador de Chromium (el HEIC se informa con un mensaje claro cuando el navegador no lo lee) |

# Verificación de la spec 002

**Fecha:** 2026-10-19 · **Entorno:** Supabase local (CLI 2.121.0, Postgres 17), Chromium (Playwright), Deno 2, catálogo local con la muestra de desarrollo y 3.929 productos reales de Open Food Facts (Argentina).

## Resultado de los comandos (T075)

| Comando | Resultado |
|---|---|
| `npm run format:check --prefix app` | ✅ |
| `npm run lint --prefix app` | ✅ sin advertencias |
| `npm run typecheck --prefix app` | ✅ |
| `npm test --prefix app` (unidad y componentes) | ✅ 274 pruebas |
| `npm run test:db` (pgTAP) | ✅ 302 pruebas en 17 archivos |
| `npm run test:functions` (Deno) | ✅ 73 pruebas |
| `npm run test:import` (Deno) | ✅ 42 pruebas |
| `npm run test:config` | ✅ 9 pruebas |
| `npm run check:secrets --prefix app` | ✅ bundle (12 archivos) y repositorio (292 archivos), sin secretos |
| e2e, proyecto `desktop` (spec 001) | ✅ 16 pruebas |
| e2e, proyecto `desktop` (spec 002) | ✅ 30 pruebas |
| e2e, proyecto `mobile` | ✅ 24 pruebas |
| e2e, proyecto `pwa` | ✅ 6 pruebas |

**Nota sobre la suite de extremo a extremo:** se ejecutó por partes (un proyecto o un grupo de archivos por corrida) para no agotar la memoria del equipo; en total son 76 pruebas y todas pasan. Las de la spec 001 se volvieron a correr para descartar regresiones (la cabecera, el color de éxito y el diálogo de confirmación son componentes compartidos).

## Escenarios del `quickstart.md` (T073)

| # | Escenario | Verificado con |
|---|---|---|
| 1 | Buscar "leche" | e2e `foods-search` + componente `FoodSearchPage` + pgTAP `search_foods` |
| 2 | "Dulce de Leche" = "dulce de leche" | e2e `foods-search` + pgTAP |
| 3 | Detalle de un alimento completo | e2e `foods-search` + componente `FoodDetailPage` |
| 4 | Fibra "sin dato", nunca 0 | e2e `foods-search` + componente + unidad `nutrition` |
| 5 | Procedencia de un alimento importado | e2e `foods-search` + componente |
| 6 | Búsqueda sin resultados: "Crear…" | e2e `foods-search` + componente |
| 7 | "Ver más" agrega sin perder lo anterior | e2e `foods-search` + componente |
| 8 | Pestañas y filtro que sobrevive al detalle | e2e `foods-search` + componente + `a11y-foods` (flechas) |
| 9 | Crear con solo nombre y energía | e2e `foods-create` + componente `FoodForm` + pgTAP `create_food` |
| 10 | Varias porciones, aparte de los valores | e2e `foods-create` + componente |
| 11 | Valores imposibles rechazados | e2e `foods-create` + unidad `foodSchema` + pgTAP |
| 12 | Energía que no coincide: aviso, se guarda | e2e `foods-create` + unidad `nutrition` + componente |
| 13 | Coma decimal | e2e `foods-create` + unidad |
| 14 | Otra cuenta no ve mi alimento | e2e `foods-create` y `foods-readonly` (API real) + pgTAP |
| 15 | Doble clic en Guardar | e2e `foods-create` + componente (mismo `request_id`) + pgTAP (idempotencia) |
| 16 | "Crear mi versión" | e2e `foods-copy` + componente `FoodCopy` + pgTAP `copy_food` |
| 17 | Editar la copia; el original no cambia | e2e `foods-copy` + pgTAP |
| 18 | Repetir la carga con datos distintos | e2e `foods-copy` + pgTAP `import_foods` |
| 19 | Editar y eliminar un alimento propio | e2e `foods-edit` + componente `FoodEdit` + pgTAP `update_delete_food` |
| 20 | El catálogo no se edita ni se elimina | e2e `foods-edit` y `foods-readonly` (API real) + pgTAP |
| 21 | Cortar la red al guardar | e2e `foods-edit` + componente |
| 22 | Ejecutar la carga dos veces | corrida real (ver abajo) + pgTAP `import_foods` + Deno `load.test` |
| 23 | Faltantes, imposibles y sin nombre | corrida real con la muestra + Deno `normalize.test` + pgTAP |
| 24 | Fuente sin licencia | Deno `load.test` + pgTAP `import_foods` |
| 25 | `/fuentes` | e2e `foods-sources` + componente `SourcesPage` |
| 26 | Buscar sin servicios de terceros | e2e `foods-search` (se bloquea todo lo que no sea el servidor local) |
| 27 | 50.000 alimentos | medición T071 (ver `research.md`): p95 234 ms, 60 MB |

**Escenarios 22 y 23, corrida real.** Con `npm run import:muestra` dos veces seguidas: primera carga 172 creados, 10 omitidos con su motivo; segunda carga 0 creados y 172 actualizados. Con 13.395 productos de Argentina de Open Food Facts: 3.929 cargados y 9.465 omitidos con motivo (detalle en `research.md`, T053).

## Revisión de seguridad dirigida (T074)

| Punto revisado | Resultado | Evidencia |
|---|---|---|
| Escribir en el catálogo desde el cliente (insert, update, delete) | ✅ imposible: sin política de escritura para filas del catálogo, y la identidad de un alimento no se puede cambiar | pgTAP `foods_rls`, `foods_schema`; e2e `foods-readonly` por la API real con una sesión válida |
| `create_food`, `update_food`, `copy_food` ignoran `origin`, `user_id` y la fuente que mande el cliente | ✅ | pgTAP `create_food`, `update_delete_food` |
| `import_foods` y `finish_import` solo para `service_role` | ✅ `anon` y `authenticated` reciben "permission denied" | pgTAP `import_foods` |
| Una importación no puede tocar alimentos propios ni copias | ✅ la clave es (fuente, código) y lo propio no tiene fuente | pgTAP `import_foods` |
| Escape de comodines y de comillas en la búsqueda | ✅ `%`, `_`, `\`, comillas y un texto de 600 KB no alteran la consulta | pgTAP `search_foods` (casos `T074`) |
| Aislamiento entre cuentas y sesión vencida | ✅ | pgTAP `foods_rls`, `search_foods`; e2e `foods-readonly` |
| Datos externos malformados en el cargador | ✅ ver hallazgos | Deno `normalize.test`, `extract.test`, `load.test` |
| Enlaces que vienen de la base (licencia y sitio de las fuentes) | ✅ solo `http(s)` sin credenciales; si no, texto sin enlace | unidad `url.test`, componente `SourcesPage` |
| La clave de servicio no aparece en el bundle ni en el repositorio | ✅ y `redact` la quita de cualquier mensaje del cargador | `check:secrets`; Deno `load.test`; `supabase/.env*` están en `.gitignore` |
| Dependencia de servicios de terceros al buscar o consultar | ✅ ninguna | e2e escenario 26 |

### Hallazgos y correcciones

1. **Rendimiento de RLS (alto).** La primera medición con 50.000 alimentos no terminó en 8 minutos: las políticas llamaban a `private.is_session_fresh()` por cada fila. Corregido con `(select …)` (una evaluación por consulta); p95 de 234 ms. Una prueba pgTAP impide la regresión.
2. **Original de una copia (medio).** El embed de PostgREST sobre la relación de la tabla consigo misma no devolvía el original (un alimento propio mostraba "basado en" con un enlace roto). Lo encontró la e2e; ahora se pide el original con una consulta explícita (prueba unitaria `foodsApi`).
3. **Un solo carácter de control podía abortar toda una carga (medio).** Un NUL en un nombre hace fallar el lote completo en la base. El cargador elimina los caracteres de control de nombres y marcas (prueba Deno).
4. **Códigos de origen sin validar (bajo).** Ahora solo se admiten letras, números y `. _ -` hasta 64 caracteres (prueba Deno).
5. **Líneas desmedidas en el volcado (bajo).** Una línea de varios MB se descarta sin acumularla en memoria y la lectura sigue (prueba Deno).
6. **Enlaces externos (bajo).** React ya bloquea `javascript:`, pero se agregó una validación propia (defensa en profundidad).
7. **Accesibilidad.** El diálogo de confirmación dejaba el resto de la página accesible detrás del velo (axe marcaba contraste del contenido tapado); ahora el fondo queda inerte y el foco queda atrapado. El verde del mensaje de éxito daba 4,3:1 (AA exige 4,5:1) y se oscureció (afecta también a la spec 001).
8. **Pruebas pgTAP dependientes de datos locales.** Con el catálogo real cargado en la base de desarrollo fallaban las pruebas que suponían una base vacía; ahora parten de una base sin alimentos (todo se deshace al final).

No se acotó la longitud del texto de búsqueda: con 600 KB la función responde en milisegundos porque solo usa las primeras 5 palabras.

## Pendiente (no bloquea esta spec, requiere acción del autor)

| Tarea | Estado |
|---|---|
| T050–T052 Genéricos de USDA: traducción de nombres y carga | El código y las pruebas están listos (`extract-usda.ts`, 42 pruebas Deno). Falta descargar los CSV de USDA y traducir los nombres: desde este equipo no se pudo resolver `fdc.nal.usda.gov` (ver `supabase/README.md`, "Cargar USDA") |
| T077 Carga en producción | Requiere la clave `service_role` de producción en `supabase/.env` |
| T078 Revisión legal de la ODbL (compartir bajo la misma licencia) | Antes de abrir la aplicación a otras personas |

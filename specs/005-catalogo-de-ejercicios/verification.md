# Verificación: spec 005, catálogo de ejercicios

**Fecha**: 2026-10-21 | **Rama**: `005-catalogo-de-ejercicios`

Resultado de las tareas T066 (revisión de seguridad), T068 (los 32 escenarios del `quickstart.md`) y T069 (suite completa).

## Revisión de seguridad (T066)

| Punto | Evidencia | Resultado |
|---|---|---|
| El cliente no inserta ni actualiza `exercises` directamente; nadie modifica el catálogo | Permisos reales en la base local: `authenticated` solo tiene `SELECT` y `DELETE` sobre `exercises` y `SELECT` sobre `exercise_sources`; RLS activado en ambas; solo hay políticas `exercises_select`, `exercises_delete_own` y `exercise_sources_select`. e2e `exercises-readonly` y `exercises-isolation` (insertar, modificar y borrar el catálogo por la API real con una sesión válida: rechazado o sin filas afectadas); pgTAP `exercises_rls`, `update_delete_exercise` | Cumple |
| Las funciones del cliente no aceptan ejercicios ajenos | `update_exercise` y `copy_exercise` devuelven `not_found` para un ejercicio ajeno, del catálogo (la edición) o inexistente; verifican `auth.uid()` y la sesión vigente; `anon` no puede ejecutarlas. pgTAP `copy_exercise`, `update_delete_exercise`, `create_exercise`; e2e `exercises-isolation` | Cumple |
| Las funciones de carga solo las ejecuta `service_role` | `import_exercises` y `finish_exercise_import`: `anon = false`, `authenticated = false`, `service_role = true`. e2e `exercises-isolation` (FR-039): una cuenta con sesión y una petición anónima son rechazadas. `private.exercise_import_runs` sin permisos para el cliente | Cumple |
| La clave de servicio no está en `app/` ni en Git | Búsqueda en `app/src`, `app/tests` y `app/index.html`: solo aparece el texto «service_role» en pruebas del escáner y en comentarios. `npm run check:secrets`: «Sin secretos en el bundle ni en el repositorio» (bundle de 12 archivos y 535 del repositorio) | Cumple |
| Ningún `console.*`, registro ni mensaje de error contiene el contenido de un ejercicio propio | Sin `console.*` en `app/src`. `exerciseErrorMessage` solo devuelve textos fijos propios o `null` (entonces se usa el mensaje general); nunca se muestra el texto del servidor. Los errores del servidor tienen la forma `invalid_exercise:<motivo>:<campo>` y `not_found`, sin contenido. No hay `dangerouslySetInnerHTML` ni `innerHTML` | Cumple |
| Las funciones `security definer` fijan `search_path` vacío; las funciones auxiliares no son ejecutables por el cliente | `create_exercise`, `update_exercise`, `copy_exercise`, `import_exercises`, `finish_exercise_import` con `search_path = ''`; `private.clean_exercise_input` sin permisos para ninguna cuenta; el esquema `private` no tiene uso para `anon` | Cumple |
| Sin inyección de SQL en la búsqueda (consulta dinámica) | Todo valor del usuario entra por `format('%L')`, el tamaño y el desplazamiento son enteros, y los filtros se validan contra la lista cerrada antes de armar la consulta. **Se agregaron tres pruebas pgTAP** (`search_exercises`): comillas y SQL en el texto, tabla intacta, y un músculo con SQL rechazado con `invalid_filter` | Cumple (hallazgo: faltaba la prueba; agregada) |
| El borrador del formulario se borra al cerrar sesión | `purgeAllDrafts()` en el cierre de sesión, en la caducidad y en el cambio de sesión (`AuthProvider`); e2e `exercises-create` escenario 21 | Cumple |
| Enlaces de las fuentes | Se muestran como enlace solo si son `http(s)` (`safeHttpUrl`), con `rel="noopener noreferrer"`; prueba de componente `SourcesPage` | Cumple |

**Riesgo residual, aceptado:** los registros del propio servidor de base de datos (no de la aplicación) pueden incluir el texto de una consulta que falle. Es una propiedad de la plataforma y no cambia con esta spec; conviene tenerlo presente al elegir el plan de hosting.

## Escenarios del quickstart (T068)

Cada escenario tiene al menos una prueba automática. Las e2e corren contra el stack local real (Supabase, API y base), no contra simulaciones.

| # | Escenario | Dónde se verifica |
|---|---|---|
| 1 | Buscar «sentadilla» | `exercises-search.spec.ts` (esc. 1 y 2); `ExerciseSearchPage.test.tsx` |
| 2 | Sin importar acentos ni mayúsculas | `exercises-search.spec.ts` (esc. 1 y 2); pgTAP `search_exercises` |
| 3 | Abrir un ejercicio completo | `exercises-search.spec.ts` (esc. 3, 5 y 6); `ExerciseDetailPage.test.tsx` |
| 4 | Lo que falta dice «sin dato» | `exercises-search.spec.ts` (esc. 4); `ExerciseDetailPage.test.tsx` |
| 5 | Procedencia de un ejercicio importado | `exercises-search.spec.ts` (esc. 3, 5 y 6); `exercises-sources.spec.ts` (el enlace a las fuentes) |
| 6 | Traducción sin revisar y revisada | `exercises-search.spec.ts` (esc. 3, 5 y 6); `exerciseText.test.ts` |
| 7 | Buscar algo que no existe y «Crear [lo buscado]» | `exercises-search.spec.ts` (esc. 7, 8 y 9); `ExerciseSearchPage.test.tsx` |
| 8 | Una letra y espacios | `exercises-search.spec.ts` (esc. 7, 8 y 9); pgTAP `search_exercises` (`query_too_short`) |
| 9 | «Ver más» | `exercises-search.spec.ts` (esc. 7, 8 y 9); pgTAP (tres tandas sin repetir) |
| 10 | Pestañas y estado al ir al detalle y volver | `exercises-search.spec.ts` (esc. 10); `OriginTabs.test.tsx`; `a11y-exercises.spec.ts` (teclado) |
| 11 | Filtrar por músculo | `exercises-search.spec.ts` (esc. 11 a 13); `exercises-measure.spec.ts` (SC-012: 18 músculos, 0 diferencias) |
| 12 | Equipamiento + músculo + texto, filtros que se quitan | `exercises-search.spec.ts` (esc. 11 a 13); `a11y-exercises.spec.ts` (filtros con teclado) |
| 13 | Filtros sin resultados | `exercises-search.spec.ts` (esc. 11 a 13); `a11y-exercises.spec.ts` (axe) |
| 14 | «squat» y un sinónimo | `exercises-search.spec.ts` (esc. 14); `exercises-measure.spec.ts` (SC-012: 40 de 40 por nombre original y 40 de 40 por sinónimo) |
| 15 | Solo nombre y tipo de medición | `exercises-create.spec.ts` (esc. 15); pgTAP `create_exercise` |
| 16 | Ejercicio completo, por nombre y por otro nombre | `exercises-create.spec.ts` (esc. 16); `ExerciseForm.test.tsx` |
| 17 | Nombre vacío, tipo sin elegir, descripción enorme | `exercises-create.spec.ts` (esc. 17); `exerciseSchema.test.ts`; pgTAP `create_exercise` |
| 18 | Nombre repetido entre los propios | `exercises-create.spec.ts` (esc. 18); `ExerciseForm.test.tsx` |
| 19 | Doble clic en «Guardar» | `exercises-create.spec.ts` (esc. 19); `ExerciseForm.test.tsx`; pgTAP (idempotencia) |
| 20 | Cortar la red al guardar | `exercises-create.spec.ts` (esc. 20); `exercises-edit.spec.ts` (edición); `ExerciseForm.test.tsx` |
| 21 | Borrador tras recargar; se borra al cerrar sesión | `exercises-create.spec.ts` (esc. 21); `ExerciseForm.test.tsx` |
| 22 | Otra cuenta no ve un ejercicio propio | `exercises-create.spec.ts` (esc. 22); pgTAP `exercises_rls` |
| 23 | «Crear mi versión» y editar | `exercises-copy.spec.ts` (esc. 23); `ExerciseCopy.test.tsx`; pgTAP `copy_exercise` |
| 24 | Copiar dos veces | `exercises-copy.spec.ts` (esc. 24); `ExerciseCopy.test.tsx`; pgTAP `copy_exercise` |
| 25 | Editar y eliminar un ejercicio propio; las copias siguen | `exercises-edit.spec.ts` (esc. 25); `ExerciseEdit.test.tsx`; pgTAP `update_delete_exercise` |
| 26 | Editar o eliminar el catálogo (también por la API) | `exercises-edit.spec.ts` (esc. 26); `exercises-readonly.spec.ts`; `exercises-isolation.spec.ts` |
| 27 | Cargar dos veces: 0 duplicados | Carga real del 2026-10-21 (876 creados; repetición: 0 creados, 876 actualizados, 0 duplicados; ver `research.md`); pgTAP `import_exercises` (propios, copias y traducciones revisadas intactos) |
| 28 | Sin licencia, SHA-256 distinto, sin traducción | `load-exercises.test.ts` (FR-019, sin licencia: rechazada y no envía nada); `extract-exercises.test.ts` (SHA-256 distinto: se detiene antes de leer; sin traducción: se omite y se cuenta); `source_pin.test.ts`; `normalize-exercises.test.ts` (`no_translation`) |
| 29 | `/fuentes` con las secciones Alimentos y Ejercicios | `exercises-sources.spec.ts`; `foods-sources.spec.ts`; `SourcesPage.test.tsx` (vacío y fallo por sección) |
| 30 | La cuenta B y la petición anónima | `exercises-isolation.spec.ts`; `exercises-readonly.spec.ts`; pgTAP `exercises_rls` |
| 31 | Teléfono y escritorio, teclado y axe | `a11y-exercises.spec.ts`; `responsive-exercises.spec.ts` (375 y 1280 px, áreas táctiles de 44 px o más, nombres sin espacios) |
| 32 | Buscar con 2.000 ejercicios | `mediciones/bench_search.sql`: p95 de 12 ms con 2.030 filas y de 56 ms con 20.030 (tope: 1 s); `exercises-measure.spec.ts` (SC-002 por la API real: p95 de 33 ms) |

## Suite completa (T069)

| Comando | Resultado |
|---|---|
| `format:check` | Todos los archivos con el estilo de Prettier |
| `lint` (oxlint) | Sin avisos |
| `typecheck` (`tsc -b`) | Sin errores |
| `test` (Vitest) | 64 archivos, 798 pruebas, todas pasan |
| `test:db` (pgTAP) | 38 archivos, 872 pruebas, todas pasan |
| `test:import` (Deno) | 105 pasan, 0 fallan |
| `test:functions` (Deno) | 101 pasan, 0 fallan |
| `test:config` | 12 pasan, 0 fallan |
| `check:secrets` | Sin secretos en el bundle ni en el repositorio |
| e2e, por partes (memoria limitada: un proyecto de Playwright a la vez) | **194 pruebas, todas pasan**: ejercicios (búsqueda y creación 15; copia, edición, aislamiento, solo lectura y fuentes 13; accesibilidad, responsive y mediciones 25), alimentos y cuentas 38, objetivo 35, comidas 38, y los proyectos `mobile` y `pwa` 30 |

Notas de la corrida:

- Una primera ejecución de las e2e en segundo plano se detuvo porque el sistema se quedó sin memoria; no era un fallo de las pruebas. Se repitió por partes, en primer plano.
- La vista previa de producción (puerto 4173) servía una compilación vieja; se recompiló con `npm run build` antes de medir.
- Las e2e de alimentos necesitan la muestra de alimentos cargada (`npm run import:muestra`); un `db reset` la vacía y hay que volver a cargarla.

## Lo que queda fuera de esta verificación

- La carga en producción y el despliegue: dependen de que exista el proyecto de Supabase (`Documentacion/issues-autor/04-despliegue.md` y `08-ejercicios-licencias.md`, punto 4).
- La revisión de licencias del autor (procedencia de los pasos de free-exercise-db y dedicación CC0 de `myguide-base`): `Documentacion/issues-autor/08-ejercicios-licencias.md`. No bloquea el uso personal; sí abrir la aplicación a terceros.
- La revisión de las 876 traducciones automáticas: todas están marcadas «traducción sin revisar» y la pantalla lo avisa.

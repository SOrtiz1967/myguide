# Verificación: spec 004, objetivo calórico y resumen diario

**Fecha**: 2026-10-20 | **Rama**: `004-objetivo-calorico-resumen`

Resultado de las tareas T050 (revisión de seguridad), T052 (los 31 escenarios del `quickstart.md`) y T053 (suite completa).

## Escenarios del quickstart

Cada escenario tiene al menos una prueba automática. Las e2e corren contra el stack local real (Supabase, API y base), no contra simulaciones.

| # | Escenario | Dónde se verifica |
|---|---|---|
| 1 | Cuenta sin objetivo: sin restantes, porcentaje ni barra; con invitación | `goals-set.spec.ts` (esc. 1 y 2); `GoalSummary.test.tsx` (sin objetivo); `daySummary.test.ts` (los campos no existen) |
| 2 | Fijar 2.000 kcal | `goals-set.spec.ts` (esc. 1 y 2); `GoalPage.test.tsx` |
| 3 | 999, 6.001, vacío, «abc» y «1800,5» se rechazan | `goals-set.spec.ts` (esc. 3); `goalSchema.test.ts`; `GoalPage.test.tsx`; pgTAP `set_energy_goal` (servidor) |
| 4 | «2.000» y «2000,0» se guardan como 2.000 | `goals-set.spec.ts` (esc. 4); `goalSchema.test.ts` |
| 5 | Doble clic: una sola entrada | `goals-set.spec.ts` (esc. 5); `GoalPage.test.tsx`; pgTAP (idempotencia y reintento tardío) |
| 6 | Sin red: aviso, valor conservado, reintento | `goals-set.spec.ts` (esc. 6); `GoalPage.test.tsx` |
| 7 | Borrador tras recargar; se borra al cerrar sesión | `goals-set.spec.ts` (esc. 7); `GoalPage.test.tsx` |
| 8 | 2.000 y 1.350 registradas → «Restan 650 kcal», cuenta y 68 % | `goals-summary.spec.ts` (esc. 8); `GoalSummary.test.tsx` |
| 9 | Agregar y eliminar un ítem actualiza las cifras sin recargar | `goals-summary.spec.ts` (esc. 9); `DayPage.test.tsx` |
| 10 | Cada día con su total y su objetivo | `goals-summary.spec.ts` (esc. 10); `DayPage.test.tsx`; `goalHistory.test.ts` |
| 11 | Día vacío con objetivo | `goals-summary.spec.ts` (esc. 11); `GoalSummary.test.tsx` |
| 12 | A la 01:00, el resumen del día que se cierra con su fecha | `goals-summary.spec.ts` (esc. 12); `DayPage.test.tsx` |
| 13 | Ítem sin dato de energía → «como máximo» | `goals-uncertainty.spec.ts` (esc. 13); `GoalSummary.test.tsx` |
| 14 | Estimado sin confirmar, sembrado por SQL | `goals-uncertainty.spec.ts` (esc. 14); `GoalSummary.test.tsx` |
| 15 | Todo confirmado y con energía: ninguna aclaración | `goals-uncertainty.spec.ts` (esc. 15); `GoalSummary.test.tsx` |
| 16 | «Cómo se calcula» | `goals-uncertainty.spec.ts` (esc. 16); `a11y-goals.spec.ts` (teclado) |
| 17 | 2.250 con objetivo 2.000: frase factual, sin alarma, sin términos prohibidos | `goals-over.spec.ts` (esc. 17); `GoalSummary.test.tsx` (SC-005); `goalCopy.test.ts` |
| 18 | Exactamente 2.000: «Restan 0 kcal» | `goals-over.spec.ts` (esc. 18); `GoalSummary.test.tsx` |
| 19 | 1.100 kcal: se guarda y muestra la nota informativa | `goals-over.spec.ts` (esc. 19); `LowGoalNote.test.tsx` |
| 20 | Superar el objetivo varios días seguidos: sin avisos ni rachas | `goals-over.spec.ts` (esc. 20) |
| 21 | Cambiar de 2.000 a 1.800 | `goals-history.spec.ts` (esc. 21); pgTAP `energy_goal_history` |
| 22 | Dos cambios el mismo día: rige el último | `goals-history.spec.ts` (esc. 22); `goalHistory.test.ts`; pgTAP |
| 23 | Quitar y volver a fijar | `goals-history.spec.ts` (esc. 23); `GoalPage.test.tsx` |
| 24 | Días anteriores a la primera vez | `goals-history.spec.ts` (esc. 24); `DayPage.test.tsx` |
| 25 | Fecha futura cercana | `goals-history.spec.ts` (esc. 25); `DayPage.test.tsx` |
| 26 | Cambiar la zona horaria del perfil | `goals-history.spec.ts` (esc. 26); pgTAP `energy_goal_history` |
| 27 | Cambiar el objetivo a la 01:00 | `goals-history.spec.ts` (esc. 27); pgTAP `energy_goal_history` |
| 28 | Cuenta B y petición anónima | `goals-isolation.spec.ts`; pgTAP `energy_goals_rls` |
| 29 | Día con 60 ítems y objetivo en un teléfono | `goals-measure.spec.ts`; medición en `research.md` |
| 30 | Teléfono y escritorio, lector de pantalla y teclado | `a11y-goals.spec.ts`; `responsive-goals.spec.ts` |
| 31 | Cerrar sesión y entrar con otra cuenta en la misma pestaña | `session-switch.spec.ts`; `AuthProvider.test.tsx` |

## Revisión de seguridad dirigida (T050)

| Punto | Resultado |
|---|---|
| El cliente solo lee `energy_goals`; la escritura es solo por `set_energy_goal` | **Cumple.** `energy_goals` tiene RLS y solo `select` para `authenticated` (migración `20261020000200`); `insert`, `update` y `delete` directos dan `permission denied` (pgTAP `energy_goals_rls`, y e2e `goals-isolation` por la API real). En `app/src` el único acceso es el `select` de `api.ts` y la llamada a la función |
| La cuenta B no puede leer, insertar, modificar ni borrar el historial de A; ni reutilizar su `request_id` | **Cumple.** `goals-isolation.spec.ts`: B recibe listas vacías, errores en las escrituras directas, y reutilizar el identificador de solicitud de A no toca la fila de A (la restricción única es por cuenta) |
| Petición anónima | **Cumple.** Sin permisos sobre la tabla ni sobre la función |
| `private.set_energy_goal_at` no está expuesta | **Cumple.** Sin permisos para `anon` ni `authenticated` (pgTAP) y no existe en `public` (la API responde con error) |
| Ningún `console.*`, registro ni mensaje de error contiene el valor del objetivo | **Cumple.** No hay ningún `console.*` en `app/src`; las migraciones no tienen `raise notice` ni similares; los errores del servidor (`invalid_goal:out_of_range:kcal`) no incluyen el valor |
| `saveRemotely` no muestra el texto crudo del servidor | **Cumple.** `goalsApi.test.ts`: un error desconocido muestra el mensaje genérico |
| El borrador `energy-goal` se borra al cerrar sesión | **Cumple.** `purgeAllDrafts` lo incluye; `goals-set.spec.ts` (esc. 7). El borrador sí contiene el valor escrito mientras la persona edita (es un dato de salud en `localStorage`): es el mismo compromiso de las demás specs y se purga al cerrar o vencer la sesión |
| La caché de consultas se vacía al cambiar de sesión | **Cumple, y corrige un defecto heredado.** Pruebas de componente y `session-switch.spec.ts`. **Verificada con una mutación**: al desactivar `clearCache` la e2e falla (la cuenta B veía «Objetivo: 2.000 kcal» de la cuenta A), así que la prueba detecta el defecto real |
| `check:secrets` | **Cumple.** Sin secretos en el bundle ni en el repositorio |

Hallazgos: ninguno pendiente. Durante el desarrollo se encontró y corrigió que al guardar sin día de vuelta la aplicación pasaba por `/comidas` (una redirección que descarta el estado de navegación) y perdía el mensaje de confirmación; ahora vuelve directo al día de hoy (documentado en `contracts/ui-routes.md`).

## Suite completa (T053)

Ejecutada el 2026-10-20 sobre el stack local.

| Comando | Resultado |
|---|---|
| `npm run format:check`, `lint`, `typecheck` (en `app`) | Sin diferencias, sin avisos, sin errores |
| `npm test` (Vitest) | **643 pruebas** en 54 archivos, todas en verde (464 antes de la spec) |
| `npm run test:db` (pgTAP) | **611 pruebas** en 30 archivos, todas en verde (536 antes de la spec) |
| `npm run test:functions`, `test:import`, `test:config` | 101, 42 y 12 pruebas en verde |
| `npm run check:secrets` | Sin secretos |
| `npm run e2e` (Playwright, por partes) | Ver abajo |

**e2e de la spec 004 (corridas individuales, todas en verde al final):** `goals-set` (6), `goals-summary` (5), `goals-uncertainty` (4), `goals-over` (4), `goals-history` (7), `goals-isolation` (1), `session-switch` (1), `a11y-goals` (4) y `responsive-goals` (2), más las mediciones de `goals-measure` (2). Algunas pasaron tras una segunda corrida por lentitud del servidor de desarrollo o por un selector corregido (ver Observaciones).

**Pendiente: regresión e2e completa de las specs 001 a 003.** Se lanzó la parte A (autenticación, perfil y alimentos) en segundo plano y el sistema la detuvo por memoria insuficiente: 10 pruebas pasaron, 10 figuran como fallidas con 0 ms (no llegaron a ejecutarse bien: es el efecto del corte, no un resultado) y 26 no se ejecutaron. **No se volvió a lanzar.** Falta ejecutar por partes y con memoria libre: `auth access profile a11y a11y-foods foods-* responsive responsive-foods` y `a11y-meals meals-* responsive-meals`, además de los proyectos `mobile` y `pwa`. Hasta entonces T053 queda abierta.

## Observaciones

- **Orden de las pruebas.** Las pruebas puras (`goalOn`, `summarizeDay`, la lectura del número, la lista de términos) se escribieron junto a su implementación en el mismo paso, no antes como sí se hizo con las de base de datos, componentes y e2e; en esos casos no se observó el fallo previo. `energy_goal_history.test.sql` es de caracterización y pasa de inicio, como anticipó el análisis.
- **Variación del equipo.** Algunas corridas e2e aisladas fallaron una vez por lentitud del servidor de desarrollo (la vista del día quedó en «Cargando el día…» más de 15 s) y pasaron al repetirlas; no se asocian a un defecto de la spec.
- **Hecho aparte.** El caso «la sesión vence mientras se edita el objetivo» se verifica en `GoalPage.test.tsx` (se conserva el borrador y se muestra el aviso de sesión vencida) y en la prueba de `AuthProvider` (se vacía la caché); no hay una e2e que dispare un vencimiento a mitad de la edición.

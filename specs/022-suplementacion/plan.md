# Plan de implementación: Suplementación

**Rama**: `022-suplementacion` | **Fecha**: 2026-10-30 | **Spec**: [spec.md](spec.md)

## Resumen

Dos tablas chicas (`supplements` y `supplement_marks`) con lectura propia por RLS y escritura por funciones `security definer`, la misma forma que peso y medidas (spec 008). Una pantalla `/suplementos` arma la lista y un bloque del inicio marca lo tomado en el día elegido. Sin dependencias nuevas.

## Contexto técnico

- Base de datos: `supabase/migrations/20261030000300_supplements.sql`: tablas con RLS, nombre único entre los no archivados (índice parcial sobre `lower(name)`), funciones `create_supplement` (idempotente por `request_id`, tope de 30), `update_supplement`, `set_supplement_archived`, `set_supplement_taken` (marca o quita, sin días futuros) y borrado directo con política propia (las marcas caen en cascada).
- Aplicación: `features/supplements/` con `api.ts`, `useSupplements.ts`, `SupplementsPage.tsx`, `SupplementForm.tsx` y `DaySupplements.tsx` (bloque del inicio); ruta `/suplementos`, ícono y entrada en «Más»; bloque en `features/week/DayPanel.tsx`.
- Pruebas: pgTAP, Vitest (componentes), Playwright (recorrido, aislamiento y accesibilidad).

## Revisión de la Constitution

| Principio                        | Resultado                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| I (privacidad)                   | Se cumple: RLS con dueño y sesión vigente, escrituras por funciones, borrado en cascada con la cuenta, sin datos en logs.         |
| IV (sin juicio, sin recomendar)  | Se cumple: solo «Tomado» y «Sin registro»; sin rachas ni porcentajes; la dosis es texto de la persona; textos que no recomiendan. |
| VI (mobile-first, accesibilidad) | Se cumple: estados en texto y forma, controles de 44 px, teclado y axe a 375 y 1280 px.                                           |

No hay violaciones que justificar.

## Decisiones de diseño

- **Archivar y eliminar.** Archivar conserva las marcas y oculta el suplemento de los días nuevos; el panel de un día pasado lo muestra si tiene marca ese día. Eliminar borra todo, con confirmación.
- **Sin fecha de alta.** Un suplemento sin archivar se lista todos los días; un día anterior a crearlo figura «Sin registro», que es neutral.
- **Marca por presencia.** No hay estado «no tomado»: la ausencia de fila es «Sin registro».
- **Nombre único entre los no archivados** con un índice parcial: así un archivado no bloquea el nombre.
- **El bloque del inicio** va como sección propia del panel del día (ancho completo) con una casilla por suplemento y su estado en texto («Tomado»/«Sin registro»).

## Estructura de archivos

```text
supabase/migrations/20261030000300_supplements.sql
supabase/tests/supplements.test.sql
app/src/features/supplements/{api,useSupplements,supplementText}.ts
app/src/features/supplements/{SupplementsPage,SupplementForm,DaySupplements}.tsx
app/src/features/week/DayPanel.tsx
app/src/components/{NavIcon,AppShell}.tsx · app/src/routes/index.tsx · app/src/copy/es.ts
app/tests/{unit,component,e2e}/…
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de suplementos (recorrido, aislamiento y accesibilidad) y del inicio, una parte por vez.

# Implementation Plan: Inicio «Hoy»

**Branch**: `013-inicio-hoy` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

## Resumen

La pantalla de inicio (`app/src/routes/HomePage.tsx`) pasa a componer tres bloques independientes más los accesos rápidos, reutilizando lo que ya existe: el resumen de calorías de la spec 004 (`GoalSummary`), el día de comidas de la spec 003 (`useDay`, `useDayStatus`) y los componentes de entrenamiento de la spec 006 (`PlannedActions`, `RoutinePicker`, `CalendarMonth` no se usa). **No hay base de datos nueva**: solo lecturas con RLS que ya existen.

## Contexto técnico

- Mismo stack del proyecto (Vite + React + TypeScript, TanStack Query, Tailwind, Vitest, Playwright). Sin dependencias nuevas.
- **Sin migraciones ni funciones de servidor.** Las lecturas nuevas son dos consultas de tabla con RLS: el último ítem de comida (`meal_entries` ordenado por `log_date` y `created_at` descendente, límite 1) y la última sesión realizada (`fetchRecentSessions(1)`, ya existe).
- Pruebas: Vitest de componente por bloque, una prueba de lenguaje neutral sobre `es.home`, y un e2e del inicio. Accesibilidad con axe en el e2e; responsive con una prueba de desbordamiento.

## Constitution Check

| Principio | Cumplimiento |
|---|---|
| I (privacidad) | Solo lee datos propios por RLS; no agrega logs ni datos. |
| IV (sin coerción) | Reutiliza los textos neutrales de la 004 y la 006; texto nuevo pasa por lista de términos prohibidos. |
| V (datos faltantes) | Estados vacíos dicen «todavía no registraste»; nada se completa con supuestos. |
| VI (sin offline) | Sin conexión avisa y no muestra datos como actuales. |

Sin violaciones.

## Estructura

```text
app/src/
├── routes/HomePage.tsx                       # compone los bloques y conserva los avisos existentes
├── features/home/
│   ├── CaloriesBlock.tsx                     # día vigente + GoalSummary (spec 004)
│   ├── TrainingBlock.tsx                     # en curso, vencidas/de hoy, empezar
│   ├── QuickLinks.tsx                        # cuatro accesos
│   ├── LastRecords.tsx                       # último ítem de comida y última sesión realizada
│   └── useLastMealEntry.ts
├── features/training/DueSessions.tsx         # extraído de TrainingHomePage para reutilizar
└── features/meals/api.ts                     # fetchLastEntry
```

## Decisiones

1. **Día de calorías**: `useDayStatus().proposed_date` (regla del día de la spec 003); mientras carga o si falla, `useToday()`.
2. **No duplicar cálculo**: el bloque de calorías renderiza `GoalSummary` con los ítems de `useDay(date)`; así las cifras coinciden siempre (SC-003).
3. **Vacío de calorías**: sin ítems el bloque dice «Todavía no registraste comidas hoy» y ofrece registrar, en lugar de mostrar el total.
4. **Aislamiento de fallos**: cada bloque es un componente con sus propias consultas y su propio estado de error; no comparten estado.
5. **Sin conexión**: `useOnline` (ya existe) → los bloques de datos se reemplazan por un aviso; los accesos rápidos siguen (son navegación).

## Validación (quickstart)

1. Cuenta nueva: inicio con avisos de perfil, bloques vacíos y los cuatro accesos.
2. Con objetivo y comidas: cifras iguales a la vista del día.
3. Con sesión en curso / planificada hoy / vencida: bloque de entrenamiento correcto con acciones.
4. Último ítem y última sesión con enlaces.
5. Un bloque que falla no rompe los otros; sin conexión avisa.
6. Teclado, axe, teléfono y escritorio.

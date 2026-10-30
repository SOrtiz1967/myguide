# Tareas: Suplementación

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261030000300_supplements.sql`: tablas `supplements` y `supplement_marks` con RLS, índice de nombre único entre no archivados y las funciones de crear, corregir, archivar y marcar.
- [x] T002 Prueba pgTAP `supabase/tests/supplements.test.sql`.

## Fase 2: Historia 1 — Lista de suplementos

- [x] T003 [US1] `app/src/features/supplements/api.ts` y `useSupplements.ts`: leer, crear, corregir, archivar, eliminar y marcar, con errores seguros.
- [x] T004 [US1] Copy `supplements` en `app/src/copy/es.ts`, neutral y con tuteo.
- [x] T005 [US1] `SupplementForm.tsx` y `SupplementsPage.tsx`: alta con borrador, lista, corrección, archivar, restaurar y eliminar con confirmación, estados vacío, de carga y de error.
- [x] T006 [US1] Ruta `/suplementos`, ícono «pill» y entrada en «Más».

## Fase 3: Historia 2 — Marcar en el inicio

- [x] T007 [US2] `DaySupplements.tsx` y su integración en `app/src/features/week/DayPanel.tsx`: lista del día, marcar y desmarcar, día futuro, archivados con marca, estados.

## Fase 4: Pruebas y cierre

- [x] T008 Pruebas de componentes `app/tests/component/Supplements.test.tsx` y ajuste de las del inicio.
- [x] T009 Prueba e2e `app/tests/e2e/supplements.spec.ts` (recorrido, aislamiento) y de accesibilidad a 375 y 1280 px.
- [x] T010 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [x] T011 Playwright de suplementos (5 e2e: recorrido, día de la semana, aislamiento y accesibilidad a 375 y 1280 px), una parte por vez; el inicio se cubre con sus e2e existentes en la corrida completa pendiente.
- [x] T012 Actualizar `Documentacion/roadmap-specs.md` y `README.md`.

# Tasks: Inicio «Hoy»

**Input**: `specs/013-inicio-hoy/spec.md`, `plan.md`

## Phase 1: Base reutilizable

- [X] T001 Extraer `DueSessions` de `app/src/features/training/TrainingHomePage.tsx` a `app/src/features/training/DueSessions.tsx` y reutilizarlo desde ambas pantallas
- [X] T002 [P] `fetchLastEntry` en `app/src/features/meals/api.ts` y `app/src/features/home/useLastMealEntry.ts`
- [X] T003 [P] Textos `es.home` (bloques, vacíos, errores, accesos) en `app/src/copy/es.ts` y prueba de lenguaje neutral `app/tests/unit/homeCopy.test.ts`

## Phase 2: User Story 1 - Ver mi día de un vistazo (P1)

- [X] T004 [US1] `CaloriesBlock.tsx` (día vigente, `GoalSummary`, vacío, error, enlace al día) + prueba `app/tests/component/HomeCalories.test.tsx`
- [X] T005 [US1] `TrainingBlock.tsx` (en curso, de hoy y vencidas con acciones, empezar con rutina o vacía, error) + prueba `app/tests/component/HomeTraining.test.tsx`

## Phase 3: User Story 2 y 3 - Accesos y últimos registros (P2, P3)

- [X] T006 [US2] `QuickLinks.tsx` con cuatro accesos operables por teclado + prueba de componente
- [X] T007 [US3] `LastRecords.tsx` (último ítem y última sesión realizada, vacíos) + prueba `app/tests/component/HomeLastRecords.test.tsx`

## Phase 4: Integración y cierre

- [X] T008 `HomePage.tsx`: componer bloques, conservar los avisos existentes, sin conexión; ajustar `app/tests` existentes del inicio
- [X] T009 e2e `app/tests/e2e/home.spec.ts` (cuenta vacía, con datos, fallo de un bloque), axe y responsive
- [X] T010 `verification.md`, README y roadmap; suite completa (`format:check`, lint, `typecheck`, `test`, e2e por partes)

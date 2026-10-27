# Tasks: Primer ingreso y objetivo físico (spec 014) y cálculo calórico (spec 015)

**Input**: `specs/014-onboarding-objetivo/spec.md`, `plan.md`, `specs/015-calculo-calorico/spec.md`, `plan.md`

## Phase 1: Base de datos

- [X] T001 Migración `supabase/migrations/20261027000100_onboarding_profile.sql` (columnas, CHECK, grant, validación al completar)
- [X] T002 pgTAP `supabase/tests/onboarding_profile.test.sql` (valores, completitud, mayoría de edad, aislamiento)

## Phase 2: Cálculo (spec 015)

- [X] T003 `app/src/features/plan/calorie.ts` (Mifflin-St Jeor, actividad, entrenos, objetivo, pisos, IMC, tope) y `planInputFrom`
- [X] T004 `app/tests/unit/calorie.test.ts` con casos calculados a mano
- [X] T005 `PlanProposal.tsx`, `PlanPage.tsx`, `usePlanInputs.ts`, ruta `/plan`, textos `es.plan`, `PlanProposal.test.tsx`

## Phase 3: Primer ingreso (spec 014)

- [X] T006 `features/onboarding/` (`onboarding.ts`, `ChoiceGroup.tsx`, `OnboardingPage.tsx`, `save.ts`), textos `es.onboarding`
- [X] T007 `routes/RequireOnboarding.tsx` y ruta `/bienvenida`; `Profile`/`ProfileUpdate` con los campos nuevos
- [X] T008 `GoalProfileForm.tsx` en `/perfil`
- [X] T009 Pruebas `onboarding.test.ts`, `RequireOnboarding.test.tsx` (lenguaje neutral incluido) y e2e `onboarding.spec.ts`; helper `register` de los e2e marca el recorrido por SQL y `registerRaw` lo deja pendiente
- [X] T010 `verification.md`, README y roadmap

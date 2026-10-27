# Plan: Cálculo de calorías diarias

**Spec**: `specs/015-calculo-calorico/spec.md`

Sin base de datos nueva. `app/src/features/plan/calorie.ts` (cálculo puro y tipado), `PlanProposal.tsx` (presentación y confirmar/otro valor, usada por el paso 4 de `/bienvenida` y por `/plan`), `PlanPage.tsx` (lee perfil, último peso y sesiones de 4 semanas), `usePlanInputs.ts`. Textos `es.plan`. Pruebas: `calorie.test.ts` (tabla de casos, pisos, IMC, tope), `PlanProposal.test.tsx`, `planCopy.test.ts` (lenguaje neutral), e2e dentro de `onboarding.spec.ts` y `plan.spec.ts`.

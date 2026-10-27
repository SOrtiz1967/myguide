# Plan: Primer ingreso y objetivo físico

**Spec**: `specs/014-onboarding-objetivo/spec.md`

## Datos

Migración `20261027000100_onboarding_profile.sql` agrega a `public.profiles`: `goal_type`, `experience`, `job_activity`, `training_days` y `onboarding_completed_at`, con `CHECK` por valor. Se amplía el `GRANT UPDATE` por columna a esas cinco. `private.validate_profile` exige, cuando `onboarding_completed_at` pasa a tener valor, sexo, fecha de nacimiento (18 a 120 años), altura, zona horaria, objetivo, experiencia, trabajo y días; el error es `invalid_onboarding:<motivo>`. Sin tablas nuevas: el peso usa `save_measurement` (spec 008) y el objetivo, `set_energy_goal` (spec 004).

## Cliente

- `features/onboarding/`: `onboarding.ts` (opciones, validación por paso, esquema del borrador), `OnboardingPage.tsx` (pasos 1 a 3 y confirmación), `useOnboardingSave.ts` (perfil → peso → objetivo, ids de solicitud fijos por montaje).
- `features/profile/`: `api.ts` y `profileValues.ts` con los campos nuevos; `GoalProfileForm.tsx` en `/perfil`.
- `routes/RequireOnboarding.tsx` dentro de `RequireAuth`; ruta `/bienvenida` fuera de ese guardia pero dentro de `RequireAuth`.
- El paso final reutiliza `PlanProposal` de la spec 015.

## Pruebas

pgTAP `onboarding_profile`; Vitest de reglas, formulario y guardia; e2e `onboarding.spec.ts`. El helper `register` de los e2e marca el recorrido como completo por SQL para no cambiar las demás pruebas; `registerRaw` queda para esta.

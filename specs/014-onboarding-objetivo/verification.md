# Verificación: specs 014 y 015

**Fecha**: 2026-10-27

| Requisito | Dónde se comprueba | Resultado |
|---|---|---|
| 014 FR-001 (guardia del primer ingreso) | `RequireOnboarding.test.tsx`, `onboarding.spec.ts` (`/medidas` lleva a `/bienvenida`) | Cumple |
| 014 FR-002, FR-009 (pasos, borrador, volver, accesibilidad) | `onboarding.spec.ts` (axe en pasos 1, 2, 4; volver; borrador al recargar) | Cumple |
| 014 FR-003, FR-004 (datos y mayoría de edad, también en la base) | `onboarding.test.ts`, `onboarding_profile.test.sql`, `onboarding.spec.ts` (menor de edad) | Cumple |
| 014 FR-005 (guardado ordenado e idempotente) | `onboarding.spec.ts` (perfil, peso y objetivo guardados; terminar sin objetivo) | Cumple |
| 014 FR-006 (editar objetivo y actividad en el perfil) | `GoalProfileForm` (compila y se monta en `/perfil`; `profile.spec.ts` sigue verde) | Cumple |
| 014 FR-007 y 015 FR-009 (lenguaje neutral) | `onboarding.test.ts` (`findTrainingForbidden` sobre `es.onboarding`, `es.plan`, `es.profile.goalForm`) | Cumple |
| 015 FR-001 a FR-006 (fórmula, entrenos, ajustes, pisos, IMC, tope, proteína) | `calorie.test.ts` (13 casos a mano) | Cumple |
| 015 FR-007 (método a la vista; sin datos no calcula) | `PlanProposal.test.tsx`, `calorie.test.ts` (`planInputFrom`) | Cumple |
| 015 FR-010 (`/plan` recalcula y confirma) | `onboarding.spec.ts` (otro valor 2.400 guardado) | Cumple |

Suite: format, lint, `npm run typecheck`, Vitest (94 archivos, 1 097 pruebas), pgTAP (51 archivos, 1 356 pruebas) y e2e de onboarding, auth, perfil, inicio, acceso y cambio de sesión en verde.

Pendiente de la verificación manual: los números (factores, MET, porcentajes, pisos) son convenciones; ver `research_notes/Onboarding calorías y vista semanal/calculo_calorico.md`.

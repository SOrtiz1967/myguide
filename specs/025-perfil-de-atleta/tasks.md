# Tareas: Perfil de atleta

**Entrada**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261126000100_athlete_profile.sql`: tablas `athlete_goals` y `athlete_availability` (historiales de filas que nunca se actualizan, `effective_from` no anterior a la última vigente), `athlete_preferences` (una fila por persona; `priority_muscles` hasta 5, `meals_per_day` 1–8, `usual_sleep_minutes` 60–960, `perceived_recovery` 1–5, `approx_steps` 0–100000, `effort_scale` `rir`|`rpe` por defecto `rir`) y `athlete_item_preferences` (`kind` ∈ `exercise_favorite`, `exercise_avoided`, `food_avoided`; exactamente uno de `exercise_id`/`food_id`, `on delete cascade`, único por usuario, tipo e ítem). Todas con `user_id`, RLS de lectura propia y sin escritura directa.
- [x] T002 En la misma migración, funciones `security definer` con `private.is_session_fresh()` e idempotencia por `client_request_id`: `save_athlete_goals` (1–3 objetivos, prioridades 1–3 sin repetir, `custom` con texto de 1–60 caracteres, `apply_to_profile` actualiza `profiles.goal_type` en la misma transacción solo si el objetivo 1 tiene equivalente), `save_athlete_availability` y `save_athlete_preferences` (reemplaza la lista de preferencias por ítem; un ejercicio no puede ser favorito y evitado). Errores `invalid_athlete:<motivo>:<campo>`.
- [x] T003 Migración `supabase/migrations/20261126000200_athlete_privacy.sql`: agrega las cuatro tablas a `export_my_data()` y verifica el borrado en cascada con la cuenta.
- [x] T004 Prueba pgTAP `supabase/tests/athlete_profile.test.sql`: esquema, RLS (aislamiento entre cuentas), rangos, idempotencia, vigencia no retroactiva, mapeo a `goal_type`, exportación y borrado; el guardián de RLS existente debe seguir en verde.

## Fase 2: Historia 1 — Completar mi contexto deportivo (P1)

- [x] T005 [US1] `app/src/features/athlete/athlete.ts`: tipos, validación y mapeo de objetivos (puro, determinista) con prueba `app/tests/unit/athlete.test.ts`.
- [x] T006 [US1] `app/src/features/athlete/api.ts` y `useAthlete.ts`: leer perfil vigente y llamar a las tres funciones con `client_request_id`, errores seguros y sin mostrar guardado hasta la confirmación del servidor.
- [x] T007 [US1] Copy `athlete` en `app/src/copy/es.ts`, neutral y con tuteo; cada bloque explica para qué se usa el dato.
- [x] T008 [US1] `GoalsForm.tsx`, `AvailabilityForm.tsx` y `PreferencesForm.tsx` con las piezas de la spec 014 (`Field`, `ChoiceGroup`, `Card`); selección de ejercicios y alimentos desde el catálogo; todo opcional; datos de la 014 de solo lectura con enlace a su edición.
- [x] T009 [US1] `AthleteProfilePage.tsx` y enlace desde `app/src/features/profile/ProfilePage.tsx`; estados vacío, de carga y de error; conserva lo escrito si el guardado falla.

## Fase 3: Historia 2 — Cambiar mi perfil sin reescribir el pasado (P1)

- [x] T010 [US2] Historial en `AthleteProfilePage.tsx`: lista de objetivos y disponibilidad con su vigencia; fecha de vigencia no anterior a la última; aviso neutral que ofrece revisar el objetivo calórico sin cambiarlo (FR-009).

## Fase 4: Historia 3 — Ver y exportar (P2)

- [x] T011 [US3] Resumen legible del perfil de atleta y verificación de que «Tus datos» (spec 011) lo descarga y la eliminación de cuenta lo borra.

## Fase 5: Pruebas y cierre

- [ ] T012 Prueba de componentes `app/tests/component/AthleteProfile.test.tsx`.
- [ ] T013 Prueba e2e `app/tests/e2e/athlete-profile.spec.ts` (recorrido, recarga, vigencia, aislamiento) y accesibilidad a 375 y 1280 px.
- [ ] T014 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [ ] T015 Playwright de perfil y accesibilidad; actualizar `Documentacion/roadmap-specs.md` y `README.md`.

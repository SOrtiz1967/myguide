# Tareas: Recordatorios configurables

**Entrada**: [spec.md](spec.md), [plan.md](plan.md). Las rutas son relativas a la raíz del repositorio.

## Fase 1: Base de datos

- [x] T001 Migración `supabase/migrations/20261030000400_reminders.sql`: tabla `reminders`, `set_reminder`, `snooze_reminder`, migración y baja de `profiles.weight_reminder`.
- [x] T002 Prueba pgTAP `supabase/tests/reminders.test.sql` y ajuste de `supabase/tests/onboarding_profile.test.sql`.

## Fase 2: Regla y datos

- [x] T003 [US2] `app/src/features/reminders/due.ts`: regla pura de cuándo corresponde un aviso (frecuencias, último registro, hoy ya registrado, «más tarde»).
- [x] T004 [US1] `app/src/features/reminders/api.ts` y `useReminders.ts`: leer, configurar, posponer, última foto y datos del día.
- [x] T005 [US1] Copy `reminders` en `app/src/copy/es.ts`, neutral y con tuteo.

## Fase 3: Historia 1 — Configurar

- [x] T006 [US1] `RemindersSection.tsx` en el perfil: interruptor y frecuencia de cada recordatorio, validación, estados y mensajes.
- [x] T007 [US1] Quitar la casilla de `GoalProfileForm.tsx`, `weight_reminder` de `app/src/features/profile/api.ts` y el aviso suelto de `app/src/features/week/DayPanel.tsx`.

## Fase 4: Historias 2 y 3 — Aviso en el inicio

- [x] T008 [US2] `ReminderCards.tsx` e integración en `app/src/routes/HomePage.tsx`: tarjetas, accesos directos, «Más tarde» y «Desactivar», aislamiento de fallos.

## Fase 5: Pruebas y cierre

- [x] T009 Pruebas unitarias `app/tests/unit/reminderDue.test.ts` y de componentes `app/tests/component/Reminders.test.tsx`; ajuste de las pruebas que mencionaban `weight_reminder`.
- [x] T010 Prueba e2e `app/tests/e2e/reminders.spec.ts` (recorrido, aislamiento y accesibilidad a 375 y 1280 px) y reemplazo de la prueba de la casilla en `app/tests/e2e/week.spec.ts`.
- [x] T011 Correr pgTAP, lint, formato, typecheck y Vitest completos; leer el resultado.
- [x] T012 Playwright de recordatorios (4 e2e: recorrido, validación y aislamiento, accesibilidad a 375 y 1280 px) y de semana, perfil e inicio, una parte por vez; la corrida completa de todas las specs sigue pendiente.
- [x] T013 Actualizar `Documentacion/roadmap-specs.md` y `README.md`.

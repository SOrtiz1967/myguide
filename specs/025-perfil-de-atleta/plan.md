# Plan de implementación: Perfil de atleta

**Rama**: `025-perfil-de-atleta` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

El perfil de atleta extiende el perfil de la spec 014 sin duplicar nada de lo que esa spec ya guarda. Se agregan tres piezas: una lista de objetivos con prioridad y vigencia, un bloque de disponibilidad con vigencia, y un conjunto de preferencias (ejercicios, alimentos, músculos) más contexto de recuperación. Los valores que afectan cálculos futuros se guardan como filas con fecha de vigencia (historial por cambio, sin actualizar ni borrar), igual que `energy_goals` en la spec 004. Las preferencias y el contexto de recuperación son datos blandos: se guardan en una tabla de una fila por persona. Nada de esto modifica el objetivo calórico (FR-009).

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126000100_athlete_profile.sql` con las tablas `athlete_goals`, `athlete_availability`, `athlete_preferences` y `athlete_item_preferences`, y las funciones `save_athlete_goals`, `save_athlete_availability` y `save_athlete_preferences`. Sin servicios ni dependencias nuevas.
- **Aplicación**: TypeScript y React; datos con TanStack Query; formularios con las piezas de la spec 014 (`Field`, `ChoiceGroup`, `Card`). Carpeta nueva `app/src/features/athlete/` y una sección enlazada desde `/perfil`.
- **Pruebas**: pgTAP para esquema, RLS e idempotencia; Vitest para validación y mapeo de objetivos; Playwright para el recorrido completo y accesibilidad.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I (privacidad y propiedad) | Se cumple: todas las tablas con `user_id`, RLS con lectura propia y escritura solo por funciones `security definer` con sesión fresca; entran en `export_my_data()` y se borran en cascada con la cuenta. |
| II (historial inmutable) | Se cumple: objetivos y disponibilidad con vigencia; cada cambio agrega una fila y no reescribe el pasado. |
| III | No aplica. |
| IV (no coercitivo) | Se cumple: todo opcional, textos neutrales, las preferencias no se convierten en restricciones (FR-008). |
| V (entrenamiento y recuperación) | Se cumple: el sueño y la recuperación declarados se rotulan como contexto declarado. |
| VI (accesibilidad) | Se cumple: campos con etiqueta, 360 px, axe a 375 y 1280 px. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Objetivo principal.** `profiles.goal_type` (spec 014) sigue siendo el objetivo del cálculo calórico (spec 015). La lista nueva guarda hasta 3 objetivos con prioridad; si el de prioridad 1 tiene equivalente (hipertrofia → `muscle_gain`, pérdida gradual de grasa → `fat_loss`, recomposición → `recomposition`) y la persona lo confirma, `save_athlete_goals` actualiza `goal_type` en la misma transacción. Los demás objetivos no tocan `goal_type`.
- **Vigencia.** `athlete_goals` y `athlete_availability` son historiales de filas que nunca se actualizan. El vigente es la fila de `created_at` más reciente con `effective_from <= hoy`. La fecha de vigencia no puede ser anterior a la última vigente (FR-007).
- **Preferencias sin historial.** Favoritos, evitados, músculos prioritarios y contexto de recuperación son del presente: se actualizan en una sola fila por persona y no afectan registros pasados.
- **Referencias a catálogos.** `athlete_item_preferences` apunta al ejercicio o alimento con `on delete cascade`; borrar un elemento propio quita la preferencia sin romper el perfil.
- **Escala RIR/RPE.** La preferencia de la spec 029 vive en `athlete_preferences.effort_scale` (`rir` o `rpe`, por defecto `rir`).
- **Datos que no se piden dos veces.** Sexo, nacimiento, altura, experiencia, trabajo y días de entrenamiento se muestran de solo lectura con un enlace a su edición actual.
- **Sexo y nacimiento obligatorios.** Se mantiene lo decidido en 014.

## Contratos (funciones de base)

- `save_athlete_goals(goals jsonb, effective_from date, apply_to_profile boolean, request_id uuid)`: valida 1 a 3 objetivos, prioridades distintas y objetivo personalizado con texto de 1 a 60 caracteres. Error `invalid_athlete:<motivo>:<campo>`.
- `save_athlete_availability(days_per_week smallint, session_minutes smallint, usual_time text, place text, equipment text[], effective_from date, request_id uuid)`.
- `save_athlete_preferences(prefs jsonb, request_id uuid)`: músculos prioritarios, comidas por día, sueño habitual, recuperación percibida, pasos aproximados, escala de esfuerzo y la lista completa de preferencias por ítem (se reemplaza).
- Todas son idempotentes por `request_id` y fijan el «hoy» de la persona en el servidor.

## Estructura de archivos

```text
supabase/migrations/20261126000100_athlete_profile.sql
supabase/migrations/20261126000200_athlete_privacy.sql   # agrega las tablas a export_my_data()
supabase/tests/athlete_profile.test.sql
app/src/features/athlete/{AthleteProfilePage,GoalsForm,AvailabilityForm,PreferencesForm,api,athlete,useAthlete}.ts(x)
app/src/features/profile/ProfilePage.tsx
app/src/copy/es.ts
app/tests/{unit/athlete.test.ts,component/AthleteProfile.test.tsx,e2e/athlete-profile.spec.ts}
```

## Verificación

pgTAP completo (incluido el guardián de RLS), lint, formato, typecheck, Vitest completo y Playwright de perfil y accesibilidad. Comprobar que la exportación y la eliminación de cuenta (spec 011) incluyen las tablas nuevas.

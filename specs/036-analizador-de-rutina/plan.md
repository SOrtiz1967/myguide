# Plan de implementación: Analizador de rutina

**Rama**: `036-analizador-de-rutina` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

En MyGuide una **rutina** (spec 006) es una lista de ejercicios con series, equivalente a **una sesión**; no tiene días propios. La «distribución semanal» y la frecuencia por grupo salen del **plan semanal** (spec 018), que asigna una rutina a cada día. Por eso el analizador tiene dos niveles, ambos puros y del lado del cliente, sin tablas ni funciones nuevas: (1) el análisis de **una rutina** (series directas e indirectas por grupo en esa sesión, ejercicios repetidos, duración estimada) y (2) el análisis de **la semana** cuando las rutinas están asignadas a días (series y frecuencia semanal por grupo, descanso entre sesiones del mismo grupo, comparación con objetivos y prioridades del perfil). Las observaciones se arman con plantillas a partir de los números.

## Contexto técnico

- **Base de datos**: solo una pequeña migración `supabase/migrations/20261126001900_dismissed_observations.sql` con la tabla `routine_observation_dismissals` y la función `dismiss_observation` para ocultar observaciones. El resto se lee de `routines`, `routine_exercises`, `exercises` y `weekly_plan_days`. Para poder agrupar por músculo sin llamadas adicionales se usan los músculos actuales del catálogo (las rutinas no tienen instantánea; son plantillas editables).
- **Aplicación**: `app/src/features/training/analyzer/` con `analyzeRoutine()` y `analyzeWeek()` (puros), reutilizando `muscleGroups.ts` y la regla directa/indirecta de la spec 031; `RoutineAnalysisPage` (ruta `/entrenamiento/rutinas/:id/analisis`), `WeekAnalysisCard` y las observaciones.
- **Pruebas**: Vitest con rutinas armadas a mano (equilibrada, concentrada en brazos, con ejercicios sin músculos, con cardio, vacía) y revisión de textos; pgTAP para la tabla; Playwright para ver, ocultar y navegar.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: la tabla nueva tiene `user_id`, RLS propia y escritura por función con sesión fresca; el análisis solo lee lo propio. |
| II | Se cumple: el análisis no modifica ninguna rutina ni sesión; es derivado. |
| IV | Se cumple: observaciones neutrales, sin órdenes ni «rutina ideal»; una rutina sin observaciones no se llama «óptima». |
| V | Se cumple: la duración estimada muestra método y supuestos; no se afirma lo que no se puede saber. |
| VI | Se cumple: pantalla accesible, gráficos con tabla alternativa, 360 px. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Dos niveles.** Rutina (por sesión) y semana (según el plan semanal de la spec 018). Si el plan semanal no tiene rutinas, solo se ofrece el nivel de rutina. Rutinas rotativas se analizan una por una.
- **Reutilizar el cálculo de volumen.** La función de series por grupo es la misma de la spec 031 (se extrae a una utilidad compartida `muscleSets()`), para que las dos pantallas coincidan.
- **Duración estimada.** `series × (tiempo bajo tensión + descanso)` más calentamiento: 45 segundos de ejecución por serie, descanso de 90 segundos para ejercicios compuestos con carga, 60 segundos para aislamiento, y 5 minutos de calentamiento. Los valores son supuestos documentados y se muestran con la fórmula; la rutina no guarda descansos. Se presenta como rango (±20 %).
- **Observaciones.** Reglas con plantillas (sin IA): distribución desigual (un grupo con más del doble que otro de igual prioridad), grupo prioritario del perfil con pocas series, frecuencia semanal de 1 para un grupo con muchas series, ejercicios repetidos, sesiones consecutivas con el mismo grupo grande, ejercicios sin músculos, duración mayor a la disponibilidad declarada (spec 025). Cada observación lleva el dato, la comparación y una opción neutral.
- **Prioridades del perfil.** Si existe el perfil de atleta (spec 025) se comparan los grupos prioritarios y la duración con la disponibilidad; si no, solo se compara el reparto interno.
- **Ocultar.** `routine_observation_dismissals(user_id, scope_key, observation_key, data_hash)`: reaparece si cambian los datos (el `data_hash` de la rutina o el plan).
- **Sin aplicar cambios.** El analizador nunca modifica la rutina.

## Contratos (función de base)

- `dismiss_observation(scope_key text, observation_key text, data_hash text, request_id uuid) returns void`: `scope_key` es `routine:<id>` o `week`; textos de 1 a 80 caracteres. Error `invalid_observation:<motivo>:<campo>`.

## Estructura de archivos

```text
supabase/migrations/20261126001900_dismissed_observations.sql
supabase/tests/dismissed_observations.test.sql
app/src/features/training/muscleSets.ts                 # compartido con la spec 031
app/src/features/training/analyzer/{analyzeRoutine,analyzeWeek,duration,observations,config,api}.ts(x)
app/src/features/training/analyzer/{RoutineAnalysisPage,WeekAnalysisCard,ObservationList}.tsx
app/src/features/training/RoutineDetailPage.tsx
app/src/copy/es.ts
app/tests/{unit/analyzeRoutine.test.ts,unit/analyzeWeek.test.ts,component/RoutineAnalysisPage.test.tsx,e2e/routine-analysis.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de entrenamiento y accesibilidad. Revisión de textos: ninguna observación usa «debés», «tenés que» ni «ideal».

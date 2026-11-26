# Plan de implementación: Progresión automática de entrenamiento

**Rama**: `030-progresion-entrenamiento` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

La sugerencia de cada ejercicio es una **función pura del cliente** sobre el historial que ya devuelve `exercise_history` (spec 006): doble progresión con un rango de repeticiones por ejercicio. No se guarda (se recalcula con los datos vigentes) y no usa IA. Lo único que se persiste es el **criterio** de cada ejercicio (rango, incremento y activación) en una tabla chica de una fila por persona y ejercicio. La sugerencia aparece al abrir una sesión, junto a cada ejercicio del plan de la sesión, y en el historial del ejercicio.

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126000900_progression_settings.sql` con la tabla `exercise_progression_settings` y la función `save_progression_setting`. Sin cambios en tablas existentes (los ítems del plan de sesión tienen una sola `target_reps`; el rango vive en el criterio, no en el plan).
- **Aplicación**: `app/src/features/training/progression/` con `suggestNext()` (puro), `useSuggestion` (lee `exercise_history` de las últimas sesiones), `SuggestionCard` (con «por qué»), y un formulario de criterio por ejercicio. Mejora con el esfuerzo por serie (spec 029) pero funciona sin él.
- **Pruebas**: Vitest con historiales armados a mano para cada regla (mantener, subir peso, bajar, insuficiente, ejercicios sin carga, por duración), pgTAP para la tabla, y Playwright para ver, aceptar, editar e ignorar la sugerencia.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: tabla con `user_id`, RLS propia, escritura por función con sesión fresca; entra en exportación y eliminación. |
| II | Se cumple: la sugerencia no se guarda ni modifica sesiones pasadas. |
| IV | Se cumple: «podés intentar…», sin presionar, ignorable; nunca se aplica sola. |
| V | Se cumple: no se concluye con una sola sesión; con datos insuficientes se dice «sin información suficiente». |
| VI | Se cumple: tarjeta accesible, 44 px, sin desplazamiento horizontal a 360 px. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Doble progresión.** Con un rango de repeticiones [mín, máx] y un incremento de carga:
  1. Si en las últimas dos sesiones el peso fue el mismo y todas las series llegaron al máximo del rango (con esfuerzo, si se registró, no mayor al límite de seguridad, ver research), se sugiere subir el peso en el incremento y volver al mínimo del rango.
  2. Si no, se sugiere mantener el peso y buscar más repeticiones que la última vez en alguna serie.
  3. Si en la última sesión no se alcanzó el mínimo del rango en ninguna serie, se sugiere mantener el peso (no se baja la carga por una sola sesión) y solo tras dos sesiones seguidas por debajo del mínimo se ofrece una reducción del 5 al 10 %.
- **Historial mínimo.** Dos sesiones realizadas del mismo ejercicio en las últimas 8 semanas; con menos, «sin información suficiente».
- **Esfuerzo.** Si hay `effort_rpe` por serie (spec 029) y el promedio de la última sesión es de 9,5 o más, no se sugiere subir el peso aunque se haya alcanzado el máximo. Sin esfuerzo se usa solo el rendimiento y se indica.
- **Rango predeterminado.** 8–12 repeticiones e incremento de 2,5 kg para ejercicios de carga externa; 8–15 repeticiones sin incremento de peso para peso corporal (progresión por repeticiones). Ejercicios por duración o distancia: solo «superar el valor anterior», sin rango.
- **Aplicación en la sesión.** Cuando se crea una sesión desde una rutina, la sugerencia se muestra como texto junto a las series planificadas; **no** reescribe `target_weight_kg` ni `target_reps` del plan. La persona decide cargarlo o ignorarlo.
- **Un criterio por persona y ejercicio.** Se lee en el momento; borrar o eliminar el ejercicio no afecta el historial.
- **Fatiga reciente.** Si existe la spec 034, una recuperación declarada baja en los últimos 3 días agrega una nota («tu recuperación declarada viene baja») pero no cambia el número sugerido.

## Contratos (función de base)

- `save_progression_setting(exercise_id uuid, rep_min smallint, rep_max smallint, increment_kg numeric, enabled boolean, request_id uuid) returns void`: valida 1 ≤ rep_min < rep_max ≤ 50, incremento entre 0 y 20 kg en pasos de 0,25 y que el ejercicio exista y sea visible para la persona. Error `invalid_progression:<motivo>:<campo>`.

## Estructura de archivos

```text
supabase/migrations/20261126000900_progression_settings.sql
supabase/migrations/20261126001000_progression_privacy.sql
supabase/tests/progression_settings.test.sql
app/src/features/training/progression/{suggestNext,defaults,useSuggestion,useProgressionSetting}.ts(x)
app/src/features/training/progression/{SuggestionCard,ProgressionSettingForm}.tsx
app/src/features/training/{SessionExerciseCard,ExerciseHistoryPage}.tsx
app/src/copy/es.ts
app/tests/{unit/suggestNext.test.ts,component/SuggestionCard.test.tsx,e2e/progression.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de entrenamiento y accesibilidad. Verificar a mano al menos diez historiales (incluidos ejercicios por duración, sin carga y con una sola sesión).

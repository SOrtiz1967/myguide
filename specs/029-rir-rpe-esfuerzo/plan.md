# Plan de implementación: RIR/RPE y esfuerzo por serie

**Rama**: `029-rir-rpe-esfuerzo` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

Hoy el esfuerzo se registra **por ejercicio** de una sesión (`session_exercises.effort`, entero de 1 a 10, spec 006) y no por serie. Esta spec agrega el esfuerzo **por serie** en `session_sets` con una representación interna única (RPE) y deja que la persona lo cargue y lo vea en RIR o en RPE según su preferencia. El esfuerzo por ejercicio ya existente se conserva sin cambios y sin migrar (es otro dato: una valoración global del ejercicio); donde hay esfuerzo por serie, los gráficos y el historial lo usan; donde no, siguen mostrando el del ejercicio.

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126000800_set_effort.sql` que agrega `session_sets.effort_rpe numeric(3,1)` (1,0 a 10,0 en pasos de 0,5) y `session_sets.note text`, actualiza `private.clean_session_set` para aceptar las claves `effort_rpe` y `note`, y actualiza `exercise_progress` y `exercise_history` para devolverlas. `save_session` ya recibe las series como `jsonb`, de modo que el contrato crece de forma retrocompatible.
- **Aplicación**: `app/src/features/training/` — nuevo `effortScale.ts` (conversiones y etiquetas), un selector de esfuerzo por serie dentro de la fila de serie de `SessionExerciseCard`, y la visualización en `HistoryEntryView` y en el gráfico de progreso (`progress/series.ts`). La preferencia de escala se lee del perfil de atleta (spec 025) con RIR como valor por defecto hasta que exista.
- **Pruebas**: pgTAP (rango, pasos, retrocompatibilidad, series viejas intactas), Vitest para conversiones y formateo, Vitest de componentes para el selector y Playwright para cargar, guardar y reabrir una sesión.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: columnas nuevas de una tabla con RLS propia; entran en exportación y eliminación sin cambios de política. |
| II | Se cumple: las series existentes no se modifican; el esfuerzo faltante es `null`, nunca se completa. |
| IV | Se cumple: el esfuerzo es un dato de la persona; ningún texto lo juzga. |
| V | Se cumple: esfuerzo percibido por serie como pide el principio; con distinto esfuerzo, las series no se tratan como equivalentes. |
| VI | Se cumple: control con un toque adicional por serie, 44 px, accesible por teclado. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Representación interna: RPE.** Se guarda `effort_rpe` (1,0 a 10,0, pasos de 0,5). RIR se obtiene como `10 − RPE` para valores enteros de RPE entre 6 y 10 (RIR 0 a 4) y se admite RIR de 0 a 9 → RPE 10 a 1 al convertir. Se elige RPE porque es una única escala acotada y ordenada que se puede comparar sin ambigüedad. La equivalencia usada se muestra en pantalla («RIR 2 ≈ RPE 8»).
- **Rango.** La spec pide RIR 0 a 10 y RPE 1 a 10; como RIR 10 equivaldría a RPE 0 (sin esfuerzo), se acota RIR a 0–9. Registrado como ajuste menor respecto del texto de la spec.
- **El esfuerzo por ejercicio no se toca.** Sigue en `session_exercises.effort` con su selector actual; se rotula «Esfuerzo del ejercicio» y la nueva columna «Esfuerzo de la serie».
- **Escala preferida.** Solo cambia cómo se muestra y se carga; los datos guardados no cambian al cambiar de escala (FR-007).
- **Un toque más por serie.** El selector aparece colapsado como un botón «Esfuerzo» en la fila de la serie; abrirlo muestra los valores como opciones táctiles. Recordar el último valor usado en la sesión para repetir con un toque.
- **Copiar una sesión o rutina no copia el esfuerzo** (es un dato real), igual que los pesos y repeticiones reales.
- **Nota por serie.** Opcional, hasta 200 caracteres; se limpia como el resto de los textos de la sesión.

## Contratos

- `save_session(...)`: cada serie del `jsonb` acepta `effort_rpe` (número de 1 a 10, múltiplo de 0,5) y `note` (texto de 1 a 200). Un valor fuera de rango lanza `invalid_session:invalid_effort:sets`. Si falta, queda `null`.
- `exercise_progress(exercise_id)` y `exercise_history(...)`: las series devueltas incluyen `effort_rpe` y `note` cuando existen (`jsonb_strip_nulls`).

## Estructura de archivos

```text
supabase/migrations/20261126000800_set_effort.sql
supabase/tests/set_effort.test.sql
app/src/features/training/{effortScale,SetEffortPicker,SessionExerciseCard,HistoryEntryView,sessionEditorState,schema,api}.ts(x)
app/src/features/training/progress/{series,ProgressChart}.ts(x)
app/src/copy/es.ts
app/tests/{unit/effortScale.test.ts,component/SetEffortPicker.test.tsx,e2e/set-effort.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de entrenamiento (sesión, historial, progreso) y accesibilidad. Comprobar que las series previas siguen mostrándose sin esfuerzo y que un historial con dos series de igual peso y repeticiones y distinto esfuerzo las muestra distintas.

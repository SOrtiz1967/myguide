# Plan de implementación: Estimación de comidas con IA

**Rama**: `009-estimacion-comidas-ia` | **Fecha**: 2026-11-01 | **Spec**: [spec.md](spec.md) | **Contrato**: [contracts/estimate-meal.md](contracts/estimate-meal.md)

## Resumen

Una Edge Function nueva, `estimate-meal`, recibe el texto de la comida, llama a Gemini a través de un adaptador propio, valida la respuesta contra un esquema estricto y devuelve una lista de ítems. La aplicación muestra esa lista como propuesta editable que no se guarda; al confirmar, una función de base de datos, `add_estimated_entries`, inserta todos los ítems juntos con origen «estimado» y estado confirmado. La misma consulta sirve para completar los campos del formulario manual. Cada consulta es idempotente y conserva su resultado 24 horas. La foto del plato (historia 6) reutiliza la función y la pantalla de revisión y se entrega al final.

## Contexto técnico

- **Proveedor (decisión #3):** Gemini, modelo `GEMINI_MODEL` (por omisión `gemini-2.5-flash`), clave `GEMINI_API_KEY` solo en el servidor. Salida estructurada por JSON Schema del propio proveedor (`responseMimeType: application/json` y `responseSchema`), que se vuelve a validar en la función. El adaptador (`supabase/functions/_shared/gemini.ts`) es lo único que conoce a Google: recibe `fetch` por inyección para probarlo con respuestas simuladas.
- **Cuota (decisión #6):** 5 consultas por minuto y 30 por día por cuenta con `check_rate_limit` (ventana máxima de un día, la que ya limpia la tabla). La cuota del proveedor agotada (HTTP 429 de Google) se mapea a `quota_exhausted`. Las consultas repetidas con el mismo `request_id` se resuelven desde el resultado guardado antes de contar.
- **Base de datos:** `supabase/migrations/20261101000100_ai_estimates.sql`:
  - Tabla `ai_estimates (user_id, request_id, result jsonb, created_at)`, clave `(user_id, request_id)`, RLS activada sin políticas (solo la función con rol de servicio), `on delete cascade` con la cuenta. Los resultados de más de 24 horas se ignoran al leer y se borran al guardar uno nuevo.
  - `public.add_estimated_entries(entries jsonb, request_id uuid) returns uuid[]`: `security definer`, exige sesión vigente, recibe `{log_date, meal, items[]}` (1 a 12 ítems con los mismos campos que el alta manual), reutiliza `private.parse_log_date` y `private.validate_manual_values`, y inserta cada ítem con origen `estimated`, estado `confirmed` y `client_request_id` derivado de `request_id` y la posición (idempotente). Errores `invalid_entry:<motivo>:<campo>`.
  - Sin cambios en `meal_entries`: ya admite `origin = 'estimated'`.
- **Función `estimate-meal`:**
  - `supabase/functions/estimate-meal/{handler.ts,index.ts,index.test.ts}` y `supabase/functions/_shared/{gemini.ts,estimate.ts}` (esquema y validación, adaptador). `supabase/config.toml`: `[functions.estimate-meal] verify_jwt = false` (se verifica dentro, igual que `meal-photo`) y su prueba en `supabase/tests/config.test.ts`.
  - Registros: `estimate_meal` con `request_id` interno, `status`, `result` (`ok`, `cached`, `rate_limited`, `ai_unavailable`, `ai_timeout`, `ai_invalid`, `quota_exhausted`…), `ms` y cantidad de ítems; nunca el texto ni los valores.
- **Aplicación (`app/src/features/meals/ai/`):**
  - `api.ts` (`estimateMeal`, `confirmEstimate`, mapeo de errores), `estimate.ts` (tipos, conversión de ítem a texto de formulario y de formulario a carga), `EstimatePanel.tsx` (texto, estado de espera, errores), `EstimateReview.tsx` (ítems editables, quitar, agregar, destino, confirmar) y `useEstimate.ts`.
  - `AddEntryPage.tsx`: botón secundario «Describir con IA» junto a «Escribir a mano». `ManualEntryForm.tsx`: botón «Calcular con IA» opcional (historia 3).
  - `EntryDetailPage.tsx` y `SaveAsFoodPanel.tsx`: la acción «guardar como alimento propio» también para ítems estimados, con el aviso de que partieron de una estimación. Etiqueta `origin.estimated` pasa a «Estimado por IA».
  - Copy `es.meals.ai`, neutral y con tuteo.
- **Foto del plato (historia 6):** la función acepta además `multipart/form-data` con `photo` y `request_id`; reutiliza `_shared/jpeg.ts` para limpiar metadatos; el adaptador envía la imagen como parte en línea. La pantalla agrega «Estimar desde una foto» con el mismo selector que ya usa la foto de la comida.
- **Pruebas:** pgTAP (`add_estimated_entries`, aislamiento, idempotencia, rangos), Deno (validación de respuestas válidas e inválidas, adaptador con `fetch` simulado, manejador completo con dependencias simuladas, cuotas, caché, registros), Vitest (panel, revisión, errores, formulario manual), Playwright (recorrido completo con la función real y la IA simulada por un servidor local de pruebas, caída de la IA y accesibilidad a 375 y 1280 px).

## Revisión de la Constitution

| Principio                           | Resultado                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I (privacidad)                      | Se cumple: al proveedor solo va el texto (o la foto de la comida); sin identificadores ni perfil; clave solo en el servidor; resultados privados con RLS y borrado en cascada. |
| II (procedencia e integridad)       | Se cumple: origen «estimado» persistido; la estimación no pisa valores escritos; confirmación explícita; operaciones idempotentes.                                             |
| III (estimaciones transparentes)    | Se cumple: marcadas en texto, corregibles antes de guardar, no suman hasta confirmar; el fallo de la IA no impide la carga manual.                                             |
| IV (sin culpa ni juicios)           | Se cumple: textos neutrales, sin valorar la comida ni sugerir cantidades.                                                                                                      |
| VI (accesible y adaptable)          | Se cumple: espera anunciada, formularios operables por teclado, axe a 375 y 1280 px.                                                                                           |
| VII (arquitectura y pruebas con IA) | Se cumple: adaptador desacoplado, esquema estricto en ejecución y pruebas con respuestas simuladas, incluidas las malformadas.                                                 |
| IX (observabilidad)                 | Se cumple: registros estructurados de resultado, duración y motivo, sin contenido; conteo agregado de uso.                                                                     |

No hay violaciones que justificar.

## Decisiones de diseño

- **La propuesta no se guarda.** Evita el estado «pendiente» en la base, que no sumaría y exigiría limpiar abandonados. El estado `pending` sigue disponible, sin uso.
- **Caché por solicitud en la base**, no en memoria: las funciones pueden reiniciarse y el reintento tiene que resolverse igual.
- **`add_estimated_entries` en una sola transacción:** o se guardan todos los ítems o ninguno.
- **Esquema doble:** el proveedor recibe el esquema para guiar la salida, pero la función no confía en él y valida todo de nuevo; una respuesta con un solo ítem inválido se descarta entera.
- **Los gramos aproximados no se guardan:** `meal_entries` ya tiene `quantity_text`; la cantidad es solo texto.
- **Disponibilidad:** la aplicación no sabe si hay clave; ofrece la opción y la función responde `ai_unavailable` con un mensaje claro. Así la clave nunca se expone ni siquiera como «existe/no existe».

## Estructura de archivos

```text
supabase/migrations/20261101000100_ai_estimates.sql
supabase/tests/ai_estimates.test.sql
supabase/functions/_shared/{gemini,estimate}.ts · supabase/functions/_shared/estimate.test.ts · gemini.test.ts
supabase/functions/estimate-meal/{handler,index,index.test}.ts
supabase/config.toml · supabase/tests/config.test.ts
app/src/features/meals/ai/{api,estimate,useEstimate}.ts
app/src/features/meals/ai/{EstimatePanel,EstimateReview}.tsx
app/src/features/meals/{AddEntryPage,ManualEntryForm,EntryDetailPage,SaveAsFoodPanel}.tsx
app/src/copy/es.ts
app/tests/{unit/estimate.test.ts,component/EstimateMeal.test.tsx,e2e/estimate-meal.spec.ts}
```

## Verificación

pgTAP completo, pruebas Deno de funciones y de configuración, lint, formato, typecheck, Vitest completo y Playwright del recorrido, de la caída de la IA y de accesibilidad, una parte por vez.

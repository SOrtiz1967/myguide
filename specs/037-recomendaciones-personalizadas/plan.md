# Plan de implementación: Recomendaciones personalizadas

**Rama**: `037-recomendaciones-personalizadas` | **Fecha**: 2026-11-25 | **Spec**: [spec.md](spec.md)

## Resumen

Un **motor de reglas** del lado del cliente que no calcula nada nuevo: consume los resultados de las specs anteriores (progresión 030, volumen 031, récords 032, estancamiento 033, recuperación 034, adherencia 035, macros 026 y 027, tendencias 010) y los convierte en recomendaciones con dato de origen, período, confianza, acción sugerida y opción de ignorar. Cada regla es un módulo independiente que declara qué datos necesita; si una spec todavía no existe o faltan datos, la regla no se ejecuta y el área lo informa. Se persisten solo las preferencias de la persona (áreas ocultas) y las recomendaciones ignoradas. Las recomendaciones no se guardan: se recalculan con los datos vigentes.

## Contexto técnico

- **Base de datos**: una migración `supabase/migrations/20261126002000_recommendation_prefs.sql` con `recommendation_preferences` (áreas ocultas, una fila por persona) y `recommendation_dismissals` (reglas ignoradas con huella de datos), y las funciones `save_recommendation_preferences` y `dismiss_recommendation`.
- **Aplicación**: `app/src/features/recommendations/` con el registro de reglas (`rules/*.ts`), el motor `buildRecommendations()` (puro), la fuente de datos `useRecommendationContext` (reúne lecturas ya existentes con TanStack Query), `RecommendationsPage` (ruta `/recomendaciones`) y una tarjeta resumida en el inicio. Cada regla se prueba por separado.
- **Pruebas**: Vitest con contextos armados a mano por regla (con datos, sin datos, borde de umbral) y revisión de textos; pgTAP para las tablas; Playwright para ver, ignorar y ocultar áreas.

## Revisión de la Constitution

| Principio | Resultado |
| --- | --- |
| I | Se cumple: tablas con `user_id`, RLS propia y escritura por función con sesión fresca; ningún dato sale a servicios externos. |
| II | Se cumple: las recomendaciones son derivadas y no se almacenan como verdad histórica; ignorar no borra datos. |
| III | Se cumple: las reglas de nutrición respetan rangos e incertidumbre del objetivo y distinguen estimado de confirmado. |
| IV | Se cumple: sugerencias informativas con dato, sin órdenes ni culpa; sin ayuno, compensación ni restricción; un exceso calórico nunca genera una recomendación de recorte. |
| V | Se cumple: patrones observados con período y cantidad de datos, sin causalidad, sin conclusiones con datos insuficientes. |
| VI | Se cumple: tarjetas accesibles, 360 px, opción de ocultar. |

No hay violaciones que justificar.

## Decisiones de diseño

- **Reglas, no IA.** Cada regla es una función `(ctx) => Recommendation | null` con plantilla de texto. La IA no interviene; si más adelante se quisiera mejorar la redacción, recibiría solo la recomendación ya generada y no podría agregar datos ni cifras (fuera de esta spec).
- **Estructura de una recomendación.** `{ key, area, headline, origin: {metric, value, comparedTo, period, sampleSize}, confidence: 'high'|'medium'|'low', action, dataHash }`. `key` identifica la regla; `dataHash` cambia cuando cambian los datos que la originan.
- **Confianza.** Alta: datos de al menos 4 semanas y 10 registros que cumplen la regla con margen; media: al menos 2 semanas y 6 registros; baja: por debajo se muestra solo si la regla lo permite y con aviso. Debajo del mínimo de cada regla no se genera.
- **Reglas iniciales.** Entrenamiento: progresión disponible para un ejercicio (spec 030), nuevo récord reciente (032), estancamiento (033). Volumen: grupo con volumen por debajo del promedio de 4 semanas (031). Recuperación: sueño promedio menor que el habitual y recuperación declarada baja (034, 007). Adherencia: semana con adherencia menor a lo habitual (035). Nutrición: proteína promedio por debajo del rango objetivo (027), registro incompleto de comidas durante varios días (neutral, sin juicio).
- **Selección.** Máximo 5 recomendaciones visibles, ordenadas por confianza y recencia, a lo sumo 2 por área. Si dos reglas se contradicen (por ejemplo, subir carga y señal de recuperación baja), se muestra la de mayor confianza y la otra aparece como contexto en su detalle.
- **Ignorar.** Una recomendación ignorada no reaparece mientras su `dataHash` no cambie de forma relevante (cambio de más de un umbral en la métrica o 2 semanas más de datos).
- **Ocultar áreas.** La persona puede ocultar entrenamiento, volumen, recuperación o nutrición; se informa que está oculto y puede volver a activarse.
- **Sin conexión.** Se muestran las últimas calculadas con su fecha; no se genera nada nuevo sin datos frescos.
- **Señales de salud.** Si la spec 034 detecta una señal persistente, se muestra su nota neutral con sugerencia de apoyo profesional; no se transforma en una recomendación de entrenamiento.

## Contratos (funciones de base)

- `save_recommendation_preferences(hidden_areas text[], request_id uuid) returns void`: áreas de la lista cerrada.
- `dismiss_recommendation(rule_key text, data_hash text, request_id uuid) returns void`: `rule_key` de 1 a 80 caracteres; si ya existe, actualiza la huella y la fecha.

## Estructura de archivos

```text
supabase/migrations/20261126002000_recommendation_prefs.sql
supabase/migrations/20261126002100_recommendation_prefs_privacy.sql
supabase/tests/recommendation_prefs.test.sql
app/src/features/recommendations/{buildRecommendations,confidence,types,config}.ts
app/src/features/recommendations/rules/{progression,records,stagnation,volume,recovery,adherence,nutrition}.ts
app/src/features/recommendations/{useRecommendationContext,useRecommendations,api}.ts(x)
app/src/features/recommendations/{RecommendationsPage,RecommendationCard,AreaFilters}.tsx
app/src/features/home/HomePage.tsx
app/src/copy/es.ts
app/tests/{unit/rules.*.test.ts,unit/buildRecommendations.test.ts,component/RecommendationCard.test.tsx,e2e/recommendations.spec.ts}
```

## Verificación

pgTAP completo, lint, formato, typecheck, Vitest completo y Playwright de recomendaciones y accesibilidad. Revisión de textos: ninguna cadena contiene lenguaje de orden, culpa, compensación o causalidad. Verificar que sin datos suficientes no se genera ninguna recomendación.

# Investigación: PRs y récords personales

## Decisión 1: derivar los récords del historial

**Decisión**: función de lectura sobre las series de sesiones realizadas, sin tabla de récords.
**Razón**: la spec exige que se conserven y que solo cambien por corrección explícita; una tabla requeriría recalcularse ante correcciones y eliminaciones y podría desincronizarse. Derivarlos garantiza coherencia y es idempotente.
**Costo**: cada consulta recorre las series de un ejercicio (acotado a 2.000 sesiones, como la spec 012).
**Plan B si hay problemas de rendimiento**: tabla caché recalculable por ejercicio, nunca fuente de verdad.

## Decisión 2: estimación de 1RM

**Decisión**: fórmula de Epley (`peso × (1 + reps / 30)`), solo para 1 a 10 repeticiones.
**Fuentes a verificar**: Epley (1985); LeSuer et al. (1997) y la revisión de Brzycki sobre exactitud de fórmulas de predicción de 1RM. La precisión cae por encima de 10 repeticiones y varía por ejercicio.
**Presentación**: siempre como «1RM estimado», con el método y la salvedad; sin decimales falsos (redondeo a 0,5 kg).

## Decisión 3: tipos de récord

Se eligen los del documento de origen. «Mejor volumen» se divide en serie y sesión para evitar ambigüedad. «Mejor rendimiento dentro de un rango» se implementa como mayor peso en rangos de repeticiones 1–5, 6–10 y 11–15 (se pueden ajustar sin migración porque se calcula en la función con constantes documentadas).

## Decisión 4: primer registro

No se anuncia como récord; se muestra como punto de partida. Evita anunciar «récord» sin nada contra lo que comparar.

## Decisión 5: tono

Sobrio: «Nuevo registro: press inclinado, 27,5 kg × 10». Sin ranking, sin comparación con otras personas, sin metas de superación. Principio IV.

## Decisión 6: esfuerzo

El récord es un dato objetivo (peso, repeticiones); el esfuerzo percibido se muestra al lado pero no decide si hay récord. Principio V: dos rendimientos con distinto esfuerzo no se tratan como iguales, pero un récord objetivo sigue siéndolo.

## Preguntas que se resuelven al implementar

- Si conviene permitir ocultar los récords de un ejercicio (propuesta: no en esta spec).
- Cómo tratar series por peso corporal con lastre (propuesta: considerar el lastre como peso si el ejercicio lo registra; si no, solo repeticiones).


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- Epley (peso × (1 + reps/30)) y Brzycki (peso × 36/(37 − reps)): fórmulas NO verificadas en el original (Epley 1985, Brzycki 1993); comprobar antes de implementar.
- Precisión mejor con 3–5 reps y se degrada hacia 10+ (Macarilla 2022). Mostrar e1RM solo con ≤10 reps (mejor ≤6), nunca >12, como estimación con ±5 % (2–5 reps) y ±5–10 % (6–10). Peso muerto se subestima 9–14 % en un estudio: aviso aparte.
- **Decisión revisada**: PR real = cualquier superación del peso por repeticiones (sin umbral). «Progreso significativo» por e1RM: ≥~4–5 % (≥5 % si el e1RM viene de >5 reps o ejercicio nuevo), porque el CV mediano del 1RM es 4,2 % (Grgic 2020). El 2,5 % queda bajo el ruido.

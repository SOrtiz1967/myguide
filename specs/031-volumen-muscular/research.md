# Investigación: Volumen por grupo muscular

## Hallazgo: la sesión no guarda los músculos

`session_exercises` guarda `exercise_name` y `measurement_type`, pero no `primary_muscles` ni `secondary_muscles`. Leerlos del ejercicio actual haría que editar un ejercicio cambiara semanas pasadas y que los ejercicios eliminados (`exercise_id` en nulo) quedaran sin grupo. La spec asume una instantánea que hoy no existe; el plan la agrega.

## Decisión 1: instantánea de músculos

**Decisión**: columnas nuevas en `session_exercises`, llenas por disparador en el alta y por un relleno único para lo ya registrado.
**Limitación**: el relleno usa los músculos actuales del ejercicio, porque no hay otra información; se documenta en la verificación.

## Decisión 2: series directas e indirectas

**Decisión**: directa para músculos primarios, indirecta para secundarios; sin ponderar (no se cuenta 0,5 por serie indirecta).
**Razón**: simple, explicable y sin supuestos ocultos. La literatura discute factores de ponderación para el volumen indirecto, pero no hay consenso. Mostrar los dos números por separado evita imponer uno.
**Fuentes a verificar**: revisiones de Schoenfeld sobre dosis-respuesta del volumen semanal e hipertrofia (2017, 2019) y su discusión sobre volumen indirecto.

## Decisión 3: no hay «series recomendadas»

**Decisión**: no se muestran rangos «óptimos» de series por músculo.
**Razón**: Principio IV y la spec; los rangos varían según persona, experiencia, recuperación y ejercicio. La pantalla informa el dato y sugiere revisarlo con su objetivo y su rendimiento.

## Decisión 4: calentamientos

No hay marca de calentamiento en `session_sets`, así que se cuentan todas las series. Se informa en pantalla. Mejora futura posible: marca opcional por serie (fuera de esta spec).

## Decisión 5: semanas y zona horaria

`session_date` ya es una fecha en la zona de la persona. Semanas ISO (lunes a domingo). La semana en curso se marca incompleta.

## Decisión 6: agrupación en el cliente

La base devuelve los 18 valores del catálogo; el cliente los agrupa. Cambiar la agrupación no requiere migración ni afecta datos.

## Preguntas que se resuelven al implementar

- Si «hombros» debe separarse en frontal, lateral y posterior (el catálogo solo tiene `shoulders`; no se puede sin ampliar el catálogo).
- Cómo mostrar `full_body` (propuesta: contador aparte, sin sumar a ningún grupo).


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- Dosis-respuesta graduada con rendimientos decrecientes (Schoenfeld 2017: +0,37 % por serie semanal extra; Pelland 2026, 67 estudios). Rango orientativo 10–20 series duras/músculo/semana (Baz-Valle 2022: 12–20, 7 ensayos). Sin techo duro.
- MEV/MAV/MRV de Israetel/RP: sin artículo primario; no citarlos como científicos. Aviso suave bajo ~4–6 series (inferencia).
- Series indirectas: ponderación 0,5 con mayor respaldo relativo (Pelland 2026; texto completo no leído). A confirmar.
- Frecuencia: sin efecto a volumen igualado (Schoenfeld 2019; Grgic 2018): no penalizar 1 vez/semana.
- Serie efectiva: Robinson/Pelland 2024 sugiere 0–5 RIR (solo nota de prensa); definir RIR ≤4 y excluir calentamiento es práctica común, no hallazgo.

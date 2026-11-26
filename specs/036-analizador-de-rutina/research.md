# Investigación: Analizador de rutina

## Hallazgo: una rutina es una sesión

`routines` y `routine_exercises` (spec 006) no tienen días: una rutina es la plantilla de **una** sesión. La distribución semanal y la frecuencia por grupo existen solo cuando las rutinas se asignan a días de la semana en el plan (spec 018). La spec habla de «frecuencia» y «distribución semanal» de una rutina; el plan la interpreta como el análisis de la **semana** cuando hay rutinas asignadas, y como análisis de la sesión cuando no.

## Decisión 1: análisis sin IA

**Decisión**: reglas deterministas y plantillas de texto.
**Razón**: el documento de origen lo pide («la IA no debería ser necesaria»); los números se pueden verificar a mano. Una explicación en lenguaje natural generada por IA sería una spec aparte.

## Decisión 2: volumen directo e indirecto

**Decisión**: la misma regla que la spec 031 (primarios directos, secundarios indirectos), compartida en una utilidad común.
**Razón**: dos pantallas que cuentan distinto confundirían.

## Decisión 3: duración estimada

**Decisión**: 45 s por serie de ejecución, descanso de 90 s (compuestos con carga) o 60 s (aislamiento), 5 min de calentamiento, rango ±20 %.
**Fuentes a verificar**: revisión de Schoenfeld et al. (2016) sobre intervalos de descanso e hipertrofia y la posición de la ACSM sobre descansos entre series; los valores son supuestos de partida, la rutina no guarda descansos y la estimación siempre se presenta como aproximada.
**Cómo se distingue compuesto de aislamiento**: por la cantidad de músculos primarios del ejercicio (más de uno → compuesto); documentado.

## Decisión 4: reglas de observación

**Decisión**: reglas con umbrales documentados y configurables (por ejemplo, un grupo con más del doble de series que otro de la misma prioridad; un grupo prioritario por debajo de la mediana de los demás).
**Razón**: el documento pide observaciones del tipo «más volumen en brazos y pecho que en espalda». Los umbrales son punto de partida y se calibran con uso; las observaciones sugieren, no ordenan.
**Redacción**: «La rutina concentra más series en… que en… Si tu prioridad es…, podrías revisar la distribución.»

## Decisión 5: sin «rutina óptima»

Ninguna pantalla califica una rutina como buena o mala ni muestra un puntaje. Sin observaciones: «No encontramos nada para señalar con los datos de esta rutina.»

## Decisión 6: lectura del catálogo, sin instantánea

Las rutinas son plantillas editables y se analizan con los músculos actuales del catálogo; no es un dato histórico, a diferencia de las sesiones (spec 031).

## Decisión 7: ocultar observaciones

Se guarda qué observación se ocultó y un hash de los datos de la rutina o del plan; si cambian, la observación puede reaparecer.

## Preguntas que se resuelven al implementar

- Qué hacer cuando una rutina tiene ejercicios por duración o cardio (propuesta: se cuentan aparte en la duración y no en el volumen).
- Si conviene analizar también la semana real realizada (no solo el plan); propuesta: no en esta spec, ver las specs 031 y 035.


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- Equilibrio push/pull y duración máxima de sesión: sin evidencia primaria hallada; heurísticas.
- Descanso entre series: ventaja pequeña >60 s y nula más allá de 90 s con IC que incluyen cero (Singer 2024); 3 min > 1 min en entrenados (Schoenfeld 2016).
- No penalizar frecuencia 1 vez/semana por músculo si el volumen es adecuado (Schoenfeld 2019).

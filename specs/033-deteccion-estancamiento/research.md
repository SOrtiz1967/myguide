# Investigación: Detección de estancamiento

## Decisión 1: criterio de estancamiento

**Decisión**: cinco sesiones realizadas del mismo ejercicio, dentro de 12 semanas, sin «mejora clara» frente a la mejor sesión previa, excluyendo descargas y pausas.
**Razón**: coincide con el ejemplo del documento de origen («27,5 kg durante 5 sesiones»); cinco sesiones evitan reaccionar al ruido de una o dos y tres meses acotan la ventana.
**Para calibrar**: ejercicios con poca frecuencia (una vez cada 2 semanas) necesitan una ventana mayor; propuesta: exigir también que el tramo cubra al menos 3 semanas.

## Decisión 2: qué es una mejora clara

**Decisión**: +1 incremento de peso (por defecto 2,5 kg), o +1 repetición en la serie principal, o +2 % de volumen de la sesión, o igual rendimiento con menor esfuerzo percibido.
**Razón**: son cambios mayores que la variación normal entre sesiones; los umbrales son configurables y documentados. Se verifican con historiales reales antes de fijarlos.

## Decisión 3: factores observables sin causalidad

**Decisión**: mostrar factores que coinciden con el tramo (menos sueño, más esfuerzo, menos volumen, balance energético negativo, menos frecuencia, recuperación declarada baja) con período y cantidad de datos.
**Razón**: Principio V. La evidencia sobre qué causa un estancamiento es multifactorial; la aplicación no puede atribuir causa con datos observacionales de una sola persona.
**Redacción**: «También se observa…», «Durante el mismo período…», nunca «por», «debido a», «causa».

## Decisión 4: umbral de un factor

Un factor aparece solo si hay al menos el 70 % de los días con dato en ambos períodos y la diferencia supera un umbral (por ejemplo, sueño: 30 minutos de promedio; frecuencia: una sesión menos por semana). Sin datos suficientes el factor se omite y se aclara.

## Decisión 5: descargas y pausas

**Decisión**: tabla compartida `training_periods` (la reutiliza la spec 035).
**Razón**: una semana de descarga planificada o unas vacaciones no son estancamiento ni incumplimiento; el usuario es quien sabe cuándo ocurrieron.

## Decisión 6: aviso descartable

Si se descarta, vuelve solo tras 3 sesiones más sin mejora. Evita insistir, y no oculta para siempre un patrón real.

## Decisión 7: sin IA

Todo es determinista y verificable con historiales de prueba.

## Preguntas que se resuelven al implementar

- Si el mínimo de 5 sesiones debe variar con la frecuencia semanal del ejercicio.
- Cómo mostrar el aviso en ejercicios con rangos de repeticiones que cambiaron (propuesta: reiniciar la comparación desde el cambio, ver historial de la progresión de la spec 030).


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- No existe definición de plateau en N sesiones/semanas en literatura revisada. «5 sesiones» es **heurística propia**; etiquetarla así.
- Ruido del 1RM ~4,2 % (Grgic 2020): una variación menor no es señal. Escalar el mínimo por nivel (más sesiones en avanzados) y comparar con RIR comparable.
- Lenguaje neutro: «sin progreso reciente», nunca diagnóstico. Marco por nivel del ACSM 2009; tasas por nivel (~40/20/10/2 %) sin verificar.

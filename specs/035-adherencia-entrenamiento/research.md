# Investigación: Adherencia al entrenamiento

## Hallazgo: no hay historial del plan semanal

`weekly_plan_days` (spec 018) guarda una fila por día de la semana y persona y se actualiza al cambiar el plan; no conserva versiones. Calcular la adherencia de una semana pasada con el plan actual daría resultados distintos cada vez que se edite el plan, lo que contradice el Principio II y el criterio de la spec («cambiar el plan no modifica semanas ya cerradas»).

## Decisión 1: versiones inmutables del plan

**Decisión**: tabla `weekly_plan_versions` escrita por un disparador sobre `weekly_plan_days`.
**Razón**: no toca el contrato de las funciones de la spec 018 (`set_weekly_plan_day`) ni sus pruebas, y garantiza una versión por cambio sin depender del cliente.
**Limitación**: no hay forma de reconstruir semanas anteriores a esta migración; se informa «sin plan semanal registrado» y se calcula solo con sesiones planificadas a mano.

## Decisión 2: definición de «planificado»

**Decisión**: días con rutina en el plan vigente de la semana, más sesiones con plan agendadas a mano esa semana. Un día no se cuenta dos veces.
**Razón**: refleja cómo la persona usa la app (plan semanal y calendario) y evita duplicados.

## Decisión 3: reprogramaciones y cancelaciones

**Decisión**: una sesión reprogramada dentro de la misma semana cumple el día; reprogramada a otra semana cuenta en la semana donde se hizo. Las canceladas cuentan como planificadas no realizadas.
**Razón**: el porcentaje describe el cumplimiento del plan sin castigar una sesión movida un día; las canceladas se muestran con texto neutral («cancelada»), sin culpa (Principio IV).
**Para validar**: si las canceladas deberían excluirse del denominador cuando la persona las cancela a propósito; propuesta inicial: contarlas y mostrar el número aparte para que se vea.

## Decisión 4: sesiones sin plan

Cuentan en la frecuencia real y no en el porcentaje. Se informan como «sin planificar» para no inflar la adherencia.

## Decisión 5: series planificadas contra realizadas

Se compara en series (no en repeticiones ni en carga) porque es lo que define el plan de la rutina y es verificable. Puede superar el 100 %.

## Decisión 6: interpretación

El porcentaje describe, no juzga. Con menos de 3 semanas cerradas no se muestran tendencias. El documento de origen indica que sirve para distinguir una rutina poco efectiva de una con poca consistencia, pero la app no hace esa atribución: solo muestra los datos (Principio V).

## Decisión 7: pausas

Los períodos `pause` de `training_periods` (spec 033) se excluyen del período evaluado; la persona los marca. Las semanas de descarga no se excluyen por defecto (se entrena aunque con menos carga), solo si la persona las marca como pausa.

## Preguntas que se resuelven al implementar

- Si conviene incluir rutinas con más de una sesión por día (propuesta: contar una por día planificado por simplicidad).
- Cómo tratar planes cambiados el mismo día (propuesta: la última versión del día).

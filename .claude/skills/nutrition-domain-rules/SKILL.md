---
name: nutrition-domain-rules
description: Usar al implementar o revisar cálculos y textos de nutrición (calorías, macros, porciones, objetivo diario, estimaciones de IA, gasto y mantenimiento). Mantiene coherentes unidades, precisión, incertidumbre, confirmación y lenguaje no coercitivo según la Constitution.
---

# Reglas de dominio de nutrición

Fuente de verdad: `.specify/memory/constitution.md`, Principios III, IV, V y X. Esta skill baja esas reglas a decisiones concretas de cálculo y de texto.

## Unidades y datos

- Sistema métrico: kcal, g, ml. Todo valor mostrado lleva su unidad.
- Catálogo normalizado por 100 g o 100 ml; la porción es un dato aparte. Cantidad consumida = porción × factor sobre el valor por 100.
- Un nutriente faltante es `null` y se muestra como "sin dato". Nunca se trata como 0 ni se completa con supuestos.

## Cálculo

- Los cálculos son funciones puras, deterministas y con pruebas unitarias, separadas de la interfaz y de la IA (Principio VII).
- Si hay macros, las calorías pueden derivarse con factores de Atwater: 4 kcal/g de proteína y de carbohidratos, 9 kcal/g de grasa, 7 kcal/g de alcohol. Si la fuente trae calorías declaradas y difieren de la derivación, se conserva el valor de la fuente y no se corrige en silencio.
- Los totales del día suman solo ítems con datos. Si faltan valores, el total se rotula como parcial y dice cuántos ítems quedaron fuera.

## Precisión y redondeo

- No comunicar más precisión que la que dan los datos de entrada.
- Calorías: enteros. Macros: un decimal como máximo. Estimaciones de IA o de porciones: redondear a pasos gruesos (por ejemplo, de a 5 o 10 kcal) o mostrar un rango.
- Redondear solo al mostrar. Almacenar y operar con el valor completo.

## Origen y confirmación (Principios II y III)

Cada valor tiene un estado visible: `manual`, `importado`, `estimado` o `confirmado`.

- Una estimación se muestra como estimación y se puede corregir (alimentos, ingredientes, cantidades, porciones) antes de confirmar.
- Una estimación **nunca** sobrescribe un valor confirmado. Volver a analizar una foto no cambia un registro confirmado.
- Confirmar guarda un snapshot de los valores en ese momento (ver la skill `database-design`).
- Se indica cuándo faltan datos, cuándo la porción es incierta y cuándo no se pudo estimar de forma confiable.
- Si el proveedor de IA falla o devuelve una respuesta que no cumple el esquema, el usuario puede registrar la comida a mano. Nunca bloquea el registro.

## Objetivo diario y resumen (Principio IV)

- Mostrar calorías consumidas y progreso **solo si existe un objetivo configurado**.
- Calorías restantes = objetivo − total registrado, mostrando por separado la parte estimada y la confirmada.
- No ajustar objetivos ni gasto automáticamente por fluctuaciones diarias. Los cambios son revisables por el usuario.

## Gasto y mantenimiento (Principio V)

- El gasto derivado de pasos, actividad o entrenamiento es una **estimación aproximada**, con el método explicado y sin precisión excesiva.
- Las calorías de mantenimiento se calculan con un método documentado y revisable, mostrando qué datos intervienen.
- Con pocos días de datos no se muestra un número: se informa que no hay información suficiente.
- Las relaciones entre sueño, rendimiento y alimentación se presentan como patrones observados (con período y cantidad de datos), no como causas.

## Lenguaje (Principio IV)

Prohibido en cualquier texto de la interfaz, mensajes, notificaciones y datos de ejemplo:
- Clasificar alimentos como buenos o malos, limpios o sucios, permitidos o prohibidos, o hablar de "trampa", "culpa", "pecado" o "premio".
- Sugerir saltarse comidas, ayunar, "compensar" con ejercicio, o recortes extremos, incluso cuando se supera el objetivo.
- Diagnosticar, o afirmar que se puede medir con exactitud el porcentaje de grasa a partir de fotos.

Permitido y esperado:
- Informar la diferencia con el objetivo de forma neutral ("Registraste 180 kcal más que tu objetivo de hoy").
- Presentar sugerencias como opciones, indicando qué datos las motivan.
- Recomendar apoyo profesional, sin diagnosticar, cuando los datos son insuficientes o hay una señal preocupante.

## Lista de revisión

- [ ] ¿Todos los valores muestran unidad y estado (manual, importado, estimado, confirmado)?
- [ ] ¿Algún faltante se está tratando como cero?
- [ ] ¿La precisión mostrada excede la de los datos?
- [ ] ¿El cálculo es una función pura con pruebas, y separado de la IA?
- [ ] ¿Una estimación puede pisar un valor confirmado? (debe ser imposible)
- [ ] ¿Existe camino de registro manual si la IA falla?
- [ ] ¿Algún texto moraliza, culpabiliza o sugiere compensar?
- [ ] ¿El resumen se muestra solo con objetivo configurado?

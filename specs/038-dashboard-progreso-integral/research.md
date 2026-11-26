# Investigación: Dashboard de progreso integral

## Decisión 1: sin backend nuevo

**Decisión**: componer lecturas existentes en el cliente.
**Razón**: el dashboard debe coincidir con las pantallas de detalle; recalcular indicadores en otra capa duplicaría lógica y la haría divergir. Si el rendimiento no alcanza, se agrega una función agregadora de solo lectura en una spec posterior, sin cambiar los cálculos.

## Decisión 2: degradar por bloque

**Decisión**: cada bloque se omite si su spec de origen no está disponible o su lectura falla; se informa el error con reintento solo en ese bloque.
**Razón**: el documento marca el dashboard como la última fase, pero las specs de origen se implementan escalonadamente y una caída parcial no debe dejar la pantalla vacía.

## Decisión 3: qué significa «estable»

**Decisión**: variación del peso promedio de 7 días entre el inicio y el fin del período menor a ±0,5 % del peso para 30 días (±0,3 % para 7 días y ±1 % para 90 días).
**Razón**: las fluctuaciones diarias por agua, sal y glucógeno suelen ser de 0,5 a 2 kg; usar el promedio móvil y un umbral relativo evita llamar «cambio» al ruido (Principio V). Los umbrales son punto de partida y se documentan.
**Con pocos datos**: menos de 3 pesajes, «sin datos suficientes».

## Decisión 4: lectura sin causalidad

**Decisión**: la lectura solo yuxtapone indicadores («mantuviste el peso mientras mejoraste varios indicadores de rendimiento») y solo si dos o más bloques tienen datos suficientes.
**Razón**: Principio V y el documento de origen («evitar afirmaciones causales no demostradas»). Se revisan los textos para detectar conectores causales.

## Decisión 5: fotos

**Decisión**: solo la cantidad y un enlace a la comparación; no se muestran ni se analizan en el dashboard.
**Razón**: Principio I y V (las fotos de progreso son sensibles, no se procesan con IA y la comparación visual es para seguimiento de la persona).

## Decisión 6: período en la URL

El período vive en la dirección para que volver del detalle lo conserve y para poder compartir el enlace dentro de la app sin datos personales en la URL.

## Decisión 7: sin metas ni puntajes

El dashboard no define metas ni muestra puntajes o niveles; muestra datos y comparaciones con el período anterior cuando existe.

## Preguntas que se resuelven al implementar

- Si conviene comparar con el período anterior equivalente (propuesta: sí, como diferencia pequeña y neutral, solo cuando hay datos en ambos).
- Dónde ubicar el acceso en el menú (propuesta: reemplazar o complementar «Tendencias»; se decide con la persona usuaria tras probarlo).


## Verificación científica (2026-11-25)

Fuente: `Documentacion/investigacion/umbrales-cientificos.md` (rama `docs-nuevas-specs`). Las cifras se leyeron sobre todo en resúmenes; lo no verificado en fuente primaria queda marcado.

- «Peso estable ±0,5 %»: plausible sobre media móvil de 7 días (variación semanal ~0,35 %, Turicchi 2020); no evaluar con pesaje diario aislado. Ningún estudio fija el umbral.
- Pesaje: la mayoría de las revisiones no halla daño psicológico en adultos con sobrepeso, pero Benn 2016 sí con pesaje diario; mantener opción de ocultar peso.

# Investigación: Recomendaciones personalizadas

## Decisión 1: motor de reglas modular

**Decisión**: una regla por archivo, cada una con sus datos requeridos y su plantilla de texto.
**Razón**: las recomendaciones dependen de specs que se implementan en fases distintas; con reglas independientes, el motor funciona con las que existan y cada regla se prueba sola. Evita un componente monolítico y facilita ajustar umbrales.

## Decisión 2: sin IA en esta spec

**Decisión**: el texto sale de plantillas con los números de la persona.
**Razón**: el documento de origen indica que no se necesita IA para la lógica básica, y una redacción generada podría introducir cifras o afirmaciones no verificables (Principio III y IV). Si en el futuro se usa para pulir la redacción, solo recibiría la recomendación ya calculada.

## Decisión 3: niveles de confianza

**Decisión**: alta, media y baja según semanas y registros. Debajo del mínimo de cada regla no se genera.
**Razón**: la spec pide mostrar «nivel de confianza» y no generar con datos insuficientes. Los umbrales (4 semanas y 10 registros; 2 semanas y 6 registros) son parámetros documentados y se calibran con uso real; deben ajustarse regla por regla.

## Decisión 4: nutrición sin presión

**Decisión**: solo se recomienda sobre proteína por debajo del rango y registro incompleto; nunca sobre exceso calórico ni sobre «compensar».
**Razón**: Principio IV. El mensaje informa el promedio y el rango y ofrece una opción neutral («si te faltan comidas hoy, podés distribuir el resto entre ellas»). El registro incompleto se señala como dato faltante, no como falla de la persona.

## Decisión 5: contradicciones

**Decisión**: gana la de mayor confianza; la otra queda como contexto.
**Razón**: no mostrar «subí el peso» junto a «tu recuperación viene baja» sin explicar la tensión; la persona decide con ambos datos a la vista.

## Decisión 6: reaparición

Ignorar equivale a «no ahora»: no reaparece hasta que cambien los datos de forma relevante. No se insiste.

## Decisión 7: cantidad

Máximo 5 recomendaciones y 2 por área. Más sería ruido y presión (Principio VI).

## Decisión 8: fuentes de datos

El contexto reúne lecturas ya implementadas en cada spec (sin duplicar su lógica). Si cambia un cálculo de origen, la recomendación cambia con él.

## Preguntas que se resuelven al implementar

- Dónde mostrarlas por defecto (propuesta: tarjeta en «Hoy» con enlace a la pantalla completa).
- Si conviene un resumen semanal fijo («Esta semana») o recomendaciones continuas; propuesta inicial: continuas, con corte semanal para el resumen.

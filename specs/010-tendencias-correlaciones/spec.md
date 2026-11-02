# Feature Specification: Tendencias, mantenimiento y cruces de datos

**Feature Branch**: `010-tendencias-correlaciones`

**Created**: 2026-11-01

**Status**: Implementada (2026-11-01); falta la corrida de e2e

**Input**: User description: "Pantalla «Tendencias» con tres secciones calculadas desde datos que ya existen. (1) Alimentación: promedio semanal de calorías y macros de los días con registro frente al objetivo calórico, cantidad de días con registro, días dentro del rango de ±10 % del objetivo (sin porcentaje de adherencia) y proteína por kilo con el último peso registrado y su fecha. (2) Mantenimiento estimado: a partir de la tendencia del peso y el promedio de calorías registradas, con 7.700 kcal/kg declarado, mostrado como rango y solo con al menos 14 días con calorías y 4 pesajes en una ventana de 21 días, con el método explicado, sus sesgos y sin recomendar cambiar el objetivo. (3) Entrenamiento y sueño: series registradas por grupo muscular principal y semana, y sueño, apilados con un eje de fechas común y una tabla equivalente, sin coeficientes de correlación ni frases causales. Todo con unidades, fechas y cantidad de datos, datos faltantes como «sin dato», sin metas, rachas ni rojo y verde de juicio. Investigación previa: `research_notes/Análisis de datos de progreso/analisis_datos.md`."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ver cómo comí por semana (Priority: P1)

La persona abre «Tendencias» y ve, semana a semana, cuántas calorías y cuántos gramos de proteína, carbohidratos y grasas consumió en promedio en los días en que registró comidas, junto con su objetivo calórico de esos días, cuántos días registró y en cuántos estuvo dentro del rango de más o menos 10 % de su objetivo. También ve cuánta proteína tomó por kilo de peso, con el peso usado y la fecha de ese peso.

**Why this priority**: Es el análisis que más datos ya tiene (las comidas y el objetivo existen desde las specs 003 y 004) y el que responde la pregunta más común, «¿cómo vengo con la comida?», sin interpretar por la persona.

**Independent Test**: Con comidas registradas en cuatro semanas (algunas con días sin registro), un objetivo calórico y un peso, abrir la pantalla y comprobar que cada promedio, cada conteo de días y la proteína por kilo coinciden con un cálculo hecho a mano.

**Acceptance Scenarios**:

1. **Given** comidas registradas en varias semanas, **When** la persona abre la sección «Alimentación», **Then** ve por semana (lunes a domingo) el promedio de calorías, proteína, carbohidratos y grasas de los días con registro, con la cantidad de días con registro de esa semana y la fecha de cada semana.
2. **Given** una semana con 5 días registrados y 2 sin registro, **When** la mira, **Then** el promedio usa solo los 5 días, dice «5 de 7 días con registro» y los 2 días restantes figuran como «sin dato», no como cero.
3. **Given** un objetivo calórico vigente, **When** mira una semana, **Then** ve el objetivo de esos días junto al promedio y la cantidad de días con registro cuyas calorías estuvieron dentro de 10 % por encima o por debajo del objetivo de ese día (por ejemplo, «4 de 5 días con registro»), sin porcentaje de adherencia, sin calificación y sin color de aprobación.
4. **Given** que el objetivo cambió dentro del período, **When** mira las semanas, **Then** cada día se compara con el objetivo que regía ese día, no con el actual.
5. **Given** que la persona nunca definió un objetivo, o lo quitó, **When** abre la sección, **Then** ve los promedios sin comparación y sin conteo de rango, con una nota neutral de que no hay objetivo.
6. **Given** un peso registrado, **When** mira la proteína por kilo, **Then** ve el valor en g/kg, el peso usado en kg y la fecha de ese peso; si no hay ningún peso, ve «sin dato» y una invitación a registrar uno, sin estimar el peso.
7. **Given** la semana en curso, **When** la mira, **Then** aparece marcada como «en curso» y sus promedios solo incluyen los días ya registrados.
8. **Given** que no hay comidas registradas en el período, **When** abre la sección, **Then** ve un estado vacío con una invitación a registrar comidas.

---

### User Story 2 - Ver una estimación de mantenimiento con su método (Priority: P2)

Cuando hay suficientes datos de comida y de peso, la persona ve una estimación de las calorías con las que su peso se mantuvo, presentada como un rango, con la explicación sencilla de cómo se calculó, qué datos usó y por qué puede equivocarse. Cuando no hay suficientes datos, ve qué falta, no una cifra.

**Why this priority**: Es el análisis más pedido y también el más fácil de interpretar mal. Por eso va después del análisis básico y con reglas estrictas de datos mínimos y de transparencia (Principios III y V).

**Independent Test**: Con 21 días de comidas y pesajes calculados a mano, abrir la sección y comprobar que el rango coincide con el cálculo; con menos de 14 días con calorías o menos de 4 pesajes, comprobar que no aparece ninguna cifra y que se dice cuántos datos faltan.

**Acceptance Scenarios**:

1. **Given** al menos 14 días con calorías registradas y al menos 4 pesajes dentro de los últimos 21 días terminados, con al menos un pesaje en los primeros 7 días de esa ventana y otro en los últimos 7, **When** abre la sección «Mantenimiento estimado», **Then** ve un rango en kcal por día, la ventana de fechas usada, la cantidad de días con calorías y de pesajes, y el peso de partida y de llegada de la tendencia.
2. **Given** menos de 14 días con calorías o menos de 4 pesajes o pesajes concentrados en un solo extremo de la ventana, **When** abre la sección, **Then** no ve ninguna cifra y ve cuántos datos faltan (por ejemplo, «Tienes 9 de los 14 días con calorías que hacen falta»).
3. **Given** una estimación, **When** la mira, **Then** el método está a la vista en lenguaje sencillo: se compara el promedio de calorías registradas con el cambio de la tendencia del peso, se declara que se usan 7.700 kcal por kilo como convención, y se indican los sesgos: comida sin registrar, variaciones de agua y sal, y que la equivalencia en calorías del peso cambia con el tiempo.
4. **Given** una estimación, **When** la mira, **Then** se presenta como «una estimación de lo que registraste», no como el gasto real, y no se sugiere subir ni bajar el objetivo calórico; el objetivo solo lo cambia la persona (Principio IV).
5. **Given** que la persona registró poca comida en la ventana, **When** mira la estimación, **Then** el rango sigue calculándose con lo registrado y se muestra la cantidad de días con calorías, para que ella juzgue su confiabilidad; la aplicación no corrige ni completa los días sin registro.
6. **Given** un cambio de peso muy pequeño o nulo, **When** mira el resultado, **Then** el rango se muestra igual, sin frases como «estás en mantenimiento».
7. **Given** que cambia la ventana (pasa un día), **When** vuelve a abrir la sección, **Then** el rango se recalcula con la nueva ventana y las fechas visibles.

---

### User Story 3 - Mirar entrenamiento y sueño en el mismo eje de fechas (Priority: P2)

La persona elige un grupo muscular y ve, semana a semana, cuántas series registró de ese grupo, y debajo, con las mismas semanas en el mismo eje horizontal, cuánto durmió en promedio por noche. Puede mirar las dos series juntas y sacar sus propias ideas, sin que la aplicación diga que una causa la otra.

**Why this priority**: Responde la nota 6 del autor (cruces entre sueño, entrenamiento y alimentación) sin sugerir causalidad. Depende de datos que son opcionales (el sueño), así que no es lo primero.

**Independent Test**: Con sesiones realizadas en seis semanas con ejercicios de distintos grupos y sueño cargado en parte de esas semanas, comprobar que las series por semana y los promedios de sueño coinciden con el cálculo a mano, que las semanas sin sueño dicen «sin dato» y que no aparece ningún coeficiente ni frase causal.

**Acceptance Scenarios**:

1. **Given** sesiones realizadas con ejercicios de distintos grupos, **When** abre la sección «Entrenamiento y sueño» y elige un grupo muscular, **Then** ve las series registradas de ese grupo por semana, con las fechas de cada semana.
2. **Given** un ejercicio que trabaja dos grupos como principales, **When** se cuentan sus series, **Then** cada serie cuenta una vez en cada uno de esos grupos, y esto se explica en texto.
3. **Given** un ejercicio sin grupo muscular (por ejemplo, uno que ya no está en el catálogo), **When** se cuentan sus series, **Then** cuentan en «Sin grupo» y no desaparecen del total.
4. **Given** el gráfico de series, **When** lo mira, **Then** debajo aparece el promedio de horas de sueño por noche de cada semana, alineado con las mismas semanas, con la cantidad de noches con dato de cada una.
5. **Given** una semana sin ninguna noche de sueño registrada, **When** la mira, **Then** el sueño figura como «sin dato» y no como cero horas.
6. **Given** las dos series, **When** las mira, **Then** no hay coeficientes de correlación, líneas de ajuste, etiquetas de «relación» ni frases que sugieran que el sueño causa el rendimiento o al revés; solo se indica que cada serie se muestra por separado en el mismo eje de fechas.
7. **Given** series sin comparación con rangos recomendados, **When** las mira, **Then** no hay un número «ideal» de series, ni colores o mensajes de «poco» o «mucho».
8. **Given** que no hay sesiones realizadas, o que no hay sueño, **When** abre la sección, **Then** ve el estado vacío correspondiente: la serie que tiene datos se muestra igual y la que no tiene muestra una invitación a registrar.

---

### Edge Cases

- Las semanas van de lunes a domingo, igual que el plan semanal; la semana en curso se marca como tal.
- Un día cuenta como «con registro» si tiene al menos una entrada confirmada con calorías; las estimaciones pendientes de confirmar no cuentan (spec 009) y un día sin entradas es «sin dato».
- Una entrada sin dato de proteína, carbohidratos o grasas no suma cero a esa medida: ese día queda fuera del promedio de esa medida y se dice cuántos días tuvieron dato.
- Los días en que la persona marcó que empezó el día sin registrar comida no cuentan como días con registro.
- El peso para la proteína por kilo es el último registrado hasta el final del período mostrado; si es muy antiguo, la fecha lo deja a la vista y la aplicación no lo ajusta ni lo estima.
- Si la persona registra el peso varias veces el mismo día se usa lo que la spec 020 ya define para ese día; esta spec no cambia esa regla.
- Cambiar la zona horaria del perfil no mueve registros ya guardados de día.
- Una comida o un peso mal anotados se usan tal como están; la aplicación no los descarta ni los corrige (la persona puede corregirlos en su pantalla de origen).
- El sueño es opcional: ninguna pantalla ni cálculo lo exige. Las series de entrenamiento se muestran aunque no haya sueño, y el sueño se muestra aunque no haya entrenamiento.
- Solo cuentan sesiones realizadas; las planificadas, en curso, canceladas o sin registrar no suman series.
- Los grupos musculares se leen del catálogo de ejercicios tal como está hoy; si el catálogo cambia el grupo de un ejercicio, las semanas pasadas se reclasifican (se explica en la pantalla).
- Un período largo sigue siendo legible en el teléfono: se pueden recorrer las semanas con el teclado y consultar la tabla.
- Sin conexión no se calcula nada; se informa y no se muestran cifras desactualizadas como actuales.
- El lenguaje es siempre neutral: sin «adherencia», «cumpliste», «racha», «superávit», «déficit», «mejor semana» ni metas.

## Requirements _(mandatory)_

### Functional Requirements

**Pantalla y navegación**

- **FR-001**: La aplicación MUST ofrecer una pantalla «Tendencias» accesible desde el menú (en «Más») y desde un enlace en el inicio, con tres secciones: «Alimentación», «Mantenimiento estimado» y «Entrenamiento y sueño».
- **FR-002**: La persona MUST poder elegir el período de las secciones «Alimentación» y «Entrenamiento y sueño» entre 4 semanas, 12 semanas, 6 meses y 1 año (por omisión, 12 semanas); la sección «Mantenimiento estimado» usa siempre su propia ventana fija.
- **FR-003**: La pantalla MUST calcularse solo con datos ya registrados (comidas, objetivo, pesos, sueño y sesiones realizadas); MUST NOT modificar ni completar ningún registro, ni exigir datos nuevos.

**Alimentación**

- **FR-004**: La sección MUST mostrar, por semana de lunes a domingo, el promedio por día con registro de calorías (kcal), proteína (g), carbohidratos (g) y grasas (g), con la cantidad de días con registro y las fechas de la semana.
- **FR-005**: Un día MUST contar como «con registro» solo si tiene al menos una entrada confirmada con calorías; los demás días MUST mostrarse como «sin dato» y MUST NOT entrar como cero en ningún promedio.
- **FR-006**: Cada promedio MUST calcularse solo con los días que tienen ese dato y MUST indicar cuántos días lo usaron.
- **FR-007**: Cuando hay objetivo calórico, la sección MUST mostrarlo junto al promedio y MUST indicar cuántos de los días con registro tuvieron calorías dentro de 10 % por encima o por debajo del objetivo que regía ese día; el resultado MUST expresarse como conteo («4 de 5 días con registro»), MUST NOT expresarse como porcentaje de adherencia y MUST NOT usar colores o palabras de aprobación.
- **FR-008**: Cada día MUST compararse con el objetivo vigente ese día según el historial de objetivos de la spec 004. Sin objetivo vigente, la sección MUST mostrar los promedios sin comparación y con una nota neutral.
- **FR-009**: La sección MUST mostrar la proteína por kilo de peso en g/kg, calculada con el promedio de proteína de los días con registro del período y el último peso registrado hasta el final del período, indicando el peso usado en kg y su fecha. Sin peso registrado, MUST mostrar «sin dato» y MUST NOT estimar el peso.
- **FR-010**: La semana en curso MUST marcarse como «en curso» y calcularse solo con los días ya registrados.

**Mantenimiento estimado**

- **FR-011**: La estimación MUST calcularse a partir del cambio de la tendencia del peso (el promedio de los pesajes de los primeros 7 días de la ventana frente al de los últimos 7) en una ventana de 21 días terminados, y del promedio de calorías de los días con registro de esa ventana, con la convención declarada de 7.700 kcal por kilo.
- **FR-012**: La estimación MUST mostrarse solo si la ventana tiene al menos 14 días con calorías registradas y al menos 4 pesajes, con al menos un pesaje en los primeros 7 días de la ventana y otro en los últimos 7. En cualquier otro caso MUST NOT mostrarse ninguna cifra y MUST decirse qué falta y cuánto.
- **FR-013**: La estimación MUST presentarse como un rango en kcal por día, nunca como una cifra única, y MUST mostrar la ventana de fechas, la cantidad de días con calorías, la cantidad de pesajes y los pesos de partida y de llegada de la tendencia. El ancho del rango MUST reflejar la incertidumbre del peso y se documenta en el plan.
- **FR-014**: La sección MUST explicar en lenguaje sencillo el método, la convención de 7.700 kcal por kilo y sus sesgos (comida sin registrar, variación de agua y sal, y que la equivalencia en calorías del peso cambia con el tiempo), y MUST llamar al resultado «una estimación de lo que registraste», no el gasto real.
- **FR-015**: La sección MUST NOT recomendar cambiar el objetivo calórico, comer más o menos, ni calificar el resultado («estás en mantenimiento», «déficit», «superávit»); el objetivo solo lo cambia la persona (Principio IV).
- **FR-016**: La aplicación MUST NOT completar, interpolar ni corregir días sin registro ni pesajes faltantes para obtener la estimación.

**Entrenamiento y sueño**

- **FR-017**: La sección MUST permitir elegir un grupo muscular principal (o «Todos los grupos») y mostrar las series registradas por semana de lunes a domingo en sesiones realizadas, con las fechas de cada semana.
- **FR-018**: Una serie MUST contar una vez en cada grupo muscular principal de su ejercicio según el catálogo; un ejercicio sin grupo MUST contar en «Sin grupo». Los músculos secundarios MUST NOT sumar series (sin volumen fraccionado) y la aplicación MUST explicar esta regla en texto.
- **FR-019**: Solo MUST contar series de sesiones realizadas, y MUST NOT contar ni excluir series según rangos recomendados de volumen.
- **FR-020**: Debajo de las series, la sección MUST mostrar el promedio de horas de sueño por noche de cada semana, alineado con las mismas semanas en el mismo eje horizontal, con la cantidad de noches con dato por semana; una semana sin sueño MUST mostrarse como «sin dato» y MUST NOT graficarse como cero.
- **FR-021**: La sección MUST NOT calcular ni mostrar coeficientes de correlación, líneas de ajuste, etiquetas de «relación» ni frases que sugieran causalidad entre el sueño, el entrenamiento o la alimentación, ni dar recomendaciones a partir de ellos.
- **FR-022**: El sueño MUST ser opcional: la sección MUST funcionar con datos solo de entrenamiento o solo de sueño, mostrando para la serie sin datos un estado vacío con una invitación a registrar.

**Integridad, privacidad y lenguaje**

- **FR-023**: Los datos faltantes MUST mostrarse como «sin dato» y MUST NOT completarse con valores supuestos ni contarse como cero.
- **FR-024**: Cada valor mostrado MUST incluir su unidad y su fecha o período, y los números MUST usar el formato regional (coma decimal).
- **FR-025**: Los cálculos MUST ser privados de cada cuenta: ninguna cuenta ve datos de otra y una petición sin sesión vigente no accede a nada.
- **FR-026**: Los textos MUST ser neutrales: sin metas, rachas, adherencia, «mejor semana», rojo y verde como juicio de calorías, peso o rendimiento, ni sugerencias de entrenar a pesar de dolor o lesión (Principio IV y Límites de alcance).
- **FR-027**: Los registros técnicos (logs) MUST NOT contener comidas, pesos, sueño ni sesiones de la persona.

**Accesibilidad y uso**

- **FR-028**: Cada gráfico MUST ofrecer la misma información como tabla, MUST poder recorrerse con el teclado y MUST NOT depender solo del color para distinguir datos.
- **FR-029**: La pantalla MUST ser usable a 375 px y a 1280 px sin desplazamiento horizontal de la página, con estados de carga, vacío y error definidos, con mensajes en español con tuteo.
- **FR-030**: Sin conexión, la aplicación MUST informarlo y MUST NOT mostrar datos desactualizados como si fueran actuales.
- **FR-031**: Las pruebas funcionales existentes de las specs 003, 004, 006, 007, 008, 012 y 020 MUST seguir pasando sin cambios de comportamiento.

### Key Entities _(include if feature involves data)_

- **Resumen semanal de alimentación**: vista derivada de las comidas y el objetivo. Por semana: fechas, días con registro, promedios por día con registro (kcal, proteína, carbohidratos, grasas), objetivo de esos días y conteo de días dentro del rango.
- **Estimación de mantenimiento**: vista derivada de pesos y comidas de una ventana de 21 días. Atributos: ventana, días con calorías, pesajes, peso de partida y de llegada de la tendencia, promedio de calorías y rango resultante, o la lista de lo que falta.
- **Series por grupo muscular**: vista derivada de las sesiones realizadas y del catálogo de ejercicios. Por semana y grupo: cantidad de series.
- **Sueño semanal**: vista derivada de los registros de sueño. Por semana: promedio de horas por noche y cantidad de noches con dato.
- **Registros de origen**: las comidas, el objetivo, los pesos, el sueño y las sesiones de las specs 003, 004, 008, 007 y 006; esta spec solo los lee.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Una persona con datos de cuatro semanas entiende cuántos días registró y cuál fue su promedio de calorías semanal en menos de 15 segundos desde que abre «Tendencias».
- **SC-002**: La pantalla con un año de datos de comidas, pesos, sueño y sesiones se muestra en menos de 3 segundos.
- **SC-003**: En el 100 % de los casos probados, cada promedio, conteo de días, proteína por kilo, rango de mantenimiento y conteo de series coincide con un cálculo hecho a mano o por una segunda fuente de cálculo independiente.
- **SC-004**: El 100 % de los datos faltantes se muestra como «sin dato» y el 0 % se completa, interpola o cuenta como cero.
- **SC-005**: En el 100 % de los casos con menos de 14 días con calorías, menos de 4 pesajes o pesajes concentrados en un extremo, no aparece ninguna cifra de mantenimiento y se dice qué falta.
- **SC-006**: En el 100 % de las estimaciones mostradas están a la vista el método, la convención de 7.700 kcal por kilo y los sesgos, sin recomendación sobre el objetivo.
- **SC-007**: Ningún texto de la pantalla contiene coeficientes de correlación, frases causales, metas, rachas, adherencia ni valoraciones, verificado por revisión de todos los textos y por pruebas automáticas.
- **SC-008**: En pruebas con dos cuentas, el 100 % de los intentos de ver datos de tendencias de otra cuenta es rechazado.
- **SC-009**: El 100 % de los valores mostrados incluye su unidad y su fecha o período.
- **SC-010**: Todas las secciones se pueden usar en teléfono y en escritorio, por teclado y con lector de pantalla (cada gráfico con su tabla equivalente), sin errores de accesibilidad graves.

## Assumptions

- Depende de las specs 003 (comidas), 004 (objetivo calórico), 006 (sesiones), 007 (sueño), 008 y 020 (peso y su promedio de 7 días), todas implementadas. Comparte el lenguaje visual con los gráficos de las specs 020 y 012.
- No hay tablas ni columnas nuevas. Puede haber funciones de lectura agregada si el volumen lo pide; eso se decide en el plan.
- Los grupos musculares se leen del catálogo de ejercicios al consultar, porque las sesiones solo guardan el nombre y el tipo de medición del ejercicio. Por eso las semanas pasadas pueden cambiar de grupo si el catálogo cambia. Si el autor quiere que queden congelados, hay que guardar el grupo en la sesión, lo que exige un cambio de la spec 006 y se trata en una spec propia.
- La convención de 7.700 kcal por kilo es una aproximación estática de la bibliografía (regla de Wishnofsky); la medición varía con el tiempo. Se usa porque es lo habitual y se declara; la investigación completa está en `research_notes/Análisis de datos de progreso/analisis_datos.md`.
- Los umbrales (14 días con calorías, 4 pesajes y ventana de 21 días) salen de reglas prácticas de proveedores de apps, sin un umbral publicado riguroso. Son razonables para uso personal y se pueden ajustar en el plan sin cambiar el comportamiento descrito.
- El rango de más o menos 10 % del objetivo es el que pidió el autor (nota 6). Es un conteo de días, no una meta.
- No incluye cruces con calorías en el mismo gráfico de sueño y entrenamiento, ni correlaciones: la investigación recomienda series apiladas para que la persona mire sin que la aplicación infiera.
- No incluye metas, recomendaciones, ajuste automático del objetivo calórico ni exportación de gráficos (la exportación es de la spec 011).
- No incluye pasos ni minutos de actividad; se pueden sumar más adelante con la misma estructura.
- No hay funcionamiento sin conexión (Principio VI).
- Los detalles de presentación (tipo de gráfico, colores) y de cálculo (ancho del rango, definición exacta de la ventana) se deciden en el plan, con las restricciones de este documento.

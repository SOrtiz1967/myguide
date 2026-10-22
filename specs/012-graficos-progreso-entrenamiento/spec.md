# Feature Specification: Gráficos de progreso de entrenamiento

**Feature Branch**: `012-graficos-progreso-entrenamiento` (todavía sin rama: spec redactada y pendiente de desarrollo)

**Created**: 2026-10-21

**Status**: Draft — redactada y dejada para después. Depende de la spec 006 (rutinas, calendario y sesiones) y no se desarrolla hasta que ella esté implementada.

**Input**: User description: "Gráficos de progreso de entrenamiento de MyGuide (Principios II, V y VI). A partir de las sesiones realizadas que registra la spec 006, la persona ve cómo evoluciona un ejercicio en el tiempo (por ejemplo, la carga máxima, el volumen, las repeticiones, el tiempo o la distancia, según el tipo de medición del ejercicio), puede elegir el período y comparar un período con otro, y ve cuánto entrenó por semana y por mes. Todo con unidades, fechas y contexto suficiente para interpretar la tendencia, sin conclusiones firmes a partir de una sola sesión, mostrando como faltantes los datos que faltan y sin completarlos con supuestos. Sin recomendaciones, metas ni valoraciones del rendimiento. Privado de cada cuenta, accesible, responsive y en español."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver la evolución de un ejercicio (Priority: P1)

Desde la historia de un ejercicio, la persona abre un gráfico que muestra cómo cambió lo que registró en ese ejercicio a lo largo del tiempo: un punto por cada sesión realizada, con su fecha y su valor, y las unidades en los ejes. Elige qué mide el gráfico entre las opciones que corresponden al tipo de medición del ejercicio y el período que quiere mirar.

**Why this priority**: Es el valor central de la spec y el uso que justifica registrar series con detalle: responder "¿cómo vengo con este ejercicio?" con datos, sin interpretar por la persona.

**Independent Test**: Con un ejercicio registrado en seis sesiones repartidas en tres meses, abrir su gráfico, cambiar de medida y de período, y comprobar que cada punto corresponde a una sesión, con fecha, valor y unidad, y que los datos coinciden con los de la historia del ejercicio.

**Acceptance Scenarios**:

1. **Given** un ejercicio de "repeticiones con peso" con sesiones realizadas, **When** abre su gráfico, **Then** ve un punto por sesión con su fecha, y puede elegir entre "peso máximo de la sesión", "volumen" (repeticiones por peso, sumado) y "repeticiones totales", cada una con su unidad.
2. **Given** un ejercicio de "repeticiones sin peso", "tiempo" o "distancia y tiempo", **When** abre su gráfico, **Then** las medidas que se le ofrecen son las que corresponden a su tipo (por ejemplo, repeticiones totales y mayor número de repeticiones en una serie; tiempo total y serie más larga; distancia total y tiempo total).
3. **Given** un gráfico abierto, **When** elige un período (últimas 4 semanas, 12 semanas, 6 meses, 1 año o todo el historial), **Then** el gráfico muestra solo las sesiones de ese período y dice cuántas son y desde qué fecha hasta cuál.
4. **Given** un ejercicio con menos de 3 sesiones realizadas en el período, **When** abre el gráfico, **Then** ve los puntos que hay, sin línea de tendencia, y un aviso neutral de que con tan pocos datos no se puede hablar de una evolución.
5. **Given** una sesión donde el ejercicio tiene series sin algún dato (por ejemplo, repeticiones sin peso), **When** se calcula una medida que necesita ese dato, **Then** esas series se excluyen del cálculo y el gráfico indica cuántas series quedaron fuera por no tener el dato; si una sesión no tiene ningún dato utilizable, aparece como "sin dato" y no como cero.
6. **Given** un ejercicio sin sesiones realizadas, **When** abre su gráfico, **Then** ve un estado vacío ("Todavía no lo registraste") sin ejes ni datos inventados.
7. **Given** un gráfico, **When** la persona prefiere no verlo o usa un lector de pantalla, **Then** dispone de la misma información como tabla de fecha, valor y unidad, y puede recorrer los puntos con el teclado.
8. **Given** un ejercicio que se renombró o se eliminó después de usarlo, **When** abre su gráfico, **Then** las sesiones aparecen igual, con el nombre que el ejercicio tenía en cada una.

---

### User Story 2 - Comparar dos períodos (Priority: P2)

La persona compara un ejercicio en dos períodos (por ejemplo, las últimas 4 semanas y las 4 anteriores) y ve lado a lado las mismas medidas, cada una con su cantidad de sesiones, y la diferencia en números con su unidad.

**Why this priority**: El Principio V exige poder comparar períodos. Es útil, pero necesita primero el gráfico básico de la historia de usuario 1.

**Independent Test**: Con un ejercicio con sesiones en los dos períodos, elegir "comparar", y comprobar que se ven ambos períodos con sus fechas, su cantidad de sesiones y sus valores, y que la diferencia es la resta correcta con su unidad y sin valoración.

**Acceptance Scenarios**:

1. **Given** un ejercicio con sesiones en dos períodos consecutivos de igual duración, **When** elige comparar, **Then** ve para cada período las fechas, la cantidad de sesiones y el valor de la medida elegida, uno junto al otro.
2. **Given** la comparación, **When** la mira, **Then** la diferencia se expresa como un número con su unidad (por ejemplo, "+2,5 kg") y no se califica como mejora, retroceso, bueno ni malo.
3. **Given** un período sin sesiones o con una sola, **When** compara, **Then** se indica que no hay datos suficientes para comparar y no se muestra una diferencia.
4. **Given** la comparación entre dos períodos, **When** los períodos tienen distinta cantidad de sesiones, **Then** se muestra la cantidad de cada uno junto al valor, para que la diferencia se interprete con ese contexto.
5. **Given** que cambia el período o la medida, **When** actualiza la comparación, **Then** todos los valores se recalculan y las fechas y las unidades se mantienen visibles.

---

### User Story 3 - Ver cuánto entrené por semana y por mes (Priority: P2)

La persona ve, en un gráfico simple, cuántas sesiones realizadas tuvo por semana y por mes en el período que elija, sin metas, sin rachas y sin comparaciones valorativas.

**Why this priority**: Da una visión general de la actividad, pero no cambia lo que la persona hace con cada ejercicio.

**Independent Test**: Con sesiones realizadas repartidas en ocho semanas, abrir el resumen y comprobar que cada semana y cada mes muestran la cantidad correcta de sesiones, que las semanas sin sesiones aparecen como cero registradas y que no hay rachas, objetivos ni mensajes de reproche.

**Acceptance Scenarios**:

1. **Given** sesiones realizadas en varias semanas, **When** abre el resumen, **Then** ve por semana (y alternativamente por mes) la cantidad de sesiones realizadas, con las fechas de cada semana.
2. **Given** una semana sin sesiones, **When** la mira, **Then** aparece con cero sesiones registradas, de forma neutral y sin mensajes.
3. **Given** sesiones planificadas, canceladas o sin registrar, **When** mira el resumen, **Then** solo cuentan las realizadas; las demás no suman ni restan.
4. **Given** el resumen, **When** lo mira, **Then** no hay objetivos de frecuencia, rachas, "mejor semana" ni otros mensajes que juzguen la constancia.
5. **Given** un período sin ninguna sesión, **When** abre el resumen, **Then** ve un estado vacío con la invitación a registrar una.

---

### User Story 4 - Ver el esfuerzo percibido junto a la evolución (Priority: P3)

Cuando la persona indicó un esfuerzo percibido en un ejercicio, el gráfico lo muestra como contexto de cada punto (por ejemplo, al recorrer el punto o en la tabla), para interpretar el dato con más información. No se saca ninguna conclusión de él.

**Why this priority**: Enriquece la lectura, pero no es necesario para ver la evolución.

**Independent Test**: Con un ejercicio con esfuerzo percibido en algunas sesiones y no en otras, comprobar que los puntos con esfuerzo lo muestran y los demás dicen "sin dato", sin calcular promedios ni sugerencias.

**Acceptance Scenarios**:

1. **Given** una sesión con esfuerzo percibido indicado para el ejercicio, **When** recorre su punto, **Then** ve el valor del esfuerzo (1 a 10) junto a la fecha y la medida.
2. **Given** una sesión sin esfuerzo indicado, **When** recorre su punto, **Then** ve "sin dato" para el esfuerzo.
3. **Given** el gráfico, **When** lo mira, **Then** no se infieren relaciones entre el esfuerzo y la medida ni se dan recomendaciones.

---

### Edge Cases

- Dos sesiones del mismo ejercicio el mismo día aparecen como dos puntos en esa misma fecha, no se fusionan.
- Solo cuentan las sesiones realizadas (incluidas las corregidas); las planificadas, en curso, canceladas o sin registrar no aportan puntos.
- Una sesión corregida después usa sus valores corregidos en el gráfico.
- Las sesiones se ubican por su fecha en la zona horaria de la persona; cambiar la zona horaria del perfil no mueve sesiones ya registradas de día.
- Un ejercicio sustituido en una sesión aparece en el gráfico del ejercicio realmente realizado, no del planificado.
- Una copia propia de un ejercicio del catálogo es otro ejercicio y tiene su propio gráfico; no se unen en silencio.
- Un valor muy fuera de lo habitual (por ejemplo, un peso mal anotado) se grafica como está: la aplicación no lo descarta ni lo corrige por su cuenta; la persona puede corregir la sesión (spec 006).
- Una medida que mezcla datos de distinto tipo (por ejemplo, volumen en un ejercicio de tiempo) no se ofrece: cada ejercicio solo permite las medidas de su tipo.
- Un período muy largo con muchas sesiones sigue siendo legible en el teléfono: se pueden recorrer los puntos y consultar la tabla.
- Si la persona no tiene sesiones realizadas, los accesos a los gráficos muestran un estado vacío que invita a registrar una sesión.
- Sin conexión no se pueden consultar los gráficos; se informa y no se muestra nada desactualizado como si fuera actual.
- El lenguaje es siempre neutral: no hay "récord", "mejoraste", "retrocediste", rachas ni metas.

## Requirements *(mandatory)*

### Functional Requirements

**Evolución de un ejercicio**

- **FR-001**: La persona MUST poder abrir, desde la historia de un ejercicio (spec 006), un gráfico de su evolución con un punto por cada sesión realizada donde lo registró.
- **FR-002**: Cada punto MUST mostrar la fecha de la sesión, el valor de la medida elegida y su unidad, y los ejes MUST indicar fechas y unidades.
- **FR-003**: Las medidas ofrecidas MUST depender del tipo de medición del ejercicio: repeticiones con peso (peso máximo de la sesión en kg, volumen en kg y repeticiones totales); repeticiones sin peso (repeticiones totales y mayor número de repeticiones en una serie); tiempo (tiempo total y serie más larga); distancia y tiempo (distancia total en km y tiempo total).
- **FR-004**: El volumen MUST calcularse como la suma, por serie, de repeticiones por peso, usando solo las series que tienen ambos datos; la aplicación MUST explicar cada medida y cómo se calcula.
- **FR-005**: Las series que no tienen un dato necesario para la medida elegida MUST excluirse del cálculo, MUST indicarse cuántas se excluyeron, y una sesión sin ningún dato utilizable MUST mostrarse como "sin dato" y MUST NOT graficarse como cero.
- **FR-006**: La persona MUST poder elegir el período: últimas 4 semanas, últimas 12 semanas, últimos 6 meses, último año o todo el historial; el gráfico MUST indicar el período y la cantidad de sesiones usadas.
- **FR-007**: Con menos de 3 sesiones en el período, el gráfico MUST mostrar solo los puntos, sin línea de tendencia, junto con un aviso neutral de que no hay datos suficientes para hablar de una evolución (Principio V: sin conclusiones firmes a partir de una sola sesión).
- **FR-008**: Un ejercicio sin sesiones realizadas MUST mostrar un estado vacío; el gráfico MUST NOT mostrar datos inventados ni ejes vacíos engañosos.
- **FR-009**: El gráfico MUST usar para cada sesión el nombre y el tipo de medición con que el ejercicio quedó guardado en ella, y MUST seguir funcionando para ejercicios renombrados o eliminados.

**Comparación de períodos**

- **FR-010**: La persona MUST poder comparar dos períodos de un ejercicio, de igual duración, para la misma medida, viendo por cada uno sus fechas, la cantidad de sesiones y el valor.
- **FR-011**: La diferencia entre períodos MUST mostrarse como número con su unidad y MUST NOT calificarse (sin "mejora", "retroceso", "bueno" ni "malo").
- **FR-012**: Si un período tiene menos de 2 sesiones, la comparación MUST indicar que no hay datos suficientes y MUST NOT mostrar una diferencia.

**Resumen de actividad**

- **FR-013**: La persona MUST poder ver la cantidad de sesiones realizadas por semana y por mes en el período elegido, con las fechas de cada tramo; los tramos sin sesiones se muestran con cero registradas.
- **FR-014**: El resumen MUST contar solo sesiones realizadas y MUST NOT incluir objetivos de frecuencia, rachas, "mejor semana" ni mensajes sobre la constancia.

**Esfuerzo percibido**

- **FR-015**: Cuando la sesión tiene esfuerzo percibido para el ejercicio, el gráfico MUST mostrarlo junto a la fecha y la medida de ese punto; si no lo tiene, MUST mostrar "sin dato".
- **FR-016**: La aplicación MUST NOT inferir relaciones entre el esfuerzo percibido y las demás medidas ni dar recomendaciones a partir de ellas.

**Integridad, privacidad y lenguaje**

- **FR-017**: Los gráficos MUST calcularse solo a partir de sesiones realizadas ya registradas (spec 006), con los valores que tienen en ese momento; MUST NOT modificar ni completar ninguna sesión.
- **FR-018**: Los datos faltantes MUST mostrarse como faltantes y MUST NOT completarse con valores supuestos ni interpolados.
- **FR-019**: Los gráficos MUST ser privados de cada cuenta: ninguna cuenta ve datos de otra y una petición sin sesión vigente no accede a nada.
- **FR-020**: Los textos MUST ser neutrales: sin récords, rachas, metas, valoraciones del rendimiento ni sugerencias de entrenar a pesar de dolor o lesión (Principio IV y Límites de alcance).
- **FR-021**: La aplicación MUST NOT presentar un gráfico de entrenamiento como una medición de composición corporal ni derivar calorías de él (spec 007/008).

**Accesibilidad y uso**

- **FR-022**: Cada gráfico MUST ofrecer la misma información como tabla de fecha, valor y unidad, MUST poder recorrerse con el teclado y MUST NOT depender solo del color para distinguir datos.
- **FR-023**: Las pantallas MUST ser usables en teléfono y en escritorio, con etiquetas accesibles, y MUST tener estados de carga, vacío y error definidos, con mensajes en español.
- **FR-024**: Los números MUST mostrarse con el formato regional (coma decimal) y con su unidad.
- **FR-025**: Sin conexión, la aplicación MUST informarlo y MUST NOT mostrar datos desactualizados como si fueran actuales.
- **FR-026**: Los registros técnicos (logs) MUST NOT contener datos que identifiquen a la persona ni el contenido de sus sesiones.

### Key Entities *(include if feature involves data)*

- **Gráfico de un ejercicio**: vista derivada de las sesiones realizadas donde se registró un ejercicio. No guarda datos propios. Atributos mostrados: ejercicio, medida elegida, período, puntos (fecha, valor, unidad, esfuerzo percibido opcional), cantidad de sesiones usadas y cantidad de series excluidas por no tener el dato.
- **Medida**: una forma de resumir una sesión de un ejercicio con su unidad (peso máximo, volumen, repeticiones totales, mayor número de repeticiones en una serie, tiempo total, serie más larga, distancia total). Cada tipo de medición admite un conjunto fijo de medidas.
- **Período**: un rango de fechas elegido por la persona (o dos de igual duración para comparar).
- **Resumen de actividad**: vista derivada de la cantidad de sesiones realizadas por semana y por mes.
- **Sesión y serie**: las de la spec 006; esta spec solo las lee.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona llega al gráfico de un ejercicio y entiende cómo evolucionó en menos de 15 segundos desde que abre la historia de ese ejercicio.
- **SC-002**: El gráfico de un ejercicio con 500 sesiones y el resumen de un año de actividad se muestran en menos de 2 segundos.
- **SC-003**: En el 100 % de los casos probados, cada punto, cada total y cada diferencia coincide con los datos de las sesiones registradas (recalculados a mano o con una segunda fuente de cálculo independiente).
- **SC-004**: El 100 % de los datos faltantes se muestra como "sin dato" y el 0 % se completa, interpola o cuenta como cero.
- **SC-005**: En el 100 % de los gráficos con menos de 3 sesiones no aparece una línea de tendencia y se muestra el aviso de datos insuficientes.
- **SC-006**: El 100 % de los valores mostrados incluye su unidad y su fecha o período.
- **SC-007**: Renombrar o eliminar un ejercicio, o repetir la importación del catálogo, no cambia ningún punto ni total de gráficos ya consultados en el 100 % de los casos probados.
- **SC-008**: En pruebas con dos cuentas, el 100 % de los intentos de ver datos de gráficos de otra cuenta es rechazado.
- **SC-009**: Ningún texto de la sección contiene récords, rachas, metas ni valoraciones del rendimiento, verificado por revisión de todos los textos y por pruebas automáticas.
- **SC-010**: Todas las pantallas se pueden usar y completar en pantalla de teléfono y de escritorio, por teclado y con lector de pantalla (cada gráfico con su tabla equivalente), sin errores de accesibilidad graves.

## Assumptions

- Depende de la spec 006: usa las sesiones realizadas, sus series, el esfuerzo percibido por ejercicio y el identificador estable de los ejercicios. No se puede desarrollar antes de que la 006 esté implementada. La numeración 012 respeta el orden del roadmap (después de la 011) pero la spec se desarrolla justo después de la 006.
- La spec 006 ya está implementada y coincide con estos supuestos: cada ejercicio realizado guarda su nombre y su tipo de medición, el esfuerzo percibido es uno por ejercicio de la sesión, las series vacías no se guardan y las sesiones realizadas, planificadas, canceladas y en curso se distinguen por su estado. Solo las `completed` deben alimentar los gráficos. La función `exercise_history` (con tope de 50 por tanda) responde la primera tanda de un ejercicio con 700 sesiones en unas decenas de milisegundos; los gráficos pueden necesitar su propia lectura agregada.
- No incluye gráficos de peso corporal, sueño, pasos, alimentación ni correlaciones: eso es la spec 010 (tendencias, mantenimiento y correlaciones). Conviene que ambas compartan el mismo lenguaje visual y las mismas reglas de unidades, fechas y datos insuficientes.
- No hay grupos musculares en los gráficos: las sesiones guardan el nombre y el tipo de medición del ejercicio, no sus músculos, y leerlos del catálogo actual haría que los gráficos cambiaran con el catálogo. Si más adelante se quiere ver el trabajo por músculo, hay que decidir si las sesiones lo guardan también.
- No hay objetivos, metas, líneas de referencia, récords ni mensajes de logro; tampoco recomendaciones (Principio IV). La persona interpreta los datos.
- Las medidas de cada tipo de medición son las listadas en FR-003; agregar otras (por ejemplo, ritmo o velocidad) exigiría explicar el método y se evalúa en una spec posterior.
- Los períodos son los preestablecidos de FR-006; los períodos personalizados por fechas quedan fuera de esta spec.
- No hay exportación de datos ni imágenes de los gráficos en esta spec (la exportación es de la spec 011).
- No hay funcionamiento sin conexión (Principio VI).
- Los detalles de presentación (tipo de gráfico, colores, biblioteca de gráficos) se deciden en el plan, con la restricción de accesibilidad de FR-022.
- Los valores de umbral (3 sesiones para la tendencia, 2 para comparar) son razonables para uso personal y se pueden ajustar en el plan sin cambiar el comportamiento descrito.

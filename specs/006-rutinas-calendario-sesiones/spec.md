# Feature Specification: Rutinas, calendario y sesiones de entrenamiento

**Feature Branch**: `006-rutinas-calendario-sesiones`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Rutinas, calendario y sesiones de entrenamiento de MyGuide (spec 006 del roadmap, Principios II, V y VI). La persona puede armar rutinas (planes de entrenamiento reutilizables) con ejercicios del catálogo de la spec 005, indicando para cada ejercicio cuántas series quiere hacer y, de forma opcional, repeticiones, carga o tiempo objetivo según el tipo de medición del ejercicio. Puede planificar sesiones en un calendario (una sesión planificada en una fecha, a partir de una rutina o vacía), y realizarlas: registrar por cada ejercicio sus series con repeticiones y carga, repeticiones sin carga, tiempo, o distancia y tiempo según el tipo de medición, un esfuerzo percibido opcional y notas opcionales. Una sesión puede estar planificada, en curso, realizada, modificada, reprogramada o cancelada; se puede registrar una sesión que no estaba planificada, sustituir un ejercicio por otro durante la sesión, y mover una sesión a otra fecha sin duplicarla ni perder su historial. Lo planificado y lo realmente hecho se muestran por separado y nunca se mezclan ni se completan con supuestos; los datos que faltan se muestran como faltantes. Cada sesión guarda una copia propia (snapshot) del nombre y del tipo de medición de cada ejercicio, de modo que editar o eliminar un ejercicio propio, o una nueva importación del catálogo, nunca cambia sesiones ya realizadas. Editar o eliminar una rutina nunca cambia las sesiones ya creadas a partir de ella. Una sesión en curso conserva su borrador localmente, con avisos claros de lo que no llegó al servidor, guardados idempotentes y sin dobles registros. Ver la historia de un ejercicio (las últimas veces que se hizo, con sus series), sin recomendaciones automáticas. Lenguaje neutral y sin coerción: sin rachas, sin culpa por sesiones saltadas o canceladas, sin juicios sobre el rendimiento. Privacidad: rutinas y sesiones son privadas de cada cuenta. Estados de carga, vacío y error, formularios con borrador local, accesible y responsive, todo en español, sin funcionamiento sin conexión. Fuera de alcance: cálculo de gasto calórico (007/008), sueño, pasos y actividad (007), recomendaciones automáticas, estimación con IA, compartir o importar rutinas, y gráficos de progreso (a decidir en las aclaraciones si entra algo mínimo)."

## Clarifications

### Session 2026-10-21

- Q: ¿El esfuerzo percibido se registra por sesión, por serie o ambos? → A: Por cada ejercicio de la sesión, con un solo valor que vale para todas sus series; no se registra por sesión completa ni por serie.
- Q: ¿Se puede planificar una sesión que se repite (por ejemplo, todos los lunes)? → A: No. Las rutinas no se asignan a días de la semana ni se repiten solas: funcionan como un catálogo de entrenamientos de la persona, y cada día ella elige cuál toca (o ninguno), con total flexibilidad.
- Q: ¿Entra algún gráfico de progreso mínimo en esta spec? → A: No. Esta spec solo muestra la lista de las últimas veces que se hizo un ejercicio; los gráficos de progreso quedan para una spec propia, ya redactada (`specs/012-graficos-progreso-entrenamiento`) y pendiente de desarrollo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar una sesión de entrenamiento (Priority: P1)

La persona entrena y quiere anotar lo que hizo: abre una sesión (hoy, o una fecha pasada), agrega ejercicios del catálogo o propios, y por cada uno anota sus series con los datos que corresponden a cómo se mide ese ejercicio. Al terminar, la sesión queda como realizada. No hace falta haber planificado nada ni tener una rutina.

**Why this priority**: Es el valor central de la spec y lo que pide el Principio V: poder registrar ejercicios, series, repeticiones y cargas. Sin esto no hay historial, ni historia de un ejercicio, ni nada que comparar.

**Independent Test**: Registrar una sesión de hoy con un ejercicio de cada tipo de medición (repeticiones con peso, repeticiones sin peso, tiempo, y distancia y tiempo), con dos series cada uno; terminarla y verla en el día con todo lo anotado y sus unidades.

**Acceptance Scenarios**:

1. **Given** que la persona no tiene nada planificado, **When** inicia una sesión y agrega "Sentadilla con barra", **Then** puede anotar series con repeticiones y peso en kilogramos.
2. **Given** un ejercicio de tipo "repeticiones sin peso", **When** anota una serie, **Then** se le piden solo repeticiones (sin campo de peso).
3. **Given** un ejercicio de tipo "tiempo", **When** anota una serie, **Then** se le pide solo la duración; **Given** un ejercicio de "distancia y tiempo", **Then** se le piden la distancia en kilómetros y la duración.
4. **Given** una serie con algún dato sin completar (por ejemplo, repeticiones sin peso en un ejercicio de repeticiones con peso), **When** guarda, **Then** se acepta y el dato que falta se muestra como "sin dato", nunca como 0 ni como un valor supuesto.
5. **Given** una sesión con varios ejercicios, **When** la termina, **Then** queda como "Realizada" en su día, con los ejercicios, las series y las unidades que anotó.
6. **Given** que quiere registrar un entrenamiento de ayer o de otro día pasado, **When** elige esa fecha, **Then** la sesión queda en esa fecha como realizada.
7. **Given** una serie anotada por error, **When** la elimina o la corrige antes de terminar, **Then** el cambio se refleja sin dejar series duplicadas ni huecos.
8. **Given** un ejercicio con sus series anotadas, **When** quiere indicar qué tan exigente le resultó, **Then** puede elegir un esfuerzo percibido de 1 a 10 para ese ejercicio en su totalidad (no por serie); es opcional y, si no lo elige, se muestra como "sin dato".
9. **Given** un ejercicio ya agregado a la sesión, **When** quiere ver cómo le fue la última vez, **Then** lo ve en un paso, sin salir de la sesión (ver historia, historia de usuario 5).
10. **Given** que ya tiene una sesión en curso, **When** intenta iniciar otra, **Then** se le ofrece continuar la que tiene abierta en lugar de crear una segunda sin querer.

---

### User Story 2 - Armar y mantener mis rutinas (Priority: P1)

La persona arma una rutina —un plan reutilizable con nombre— eligiendo ejercicios del catálogo (o propios), en el orden que quiere, e indicando para cada uno cuántas series quiere hacer y, de forma opcional, un objetivo de repeticiones, de peso o de tiempo según el tipo de medición. Puede editarla, duplicarla y eliminarla. Sus rutinas forman un catálogo de entrenamientos propio: no se asignan a días de la semana, y cada día la persona elige cuál toca.

**Why this priority**: Es lo que permite entrenar y planificar sin armar todo desde cero cada vez, y es la base de la comparación entre lo planificado y lo realizado.

**Independent Test**: Crear una rutina "Torso A" con tres ejercicios y sus objetivos; editarla (cambiar el orden y un objetivo); duplicarla; eliminar la copia; comprobar que la original queda intacta.

**Acceptance Scenarios**:

1. **Given** el formulario de nueva rutina, **When** escribe un nombre y agrega ejercicios con su cantidad de series, **Then** la rutina se guarda con los ejercicios en el orden elegido.
2. **Given** un ejercicio de "repeticiones con peso" dentro de la rutina, **When** completa los objetivos opcionales, **Then** puede indicar repeticiones y peso objetivo; en un ejercicio de "tiempo" solo duración; en uno de "distancia y tiempo" distancia y duración; en uno de "repeticiones sin peso" solo repeticiones.
3. **Given** un nombre vacío, una rutina sin ejercicios o un número de series no válido, **When** intenta guardar, **Then** se rechaza con un mensaje que explica qué corregir.
4. **Given** una rutina existente, **When** cambia el orden de los ejercicios, agrega, quita o modifica un objetivo, **Then** los cambios se guardan y la rutina refleja el nuevo plan.
5. **Given** una rutina, **When** la duplica, **Then** obtiene una segunda rutina independiente con el mismo contenido y un nombre que indica que es una copia.
6. **Given** una rutina, **When** la elimina (tras confirmar), **Then** desaparece de su lista; las sesiones ya creadas a partir de ella no cambian.
7. **Given** una rutina con un ejercicio propio que luego se eliminó, **When** la abre, **Then** ese ítem se sigue mostrando con el nombre que tenía y una nota de que el ejercicio ya no está en su lista, y puede reemplazarlo o quitarlo.
8. **Given** un doble clic en "Guardar" o un reintento de red, **When** se envía, **Then** se crea una sola rutina.
9. **Given** que se cortó la conexión al guardar, **When** falla, **Then** la persona ve que no se guardó y lo escrito se conserva como borrador.

---

### User Story 3 - Entrenar con una rutina y ver lo planificado frente a lo realizado (Priority: P1)

La persona inicia una sesión a partir de una rutina. La sesión nace con el plan de esa rutina (ejercicios, series y objetivos) y, a medida que entrena, anota lo que realmente hizo. En cualquier momento ve el plan y lo realizado por separado, y puede sustituir un ejercicio por otro, agregar uno que no estaba o saltear otro sin perder el plan original.

**Why this priority**: Es la separación entre planificación y ejecución que exige el Principio II, y el caso de uso más frecuente de una persona que sigue un plan.

**Independent Test**: Iniciar una sesión desde una rutina de tres ejercicios; hacer el primero tal cual, sustituir el segundo por otro, saltear el tercero y agregar uno nuevo; terminarla y comprobar que el plan sigue mostrando lo planificado, que lo realizado muestra lo que de verdad se hizo y que la sesión está marcada como "Modificada".

**Acceptance Scenarios**:

1. **Given** una rutina, **When** inicia una sesión desde ella, **Then** la sesión se crea con el plan de la rutina en el estado de ese momento y los ejercicios listos para anotar sus series.
2. **Given** una sesión con plan, **When** la mira, **Then** ve el plan (qué se pensaba hacer) y lo realizado (lo que anotó) en lugares claramente diferenciados; ningún valor planificado aparece como si fuera realizado.
3. **Given** un ejercicio con objetivo de repeticiones y peso, **When** anota sus series, **Then** cada serie lleva los valores que realmente hizo; el objetivo se muestra aparte como referencia, nunca como valor ya anotado.
4. **Given** un ejercicio planificado, **When** lo sustituye por otro durante la sesión, **Then** el plan conserva el ejercicio original, lo realizado registra el sustituto, y ambos quedan relacionados ("en lugar de X").
5. **Given** una sesión, **When** agrega un ejercicio que no estaba en el plan, **Then** se anota como realizado y se ve que no formaba parte del plan.
6. **Given** un ejercicio planificado que no hizo, **When** termina la sesión, **Then** queda como "no realizado" en el plan, de forma neutral y sin juicio, y la sesión termina igual.
7. **Given** una sesión terminada donde lo realizado difiere del plan (sustitución, ejercicio agregado o no hecho, otra cantidad de series), **When** la mira, **Then** aparece con la marca "Modificada" y puede ver en qué difiere.
8. **Given** una sesión terminada tal como se planificó, **When** la mira, **Then** aparece como "Realizada", sin la marca "Modificada".
9. **Given** una sesión iniciada desde una rutina, **When** la rutina se edita o elimina después, **Then** el plan y lo realizado de esa sesión no cambian.
10. **Given** que quiere entrenar sin seguir ningún plan, **When** inicia una sesión vacía, **Then** funciona como la historia de usuario 1 y se muestra "sin planificación".

---

### User Story 4 - Planificar en el calendario, reprogramar y cancelar (Priority: P2)

La persona ve un calendario con sus sesiones y, para cada día, elige qué entrenamiento toca: una de sus rutinas o ninguna. No hay un horario fijo ni repeticiones automáticas, así que cada semana puede ser distinta. Si cambian sus planes, mueve la sesión a otro día; si no la va a hacer, la cancela. Moverla no la duplica ni pierde su historia, y nunca toca lo que ya hizo.

**Why this priority**: Es lo que pide el Principio V para el calendario. Es valioso, pero la persona ya puede entrenar y registrar sin planificar por adelantado.

**Independent Test**: Planificar una sesión desde una rutina para dentro de tres días, reprogramarla dos veces, cancelarla y volver a planificarla; comprobar que hay una sola sesión en todo momento, que muestra su fecha original y que una sesión ya realizada no se puede mover.

**Acceptance Scenarios**:

1. **Given** el calendario, **When** elige un día y marca qué entrenamiento toca (una rutina de su catálogo, o una sesión vacía), **Then** queda como "Planificada" en ese día con el plan de la rutina en ese momento.
2. **Given** que planificó un día con una rutina, **When** más tarde cambia de idea, **Then** puede reemplazar la rutina de ese día por otra, o quitarla, mientras la sesión sea solo planificada y sin tocar nada de otros días.
3. **Given** que nunca planificó nada, **When** abre "Hoy", **Then** puede elegir una rutina de su catálogo y empezar a entrenar de inmediato, sin planificar antes.
4. **Given** el catálogo de rutinas, **When** planifica la misma rutina en varios días, **Then** cada día es una sesión independiente; la app no repite ni propone fechas por su cuenta.
5. **Given** un mes con sesiones, **When** lo abre, **Then** ve qué días tienen sesiones y su estado (planificada, realizada, cancelada), y al elegir un día ve el detalle de sus sesiones.
6. **Given** una sesión planificada, **When** la mueve a otra fecha, **Then** sigue siendo la misma sesión (no se crea otra), queda marcada como "Reprogramada" y muestra la fecha en la que estaba antes.
7. **Given** una sesión reprogramada varias veces, **When** la abre, **Then** ve su recorrido de fechas, de la original a la actual.
8. **Given** una sesión ya realizada, **When** intenta moverla de fecha, **Then** no se permite: la fecha de lo que ya ocurrió no cambia.
9. **Given** una sesión planificada, **When** la cancela, **Then** queda como "Cancelada" en su día, con su plan conservado, sin avisos de culpa; puede volver a planificarla para la misma u otra fecha.
10. **Given** una sesión planificada cuya fecha ya pasó sin que la hiciera, **When** mira el calendario, **Then** la ve señalada con un texto neutral ("Sin registrar") y con las opciones de registrarla, reprogramarla o cancelarla; nunca como un fallo.
11. **Given** una sesión planificada, **When** llega el día y la inicia, **Then** pasa a "En curso" y luego a "Realizada" sin duplicarse.
12. **Given** un doble clic al mover, planificar o cancelar, o un reintento de red, **When** se envía, **Then** no se duplica ninguna sesión ni se aplican dos veces los cambios.
13. **Given** un día con más de una sesión, **When** lo abre, **Then** ve todas las sesiones de ese día en orden y puede abrir cada una.

---

### User Story 5 - Ver cómo me fue la última vez con un ejercicio (Priority: P2)

Para un ejercicio, la persona ve las últimas veces que lo hizo —fecha y series con sus valores—, tanto desde el detalle del ejercicio como dentro de una sesión en curso, para saber con qué carga entrenó antes. Es un dato, no una recomendación.

**Why this priority**: Responde a la pregunta más frecuente al entrenar ("¿con cuánto hice esto la última vez?"), pero solo tiene sentido cuando ya hay sesiones registradas.

**Independent Test**: Registrar un ejercicio en tres sesiones distintas y comprobar que su historia muestra las tres, de la más reciente a la más antigua, con sus series; comprobar que desde una sesión nueva con ese ejercicio se ve la última vez en un paso.

**Acceptance Scenarios**:

1. **Given** un ejercicio realizado en varias sesiones, **When** abre su historia, **Then** ve las últimas veces ordenadas de la más reciente a la más antigua, cada una con su fecha y sus series (con unidades).
2. **Given** una sesión en curso con ese ejercicio, **When** pide "la última vez", **Then** ve la sesión anterior más reciente donde lo hizo, sin salir de la sesión actual.
3. **Given** un ejercicio nunca realizado, **When** abre su historia, **Then** ve un estado vacío ("Todavía no lo registraste"), sin datos inventados.
4. **Given** un ejercicio cuyo nombre se editó después de usarlo, **When** mira su historia, **Then** cada entrada muestra el nombre que tenía ese día.
5. **Given** una historia, **When** la mira, **Then** no ve recomendaciones, metas ni valoraciones ("mejoraste", "bajaste"); solo los datos.
6. **Given** una historia con muchas sesiones, **When** pide ver más, **Then** se suman por tandas sin perder las anteriores.
7. **Given** un ejercicio propio que se eliminó, **When** la persona busca su historia desde una sesión pasada, **Then** las sesiones donde se usó siguen mostrando ese ejercicio y sus series.

---

### User Story 6 - Corregir o eliminar una sesión registrada (Priority: P3)

La persona corrige un dato de una sesión ya realizada (una repetición mal anotada, una nota) o elimina por completo una sesión que no corresponde, sin que eso afecte a otras sesiones, a las rutinas ni al catálogo.

**Why this priority**: Los errores de carga ocurren, pero no bloquean el uso principal.

**Independent Test**: Corregir las repeticiones de una serie de una sesión realizada y comprobar que se actualiza y que la sesión conserva el nombre y el tipo de medición con que se registró; eliminar una sesión y comprobar que desaparece del calendario y de la historia del ejercicio.

**Acceptance Scenarios**:

1. **Given** una sesión realizada, **When** corrige una serie, agrega o quita una serie o edita una nota, **Then** los cambios se guardan y la sesión muestra que fue corregida y cuándo.
2. **Given** una sesión realizada, **When** la corrige, **Then** el nombre y el tipo de medición de sus ejercicios siguen siendo los que se guardaron con ella, aunque el ejercicio del catálogo haya cambiado.
3. **Given** una sesión, **When** la elimina (tras confirmar), **Then** desaparece del calendario y de la historia de sus ejercicios; las rutinas y el catálogo no cambian.
4. **Given** un fallo de red al corregir o eliminar, **When** falla, **Then** la persona ve que no se guardó y puede reintentar; nada queda a medias.

---

### Edge Cases

- Una sesión iniciada antes de la medianoche y terminada después sigue siendo del día en que empezó; no se parte en dos ni se cambia de día sola.
- Cerrar la pestaña, recargar o perder la conexión con una sesión en curso no pierde lo escrito: al volver, la persona retoma donde estaba y se le indica qué está guardado en el servidor y qué solo en este dispositivo.
- Cerrar sesión borra el borrador de la sesión en curso del dispositivo.
- Dos sesiones el mismo día son válidas (por ejemplo, mañana y noche); una segunda sesión no es un duplicado de la primera.
- Una persona con una sesión en curso en un dispositivo la ve también como "En curso" en otro, pero el borrador local de cada dispositivo es independiente; no se mezclan en silencio.
- Una serie sin ningún valor (vacía) no se guarda como serie; una serie con algunos valores sí, y los que faltan se muestran como "sin dato".
- Valores fuera de rango (repeticiones negativas, peso negativo o absurdamente grande, duración de cero) se rechazan con un mensaje claro; un peso de 0 en un ejercicio de repeticiones con peso es válido y distinto de "sin dato".
- Una rutina o sesión con muchos ejercicios sigue siendo usable en el teléfono: la lista se desplaza sin romper el diseño.
- Un ejercicio del catálogo cuya definición cambió tras una nueva importación (por ejemplo, otro tipo de medición) no altera sesiones ya creadas; una sesión nueva iniciada desde una rutina toma el ejercicio tal como está en ese momento.
- Si el tipo de medición de un ejercicio cambió entre el momento en que se armó la rutina y hoy, los objetivos de la rutina que ya no corresponden se muestran aparte y se pide revisarlos, sin descartarlos en silencio.
- Una rutina eliminada deja intactas las sesiones creadas a partir de ella; esas sesiones siguen mostrando su plan, con una nota neutral de que la rutina ya no existe.
- Cancelar una sesión planificada no borra nada: su plan queda, y se puede volver a planificar.
- Reprogramar una sesión a una fecha pasada no está permitido: para registrar algo que ya ocurrió se registra como realizada.
- El lenguaje de toda la sección es neutral: ningún texto habla de rachas, de "perder" un día, de culpa ni de rendimiento bueno o malo.
- Sin conexión no se puede planificar, guardar ni consultar sesiones; se informa y lo escrito se conserva como borrador.
- Si el catálogo de ejercicios está vacío o la persona no tiene ejercicios propios, al armar una rutina o sesión se le informa y se le ofrece crear uno (spec 005).
- Un mes sin sesiones muestra un estado vacío con la invitación a planificar o registrar una, sin mensajes de reproche.

## Requirements *(mandatory)*

### Functional Requirements

**Rutinas**

- **FR-001**: La persona MUST poder crear una rutina con un nombre de 1 a 80 caracteres y entre 1 y 30 ejercicios, elegidos del catálogo o entre los propios, en el orden que elija.
- **FR-002**: Cada ejercicio de una rutina MUST tener una cantidad de series de 1 a 20 y, de forma opcional, objetivos que dependen del tipo de medición del ejercicio: repeticiones y peso (repeticiones con peso), repeticiones (repeticiones sin peso), duración (tiempo) o distancia y duración (distancia y tiempo).
- **FR-003**: La persona MUST poder editar una rutina (nombre, ejercicios, orden, series y objetivos), duplicarla y eliminarla con confirmación.
- **FR-004**: Una rutina MUST conservar, junto a cada ejercicio, el nombre y el tipo de medición con que se lo agregó, para poder mostrarlo aunque el ejercicio ya no exista; cuando el ejercicio existe se muestra su nombre actual.
- **FR-005**: Editar o eliminar una rutina MUST NOT cambiar ninguna sesión ya creada a partir de ella, planificada, en curso o realizada.
- **FR-006**: La lista de rutinas MUST mostrar para cada una su nombre y la cantidad de ejercicios, con estados de carga, vacío y error.

**Sesiones y estados**

- **FR-007**: La persona MUST poder iniciar una sesión vacía o a partir de una rutina, para hoy o para una fecha pasada, y registrar lo que hizo.
- **FR-008**: Una sesión MUST tener uno de estos estados: planificada, en curso, realizada o cancelada; además MUST poder llevar las marcas "reprogramada" (si cambió de fecha) y "modificada" (si lo realizado difiere del plan), que se muestran siempre que correspondan.
- **FR-009**: Cada persona MUST poder tener como máximo una sesión en curso a la vez; al intentar iniciar otra se le ofrece continuar la abierta.
- **FR-010**: Una sesión MUST pertenecer a un día calendario en la zona horaria de la persona; una sesión que cruza la medianoche conserva el día en que empezó.
- **FR-011**: La persona MUST poder registrar más de una sesión en el mismo día.
- **FR-012**: La persona MUST poder terminar una sesión, que pasa a "realizada" con lo que anotó, y MUST poder terminarla aunque haya ejercicios planificados sin hacer.
- **FR-013**: Una sesión en curso o realizada MUST permitir una nota general opcional de hasta 1.000 caracteres.
- **FR-014**: Para cada ejercicio de una sesión, la persona MUST poder indicar un esfuerzo percibido opcional, de 1 a 10, que vale para todas las series de ese ejercicio en conjunto. El esfuerzo percibido MUST NOT registrarse por sesión completa ni por serie, y un ejercicio sin esfuerzo indicado MUST mostrarlo como "sin dato".

**Planificación y realización por separado**

- **FR-015**: Una sesión creada a partir de una rutina MUST guardar su propio plan (ejercicios, series y objetivos tal como estaban al crearla); cambios posteriores en la rutina MUST NOT alterarlo.
- **FR-016**: Lo planificado y lo realizado MUST almacenarse y mostrarse como conceptos separados; un valor planificado MUST NOT mostrarse como realizado ni completarse en su lugar.
- **FR-017**: Una sesión sin plan MUST indicar "sin planificación"; no se inventa un plan a posteriori.
- **FR-018**: La persona MUST poder, durante una sesión, sustituir un ejercicio planificado por otro, agregar ejercicios que no estaban en el plan y dejar sin hacer ejercicios planificados; la sustitución conserva el ejercicio original en el plan y relaciona ambos.
- **FR-019**: La marca "modificada" MUST aplicarse cuando lo realizado difiere del plan en ejercicios (sustituidos, agregados o no hechos) o en la cantidad de series; MUST NOT aplicarse por diferencias de repeticiones, peso, duración o distancia respecto de los objetivos.
- **FR-020**: Un ejercicio planificado y no hecho MUST mostrarse como "no realizado" con texto neutral, sin avisos ni juicios.

**Calendario, reprogramación y cancelación**

- **FR-021**: La persona MUST poder ver un calendario mensual que indique qué días tienen sesiones y su estado, abrir un día y ver todas sus sesiones.
- **FR-022**: La persona MUST poder planificar una sesión (vacía o desde una rutina) en una fecha de hoy o futura.
- **FR-023**: La persona MUST poder mover una sesión planificada a otra fecha de hoy o futura; la sesión MUST seguir siendo la misma (sin duplicarse), quedar marcada como "reprogramada" y conservar el recorrido de sus fechas.
- **FR-024**: Una sesión realizada o en curso MUST NOT poder moverse de fecha; mover sesiones MUST NOT cambiar las fechas ni los ejercicios de sesiones ya realizadas.
- **FR-025**: La persona MUST poder cancelar una sesión planificada, que conserva su plan y puede volver a planificarse; cancelar MUST NOT borrar datos.
- **FR-026**: Una sesión planificada cuya fecha pasó sin realizarse MUST mostrarse con un texto neutral ("Sin registrar") y ofrecer registrarla, reprogramarla o cancelarla.
- **FR-027**: Las rutinas MUST funcionar como un catálogo de entrenamientos de la persona y MUST NOT asignarse a días de la semana ni repetirse automáticamente: cada sesión se planifica en una fecha concreta, y para cada día la persona elige qué rutina toca o ninguna.
- **FR-027a**: La persona MUST poder, desde un día del calendario o desde "Hoy", elegir una rutina de su catálogo con un solo gesto para planificar ese día o, si el día es hoy, empezar a entrenar de inmediato; MUST poder cambiar o quitar la rutina de un día mientras la sesión sea solo planificada.

**Registro de series**

- **FR-028**: Para cada ejercicio de una sesión, la persona MUST poder anotar entre 0 y 20 series, cada una con los valores que corresponden al tipo de medición del ejercicio: repeticiones y peso en kilogramos; repeticiones; duración; o distancia en kilómetros y duración.
- **FR-029**: Todo valor mostrado MUST indicar su unidad (kg, km, repeticiones, minutos y segundos), y los números MUST aceptarse y mostrarse con el formato regional (coma decimal).
- **FR-030**: Dentro de una serie, cada valor es opcional, pero una serie sin ningún valor no se guarda; un valor que falta MUST mostrarse como "sin dato" y MUST NOT completarse con 0 ni con el valor de otra serie.
- **FR-031**: Los valores MUST validarse: repeticiones enteras de 1 a 999; peso de 0 a 999,9 kg; duración de 1 segundo a 24 horas; distancia mayor que 0 y hasta 999,9 km. Un valor fuera de rango se rechaza con un mensaje claro.
- **FR-032**: Cada ejercicio de una sesión MUST admitir una nota opcional de hasta 500 caracteres.
- **FR-033**: La persona MUST poder agregar, corregir, eliminar y reordenar las series y los ejercicios de una sesión antes de terminarla.

**Integridad y trazabilidad**

- **FR-034**: Cada ejercicio dentro de una sesión (planificado o realizado) MUST guardar una copia propia del nombre y del tipo de medición que tenía el ejercicio al agregarlo, además de su identificador estable.
- **FR-035**: Editar o eliminar un ejercicio propio, o una nueva importación del catálogo, MUST NOT cambiar el nombre, el tipo de medición, las series ni ningún otro dato de sesiones ya creadas.
- **FR-036**: Eliminar un ejercicio MUST NOT impedir ni bloquear nada en las sesiones o rutinas que lo usan; sus sesiones siguen mostrándolo con el nombre guardado.
- **FR-037**: Al iniciar una sesión desde una rutina, el nombre y el tipo de medición MUST tomarse del ejercicio tal como está en ese momento; si el ejercicio ya no existe, se usan los que guardó la rutina y se avisa de que el ejercicio ya no está en la lista.
- **FR-038**: La persona MUST poder corregir una sesión realizada; la sesión MUST mostrar que fue corregida y cuándo, y MUST conservar el nombre y el tipo de medición con que se registró.
- **FR-039**: La persona MUST poder eliminar una sesión con confirmación; eliminarla MUST NOT afectar rutinas, catálogo ni otras sesiones.
- **FR-040**: Los datos que la persona ingresa MUST distinguirse de cualquier dato importado: las sesiones y rutinas son siempre datos de la persona (origen manual) y MUST NOT mezclarse con estimaciones.

**Historia de un ejercicio**

- **FR-041**: La persona MUST poder ver, para un ejercicio, sus últimas sesiones donde lo registró (fecha, series con unidades y esfuerzo percibido si lo indicó), de la más reciente a la más antigua, por tandas, con el nombre que el ejercicio tenía en cada sesión.
- **FR-042**: Dentro de una sesión en curso, la persona MUST poder ver la última vez que hizo un ejercicio sin salir de la sesión.
- **FR-043**: La historia MUST mostrar solo datos registrados: MUST NOT incluir recomendaciones, metas, comparaciones valorativas ni mensajes sobre rendimiento.
- **FR-044**: Esta spec MUST NOT incluir gráficos de progreso: la historia de un ejercicio es una lista de las últimas veces, con sus series, su esfuerzo percibido y sus fechas. Los gráficos quedan para una spec propia (`012-graficos-progreso-entrenamiento`).

**Borradores, idempotencia y errores**

- **FR-045**: Lo que la persona escribe en una sesión en curso, en una rutina o en cualquier formulario de esta spec MUST conservarse como borrador local hasta que el servidor confirme el guardado, y MUST borrarse al cerrar sesión.
- **FR-046**: La aplicación MUST indicar con claridad qué cambios de una sesión están guardados en el servidor y cuáles solo en el dispositivo, y MUST NOT dar por guardado nada que no llegó al servidor.
- **FR-047**: La creación, el inicio, la finalización, el movimiento, la cancelación y la corrección de sesiones, y la creación y edición de rutinas, MUST ser idempotentes: un doble clic o un reintento no duplica registros ni aplica un cambio dos veces.
- **FR-048**: Sin conexión, la aplicación MUST informarlo, MUST NOT permitir guardar y MUST conservar lo escrito como borrador.
- **FR-049**: Todas las pantallas MUST tener estados de carga, vacío, éxito y error definidos, con mensajes en español.

**Privacidad, lenguaje y accesibilidad**

- **FR-050**: Las rutinas y las sesiones MUST ser privadas de cada cuenta: ninguna cuenta puede ver, crear, cambiar ni eliminar las de otra, y una petición sin sesión vigente no accede a nada.
- **FR-051**: Los textos de toda la sección MUST ser neutrales: MUST NOT mencionar rachas, días "perdidos", culpa, ni valorar el rendimiento o la constancia de la persona, ni sugerir entrenar a pesar de dolor o lesión (Principio IV y Límites de alcance).
- **FR-052**: Las pantallas MUST ser usables en teléfono y en escritorio, por teclado y con lector de pantalla, con etiquetas accesibles y áreas táctiles suficientes.
- **FR-053**: Los registros técnicos (logs) MUST NOT contener datos que identifiquen a la persona ni el contenido de sus rutinas o sesiones.
- **FR-054**: Al eliminar una cuenta, sus rutinas y sesiones MUST eliminarse con ella.

### Key Entities *(include if feature involves data)*

- **Rutina**: plan reutilizable de la persona; el conjunto de sus rutinas es su catálogo de entrenamientos, sin días asignados. Atributos: nombre y lista ordenada de ejercicios de la rutina. Es privada de una cuenta.
- **Ejercicio de la rutina**: un ejercicio dentro de una rutina. Atributos: identificador estable del ejercicio, nombre y tipo de medición con que se agregó, posición, cantidad de series y objetivos opcionales según el tipo de medición.
- **Sesión**: una ocasión de entrenamiento de un día. Atributos: fecha (día en la zona horaria de la persona), estado (planificada, en curso, realizada, cancelada), marcas (reprogramada, modificada, corregida), recorrido de fechas si se reprogramó, rutina de origen si la hay (solo como referencia, sin dependencia), y una nota general opcional. Es privada de una cuenta.
- **Plan de la sesión**: lo que se pensaba hacer, copiado al crear la sesión desde una rutina: ejercicios, series y objetivos. Es inmutable respecto de la rutina de origen.
- **Ejercicio de la sesión**: un ejercicio dentro de una sesión. Atributos: identificador estable del ejercicio, copia del nombre y del tipo de medición, si formaba parte del plan, si sustituye a otro ejercicio planificado, si quedó sin hacer, esfuerzo percibido opcional de 1 a 10 (para todas sus series en conjunto), nota opcional y sus series realizadas.
- **Serie**: una serie realizada de un ejercicio de la sesión. Atributos: posición y los valores que correspondan al tipo de medición (repeticiones, peso en kg, duración, distancia en km), cada uno opcional y mostrado como "sin dato" si falta.
- **Tipo de medición**: el de la spec 005 (repeticiones con peso, repeticiones sin peso, tiempo, distancia y tiempo); define qué valores admite un objetivo y una serie.
- **Historia de un ejercicio**: vista derivada de las sesiones donde se registró un ejercicio; no guarda datos propios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona inicia una sesión desde una rutina y anota su primera serie en menos de 30 segundos, y registra una sesión completa de 3 ejercicios con 3 series cada uno en menos de 4 minutos.
- **SC-002**: En el 100 % de los casos probados, un doble clic, un reintento de red o mover/cancelar una sesión varias veces seguidas no crea sesiones, rutinas ni series duplicadas.
- **SC-003**: Mover o reprogramar sesiones no cambia las fechas ni los ejercicios de ninguna sesión ya realizada en el 100 % de los casos probados.
- **SC-004**: Editar o eliminar un ejercicio propio, editar o eliminar una rutina o repetir la importación del catálogo no cambia el nombre, el tipo de medición ni las series de ninguna sesión ya creada en el 100 % de los casos probados.
- **SC-005**: Tras recargar o cerrar la pestaña con una sesión en curso, se recupera el 100 % de lo escrito, y ningún cambio que no llegó al servidor se presenta como guardado.
- **SC-006**: En el 100 % de las sesiones con plan se ven el plan y lo realizado por separado, y ningún valor planificado aparece como realizado.
- **SC-007**: El 100 % de los datos que faltan se muestra como "sin dato" y el 0 % se completa con supuestos, en rutinas, sesiones e historia de un ejercicio.
- **SC-008**: En pruebas con dos cuentas, el 100 % de los intentos de ver, crear, cambiar o eliminar rutinas o sesiones de otra cuenta, o de acceder sin sesión vigente, es rechazado.
- **SC-009**: Desde una sesión en curso, la persona ve la última vez que hizo un ejercicio en un solo paso (sin salir de la sesión) en el 100 % de los ejercicios con historia.
- **SC-010**: El calendario de un mes con 200 sesiones registradas se muestra en menos de 2 segundos, y la historia de un ejercicio con 500 sesiones muestra su primera tanda en menos de 1 segundo.
- **SC-011**: Ningún texto de la sección contiene rachas, culpa, ni valoraciones de constancia o rendimiento, verificado por revisión de todos los textos y por pruebas automáticas.
- **SC-012**: Todas las pantallas se pueden usar y completar en pantalla de teléfono y de escritorio, y por teclado, sin errores de accesibilidad graves.

## Assumptions

- Las personas ya tienen cuenta y sesión iniciada (spec 001) y el catálogo de ejercicios de la spec 005 está disponible; los ejercicios se eligen con la misma búsqueda de esa spec, y cada ejercicio tiene un identificador estable que no cambia nunca.
- Las rutinas y las sesiones son siempre de una sola cuenta (convención de propiedad de la spec 001); no hay rutinas compartidas ni importadas.
- "Sesión" es el registro de un día; no se registra la hora exacta de inicio ni de fin como dato visible en esta spec (el plan puede guardarla para ordenar las sesiones de un mismo día).
- Los estados principales de una sesión son planificada, en curso, realizada y cancelada; "reprogramada" y "modificada" (Principio V) se muestran como marcas que acompañan al estado. Una sesión "modificada" siempre está además realizada.
- Un solo estado "en curso" por persona evita sesiones duplicadas por error; si se necesitan dos entrenamientos simultáneos, se registran uno a continuación del otro o como sesiones distintas del mismo día.
- Solo se puede reprogramar una sesión planificada, a una fecha de hoy o futura; para algo que ya ocurrió se registra una sesión realizada. Una sesión realizada no cambia de fecha (Principio II).
- Las unidades son las del sistema métrico (kg, km); la duración se registra en horas, minutos y segundos. Cada valor muestra su unidad (Principio VI).
- Esta spec no calcula calorías ni gasto de ninguna sesión (spec 007/008), no hace recomendaciones de cargas, ejercicios ni rutinas (Principio IV) y no usa IA (spec 009).
- Esta spec no incluye rutinas por semanas o ciclos, descansos entre series con cronómetro, supersets, calentamiento como tipo aparte, ni plantillas del sistema: la persona arma las suyas.
- Compartir rutinas con otras personas, importar rutinas de terceros y exportar el historial quedan fuera de esta spec.
- La historia de un ejercicio agrupa por el identificador del ejercicio: una copia propia de un ejercicio del catálogo es otro ejercicio y tiene su propia historia.
- Sin conexión no se puede planificar, guardar ni consultar (spec 001, Principio VI); los borradores se conservan localmente.
- Los límites numéricos (30 ejercicios por rutina o sesión, 20 series por ejercicio, notas de 1.000 y 500 caracteres) son razonables para uso personal y pueden ajustarse en el plan sin cambiar el comportamiento descrito.
- El esfuerzo percibido es un dato opcional elegido por la persona, de 1 a 10, uno por ejercicio de la sesión, sin juicios sobre el resultado; la escala se presenta con etiquetas neutrales (por ejemplo, 1 = muy suave y 10 = el máximo esfuerzo) y no se usa para recomendar nada.
- Los gráficos de progreso no forman parte de esta spec: están redactados aparte en la spec 012, pendiente de desarrollo, y se apoyarán en los datos que esta spec registra.

# Feature Specification: Catálogo de ejercicios

**Feature Branch**: `005-catalogo-de-ejercicios`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Catálogo de ejercicios de MyGuide (spec 005 del roadmap, Principios II y X). La persona puede buscar ejercicios en un catálogo propio de la aplicación (copia local importada desde fuentes abiertas, sin consultar a un tercero en vivo) y ver para cada uno su nombre en español, los músculos que trabaja, el equipamiento necesario, una descripción o pasos breves de ejecución y su tipo de medición (cómo se registra: repeticiones con carga, repeticiones sin carga, tiempo, o distancia y tiempo). Cada ejercicio muestra su procedencia: fuente, identificador de origen, fecha de importación y si es importado o propio, y los datos que faltan se muestran como faltantes, nunca completados con supuestos. Los nombres y descripciones están en español y las traducciones importadas o automáticas pueden revisarse y corregirse. La persona puede crear sus propios ejercicios, editar y eliminar los propios, y crear una copia propia editable de uno del catálogo sin alterar el original ni lo registrado antes; eliminar o editar un ejercicio nunca cambia sesiones ya realizadas (spec 006). La fuente, el formato, el proceso de importación y la estrategia de traducción se deciden en el plan con investigación (decisión pendiente 4 de la Constitution); la licencia de cada fuente se valida y documenta antes de importarla. Fuera de alcance: rutinas, sesiones y registro de entrenamientos (spec 006), sueño, pasos y actividad (007), gasto calórico (007/008), recomendaciones automáticas de ejercicios, planes y estimación con IA."

## Clarifications

### Session 2026-10-20

- Q: ¿Esta spec incluye un filtro por músculo y por equipamiento además de la búsqueda de texto y el filtro de origen? → A: Sí, ambos filtros (por músculo y por equipamiento), que se combinan con el texto buscado y con las pestañas de origen.
- Q: ¿La búsqueda debe encontrar también por el nombre original en inglés y por sinónimos? → A: Sí. La búsqueda encuentra por el nombre en español, por el nombre original de la fuente y por los sinónimos que la fuente o el autor informen; el resultado siempre muestra el nombre en español.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buscar un ejercicio y ver su detalle (Priority: P1)

La persona escribe el nombre de un ejercicio y obtiene una lista de coincidencias. Al abrir una, ve su nombre en español, los músculos que trabaja, el equipamiento que necesita, cómo se ejecuta, cómo se registra (su tipo de medición), de dónde viene el dato y qué datos faltan.

**Why this priority**: Es el valor central de la spec y la base de las rutinas y sesiones (spec 006). Sin poder encontrar y entender un ejercicio no hay nada que planificar ni registrar.

**Independent Test**: Con un catálogo de ejemplo cargado, buscar "sentadilla", "press" y "correr", abrir un resultado de cada tipo y comprobar que se ven el nombre en español, los músculos, el equipamiento, la descripción, el tipo de medición, la procedencia y los faltantes como "sin dato".

**Acceptance Scenarios**:

1. **Given** un catálogo con ejercicios de fuerza, de peso corporal y de resistencia, **When** la persona escribe "sentadilla", **Then** ve una lista de ejercicios cuyo nombre coincide, cada uno con su nombre, el músculo principal (si lo tiene), el equipamiento (si lo tiene) y una marca visible de si es del catálogo o propio.
2. **Given** una búsqueda con tildes o mayúsculas distintas ("Elevación Lateral" y "elevacion lateral"), **When** la ejecuta, **Then** obtiene los mismos resultados sin importar acentos ni mayúsculas.
3. **Given** un ejercicio con todos sus datos, **When** lo abre, **Then** ve su nombre, los músculos principales y secundarios, el equipamiento, la descripción o pasos de ejecución y su tipo de medición, explicado con palabras (por ejemplo, "Se registra con repeticiones y peso").
4. **Given** un ejercicio sin descripción, o sin músculos o equipamiento informados, **When** lo abre, **Then** cada dato faltante se muestra como "sin dato" y nunca se completa con un supuesto.
5. **Given** un ejercicio del catálogo, **When** lo abre, **Then** ve su procedencia: nombre de la fuente, identificador de origen, fecha de importación y que es un ejercicio importado.
6. **Given** un ejercicio cuyo nombre o descripción fue traducido, **When** lo abre, **Then** se indica si el texto viene del idioma original, de una traducción sin revisar o de una traducción revisada.
7. **Given** una búsqueda sin coincidencias, **When** la ejecuta, **Then** ve un mensaje claro de que no hay resultados y la opción de crear su propio ejercicio con lo que escribió.
8. **Given** una búsqueda con más resultados que los que entran en pantalla, **When** pide ver más, **Then** los suma sin perder los anteriores.
9. **Given** una búsqueda con resultados, **When** elige la pestaña "Del catálogo" o "Mis ejercicios", **Then** ve solo los ejercicios de ese origen; "Todos" los muestra juntos, claramente diferenciados.
10. **Given** el filtro por músculo o por equipamiento (FR-005), **When** elige uno, **Then** la lista se limita a los ejercicios que lo cumplen (un músculo coincide si es principal o secundario del ejercicio), sin perder el texto buscado ni la pestaña de origen; puede combinar los dos filtros y quitarlos con un solo gesto.
11. **Given** que busca "squat" o el nombre de un sinónimo ("sentadilla goblet"), **When** ejecuta la búsqueda, **Then** encuentra los ejercicios cuyo nombre original o sinónimo coincide, y cada resultado se muestra con su nombre en español.
12. **Given** un ejercicio con nombre original y sinónimos, **When** lo abre, **Then** ve su nombre en español y, aparte, los otros nombres con los que también se lo conoce.

---

### User Story 2 - Crear mi propio ejercicio (Priority: P1)

Cuando un ejercicio no está en el catálogo, la persona lo crea con su nombre y su tipo de medición, y opcionalmente músculos, equipamiento y una descripción. Solo ella lo ve y lo puede usar.

**Why this priority**: El catálogo nunca cubrirá todo (variantes, ejercicios de un gimnasio concreto, deportes); sin esto la persona queda bloqueada al armar rutinas y registrar sesiones.

**Independent Test**: Crear un ejercicio con solo nombre y tipo de medición, y otro con todos los datos; comprobar que aparecen al buscarlos, marcados como "propio", y que otra cuenta no los ve.

**Acceptance Scenarios**:

1. **Given** el formulario de nuevo ejercicio, **When** completa nombre y tipo de medición, **Then** el ejercicio se guarda; músculos, equipamiento y descripción quedan como "sin dato".
2. **Given** el formulario, **When** completa también músculos principales y secundarios, equipamiento y descripción, **Then** el ejercicio se guarda y muestra esos datos en el detalle.
3. **Given** un nombre vacío o formado solo por espacios, o un tipo de medición no elegido, **When** intenta guardar, **Then** se rechaza con un mensaje que explica qué corregir.
4. **Given** un nombre igual al de otro ejercicio suyo, **When** guarda, **Then** se guarda igual y se le avisa de que ya tiene uno con ese nombre (puede haber variantes).
5. **Given** un ejercicio propio, **When** otra cuenta busca, **Then** no lo encuentra ni puede acceder a él.
6. **Given** un doble clic en "Guardar" o un reintento de red, **When** se envía, **Then** se crea un solo ejercicio.
7. **Given** que se cortó la conexión al guardar, **When** falla, **Then** la persona ve que no se guardó y lo escrito se conserva como borrador.

---

### User Story 3 - Crear mi versión de un ejercicio del catálogo (Priority: P2)

Si un ejercicio del catálogo tiene una traducción rara, un dato incompleto o una descripción que no le sirve, la persona crea una copia propia y la corrige, sin tocar el original ni a otras personas.

**Why this priority**: Los datos importados y las traducciones pueden tener errores (Principio X); corregirlos debe ser posible sin depender de nadie. Es menos urgente que buscar y crear.

**Independent Test**: Abrir un ejercicio del catálogo, crear una copia, cambiar el nombre y la descripción; comprobar que el original no cambió, que la copia dice de qué ejercicio viene y que otra cuenta sigue viendo el original sin cambios.

**Acceptance Scenarios**:

1. **Given** un ejercicio del catálogo, **When** elige "Crear mi versión", **Then** se crea un ejercicio propio con los mismos datos, que puede editar, y que indica "basado en" el original.
2. **Given** una copia editada, **When** busca el ejercicio, **Then** ve ambos (el original del catálogo y su versión propia) claramente diferenciados.
3. **Given** una copia editada, **When** otra cuenta abre el original, **Then** lo ve sin ningún cambio.
4. **Given** que el catálogo se actualiza con una nueva importación, **When** la persona abre su copia, **Then** sus datos siguen siendo los suyos.
5. **Given** un ejercicio ya copiado, **When** lo vuelve a copiar, **Then** se crea una segunda copia independiente.

---

### User Story 4 - Editar y eliminar mis ejercicios (Priority: P2)

La persona corrige los datos de sus ejercicios propios y puede eliminarlos. Cambiar o borrar un ejercicio nunca altera lo que ya se realizó o registró en el pasado.

**Why this priority**: Mantiene el catálogo propio ordenado. No bloquea el uso básico.

**Independent Test**: Editar un ejercicio propio y comprobar que se actualiza; eliminarlo y comprobar que ya no aparece en las búsquedas; la regla de que el historial no se altera se prueba completa al implementar la spec 006.

**Acceptance Scenarios**:

1. **Given** un ejercicio propio, **When** edita nombre, tipo de medición, músculos, equipamiento o descripción y guarda, **Then** los cambios se ven al volver a abrirlo.
2. **Given** un ejercicio propio, **When** lo elimina y confirma, **Then** deja de aparecer en búsquedas y listas.
3. **Given** un ejercicio del catálogo, **When** intenta editarlo o eliminarlo, **Then** no puede: solo se ofrece crear su propia versión.
4. **Given** una edición con datos inválidos, **When** guarda, **Then** se rechaza con el mismo criterio que al crear.
5. **Given** una pérdida de conexión al guardar, **When** falla, **Then** se avisa que no se guardó y lo escrito se conserva como borrador.
6. **Given** un ejercicio propio del que hizo copias, **When** lo elimina, **Then** las copias no cambian.

---

### User Story 5 - Cargar y actualizar el catálogo (Priority: P1)

El autor de la aplicación carga el catálogo inicial desde las fuentes elegidas y puede volver a cargarlo para actualizarlo. Cada ejercicio queda con su procedencia, su tipo de medición y su nombre en español, y las fuentes con su licencia y atribución documentadas.

**Why this priority**: Sin catálogo cargado no hay qué buscar. Es un proceso del autor (no una pantalla para usuarios), pero es una dependencia directa de la Historia 1.

**Independent Test**: Ejecutar la carga con un conjunto de ejemplo; comprobar que cada ejercicio tiene fuente, identificador, fecha, nombre en español y tipo de medición; ejecutarla de nuevo y comprobar que no se duplica nada y que las copias y los ejercicios propios no cambian.

**Acceptance Scenarios**:

1. **Given** una fuente documentada, **When** el autor ejecuta la carga, **Then** los ejercicios quedan en la copia local con nombre en español, tipo de medición, fuente, identificador de origen y fecha de importación.
2. **Given** una carga ya hecha, **When** la repite sobre los mismos datos, **Then** no se crean duplicados y el resultado es el mismo.
3. **Given** un ejercicio ya importado cuya fuente cambió un dato, **When** se vuelve a importar, **Then** el ejercicio del catálogo se actualiza y las copias propias de las personas no cambian.
4. **Given** un registro de la fuente sin un dato opcional (músculos, equipamiento o descripción), **When** se importa, **Then** ese dato queda como faltante, nunca como un valor supuesto.
5. **Given** un registro de la fuente que no se puede interpretar (sin nombre, o cuyo tipo de medición no se puede determinar con las reglas documentadas), **When** se importa, **Then** se omite y queda anotado en un informe de la carga, sin detener el resto.
6. **Given** una fuente sin licencia documentada, **When** se intenta importar, **Then** la carga se rechaza.
7. **Given** nombres y descripciones en otro idioma, **When** se importan, **Then** quedan en español y marcados según si la traducción fue revisada o no, y el autor puede corregirlos y marcarlos como revisados sin que una nueva importación pise la corrección.

---

### User Story 6 - Ver las fuentes y sus licencias (Priority: P3)

La persona puede consultar de dónde salen los datos del catálogo de ejercicios y bajo qué licencia, con la atribución que cada fuente exige.

**Why this priority**: Es una obligación de las licencias y de transparencia, pero no bloquea el uso diario.

**Independent Test**: Abrir la pantalla de fuentes y comprobar que lista cada fuente de ejercicios con su licencia, su atribución, la fecha de la última importación y cuántos ejercicios aporta.

**Acceptance Scenarios**:

1. **Given** un catálogo con una o más fuentes de ejercicios, **When** abre la pantalla de fuentes, **Then** ve cada fuente con su nombre, su licencia, el texto de atribución requerido, la fecha de la última importación y la cantidad de ejercicios; las fuentes de alimentos siguen visibles en la misma pantalla.
2. **Given** un ejercicio del catálogo, **When** lo abre, **Then** desde su procedencia puede llegar a la información de su fuente.

---

### Edge Cases

- Dos ejercicios casi iguales de fuentes distintas (o del catálogo y propio) se muestran como ejercicios separados, cada uno con su procedencia; nunca se fusionan en silencio.
- Un nombre muy largo, con símbolos o emojis se muestra completo en el detalle y recortado con puntos suspensivos en la lista.
- Una búsqueda de un solo carácter o solo espacios pide escribir al menos 2 caracteres y no muestra una lista enorme.
- Con miles de coincidencias, se muestran por tandas, ordenadas por relevancia (coincidencia exacta del nombre primero, luego el resto).
- Un ejercicio sin músculos y sin equipamiento es válido; un ejercicio sin tipo de medición no existe (es obligatorio).
- Un ejercicio sin equipamiento no es lo mismo que un ejercicio de "peso corporal": el primero es un dato faltante ("sin dato") y el segundo es un valor informado.
- Si se pierde la conexión al buscar, se muestra el error con la opción de reintentar y nada se presenta como resultado.
- Si la persona elimina un ejercicio propio del que hizo copias o que usó en el pasado, las copias y las sesiones pasadas no cambian.
- Si el catálogo todavía está vacío, se informa que no hay ejercicios cargados y se ofrece crear uno propio.
- Si una fuente cambia su licencia o deja de estar disponible, lo ya importado se conserva con su licencia original documentada; la decisión de mantenerlo o retirarlo se toma por fuente.
- Cambiar el tipo de medición de un ejercicio propio que ya se usó no reescribe sesiones pasadas: cada sesión conserva su propia copia del ejercicio (spec 006).
- Una descripción larga (pasos, notas) se muestra completa en el detalle, con saltos de línea, sin cortar el diseño en el teléfono.
- Una combinación de filtros sin resultados muestra un estado vacío que dice qué filtros están activos y permite quitarlos, sin ofrecer crear un ejercicio "con el filtro".
- Un sinónimo igual al nombre en español o repetido se muestra una sola vez; un sinónimo que coincide con el nombre de otro ejercicio no fusiona los dos: ambos aparecen en la búsqueda.
- Buscar "squat" encuentra el ejercicio aunque la persona nunca haya visto el nombre original: el nombre mostrado sigue siendo el español.

## Requirements *(mandatory)*

### Functional Requirements

**Búsqueda y consulta**

- **FR-001**: El sistema MUST permitir buscar ejercicios por nombre en el catálogo importado y en los ejercicios propios de la persona, desde una única búsqueda.
- **FR-002**: La búsqueda MUST ignorar acentos y diferencias de mayúsculas y minúsculas, y MUST encontrar coincidencias parciales de palabras.
- **FR-003**: Los resultados MUST ordenarse por relevancia (nombre exacto primero, luego el resto) y MUST cargarse por tandas, sin perder los anteriores.
- **FR-004**: Cada resultado MUST mostrar el nombre, el músculo principal y el equipamiento (o "sin dato"), el tipo de medición y una marca visible de si es del catálogo o propio.
- **FR-005**: La búsqueda MUST ofrecer un filtro por músculo y un filtro por equipamiento, elegidos de las listas cerradas (FR-024). Los dos MUST poder combinarse entre sí, con el texto buscado y con el filtro de origen (FR-012); un ejercicio coincide con un músculo si lo tiene como principal o como secundario. Sin texto, los filtros MUST permitir explorar el catálogo. Cada filtro MUST poder quitarse y MUST mostrar cuántos resultados deja.
- **FR-006**: El detalle de un ejercicio MUST mostrar: nombre, músculos principales, músculos secundarios, equipamiento, descripción o pasos de ejecución y tipo de medición explicado con palabras.
- **FR-007**: Un dato que falta MUST mostrarse como "sin dato" y MUST NOT completarse con supuestos.
- **FR-008**: La búsqueda y la consulta MUST funcionar sin acceso a servicios de terceros.
- **FR-009**: Una búsqueda sin resultados MUST mostrar un estado vacío claro con la opción de crear un ejercicio propio; el catálogo vacío MUST informarse como tal.
- **FR-010**: Los estados de carga, vacío, éxito y error MUST estar definidos en la búsqueda, el detalle y los formularios.
- **FR-011**: La búsqueda MUST exigir al menos 2 caracteres.
- **FR-012**: La búsqueda MUST ofrecer un filtro de origen con tres opciones: todos, solo del catálogo y solo propios (incluidas las copias). El filtro MUST conservarse mientras la persona navega entre resultados y detalle.
- **FR-013**: La búsqueda MUST encontrar un ejercicio por su nombre en español, por su nombre original de la fuente y por sus sinónimos (por ejemplo, "squat" y "sentadilla"), con las mismas reglas de acentos y mayúsculas (FR-002). El resultado MUST mostrar siempre el nombre en español; el nombre original y los sinónimos MUST verse en el detalle como "También se conoce como".

**Tipo de medición**

- **FR-014**: Todo ejercicio MUST tener exactamente un tipo de medición, que define cómo se registrará en una sesión (spec 006). Los tipos son: **repeticiones con peso**, **repeticiones sin peso** (peso corporal), **tiempo** y **distancia y tiempo**.
- **FR-015**: El tipo de medición MUST mostrarse en la lista y en el detalle con palabras, no solo con un ícono.
- **FR-016**: El tipo de medición MUST ser un dato obligatorio al crear un ejercicio propio y al importar uno; un registro importado cuyo tipo no se pueda determinar con las reglas documentadas MUST omitirse con un informe.

**Procedencia, fuentes y traducción**

- **FR-017**: Cada ejercicio MUST registrar su procedencia: tipo de origen (importado o propio) y, si es importado, fuente, identificador de origen y fecha de importación. La interfaz MUST mostrarla.
- **FR-018**: El sistema MUST ofrecer una pantalla de fuentes con el nombre, la licencia, el texto de atribución requerido, la fecha de última importación y la cantidad de ejercicios de cada fuente de ejercicios; MUST ser la misma pantalla en la que ya se ven las fuentes de alimentos.
- **FR-019**: Una fuente MUST tener su licencia y su atribución documentadas antes de poder importarse; el proceso de carga MUST rechazar una fuente que no las tenga.
- **FR-020**: Los nombres y las descripciones de los ejercicios importados MUST mostrarse en español e indicar si provienen del idioma original, de una traducción sin revisar o de una traducción revisada (Principio X).
- **FR-021**: Las traducciones importadas MUST poder revisarse y corregirse por el autor; una corrección revisada MUST NOT ser pisada por una nueva importación.

**Ejercicios propios y copias**

- **FR-022**: La persona MUST poder crear ejercicios propios con nombre y tipo de medición obligatorios, y con músculos principales, músculos secundarios, equipamiento y descripción opcionales.
- **FR-023**: Los ejercicios propios MUST ser privados: cada uno pertenece a una única cuenta y ninguna otra puede verlo, buscarlo ni modificarlo.
- **FR-024**: Los músculos y el equipamiento MUST elegirse de listas cerradas en español (no de texto libre), para que se puedan buscar y agrupar.
- **FR-025**: El sistema MUST validar los datos: nombre no vacío y de hasta un largo razonable, tipo de medición válido, descripción de hasta un largo razonable. Los datos inválidos MUST rechazarse con un mensaje que indique qué corregir.
- **FR-026**: La persona MUST poder crear una copia propia de un ejercicio del catálogo, editable, que indique de qué ejercicio se basa, sin alterar el original ni lo que ven otras cuentas.
- **FR-027**: La persona MUST poder editar y eliminar sus ejercicios propios (incluidas sus copias), con confirmación antes de eliminar.
- **FR-028**: Los ejercicios del catálogo importado MUST ser de solo lectura para todas las cuentas: nadie puede editarlos ni eliminarlos desde la aplicación.
- **FR-029**: Crear un ejercicio MUST ser idempotente ante dobles envíos o reintentos de red (un solo ejercicio).
- **FR-030**: Editar o eliminar un ejercicio, propio o copia, MUST NOT alterar sesiones ya realizadas ni lo registrado antes (Principio II). Para ello, cada ejercicio MUST tener un identificador estable, y los datos que una sesión necesite conservar (nombre, tipo de medición) MUST poder copiarse en la sesión; esta spec no puede borrar ni reescribir nada que la referencie.

**Carga del catálogo**

- **FR-031**: Debe existir un proceso de carga, ejecutado por el autor y no por las personas usuarias, que importe ejercicios desde una fuente documentada a la copia local.
- **FR-032**: La carga MUST ser repetible: ejecutarla de nuevo con los mismos datos no crea duplicados, y con datos cambiados actualiza solo los ejercicios importados.
- **FR-033**: Una nueva importación MUST NOT modificar los ejercicios propios ni las copias de las personas.
- **FR-034**: La carga MUST conservar como faltante todo dato opcional que la fuente no informe, y MUST omitir, con un informe, los registros que no se puedan interpretar, sin detener el resto.
- **FR-035**: La carga MUST asignar el tipo de medición, los músculos y el equipamiento a las listas cerradas de la aplicación según reglas documentadas, y MUST informar los valores de la fuente que no tengan equivalente.

**Experiencia, privacidad y accesibilidad**

- **FR-036**: Las pantallas MUST ser responsive, estar en español, con etiquetas accesibles, navegación por teclado y errores comprensibles.
- **FR-037**: Un guardado que no llegó al servidor MUST informarse como tal, y los formularios MUST conservar su borrador local hasta la confirmación del servidor (según la spec 001).
- **FR-038**: Sin conexión no se puede buscar ni guardar; la aplicación lo informa y no presenta nada como guardado (Principio VI).
- **FR-039**: El catálogo importado MUST ser de lectura para cualquier cuenta con sesión vigente; sin sesión vigente nadie lo lee.
- **FR-040**: Los registros técnicos (logs) MUST NOT contener datos que identifiquen a la persona ni el contenido de sus ejercicios propios.
- **FR-041**: Al eliminar una cuenta, sus ejercicios propios MUST eliminarse con ella.

### Key Entities *(include if feature involves data)*

- **Ejercicio**: lo que la persona busca, consulta y más adelante incluye en rutinas y sesiones. Atributos: nombre en español, nombre original de la fuente y sinónimos (opcionales; solo los importados traen nombre original), tipo de medición (obligatorio), músculos principales y secundarios (opcionales), equipamiento (opcional), descripción o pasos (opcional), tipo de origen (importado o propio), estado del texto (original, traducido sin revisar, revisado) e identificador estable.
- **Tipo de medición**: cómo se registra un ejercicio: repeticiones con peso, repeticiones sin peso, tiempo, o distancia y tiempo. Lista cerrada.
- **Músculo / grupo muscular** y **Equipamiento**: valores de listas cerradas en español con los que se describen y buscan los ejercicios.
- **Fuente**: de dónde se importan los ejercicios. Atributos: nombre, licencia, texto de atribución, dirección de la fuente y fecha de la última importación. Es el mismo concepto que la fuente de alimentos de la spec 002.
- **Procedencia**: vínculo de un ejercicio importado con su fuente (identificador de origen y fecha de importación). Una copia propia guarda además el ejercicio en que se basa.
- **Informe de carga**: resultado de cada importación. Atributos: fecha, fuente, ejercicios creados, actualizados y omitidos, y el motivo de cada omisión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona encuentra un ejercicio conocido y ve su detalle en menos de 15 segundos desde que abre la búsqueda.
- **SC-002**: El 95 % de las búsquedas, con o sin filtros, devuelve la primera tanda de resultados en menos de 1 segundo, con un catálogo de al menos 2.000 ejercicios.
- **SC-012**: Buscar un ejercicio por su nombre original en inglés o por un sinónimo informado lo encuentra en el 100 % de los casos probados, y los filtros por músculo y equipamiento devuelven exactamente los ejercicios que los cumplen en el 100 % de los casos probados.
- **SC-003**: Una persona crea un ejercicio propio con nombre, tipo de medición, músculos y equipamiento en menos de 1 minuto.
- **SC-004**: El 100 % de los datos faltantes se muestra como "sin dato" y el 0 % se completa con supuestos, en el catálogo importado y en los ejercicios propios.
- **SC-005**: El 100 % de los ejercicios importados muestra fuente, identificador de origen y fecha de importación, y el 100 % de los ejercicios (importados y propios) tiene un tipo de medición.
- **SC-006**: El 100 % de los ejercicios mostrados tiene su nombre en español, con su estado de traducción visible cuando es importado.
- **SC-007**: En pruebas con dos cuentas, el 100 % de los intentos de ver, editar o eliminar ejercicios propios de otra cuenta, o de modificar el catálogo importado, es rechazado.
- **SC-008**: Editar o eliminar un ejercicio (propio o copia) no cambia ningún dato de las copias de otras cuentas ni del catálogo original en el 100 % de los casos probados.
- **SC-009**: Repetir la carga del catálogo con los mismos datos produce 0 duplicados y 0 cambios en ejercicios propios ni en traducciones ya revisadas.
- **SC-010**: Buscar y consultar el catálogo funciona sin conexión a servicios de terceros (solo con el servidor de la aplicación) en el 100 % de los casos probados.
- **SC-011**: Todas las pantallas se pueden usar y completar en pantalla de teléfono y de escritorio, y por teclado, sin errores de accesibilidad graves.

## Assumptions

- Los usuarios ya tienen cuenta y sesión iniciada (spec 001); el catálogo es privado para quien inició sesión.
- El catálogo importado es común a todas las cuentas y de solo lectura; los ejercicios propios pertenecen a una cuenta (convención de propiedad de la spec 001).
- La elección concreta de fuentes (por ejemplo, bases abiertas de ejercicios), su formato, su cobertura, su licencia y la estrategia de traducción al español se resuelven en el plan de esta spec con una investigación (decisión técnica pendiente #4 de la Constitution), no aquí.
- La carga del catálogo es una tarea del autor, ejecutada fuera de la aplicación, y no tiene pantalla para las personas usuarias; la revisión de traducciones también la hace el autor por ese camino. Las personas corrigen lo suyo creando una copia propia.
- El catálogo inicial cubre ejercicios de fuerza (con peso y con peso corporal), de resistencia (correr, caminar, bicicleta, natación, remo) y de movilidad o estiramiento, de modo que los cuatro tipos de medición queden representados. El volumen total debe caber en el plan gratuito de la base de datos, que se verifica en el plan.
- Las imágenes, GIF y videos de los ejercicios quedan fuera de esta spec; solo se evalúan en el plan si la licencia de una fuente lo permite de forma clara, y no se alojan en esta spec.
- Los músculos y el equipamiento son listas cerradas en español definidas en el plan (con su correspondencia con los valores de cada fuente); agregar valores a las listas es un cambio de la aplicación.
- Los ejercicios propios tienen sinónimos solo si la persona los escribe; no se piden en el formulario básico (un campo opcional "Otros nombres" queda a criterio del plan). Los ejercicios importados traen el nombre original y los sinónimos que informe la fuente, y el autor puede sumar otros.
- El tipo de medición de un ejercicio propio se puede cambiar; las sesiones de la spec 006 guardarán su propia copia del ejercicio (nombre y tipo de medición), así que el cambio no reescribe el pasado.
- Esta spec no calcula calorías ni gasto de ningún ejercicio (spec 007/008) ni hace recomendaciones de ejercicios (Principio IV).
- Fuera del alcance de esta spec: rutinas, sesiones, series y registro de entrenamientos (spec 006), sueño, pasos y actividad (007), cálculo de gasto calórico (007/008), recomendaciones automáticas, planes de entrenamiento, estimaciones con IA (spec 009) y fotos de ejercicios.
- El catálogo inicial se carga una vez antes del primer uso; las actualizaciones posteriores son manuales y esporádicas.
- Sin conexión no se puede buscar ni guardar (spec 001, Principio VI); el borrador de un formulario se conserva localmente.

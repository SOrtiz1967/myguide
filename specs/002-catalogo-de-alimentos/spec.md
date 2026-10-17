# Feature Specification: Catálogo de alimentos

**Feature Branch**: `002-catalogo-de-alimentos`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Catálogo de alimentos de MyGuide (spec 002 del roadmap). La persona puede buscar alimentos genéricos y de marca (con foco en productos que se consiguen en Argentina) en un catálogo propio de la aplicación, y ver sus calorías, proteínas, carbohidratos, grasas y otros valores por 100 g o 100 ml con la porción de consumo como dato aparte. Cada alimento muestra su procedencia y los valores que faltan se muestran como faltantes, nunca como cero. La persona puede crear sus propios alimentos y crear una copia editable propia de un alimento del catálogo sin alterar el original. El catálogo es una copia local importada de fuentes con licencia compatible y atribución documentada, con nombres en español revisables; buscar y consultar no depende de ningún servicio de terceros. Los alimentos propios son privados de cada cuenta; el catálogo importado es de solo lectura y común a todas las cuentas. Editar o eliminar un alimento no puede alterar registros pasados. Fuera de alcance: registrar comidas, objetivos calóricos, lectura de código de barras con la cámara y estimaciones con IA."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buscar un alimento y ver sus valores (Priority: P1)

La persona escribe el nombre de un alimento o de una marca y obtiene una lista de coincidencias. Al abrir una, ve sus valores nutricionales por 100 g o por 100 ml, la porción de consumo habitual como dato aparte, de dónde viene el dato y qué valores faltan.

**Why this priority**: Es el valor central de la spec y la base del registro de comidas (spec 003). Sin poder encontrar y entender un alimento no hay nada que registrar.

**Independent Test**: Con un catálogo de ejemplo cargado, buscar "leche", "Milka" y "banana", abrir un resultado de cada tipo (genérico y de marca) y comprobar que se ven los valores con sus unidades, la porción, la procedencia y los faltantes como "sin dato".

**Acceptance Scenarios**:

1. **Given** un catálogo con alimentos genéricos y de marca, **When** la persona escribe "leche", **Then** ve una lista que incluye alimentos cuyo nombre o marca coincide, cada uno con su nombre, su marca (si tiene) y un resumen de energía por 100 g o 100 ml.
2. **Given** una búsqueda con tildes o mayúsculas distintas ("Dulce de Leche" y "dulce de leche"), **When** la ejecuta, **Then** obtiene los mismos resultados sin importar acentos ni mayúsculas.
3. **Given** un alimento con todos sus datos, **When** lo abre, **Then** ve energía (kcal), proteínas, carbohidratos (con azúcares), grasas (con saturadas), fibra y sodio, cada uno con su unidad y referido a 100 g o 100 ml según corresponda.
4. **Given** un alimento sin dato de fibra, **When** lo abre, **Then** la fibra se muestra como "sin dato" y nunca como 0.
5. **Given** un alimento del catálogo, **When** lo abre, **Then** ve su procedencia: nombre de la fuente, identificador de origen, fecha de importación y que es un alimento importado.
6. **Given** una búsqueda sin coincidencias, **When** la ejecuta, **Then** ve un mensaje claro de que no hay resultados y la opción de crear su propio alimento con lo que escribió.
7. **Given** una búsqueda, **When** hay más resultados que los que entran en pantalla, **Then** puede ver más sin perder los anteriores.

---

### User Story 2 - Crear mi propio alimento (Priority: P1)

Cuando un alimento no está en el catálogo, la persona lo crea con su nombre, una marca opcional, los valores por 100 g o 100 ml y una porción. Solo ella lo ve y lo puede usar.

**Why this priority**: El catálogo nunca cubrirá todo (comidas caseras, productos locales); sin esto, la persona queda bloqueada al registrar comidas.

**Independent Test**: Crear un alimento con solo nombre y energía, otro con todos los valores y una porción; comprobar que aparecen al buscarlos, marcados como "propio", y que otra cuenta no los ve.

**Acceptance Scenarios**:

1. **Given** el formulario de nuevo alimento, **When** completa nombre, base de referencia (100 g o 100 ml) y energía, **Then** el alimento se guarda; los demás valores quedan como "sin dato".
2. **Given** el formulario, **When** completa también macronutrientes y una porción (nombre y cantidad, por ejemplo "1 vaso (200 ml)"), **Then** el alimento se guarda y muestra esa porción aparte de los valores por 100.
3. **Given** valores imposibles (negativos, o proteínas + carbohidratos + grasas que superan 100 g en 100 g), **When** intenta guardar, **Then** se rechaza con un mensaje que explica qué corregir.
4. **Given** una energía que no coincide con la que resultaría de los macronutrientes, **When** guarda, **Then** se guarda igual y se le muestra un aviso informativo con la diferencia aproximada.
5. **Given** que usa coma decimal ("12,5"), **When** guarda, **Then** el valor se interpreta correctamente.
6. **Given** un alimento propio, **When** otra cuenta busca, **Then** no lo encuentra ni puede acceder a él.
7. **Given** un doble clic en "Guardar" o un reintento de red, **When** se envía, **Then** se crea un solo alimento.

---

### User Story 3 - Crear mi versión de un alimento del catálogo (Priority: P2)

Si un alimento del catálogo tiene un dato incompleto o incorrecto (por ejemplo, una marca cambió la receta), la persona crea una copia propia y la corrige, sin tocar el original ni a otras personas.

**Why this priority**: Los datos colaborativos pueden tener errores (Principio X); corregirlos debe ser posible sin depender de nadie. Es menos urgente que buscar y crear.

**Independent Test**: Abrir un alimento del catálogo, crear una copia, cambiar un valor y el nombre; comprobar que el original no cambió, que la copia dice de qué alimento viene y que otra cuenta sigue viendo el original sin cambios.

**Acceptance Scenarios**:

1. **Given** un alimento del catálogo, **When** elige "Crear mi versión", **Then** se crea un alimento propio con los mismos datos, que puede editar, y que indica "basado en" el original.
2. **Given** una copia editada, **When** busca el alimento, **Then** ve ambos (el original del catálogo y su versión propia) claramente diferenciados.
3. **Given** una copia editada, **When** otra cuenta abre el original, **Then** lo ve sin ningún cambio.
4. **Given** que el catálogo se actualiza con una nueva importación, **When** la persona abre su copia, **Then** sus valores siguen siendo los suyos.
5. **Given** un alimento ya copiado, **When** lo vuelve a copiar, **Then** se crea una segunda copia independiente (no se pisa la anterior).

---

### User Story 4 - Editar y eliminar mis alimentos (Priority: P2)

La persona corrige los valores o el nombre de sus alimentos propios y puede eliminarlos. Cambiar o borrar un alimento nunca altera lo que ya se registró en el pasado.

**Why this priority**: Mantiene el catálogo propio ordenado y correcto. No bloquea el uso básico.

**Independent Test**: Editar un alimento propio y comprobar que se actualiza; eliminarlo y comprobar que ya no aparece en las búsquedas; verificar la regla de que el historial no se altera con las pruebas de la spec 003.

**Acceptance Scenarios**:

1. **Given** un alimento propio, **When** edita nombre, marca, valores o porción y guarda, **Then** los cambios se ven al volver a abrirlo.
2. **Given** un alimento propio, **When** lo elimina y confirma, **Then** deja de aparecer en búsquedas y listas.
3. **Given** un alimento del catálogo, **When** intenta editarlo o eliminarlo, **Then** no puede: solo se ofrece crear su propia versión.
4. **Given** una edición con valores inválidos, **When** guarda, **Then** se rechaza con el mismo criterio que al crear.
5. **Given** una pérdida de conexión al guardar, **When** falla, **Then** se avisa que no se guardó y lo escrito se conserva como borrador.

---

### User Story 5 - Cargar y actualizar el catálogo (Priority: P1)

El autor de la aplicación carga el catálogo inicial desde las fuentes elegidas y puede volver a cargarlo para actualizarlo. Cada alimento queda con su procedencia, y las fuentes con su licencia y atribución documentadas.

**Why this priority**: Sin catálogo cargado no hay qué buscar. Es un proceso del autor (no una pantalla para usuarios), pero es una dependencia directa de la Historia 1.

**Independent Test**: Ejecutar la carga con un conjunto de ejemplo; comprobar que cada alimento tiene fuente, identificador y fecha; ejecutarla de nuevo y comprobar que no se duplica nada y que las copias y alimentos propios no cambian.

**Acceptance Scenarios**:

1. **Given** una fuente documentada, **When** el autor ejecuta la carga, **Then** los alimentos quedan en la copia local con nombre en español, fuente, identificador de origen y fecha de importación.
2. **Given** una carga ya hecha, **When** la repite sobre los mismos datos, **Then** no se crean duplicados y el resultado es el mismo.
3. **Given** un alimento ya importado cuya fuente cambió un valor, **When** se vuelve a importar, **Then** el alimento del catálogo se actualiza y las copias propias de las personas no cambian.
4. **Given** un registro de la fuente sin un dato, **When** se importa, **Then** ese dato queda como faltante, nunca como cero ni como valor supuesto.
5. **Given** un registro de la fuente que no se puede interpretar (sin nombre o con valores imposibles), **When** se importa, **Then** se omite y queda anotado en un informe de la carga, sin detener el resto.
6. **Given** una fuente sin licencia documentada, **When** se intenta importar, **Then** la carga se rechaza.
7. **Given** nombres en otro idioma, **When** se importan, **Then** quedan en español y marcados según si la traducción fue revisada o no.

---

### User Story 6 - Ver las fuentes y sus licencias (Priority: P3)

La persona puede consultar de dónde salen los datos del catálogo y bajo qué licencia, con la atribución que cada fuente exige.

**Why this priority**: Es una obligación de las licencias y de transparencia, pero no bloquea el uso diario.

**Independent Test**: Abrir la pantalla de fuentes y comprobar que lista cada fuente importada con su licencia, su atribución y cuántos alimentos aporta.

**Acceptance Scenarios**:

1. **Given** un catálogo con una o más fuentes, **When** abre la pantalla de fuentes, **Then** ve cada fuente con su nombre, su licencia, el texto de atribución requerido y la fecha de la última importación.
2. **Given** un alimento del catálogo, **When** lo abre, **Then** desde su procedencia puede llegar a la información de su fuente.

---

### Edge Cases

- ¿Qué pasa si hay dos alimentos casi iguales de fuentes distintas? Se muestran como alimentos separados, cada uno con su procedencia; nunca se fusionan en silencio.
- ¿Qué pasa si un nombre es muy largo, tiene símbolos o emojis? Se muestra completo en el detalle y recortado con puntos suspensivos en la lista.
- ¿Qué pasa si la búsqueda tiene un solo carácter o solo espacios? Se pide escribir al menos 2 caracteres y no se muestra una lista enorme.
- ¿Qué pasa si hay miles de coincidencias? Se muestran por tandas, ordenadas por relevancia (coincidencia exacta de nombre primero, luego marca, luego el resto).
- ¿Qué pasa si un alimento tiene energía pero ningún macronutriente (o al revés)? Es válido: lo que falta se muestra como "sin dato".
- ¿Qué pasa si los macronutrientes suman más de 100 g por 100 g? Se rechaza al crear o editar; en el catálogo importado se omite ese registro (ver Historia 5).
- ¿Qué pasa si un alimento se mide por 100 ml pero la persona piensa en gramos? Se muestra siempre la base de referencia junto a cada valor; no hay conversión automática entre gramos y mililitros.
- ¿Qué pasa si una porción no tiene cantidad válida (0 o negativa)? Se rechaza con un mensaje claro.
- ¿Qué pasa si se pierde la conexión al buscar? Se muestra el error con la opción de reintentar y nada se presenta como resultado.
- ¿Qué pasa si la persona elimina un alimento propio del que hizo copias o que usó en el pasado? Las copias y los registros pasados no cambian (se conservan sus propios valores).
- ¿Qué pasa si el catálogo todavía está vacío? Se informa que el catálogo no tiene alimentos cargados y se ofrece crear uno propio.
- ¿Qué pasa si una fuente cambia su licencia o deja de estar disponible? Lo ya importado se conserva con su licencia original documentada; la decisión de mantenerlo o retirarlo se toma por fuente.

## Requirements *(mandatory)*

### Functional Requirements

**Búsqueda y consulta**

- **FR-001**: El sistema MUST permitir buscar alimentos por nombre y por marca en el catálogo importado y en los alimentos propios de la persona, desde una única búsqueda.
- **FR-002**: La búsqueda MUST ignorar acentos y diferencias de mayúsculas y minúsculas, y MUST encontrar coincidencias parciales de palabras.
- **FR-003**: Los resultados MUST ordenarse por relevancia (nombre exacto, luego marca, luego el resto) y MUST cargarse por tandas, sin perder los anteriores.
- **FR-004**: Cada resultado MUST mostrar nombre, marca (si tiene), la base de referencia (100 g o 100 ml), la energía y una marca visible de si es del catálogo o propio.
- **FR-005**: El detalle de un alimento MUST mostrar: energía (kcal), proteínas, carbohidratos (con azúcares), grasas (con saturadas), fibra y sodio, cada valor con su unidad y su base de referencia.
- **FR-006**: Un valor que falta MUST mostrarse como "sin dato" y MUST NOT mostrarse como cero ni completarse con supuestos.
- **FR-007**: La porción de consumo MUST mostrarse como un dato separado de los valores por 100 g o 100 ml, con su nombre y su cantidad.
- **FR-008**: La búsqueda y la consulta MUST funcionar sin acceso a servicios de terceros.
- **FR-009**: Una búsqueda sin resultados MUST mostrar un estado vacío claro con la opción de crear un alimento propio; el catálogo vacío MUST informarse como tal.
- **FR-010**: Los estados de carga, vacío, éxito y error MUST estar definidos en la búsqueda, el detalle y los formularios.

**Procedencia y fuentes**

- **FR-011**: Cada alimento MUST registrar su procedencia: tipo de origen (importado o propio) y, si es importado, fuente, identificador de origen y fecha de importación. La interfaz MUST mostrarla.
- **FR-012**: El sistema MUST ofrecer una pantalla de fuentes con el nombre, la licencia, el texto de atribución requerido, la fecha de última importación y la cantidad de alimentos de cada fuente.
- **FR-013**: Una fuente MUST tener su licencia y su atribución documentadas antes de poder importarse; el proceso de carga MUST rechazar una fuente que no las tenga.
- **FR-014**: Los nombres en español de los alimentos importados MUST indicar si provienen del idioma original, de una traducción sin revisar o de una traducción revisada.

**Alimentos propios y copias**

- **FR-015**: La persona MUST poder crear alimentos propios con nombre, marca opcional, base de referencia (100 g o 100 ml), valores nutricionales opcionales salvo la energía, y una porción opcional.
- **FR-016**: Los alimentos propios MUST ser privados: cada uno pertenece a una única cuenta y ninguna otra puede verlo, buscarlo ni modificarlo.
- **FR-017**: El sistema MUST validar los valores: no negativos, dentro de rangos físicamente posibles, y con proteínas + carbohidratos + grasas no mayores a 100 g por cada 100 g (o 100 ml). Los valores inválidos MUST rechazarse con un mensaje que indique qué corregir.
- **FR-018**: Si la energía declarada difiere notablemente de la derivada de los macronutrientes, el sistema MUST avisarlo de forma informativa y MUST permitir guardar.
- **FR-019**: Los valores decimales MUST aceptarse con coma o con punto, y mostrarse con el formato regional.
- **FR-020**: La persona MUST poder crear una copia propia de un alimento del catálogo, editable, que indique de qué alimento se basa, sin alterar el original ni lo que ven otras cuentas.
- **FR-021**: La persona MUST poder editar y eliminar sus alimentos propios (incluidas sus copias), con confirmación antes de eliminar.
- **FR-022**: Los alimentos del catálogo importado MUST ser de solo lectura para todas las cuentas: nadie puede editarlos ni eliminarlos desde la aplicación.
- **FR-023**: Crear un alimento MUST ser idempotente ante dobles envíos o reintentos de red (un solo alimento).
- **FR-024**: Editar o eliminar un alimento, propio o copia, MUST NOT alterar registros históricos ya confirmados, que conservan sus propios valores (Principio II).

**Carga del catálogo**

- **FR-025**: Debe existir un proceso de carga, ejecutado por el autor y no por las personas usuarias, que importe alimentos desde una fuente documentada a la copia local.
- **FR-026**: La carga MUST ser repetible: ejecutarla de nuevo con los mismos datos no crea duplicados, y con datos cambiados actualiza solo los alimentos importados.
- **FR-027**: Una nueva importación MUST NOT modificar los alimentos propios ni las copias de las personas.
- **FR-028**: La carga MUST conservar como faltante todo dato que la fuente no informe, y MUST omitir, con un informe, los registros que no se puedan interpretar o tengan valores imposibles, sin detener el resto.
- **FR-029**: Los valores importados MUST normalizarse a una base de 100 g o 100 ml con sus unidades, y la porción, si la fuente la informa, MUST guardarse aparte.

**Experiencia y accesibilidad**

- **FR-030**: Las pantallas MUST ser responsive, estar en español, con etiquetas accesibles, navegación por teclado y errores comprensibles, y cada valor numérico MUST indicar su unidad.
- **FR-031**: Un guardado que no llegó al servidor MUST informarse como tal, y los formularios MUST conservar su borrador local hasta la confirmación del servidor (según la spec 001).
- **FR-032**: Las búsquedas MUST exigir al menos 2 caracteres.

### Key Entities *(include if feature involves data)*

- **Alimento**: lo que la persona busca y consulta. Atributos: nombre en español, marca opcional, base de referencia (100 g o 100 ml), valores nutricionales (energía, proteínas, carbohidratos, azúcares, grasas, grasas saturadas, fibra, sodio; cada uno puede faltar), tipo de origen (importado o propio) y estado del nombre (original, traducido sin revisar, revisado).
- **Porción**: forma habitual de consumir un alimento, separada de los valores por 100. Atributos: nombre y cantidad (en gramos o mililitros).
- **Fuente**: de dónde se importan los alimentos. Atributos: nombre, licencia, texto de atribución, dirección de la fuente y fecha de la última importación.
- **Procedencia**: vínculo de un alimento importado con su fuente. Atributos: identificador de origen y fecha de importación. Una copia propia guarda además el alimento del que se basa.
- **Informe de carga**: resultado de cada importación. Atributos: fecha, fuente, alimentos creados, actualizados y omitidos, y el motivo de cada omisión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona encuentra un alimento conocido (genérico o de marca) y ve sus valores en menos de 15 segundos desde que abre la búsqueda.
- **SC-002**: El 95 % de las búsquedas devuelve la primera tanda de resultados en menos de 1 segundo, con un catálogo de al menos 50.000 alimentos.
- **SC-003**: Una persona crea un alimento propio con nombre, energía y macronutrientes en menos de 1 minuto.
- **SC-004**: El 100 % de los valores faltantes se muestra como "sin dato" y el 0 % como cero, en el catálogo importado y en los alimentos propios.
- **SC-005**: El 100 % de los alimentos importados muestra fuente, identificador de origen y fecha de importación.
- **SC-006**: En pruebas con dos cuentas, el 100 % de los intentos de ver, editar o eliminar alimentos propios de otra cuenta o de modificar el catálogo importado es rechazado.
- **SC-007**: Editar o eliminar un alimento (propio o copia) no cambia ningún dato de las copias de otras cuentas ni del catálogo original en el 100 % de los casos probados.
- **SC-008**: Repetir la carga del catálogo con los mismos datos produce 0 duplicados y 0 cambios en alimentos propios.
- **SC-009**: Buscar y consultar el catálogo funciona sin conexión a servicios de terceros (solo con el servidor de la aplicación) en el 100 % de los casos probados.
- **SC-010**: Todas las pantallas se pueden usar y completar en pantalla de teléfono y de escritorio, y por teclado, sin errores de accesibilidad graves.

## Assumptions

- Los usuarios ya tienen cuenta y sesión iniciada (spec 001); el catálogo es privado para quien inició sesión.
- El catálogo importado es común a todas las cuentas y de solo lectura; los alimentos propios pertenecen a una cuenta (convención de propiedad de la spec 001).
- La elección concreta de fuentes (por ejemplo, bases abiertas de productos y tablas de composición de alimentos), su cobertura para Argentina, el volumen que cabe en el plan gratuito y su licencia se resuelven en el plan de esta spec (decisión técnica pendiente #4 de la Constitution), no aquí.
- La carga del catálogo es una tarea del autor, ejecutada fuera de la aplicación, y no tiene pantalla para las personas usuarias.
- El conjunto de nutrientes de esta spec es: energía, proteínas, carbohidratos, azúcares, grasas, grasas saturadas, fibra y sodio. Agregar más (vitaminas, minerales) queda para una spec posterior.
- La energía se expresa en kcal, los macronutrientes y la fibra en gramos, y el sodio en miligramos.
- No hay conversión automática entre gramos y mililitros: cada alimento se expresa en una sola base.
- La edad mínima, el cifrado adicional y otras protecciones están fuera del alcance, según la Constitution.
- Fuera del alcance de esta spec: registrar comidas (spec 003), objetivos calóricos (spec 004), lectura de código de barras con la cámara, estimaciones con IA (spec 009) y fotos de alimentos.
- Los registros históricos que usarán estos alimentos (spec 003) guardarán su propio *snapshot* de valores; esta spec garantiza que editar o eliminar un alimento nunca altera el pasado, y la prueba completa de esa regla se hace al implementar la spec 003.
- El catálogo inicial se carga una vez antes del primer uso; las actualizaciones posteriores son manuales y esporádicas.

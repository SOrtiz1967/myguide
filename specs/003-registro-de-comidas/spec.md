# Feature Specification: Registro de comidas

**Feature Branch**: `003-registro-de-comidas`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Registro de comidas de MyGuide (spec 003 del roadmap). La persona registra lo que comió en el día, agrupado por comida (desayuno, almuerzo, merienda, cena, colación), eligiendo alimentos del catálogo de la spec 002 (catálogo importado o propios) con una cantidad en gramos o mililitros o en una porción del alimento, o escribiendo una entrada libre por texto con sus valores (energía obligatoria y macronutrientes opcionales) cuando no está en el catálogo. Cada ítem registrado guarda una copia (snapshot) de los valores nutricionales calculados en el momento de registrar, así que editar o eliminar después el alimento del catálogo o el propio nunca altera lo ya registrado (Principio II). Cada ítem tiene un estado de origen visible: manual, del catálogo y, preparado para la spec 009 de IA, estimado y confirmado; en esta spec no hay IA. La persona puede ver el registro de un día con el total de energía y macronutrientes por comida y del día, navegar entre días, editar la cantidad o el momento de un ítem, moverlo a otra comida, eliminarlo con confirmación y repetir una comida de otro día. La regla del día: el día corta a las 00:00 en la zona horaria del perfil, pero la persona puede imputar una comida al día que todavía está cerrando mientras no haya empezado a registrar el día siguiente. Foto opcional de la comida: se le eliminan los metadatos EXIF y se comprime, se guarda de forma privada y solo la ve su dueño; la foto no se analiza. Registrar es idempotente ante dobles envíos y reintentos, los guardados que no llegaron al servidor se informan como tales y los formularios conservan su borrador local. Fuera de alcance: objetivo calórico y calorías restantes (spec 004), estimación con IA (spec 009), lectura de código de barras, y registro sin conexión."

## Clarifications

### Session 2026-10-19

- Q: Pasada la medianoche, ¿hasta cuándo se propone registrar en el día que se está cerrando? → A: Sin límite de hora: hasta que la persona registre algo en el día nuevo o elija "Empezar el día de hoy"; la vista lo indica de forma visible.
- Q: Al repetir una comida de otro día, ¿se copian los valores registrados o se recalculan? → A: Se recalculan con los valores actuales del alimento si todavía existe; los ítems manuales y los de alimentos que ya no existen copian lo registrado.
- Q: Al agregar un alimento a una comida, ¿la app muestra atajos a lo ya usado? → A: Sí, recientes: los últimos 20 alimentos distintos registrados (del catálogo, propios o manuales), con la última cantidad usada precargada; la búsqueda sigue disponible arriba.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un alimento del catálogo en una comida (Priority: P1)

La persona abre el día, elige una comida (por ejemplo, "Almuerzo"), busca un alimento en el catálogo o entre los propios, indica cuánto comió (en gramos o mililitros, o en porciones del alimento) y lo agrega. Ve al instante la energía y los macronutrientes de lo que agregó, calculados para esa cantidad.

**Why this priority**: Es la tarea más frecuente de toda la aplicación y la razón de ser del catálogo de la spec 002. Sin esto no hay registro de alimentación.

**Independent Test**: Con el catálogo de desarrollo cargado, registrar "Arroz blanco cocido, 150 g" y "Leche entera, 1 vaso" en el almuerzo de hoy y comprobar que cada ítem muestra su energía y macronutrientes calculados para la cantidad, con su unidad, y el origen "del catálogo".

**Acceptance Scenarios**:

1. **Given** el día de hoy abierto, **When** la persona elige "Almuerzo", busca "arroz", elige un alimento e indica 150 g, **Then** el ítem queda registrado en el almuerzo con nombre, cantidad, energía y macronutrientes calculados para 150 g, y la marca "del catálogo".
2. **Given** un alimento con porciones (por ejemplo "1 taza = 158 g"), **When** la persona indica "1,5 tazas", **Then** se registra la cantidad equivalente (237 g) y los valores calculados para esa cantidad, mostrando también la porción elegida.
3. **Given** un alimento con base por 100 ml, **When** la persona indica la cantidad, **Then** se pide y se muestra en mililitros.
4. **Given** un alimento al que le falta un valor (por ejemplo, la fibra), **When** se registra, **Then** ese valor del ítem se muestra como "sin dato" y nunca como 0.
5. **Given** un alimento propio de la persona, **When** lo busca desde el registro, **Then** aparece junto con los del catálogo, distinguido como "propio".
6. **Given** un doble clic en "Agregar" o un reintento de red, **When** se envía, **Then** se registra un solo ítem.
7. **Given** que se cortó la conexión al agregar, **When** falla el guardado, **Then** la persona ve que no se guardó, el formulario conserva lo que había elegido y puede reintentar.
8. **Given** que la persona ya registró antes "Leche entera, 1 vaso", **When** abre el formulario para agregar, **Then** lo ve entre sus recientes con esa cantidad precargada y lo registra con un toque más.

---

### User Story 2 - Ver el día con sus totales y moverse entre días (Priority: P1)

La persona ve el registro de un día: las comidas en orden (desayuno, almuerzo, merienda, cena, colación), cada una con sus ítems y su subtotal, y el total del día de energía, proteínas, carbohidratos y grasas. Puede ir al día anterior, al siguiente o a una fecha concreta.

**Why this priority**: Registrar sin poder ver el resultado no sirve; es la vista que la persona consulta varias veces al día y la base del resumen de la spec 004.

**Independent Test**: Con ítems registrados en dos comidas de hoy y una de ayer, comprobar subtotales por comida, el total del día, que ayer muestra solo lo de ayer y que un día sin registros muestra un estado vacío claro.

**Acceptance Scenarios**:

1. **Given** ítems en el desayuno y el almuerzo, **When** la persona abre el día, **Then** ve cada comida con sus ítems y su subtotal de energía, proteínas, carbohidratos y grasas, y el total del día, cada valor con su unidad.
2. **Given** que un ítem del día no tiene dato de un nutriente (por ejemplo, grasas), **When** se calcula el total, **Then** el total de ese nutriente indica que está incompleto (cuántos ítems no lo informan) en lugar de presentarse como exacto.
3. **Given** un día sin registros, **When** la persona lo abre, **Then** ve un estado vacío con la opción de agregar a cualquier comida.
4. **Given** el día de hoy, **When** la persona va al día anterior o elige una fecha, **Then** ve el registro de ese día; volver a "Hoy" está a un toque.
5. **Given** que la persona cambia la zona horaria de su perfil, **When** vuelve a ver un día, **Then** sus ítems siguen en el mismo día en que fueron imputados.

---

### User Story 3 - Registrar algo que no está en el catálogo (Priority: P1)

Cuando lo que comió no está en el catálogo ni entre sus alimentos (por ejemplo, "porción de torta de cumpleaños"), la persona escribe una descripción y los valores que conoce o estima: la energía es obligatoria y los macronutrientes opcionales. El ítem queda marcado como "manual".

**Why this priority**: El Principio III exige poder registrar una comida escribiéndola, sin depender del catálogo, de una foto ni de la IA. Sin esta vía la persona queda bloqueada a menudo.

**Independent Test**: Registrar "Torta de cumpleaños, 1 porción, 350 kcal" sin macronutrientes y comprobar que suma al total del día, que muestra el origen "manual" y que los macronutrientes faltantes figuran como "sin dato".

**Acceptance Scenarios**:

1. **Given** el formulario de entrada libre, **When** la persona escribe una descripción y la energía, **Then** el ítem se registra como "manual" y los demás valores quedan como "sin dato".
2. **Given** la entrada libre, **When** también indica proteínas, carbohidratos y grasas, **Then** se registran y suman a los totales.
3. **Given** valores imposibles (negativos, o energía desmesurada), **When** intenta guardar, **Then** se rechaza con un mensaje que explica qué corregir.
4. **Given** una energía que no coincide con la que resultaría de los macronutrientes, **When** guarda, **Then** se guarda igual y se muestra un aviso informativo.
5. **Given** una entrada libre ya registrada, **When** la persona quiere reutilizarla seguido, **Then** puede convertirla en un alimento propio con un paso.

---

### User Story 4 - Corregir, mover y eliminar lo registrado (Priority: P2)

La persona puede cambiar la cantidad de un ítem, moverlo a otra comida o a otro día, o eliminarlo después de confirmar. Al cambiar la cantidad de un ítem del catálogo, sus valores se recalculan con los datos que se guardaron al registrarlo.

**Why this priority**: Los errores al registrar son frecuentes; sin poder corregirlos, los totales dejan de ser confiables.

**Independent Test**: Registrar un ítem, cambiar su cantidad de 100 g a 200 g, moverlo del almuerzo a la cena, y eliminarlo; comprobar cada vez los totales y que eliminar pide confirmación.

**Acceptance Scenarios**:

1. **Given** un ítem del catálogo de 100 g, **When** la persona lo cambia a 200 g, **Then** sus valores se duplican, calculados con los valores guardados al registrarlo (no con los actuales del alimento).
2. **Given** un ítem del almuerzo, **When** la persona lo mueve a la cena o a otro día, **Then** desaparece del almuerzo y aparece donde lo movió, con los totales actualizados.
3. **Given** un ítem, **When** la persona elige eliminarlo, **Then** se le pide confirmación; al confirmar, desaparece y los totales se actualizan; al cancelar, no cambia nada.
4. **Given** un ítem manual, **When** la persona edita su descripción o sus valores, **Then** se guardan los nuevos valores, con las mismas validaciones que al crearlo.
5. **Given** un ítem registrado desde un alimento, **When** ese alimento se edita o se elimina después, **Then** el ítem conserva su nombre y sus valores tal como se registraron.

---

### User Story 5 - Imputar una comida al día que se está cerrando (Priority: P2)

Pasada la medianoche, la persona puede registrar la cena tardía en el día que todavía está cerrando, y decidir cuándo empieza a registrar el día nuevo.

**Why this priority**: Es una regla de la Constitution (Principio II) y evita que las comidas nocturnas aparezcan en el día equivocado.

**Independent Test**: Simulando que son las 01:00 del martes, sin nada registrado el martes, registrar una cena y comprobar que queda en el lunes; después empezar el martes y comprobar que lo siguiente se registra en el martes.

**Acceptance Scenarios**:

1. **Given** que son las 01:00 y la persona todavía no registró nada en el día nuevo, **When** agrega una comida, **Then** la aplicación indica con claridad en qué día la va a registrar ("lunes 18") y permite elegir entre ese día y el nuevo antes de guardar.
2. **Given** ese mismo escenario, **When** la persona elige "Empezar el martes" o registra algo en el martes, **Then** las comidas siguientes se proponen para el martes.
3. **Given** cualquier momento, **When** la persona abre un día anterior, **Then** puede agregar ítems a ese día explícitamente (registro tardío).
4. **Given** la zona horaria del perfil, **When** se decide qué día es "hoy", **Then** se usa esa zona horaria y no la del dispositivo.

---

### User Story 6 - Repetir una comida de otro día (Priority: P3)

La persona puede copiar todos los ítems de una comida de otro día (por ejemplo, "el desayuno de ayer") a una comida de hoy, en un paso, y después ajustar lo que haga falta.

**Why this priority**: Mucha gente repite comidas; ahorra tiempo pero no es imprescindible para registrar.

**Independent Test**: Con un desayuno de ayer de tres ítems, repetirlo en el desayuno de hoy y comprobar que se crean tres ítems iguales, que el de ayer no cambia y que repetirlo dos veces por error con un doble clic crea los ítems una sola vez.

**Acceptance Scenarios**:

1. **Given** un desayuno de ayer con tres ítems, **When** la persona elige "Repetir" sobre él y lo destina al desayuno de hoy, **Then** se crean tres ítems en hoy con las mismas cantidades, y el desayuno de ayer no cambia.
2. **Given** que uno de esos alimentos se corrigió desde ayer, **When** se repite, **Then** el ítem nuevo usa los valores corregidos y el de ayer conserva los suyos; un ítem manual se copia tal cual.
3. **Given** la acción de repetir, **When** hay un doble clic o un reintento, **Then** los ítems se crean una sola vez.
4. **Given** los ítems repetidos, **When** la persona edita uno, **Then** no cambia el original del otro día.

---

### User Story 7 - Adjuntar una foto a una comida (Priority: P3)

La persona puede adjuntar una foto a una comida del día como recordatorio visual. La foto no se analiza: es opcional y no reemplaza registrar los alimentos.

**Why this priority**: Es opcional según el Principio III y la spec 009 la usará para la IA; en esta spec solo aporta memoria visual, por eso va al final.

**Independent Test**: Adjuntar una foto con geolocalización en sus metadatos a la cena, comprobar que se ve en la cena, que la foto almacenada ya no tiene esos metadatos, que pesa menos que la original y que otra cuenta (o alguien sin sesión) no puede verla.

**Acceptance Scenarios**:

1. **Given** una comida del día, **When** la persona adjunta una foto, **Then** se ve una miniatura en esa comida y puede abrirla en grande.
2. **Given** una foto con metadatos (incluida la ubicación), **When** se almacena, **Then** la foto guardada no conserva ningún metadato EXIF.
3. **Given** una foto grande, **When** se sube, **Then** se reduce de tamaño y se comprime antes de guardarse, sin perder la utilidad como recordatorio.
4. **Given** una foto de una comida, **When** otra cuenta o alguien sin sesión intenta verla, **Then** no puede acceder a ella.
5. **Given** una foto adjunta, **When** la persona la elimina o la reemplaza, **Then** la anterior deja de estar disponible.
6. **Given** un archivo que no es una imagen o es demasiado grande, **When** intenta subirlo, **Then** se rechaza con un mensaje claro.

---

### Edge Cases

- Una cantidad de 0, negativa o desmesurada (por ejemplo, 50 kg de arroz) se rechaza con un mensaje que explica el rango admitido.
- Una cantidad decimal escrita con coma ("12,5 g" o "0,5 porciones") se interpreta bien.
- Si el alimento elegido se elimina mientras la persona está completando el formulario, el registro falla con un mensaje claro y el borrador se conserva.
- Si la persona registra desde dos dispositivos a la vez, ambos ítems se guardan sin perder ninguno.
- Si el alimento del catálogo no tiene energía, el ítem se registra con la energía "sin dato" y el total del día lo indica como incompleto.
- Un día con muchos ítems (por ejemplo, 60) sigue mostrando los totales correctos y se puede recorrer cómodamente en un teléfono.
- El cambio de horario de verano o de zona horaria no mueve ítems ya imputados a otro día.
- La foto falla al subir pero los ítems de la comida ya se guardaron: los ítems quedan registrados y la foto se puede reintentar aparte.
- Una fecha futura cercana (hasta 7 días) muestra un estado vacío y permite registrar; más allá no se permite (ver Supuestos).
- Sin conexión, la aplicación no permite registrar y no muestra nada como guardado (spec 001).

## Requirements *(mandatory)*

### Registro de ítems

- **FR-001**: La persona MUST poder registrar un ítem en una comida de un día eligiendo un alimento del catálogo o uno propio (spec 002) e indicando una cantidad.
- **FR-002**: La cantidad MUST poder indicarse en gramos (o mililitros para alimentos con base por 100 ml) o como un número de porciones de las que tenga el alimento; se MUST guardar la cantidad equivalente en gramos o mililitros y, si se usó, la porción elegida y su cantidad.
- **FR-003**: Las cantidades MUST ser mayores que 0 y no superar 5.000 g o ml por ítem; el número de porciones MUST ser mayor que 0 y no superar 50. Se MUST aceptar coma o punto decimal.
- **FR-004**: Los valores de un ítem MUST calcularse proporcionalmente a la cantidad a partir de los valores por 100 g o 100 ml del alimento: energía, proteínas, carbohidratos (con azúcares), grasas (con saturadas), fibra y sodio.
- **FR-005**: Un valor que falta en el alimento MUST quedar como "sin dato" en el ítem y MUST NOT tratarse como 0.
- **FR-006**: La persona MUST poder registrar un ítem libre con una descripción (1 a 200 caracteres), una cantidad descriptiva opcional (por ejemplo, "1 porción"), la energía (obligatoria, de 0 a 5.000 kcal) y los demás nutrientes opcionales, con validaciones de no negatividad y coherencia (azúcares no mayores que carbohidratos; saturadas no mayores que grasas).
- **FR-007**: Si la energía de un ítem libre difiere notablemente de la que resultaría de sus macronutrientes, el sistema MUST avisarlo de forma informativa y MUST permitir guardar.
- **FR-008**: Las comidas de un día MUST ser desayuno, almuerzo, merienda, cena y colación, en ese orden.
- **FR-009**: Registrar un ítem MUST ser idempotente ante dobles envíos y reintentos (un solo ítem).

### Instantánea y origen (Principio II)

- **FR-010**: Cada ítem MUST guardar una instantánea del nombre, la marca, la base de referencia y los valores por 100 g o 100 ml del alimento en el momento de registrarlo, además de los valores calculados para su cantidad.
- **FR-011**: Editar, copiar o eliminar después el alimento de origen (del catálogo o propio), o una nueva importación del catálogo, MUST NOT modificar ningún ítem ya registrado.
- **FR-012**: Cada ítem MUST tener un origen visible: "del catálogo" (desde un alimento importado), "propio" (desde un alimento propio) o "manual" (entrada libre); y un estado de confirmación. En esta spec todo ítem guardado está "confirmado"; el estado "estimado (pendiente de confirmar)" queda definido y reservado para la spec 009, y la interfaz MUST poder mostrarlo.
- **FR-013**: Si el alimento de origen ya no existe, el ítem MUST seguir mostrándose con su instantánea y MUST indicar que el alimento ya no está disponible.

### Vista del día y totales

- **FR-014**: La persona MUST poder ver un día con sus comidas en orden, los ítems de cada una, el subtotal por comida y el total del día de energía, proteínas, carbohidratos y grasas; y el detalle de cada ítem con todos sus nutrientes.
- **FR-015**: Cuando algún ítem no informa un nutriente, el subtotal y el total de ese nutriente MUST indicar que están incompletos (por ejemplo, "al menos 45 g · falta en 2 ítems") y MUST NOT presentarse como un valor completo.
- **FR-016**: Los totales MUST mostrarse sin más precisión que la de los datos (energía sin decimales; gramos con hasta un decimal) y con su unidad, en el formato regional.
- **FR-017**: La persona MUST poder ir al día anterior, al siguiente, a una fecha elegida y volver a "hoy"; el día visible MUST conservarse al ir al detalle de un ítem y volver.
- **FR-018**: Un día sin registros MUST mostrar un estado vacío con la opción de agregar.

### Corrección

- **FR-019**: La persona MUST poder cambiar la cantidad (o la porción) de un ítem; los valores MUST recalcularse a partir de la instantánea del ítem, no de los valores actuales del alimento.
- **FR-020**: La persona MUST poder mover un ítem a otra comida u otro día.
- **FR-021**: La persona MUST poder editar la descripción y los valores de un ítem manual, con las mismas validaciones que al crearlo.
- **FR-022**: La persona MUST poder eliminar un ítem tras una confirmación explícita.
- **FR-023**: La persona MUST poder convertir un ítem manual en un alimento propio (spec 002) sin modificar el ítem. Como los valores de un ítem manual corresponden a toda la cantidad descripta ("1 porción de torta"), el sistema MUST pedir cuánto pesa o mide esa cantidad (en g o ml), calcular los valores por 100 g o 100 ml y crear el alimento con esa cantidad como porción.

### Regla del día (Principio II)

- **FR-024**: El día de un ítem MUST determinarse con la zona horaria del perfil; el día corta a las 00:00.
- **FR-025**: Pasada la medianoche, mientras la persona no haya registrado nada en el día nuevo, el sistema MUST proponer registrar en el día que se está cerrando, mostrando con claridad la fecha de destino y permitiendo elegir el día nuevo antes de guardar. La propuesta no tiene límite de hora: termina cuando la persona registra algo en el día nuevo o elige "Empezar el día de hoy". La vista del día MUST indicar de forma visible, desde que se abre, que se está registrando en el día anterior.
- **FR-026**: El día de un ítem queda fijado al guardarlo: cambios posteriores de la zona horaria del perfil o del horario de verano MUST NOT moverlo de día.
- **FR-027**: La persona MUST poder registrar explícitamente en cualquier día pasado (registro tardío).

### Repetir

- **FR-028**: La persona MUST poder repetir todos los ítems de una comida de un día en una comida elegida de cualquier día (incluido el mismo, por ejemplo para copiar el almuerzo a la merienda), en un paso, de forma idempotente. Los ítems que vienen de un alimento que todavía existe y la persona puede ver MUST recalcularse con los valores actuales de ese alimento (guardando una instantánea nueva), con la misma cantidad; los ítems manuales, y los de un alimento que ya no existe, MUST copiar lo registrado. La persona MUST ver, antes de confirmar, cuántos ítems se recalculan y cuántos se copian.
- **FR-029**: Los ítems repetidos MUST ser independientes de los originales: editar o eliminar unos no afecta a los otros.

### Foto de la comida (Principios I y VI)

- **FR-030**: La persona MUST poder adjuntar una foto opcional a una comida de un día, verla, reemplazarla y eliminarla. Registrar una comida MUST NOT exigir foto.
- **FR-031**: Antes de almacenar una foto se MUST eliminar todo metadato EXIF (incluida la ubicación), aunque el dispositivo no lo haya hecho, y se SHOULD reducir y comprimir la imagen.
- **FR-032**: Las fotos MUST guardarse de forma privada y cifrada en reposo: solo su dueño, con sesión vigente, puede verlas; MUST NOT existir un acceso público ni un listado de fotos.
- **FR-033**: Solo se MUST aceptar imágenes JPEG, PNG o WebP, y HEIC cuando el navegador pueda abrirlo, de hasta 15 MB antes de comprimir; otros archivos, y un HEIC que el navegador no puede abrir, se rechazan con un mensaje claro que sugiere probar con JPEG o PNG.
- **FR-034**: Eliminar o reemplazar una foto MUST dejar la anterior inaccesible de inmediato.
- **FR-035**: Las fotos de esta spec MUST NOT enviarse a ningún servicio externo de análisis.

### Privacidad, estados y robustez

- **FR-036**: Los ítems y las fotos MUST ser privados de cada cuenta: ninguna otra cuenta puede verlos, buscarlos ni modificarlos; sin sesión vigente nada es visible.
- **FR-037**: Un guardado que no llegó al servidor MUST informarse como tal; los formularios de registro MUST conservar su borrador local hasta la confirmación del servidor y descartarlo al confirmar (spec 001).
- **FR-038**: Los estados de carga, vacío, éxito y error MUST estar definidos en la vista del día, el formulario de registro y la foto.
- **FR-039**: Las pantallas MUST ser responsive, en español, con etiquetas accesibles, navegación por teclado, errores comprensibles y la unidad en cada valor numérico.

### Agregar rápido

- **FR-040**: Al agregar a una comida, el sistema MUST mostrar los recientes de la persona: los últimos 20 alimentos distintos que registró (del catálogo, propios o entradas manuales, identificados por su alimento o, si es manual, por su descripción), cada uno con la última cantidad usada precargada y editable antes de confirmar. Un reciente cuyo alimento ya no existe o ya no es visible MUST NOT mostrarse; una entrada manual reciente se vuelve a registrar con sus valores. La búsqueda MUST seguir disponible en la misma pantalla.

### Key Entities *(include if feature involves data)*

- **Ítem registrado**: algo que la persona comió. Pertenece a una cuenta; tiene día de imputación, comida (desayuno, almuerzo, merienda, cena o colación), momento de registro, origen (del catálogo, propio o manual), estado de confirmación (confirmado; estimado reservado para la spec 009), cantidad (en g o ml y, si corresponde, porción y número de porciones), referencia opcional al alimento de origen e instantánea de los datos del alimento (nombre, marca, base y valores por 100), y los valores calculados para su cantidad. Un dato faltante queda como faltante.
- **Foto de comida**: imagen opcional asociada a una comida de un día de una cuenta. Sin metadatos, comprimida, privada.
- **Día de registro**: la fecha en la zona horaria del perfil a la que se imputan los ítems; agrupa los ítems por comida y permite calcular subtotales y totales (no necesita guardarse por separado salvo que haga falta para la regla del día).
- **Alimento** (spec 002): origen de los valores de un ítem del catálogo o propio; los cambios en él no se propagan a los ítems ya registrados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar un alimento del catálogo en una comida lleva como máximo 4 interacciones desde la vista del día (elegir comida, buscar, elegir alimento, confirmar cantidad) y menos de 30 segundos en una prueba guiada; volver a registrar un reciente con su última cantidad lleva como máximo 2 interacciones.
- **SC-002**: La vista de un día con hasta 60 ítems se muestra completa, con totales, en menos de 2 segundos en un teléfono con conexión móvil típica en el 95 % de los casos.
- **SC-003**: Ninguna operación repetida (doble clic, reintento) crea ítems duplicados en el 100 % de las pruebas de idempotencia.
- **SC-004**: El 100 % de los ítems registrados conserva sus valores después de editar, eliminar o reimportar su alimento de origen.
- **SC-005**: El 100 % de las fotos almacenadas carece de metadatos EXIF, y ninguna se puede obtener sin la sesión de su dueño.
- **SC-006**: Los totales del día coinciden con la suma de los ítems redondeada para mostrar, y los nutrientes con datos faltantes se marcan como incompletos en el 100 % de los casos de prueba.
- **SC-007**: Una comida registrada pasada la medianoche, sin registros previos en el día nuevo y sin haber elegido empezarlo, queda por defecto en el día que se estaba cerrando en el 100 % de las pruebas, y la persona ve la fecha de destino antes de guardar.
- **SC-008**: Todas las pantallas nuevas pasan la revisión automática de accesibilidad sin problemas graves y funcionan en anchos de teléfono y de escritorio sin desplazamiento horizontal.

## Assumptions

- La única persona usuaria del MVP es el autor, pero todo se construye multiusuario y privado por cuenta (como en las specs 001 y 002).
- Las comidas son las cinco fijas de FR-008; personalizarlas (renombrar, agregar, quitar) queda fuera de esta spec.
- Se registra la hora en que se guardó cada ítem como "momento de registro"; no se pide la hora exacta de consumo. "Editar el momento" de un ítem significa cambiar su comida o su día (FR-020).
- Se admite una foto por comida de un día (reemplazable). Varias fotos por comida, o fotos por ítem, quedan para una spec futura si hace falta.
- No se impide registrar en fechas futuras cercanas (hasta 7 días), pero la aplicación no está pensada para planificar comidas.
- Sin conexión no hay registro (spec 001, Principio VI): los borradores se conservan y nada se muestra como guardado.
- Al eliminar una cuenta se borran sus ítems y también los archivos de sus fotos del almacenamiento. El flujo de eliminación de cuenta todavía no existe (Principio I lo exige antes de publicar con personas reales): cuando se construya debe incluir esa limpieza, porque el borrado en cascada de la base no alcanza a los archivos. Queda anotado como pendiente.
- El rango de días admitidos se calcula con la zona horaria del perfil; si el perfil no tiene zona, se usa UTC con un día de tolerancia.
- El catálogo, los alimentos propios y sus porciones son los de la spec 002; esta spec no cambia cómo se crean ni se editan.
- Los totales del día no comparan con un objetivo (spec 004) ni sugieren nada (Principio IV).
- La spec 009 agregará ítems "estimados" por IA que la persona confirma; el modelo de esta spec deja ese estado previsto para no cambiarlo después.

# Feature Specification: Estimación de comidas con IA

**Feature Branch**: `009-estimacion-comidas-ia`

**Created**: 2026-11-01

**Status**: Draft

**Input**: roadmap, spec 009 (ola 3), aclarada por el autor el 2026-10-28: «cargar una comida escribiéndola y que la IA calcule las calorías», y un alimento escrito a mano que no está en el catálogo se calcula igual, solo para esa comida. Cierra las decisiones pendientes #3 (proveedor de IA) y #6 (cuota). Principios: I, II, III, VII, IX.

## Clarifications

### Session 2026-11-01

- Q: ¿Qué proveedor de IA se usa y dónde corre? → A: Gemini (Google), llamado solo desde una Edge Function del servidor. La clave vive en `GEMINI_API_KEY` y el modelo en `GEMINI_MODEL` (por omisión `gemini-2.5-flash`); ninguna de las dos llega a la aplicación. El acceso al proveedor queda detrás de un adaptador propio, de modo que cambiar de proveedor no toca el resto.
- Q: ¿Qué se envía al proveedor? → A: Únicamente el texto de la comida que la persona escribió (hasta 500 caracteres). Nunca el nombre, el correo, el perfil, el peso, las medidas ni fotos de progreso. La entrada por foto de la comida es una segunda vía posterior (historia 6) y solo envía esa foto de comida ya limpia de metadatos.
- Q: ¿Qué hace la IA exactamente? → A: Separa el texto en ítems (nombre, cantidad en texto y gramos o mililitros aproximados si los puede deducir) y propone para cada ítem energía y macronutrientes (proteínas, carbohidratos, grasas). No propone azúcares, grasas saturadas, fibra ni sodio: quedan vacíos y la persona los completa si quiere. Los valores son para la cantidad indicada, no por 100 g.
- Q: ¿Qué se guarda de la estimación antes de confirmar? → A: Nada en los registros de comidas. La propuesta vive solo en la pantalla y no suma al total del día. Al confirmar, cada ítem se guarda como comida con origen «estimado por IA» y estado confirmado, con los valores finales que dejó la persona. Un ítem que la persona corrigió se guarda con sus valores corregidos y sigue marcado como estimado (conserva la procedencia).
- Q: ¿Cómo se limita el uso (decisión #6)? → A: Hasta 5 consultas por minuto y 30 por día (24 horas móviles) y por cuenta, sin contar las repetidas con el mismo identificador de solicitud. Si el proveedor responde que su cuota se agotó, se trata como «cuota agotada». En ambos casos el camino manual sigue disponible y se explica sin culpa.
- Q: ¿Se repite la consulta si el envío se repite? → A: No. El resultado de una consulta se conserva 24 horas junto con su identificador de solicitud; un reintento con el mismo identificador devuelve el mismo resultado sin llamar al proveedor ni gastar cuota.
- Q: ¿El alimento estimado se guarda como alimento propio? → A: Solo si la persona lo pide después de confirmar, con la misma acción «guardar como alimento propio» que ya existe para ítems manuales, que se extiende a los estimados. El alimento propio queda con los valores que la persona confirmó y la pantalla le avisa que partieron de una estimación; el catálogo de alimentos no cambia de estructura.
- Q: ¿La foto de la comida entra en esta spec? → A: Sí, como segunda vía y última historia: la persona fotografía el plato, la IA propone los ítems con la misma pantalla de corrección y confirmación. Se implementa después del texto y no bloquea su entrega.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Escribir una comida y recibir una propuesta (Priority: P1)

En «Agregar comida» la persona elige «Describir con IA», escribe en lenguaje natural lo que comió (por ejemplo «2 milanesas al horno con puré y una manzana») y pide la estimación. La aplicación muestra una lista de ítems propuestos, cada uno marcado como «Estimado por IA, sin confirmar», con calorías y macronutrientes.

**Why this priority**: es el flujo principal que pidió el autor: cargar sin buscar alimento por alimento.

**Independent Test**: con la IA simulada, escribir la frase, pedir la estimación y ver tres ítems con su cantidad, calorías y macros, marcados como sin confirmar y sin sumar al día.

**Acceptance Scenarios**:

1. **Given** un texto de 1 a 500 caracteres, **When** la persona pide la estimación, **Then** ve un indicador de que se está calculando y luego una lista de ítems con nombre, cantidad, energía y macronutrientes.
2. **Given** la propuesta, **Then** cada ítem y la lista están marcados en texto («Estimado por IA, sin confirmar») además del color, y el total del día no cambia.
3. **Given** un texto vacío, de solo espacios o de más de 500 caracteres, **Then** se avisa antes de enviar y no se consulta.
4. **Given** una frase de la que la IA no puede sacar ningún alimento, **Then** se explica que no se entendió y se ofrece reformularla o cargar a mano.
5. **Given** un doble toque en «Estimar» o un reintento de red, **Then** se hace una sola consulta y se muestra un solo resultado.
6. **Given** la propuesta, **Then** hay un recordatorio visible de que son aproximaciones y no mediciones.

---

### User Story 2 - Corregir y confirmar antes de guardar (Priority: P1)

La persona revisa los ítems: corrige nombre, cantidad y valores, quita los que sobran o agrega otro, elige en qué comida y día va, y recién al confirmar se guardan.

**Why this priority**: sin corrección y confirmación explícita no se cumple el Principio III.

**Independent Test**: corregir las calorías de un ítem, quitar otro, agregar uno manual, confirmar, y ver que el día suma exactamente lo confirmado y que antes de confirmar no sumaba.

**Acceptance Scenarios**:

1. **Given** un ítem propuesto, **When** la persona edita nombre, cantidad, energía o macros, **Then** los valores se validan con las mismas reglas que la carga manual (energía obligatoria, macros opcionales y coherentes) y se conservan hasta confirmar.
2. **Given** la lista, **When** quita un ítem o agrega uno vacío para completar a mano, **Then** la lista cambia y el resumen de la propuesta se recalcula.
3. **Given** la propuesta, **When** la persona confirma, **Then** todos los ítems se guardan juntos en la comida y día elegidos, con origen «estimado por IA» y estado confirmado, y el total del día los suma.
4. **Given** una lista sin ítems o con un ítem inválido, **Then** el botón de confirmar no guarda y se indica qué falta.
5. **Given** un doble toque o un reintento al confirmar, **Then** cada ítem se guarda una sola vez.
6. **Given** que falla el guardado o no hay conexión, **Then** se avisa, la propuesta y lo editado se conservan y nada queda guardado a medias.
7. **Given** un ítem guardado, **Then** en el día se ve marcado como «Estimado por IA» y puede corregirse o eliminarse como cualquier otro.
8. **Given** una propuesta sin confirmar, **When** la persona se va de la pantalla, **Then** no queda nada guardado en sus registros.

---

### User Story 3 - Un alimento escrito a mano que no está en el catálogo (Priority: P2)

En la carga manual de un alimento, la persona escribe solo el nombre y la cantidad («tarta de verdura casera, 1 porción») y pide «Calcular con IA»: los campos de calorías y macros se completan como estimación, editables, antes de guardar.

**Why this priority**: es el mismo mecanismo en pequeño y evita buscar datos sueltos.

**Independent Test**: en el formulario manual escribir nombre y cantidad, pedir el cálculo y ver los valores propuestos, marcados como estimación, y guardarlos.

**Acceptance Scenarios**:

1. **Given** el formulario manual con nombre y cantidad, **When** pide «Calcular con IA», **Then** energía y macros se completan marcados como «Estimado por IA, sin confirmar» y se pueden editar.
2. **Given** valores ya escritos por la persona, **When** pide el cálculo, **Then** se le pregunta antes de reemplazarlos; la IA nunca pisa en silencio lo que escribió.
3. **Given** valores calculados, **When** la persona los modifica, **Then** siguen siendo suyos y editables, y al guardar la comida queda como estimada.
4. **Given** una comida guardada con valores calculados, **Then** se ve marcada como «Estimado por IA» y puede guardarse como alimento propio solo si la persona lo pide, con el aviso de que sus valores partieron de una estimación.

---

### User Story 4 - Si la IA falla, todo sigue funcionando (Priority: P1)

Cuando la IA no está configurada, tarda, falla, devuelve algo inválido o se agotó el uso permitido, la persona lo ve explicado sin culpa y sigue cargando la comida a mano como siempre.

**Why this priority**: el registro nunca puede depender de la IA (Principio III).

**Independent Test**: simular cada fallo y comprobar que se muestra un mensaje específico, que lo escrito se conserva y que el formulario manual sigue disponible.

**Acceptance Scenarios**:

1. **Given** que no hay clave configurada, **Then** la opción «Describir con IA» no se ofrece o avisa que la IA no está disponible, y la carga manual sigue igual.
2. **Given** un tiempo de espera de más de 20 segundos, un error del proveedor o una respuesta que no cumple el formato esperado o con valores fuera de rango, **Then** se descarta la respuesta, se informa «no pudimos calcularlo ahora» y se ofrece reintentar o cargar a mano; nunca se muestran valores inválidos.
3. **Given** el límite por minuto, por día o la cuota del proveedor agotada, **Then** se indica el motivo en texto neutral y cuándo reintentar si se sabe, y se ofrece la carga manual.
4. **Given** una sesión vencida, **Then** no se consulta y se pide volver a ingresar.
5. **Given** cualquiera de estos fallos, **Then** el texto escrito se conserva.

---

### User Story 5 - Mi información está protegida y el lenguaje es neutral (Priority: P1)

La consulta solo lleva el texto de la comida, la clave no sale del servidor y nada de lo que sale de la IA juzga, recomienda ni fuerza.

**Why this priority**: Principios I, III y IX.

**Independent Test**: revisar lo que se envía al proveedor y los textos de la pantalla.

**Acceptance Scenarios**:

1. **Given** una consulta, **Then** al proveedor llega solo el texto de la comida, sin identificadores ni datos del perfil.
2. **Given** la aplicación instalada y su tráfico, **Then** en ningún momento aparece la clave del proveedor.
3. **Given** los registros técnicos, **Then** no contienen el texto de la comida, los ítems ni los valores; solo el resultado, la duración y el motivo del fallo.
4. **Given** los textos de la propuesta, **Then** no valoran la comida, no usan «bueno» ni «malo» y no sugieren comer más o menos ni compensar.
5. **Given** dos cuentas, **Then** ninguna ve ni reutiliza los resultados de la otra.
6. **Given** una propuesta con un único dato, **Then** no se presenta como un hecho: siempre «estimado».

---

### User Story 6 - Estimar desde la foto del plato (Priority: P3)

Como segunda vía, la persona toma o elige una foto del plato y la IA propone los ítems con la misma pantalla de corrección y confirmación.

**Why this priority**: acordada en el roadmap como complemento posterior al texto; no bloquea la entrega de las historias 1 a 5.

**Independent Test**: con la IA simulada, elegir una foto de una comida, ver ítems propuestos sin confirmar y confirmarlos.

**Acceptance Scenarios**:

1. **Given** una foto JPEG de hasta 3 MiB, **When** la persona pide estimar, **Then** se limpia de metadatos, se envía al proveedor solo esa foto y se muestra la misma propuesta editable.
2. **Given** un archivo que no es una foto válida o supera el tamaño, **Then** se rechaza con un mensaje claro y no se envía nada.
3. **Given** que la estimación termina, **Then** la foto enviada no se guarda por esta vía: solo se guarda la foto de la comida si la persona la adjunta como ya lo hace hoy.
4. **Given** una foto del cuerpo o de progreso, **Then** esta vía no la admite: solo existe en la pantalla de comidas y las fotos de progreso nunca se envían a la IA.
5. **Given** cualquier falla, **Then** valen los mismos caminos manuales y límites de uso de las historias 1 a 5.

---

### Edge Cases

- Texto con cantidades ambiguas («un poco de arroz», «lo de siempre»): la IA devuelve una cantidad aproximada marcada como tal o ningún ítem; la persona corrige.
- Texto con instrucciones al modelo («ignora lo anterior…») o con emojis, comillas o saltos de línea: se trata como texto de la comida; la respuesta se valida igual y cualquier cosa fuera del formato se descarta.
- Más de 12 ítems devueltos o valores como 80 000 kcal en un ítem: se descarta la respuesta como inválida.
- Un ítem con energía pero sin macros: se acepta; los macros vacíos quedan vacíos, nunca 0.
- Sin conexión: no se consulta y se avisa; el texto se conserva; la carga manual funciona como hoy.
- Cambio de comida o día antes de confirmar: se puede cambiar en la propia pantalla de la propuesta.
- Mientras el día anterior está «cerrándose» (spec 003): el destino se elige como en la carga actual.
- La respuesta tarda: se puede cancelar la espera y pasar a cargar a mano sin perder el texto; una respuesta tardía se ignora.
- Resultado ya conservado: reabrir con el mismo identificador no vuelve a llamar al proveedor.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La persona MUST poder describir una comida en texto libre (1 a 500 caracteres, recortado) y pedir su estimación desde «Agregar comida».
- **FR-002**: La estimación MUST mostrar una lista de 1 a 12 ítems, cada uno con nombre (1 a 200 caracteres), cantidad en texto (hasta 60) y energía en kcal; proteínas, carbohidratos y grasas son opcionales.
- **FR-003**: Todo ítem estimado MUST mostrarse como «Estimado por IA, sin confirmar» en texto además de color, y MUST NOT sumar al total del día hasta que la persona confirme.
- **FR-004**: La persona MUST poder editar cada valor, quitar ítems, agregar ítems manuales y elegir día y comida antes de confirmar, con las mismas validaciones que la carga manual (spec 003).
- **FR-005**: Confirmar MUST guardar todos los ítems juntos en una sola operación, con origen «estimado por IA» y estado confirmado, y MUST ser idempotente: un doble envío o reintento no duplica ítems.
- **FR-006**: Una estimación MUST NOT sobrescribir silenciosamente datos confirmados ni valores que la persona escribió; si hay valores propios, MUST pedirse confirmación para reemplazarlos.
- **FR-007**: En la carga manual de un alimento, la persona MUST poder pedir «Calcular con IA» a partir del nombre y la cantidad; el resultado completa energía y macros como estimación editable.
- **FR-008**: El alimento calculado por IA MUST valer solo para esa comida y MUST guardarse como alimento propio únicamente si la persona lo pide, avisándole que sus valores partieron de una estimación.
- **FR-009**: La consulta a la IA MUST ejecutarse en el servidor; la clave y el modelo MUST NOT llegar a la aplicación ni a los registros.
- **FR-010**: Al proveedor MUST enviarse únicamente el texto de la comida (o, en la historia 6, solo la foto de la comida limpia); MUST NOT enviarse identificadores, datos del perfil, del cuerpo ni fotos de progreso.
- **FR-011**: La respuesta del proveedor MUST validarse contra un esquema estricto (forma, tipos, longitudes, rangos, cantidad de ítems); lo que no cumpla MUST tratarse como fallo del proveedor y nunca mostrarse.
- **FR-012**: Si la IA no está configurada, falla, tarda más de 20 segundos, devuelve algo inválido o se agotó el uso, la aplicación MUST informarlo con un mensaje específico y sin culpa, MUST conservar lo escrito y MUST mantener disponible la carga manual.
- **FR-013**: El uso MUST limitarse a 5 consultas por minuto y 30 por día por cuenta; las repeticiones con el mismo identificador de solicitud MUST NOT contar.
- **FR-014**: El resultado de una consulta MUST conservarse 24 horas por cuenta e identificador de solicitud; un reintento con el mismo identificador MUST devolver ese resultado sin llamar al proveedor; pasado ese plazo MUST eliminarse.
- **FR-015**: La consulta MUST requerir sesión vigente; los resultados guardados MUST ser privados de la cuenta y MUST eliminarse junto con ella.
- **FR-016**: Los registros técnicos MUST NOT contener el texto de la comida, los ítems, los valores ni la clave; MUST registrar de forma estructurada el resultado, la duración y el motivo de cada fallo para medir uso y costo de forma agregada.
- **FR-017**: Los textos MUST ser neutrales: no valorar comidas, no sugerir comer más o menos ni compensar, no presentar una estimación como certeza, y recordar que son aproximaciones.
- **FR-018**: La opción de estimar MUST ser opcional y secundaria: la carga por catálogo y manual MUST seguir siendo igual de accesible.
- **FR-019**: Todas las pantallas MUST tener estados de carga, vacío, éxito y error en español con tuteo, cumplir WCAG 2.1 AA, ser usables por teclado y lector de pantalla y no tener desplazamiento horizontal a 375 px; la espera MUST anunciarse a lectores de pantalla.
- **FR-020**: (Historia 6) La persona MUST poder estimar desde una foto JPEG de comida (hasta 3 MiB, limpia de metadatos), con las mismas reglas de las historias 1 a 5; la foto enviada MUST NOT guardarse por esta vía.
- **FR-021**: Las pruebas funcionales existentes de comidas (specs 003 y 004) MUST seguir pasando sin cambios de comportamiento.

### Key Entities _(include if feature involves data)_

- **Consulta de estimación**: el texto (o foto) de una comida, el identificador de solicitud, el resultado devuelto y su vencimiento a las 24 horas. Privada de la cuenta. No es un registro de comida.
- **Ítem estimado**: propuesta con nombre, cantidad en texto, energía y macros opcionales. Vive solo en pantalla hasta confirmar; al confirmar pasa a ser una comida del día con origen «estimado por IA».
- **Comida registrada** (existente): ya admite el origen «estimado» y el estado «pendiente»; esta spec la usa con origen estimado y estado confirmado.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Cargar una comida de tres ítems con la IA, sin correcciones, lleva menos de 30 segundos desde que se abre la pantalla.
- **SC-002**: Antes de confirmar, el total del día no cambia; después de confirmar suma exactamente los valores finales de los ítems.
- **SC-003**: Un doble toque o reintento en «Estimar» o «Confirmar» deja una sola consulta y una sola vez cada ítem.
- **SC-004**: Con la IA sin clave, caída, lenta, agotada o inválida, el 100 % de las comidas se puede cargar a mano y el texto escrito no se pierde.
- **SC-005**: El 100 % de las respuestas simuladas inválidas (forma incorrecta, valores fuera de rango, demasiados ítems) se descartan y nunca llegan a la pantalla.
- **SC-006**: La clave del proveedor no aparece en el código de la aplicación, en su tráfico ni en los registros; el texto de la comida no aparece en los registros.
- **SC-007**: Ninguna pantalla nueva tiene violaciones graves o críticas de accesibilidad ni desplazamiento horizontal a 375 y 1280 px, y ningún texto valora, juzga ni culpa.
- **SC-008**: Las pruebas de comidas de las specs 003 y 004 siguen pasando.

## Assumptions

- El plan gratuito de Gemini alcanza para uso personal con los límites propios (5 por minuto, 30 por día); si Google cambia su cuota, el límite propio se ajusta por configuración y la aplicación ya trata la cuota agotada como un caso normal.
- Gemini no recibe restricción de uso para entrenamiento de modelos: la Constitution lo admite para fotos y textos de comidas; por eso solo se envía eso.
- Las porciones y pesos que propone la IA son aproximaciones; no se reconcilian con el catálogo de alimentos ni se buscan equivalentes en él.
- Los textos de comidas se interpretan en español rioplatense; la calidad depende del modelo y siempre pasa por la corrección de la persona.
- El destino por omisión (día y comida) es el de la pantalla de agregar actual.

## Out of Scope

- Reconocimiento de códigos de barras, etiquetas nutricionales o recetas completas.
- Guardar el historial de textos escritos o las consultas más allá de las 24 horas.
- Análisis o consejos sobre la dieta, ajustes automáticos de objetivos o juicios sobre lo comido (Principio IV).
- Estimar azúcares, grasas saturadas, fibra o sodio con IA.
- Enviar a la IA fotos de progreso, medidas o cualquier dato del perfil.
- Elegir proveedor o modelo desde la interfaz; el cambio es de configuración del servidor.

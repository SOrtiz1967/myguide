# Feature Specification: Inicio «Hoy»

**Feature Branch**: `013-inicio-hoy`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Inicio «Hoy» de MyGuide (spec 013, ola de uso personal; Principios IV, V y VI). La pantalla de inicio está casi vacía: al abrir la app la persona ve el día de un vistazo (calorías frente al objetivo, entrenamiento de hoy) y llega rápido a lo que más usa (registrar una comida, empezar a entrenar, calendario, perfil), con un resumen compacto de lo último que registró. Solo lectura y navegación; reutiliza las specs 003, 004 y 006."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver mi día de un vistazo (Priority: P1)

Al abrir la aplicación, la persona ve en la pantalla de inicio dos bloques: cuántas calorías registró hoy frente a su objetivo del día, y qué pasa hoy con su entrenamiento. Sin entrar a ninguna otra pantalla sabe cómo va el día y qué puede hacer a continuación.

**Why this priority**: Es la razón de ser del inicio. Hoy la pantalla está casi vacía y la persona tiene que recorrer el menú para saber dónde está parada. Con solo este bloque, el inicio ya es útil.

**Independent Test**: Con una cuenta con objetivo calórico, dos comidas registradas hoy y una sesión de entrenamiento planificada para hoy, abrir el inicio y comprobar que se ven el total registrado, las kilocalorías restantes con la misma cuenta que la vista del día, y la sesión de hoy con sus acciones.

**Acceptance Scenarios**:

1. **Given** una cuenta con objetivo vigente y comidas registradas hoy, **When** abre el inicio, **Then** ve el objetivo, el total registrado, las calorías restantes y el avance en texto, con los mismos números y las mismas aclaraciones de incertidumbre (ítems sin dato de energía, estimaciones por confirmar) que la vista del día de comidas.
2. **Given** una cuenta sin objetivo vigente, **When** abre el inicio, **Then** ve solo lo registrado hoy, sin restantes ni porcentaje ni barra, y una invitación opcional a fijar un objetivo.
3. **Given** una cuenta sin comidas registradas hoy, **When** abre el inicio, **Then** el bloque de calorías dice que todavía no hay registros hoy y ofrece registrar una comida; nunca muestra «0 kcal» como si fuera un dato de cumplimiento.
4. **Given** una sesión de entrenamiento en curso, **When** abre el inicio, **Then** el bloque de entrenamiento destaca «Continuar la sesión» con su fecha.
5. **Given** sesiones planificadas para hoy o planificadas con fecha pasada («Sin registrar») y ninguna en curso, **When** abre el inicio, **Then** ve cada una con sus acciones disponibles (empezar o registrar, reprogramar, cancelar), las mismas de la spec 006.
6. **Given** ninguna sesión en curso ni planificada para hoy, **When** abre el inicio, **Then** el bloque de entrenamiento invita a empezar una sesión con una rutina o una sesión vacía.
7. **Given** lo registrado supera el objetivo, **When** abre el inicio, **Then** se informa la diferencia con la misma frase factual y neutral de la spec 004, sin estilo de alarma.

---

### User Story 2 - Llegar rápido a lo que más uso (Priority: P2)

La persona tiene a mano accesos directos a las cuatro acciones más frecuentes: registrar una comida, empezar a entrenar, ver el calendario de entrenamiento y abrir su perfil. Cada acceso es un enlace o botón que lleva a la pantalla correspondiente en un solo paso.

**Why this priority**: Reduce el recorrido para las tareas diarias, pero el inicio ya es útil sin ellos (los enlaces del menú siguen existiendo).

**Independent Test**: Desde el inicio, activar cada uno de los cuatro accesos con el teclado y comprobar que llega a la pantalla esperada (el registro de comidas de hoy, el inicio de entrenamiento, el calendario de entrenamiento y el perfil).

**Acceptance Scenarios**:

1. **Given** el inicio abierto, **When** activa «Registrar una comida», **Then** llega a agregar una comida al día de hoy según la regla del día de la spec 003.
2. **Given** el inicio abierto, **When** activa «Empezar a entrenar», **Then** llega al inicio de entrenamiento (spec 006), o a continuar la sesión si ya hay una en curso.
3. **Given** el inicio abierto, **When** activa «Ver el calendario», **Then** llega al calendario de entrenamiento del mes en curso.
4. **Given** el inicio abierto, **When** activa «Mi perfil», **Then** llega al perfil.

---

### User Story 3 - Ver lo último que registré (Priority: P3)

La persona ve un resumen compacto de lo último que registró: la comida más reciente y la última sesión de entrenamiento realizada, cada una con su fecha y un enlace para abrirla. Sirve para retomar sin tener que buscar.

**Why this priority**: Es una comodidad adicional; el día de hoy (P1) y los accesos (P2) ya resuelven el uso diario.

**Independent Test**: Con una comida registrada hace tres días y una sesión realizada hace cinco, abrir el inicio y comprobar que se ven ambas con sus fechas y que cada enlace abre el registro correspondiente; con una cuenta sin registros, comprobar que cada bloque dice que todavía no hay nada.

**Acceptance Scenarios**:

1. **Given** comidas registradas en varios días, **When** abre el inicio, **Then** ve el último ítem registrado (el más reciente por fecha del día y, dentro del mismo día, por orden de carga), con su nombre, su comida del día y su fecha, y un enlace a su detalle.
2. **Given** sesiones realizadas, **When** abre el inicio, **Then** ve la última sesión realizada con su fecha, su rutina de origen si la tuvo, sus marcas (por ejemplo «Modificada») y un enlace a ella.
3. **Given** una cuenta sin comidas o sin sesiones realizadas, **When** abre el inicio, **Then** el bloque correspondiente dice «Todavía no registraste…» y no inventa datos.

---

### Edge Cases

- Un bloque falla al cargar (por ejemplo, el de entrenamiento): ese bloque muestra su error con «Reintentar» y los demás siguen funcionando.
- Sin conexión: se informa que no se puede ver el día actualizado; no se muestran datos viejos como si fueran de hoy ni se ofrecen acciones que escriben.
- Cuenta recién creada con perfil incompleto: se mantiene el aviso de perfil incompleto; los bloques muestran sus estados vacíos y los accesos rápidos funcionan igual.
- Cuenta con el correo sin verificar: se mantiene el aviso de verificación; no bloquea el resto del inicio.
- Cambio de día (pasada la hora de cierre del día de la spec 003, o la medianoche en la zona del perfil para entrenamiento): el inicio refleja el día vigente al volver a cargarse, sin quedar mostrando el día anterior como «hoy».
- Cambio de cuenta en el mismo navegador: el inicio no muestra, ni siquiera por un instante, datos de la cuenta anterior.
- Ítems de comidas sin dato de energía o con estimaciones pendientes: se aplican las mismas aclaraciones de la spec 004; el inicio no las oculta ni las simplifica.
- Una sesión en curso y, a la vez, sesiones planificadas vencidas: se destaca continuar la en curso; las planificadas se listan aparte, y empezarlas explica que primero hay que terminar la abierta (spec 006).

## Requirements *(mandatory)*

### Functional Requirements

**Calorías del día**

- **FR-001**: El inicio MUST mostrar el resumen de calorías del día vigente con el mismo cálculo, las mismas cifras, las mismas aclaraciones de incertidumbre y los mismos textos neutrales que la vista del día de comidas (specs 003 y 004); MUST NOT calcular nada propio distinto.
- **FR-002**: Sin objetivo vigente, el bloque MUST mostrar solo lo registrado, MUST NOT mostrar restantes, porcentaje ni barra, y MAY invitar a fijar un objetivo.
- **FR-003**: Sin ítems registrados en el día, el bloque MUST decir que todavía no hay registros hoy y ofrecer registrar una comida; MUST NOT mostrar un total de 0 como logro ni como falta.
- **FR-004**: Cuando lo registrado supere el objetivo, el bloque MUST informar la diferencia con la frase factual y neutral de la spec 004, sin estilo de alarma, sin sugerir compensar, restringir ni saltarse comidas.
- **FR-005**: El bloque MUST ofrecer un enlace para abrir el día completo de comidas.

**Entrenamiento de hoy**

- **FR-006**: Si hay una sesión en curso, el bloque de entrenamiento MUST destacar el acceso para continuarla, con su fecha.
- **FR-007**: El bloque MUST listar las sesiones planificadas para hoy y las planificadas con fecha pasada («Sin registrar»), cada una con las mismas acciones y reglas de la spec 006 (empezar o registrar con la pregunta «¿Qué día la hiciste?», reprogramar, cancelar).
- **FR-008**: Si no hay sesión en curso ni planificadas para hoy o vencidas, el bloque MUST invitar a empezar una sesión con una rutina de la persona o una sesión vacía, con el mismo gesto de la spec 006; si no tiene rutinas, MUST ofrecer armar una.
- **FR-009**: El bloque MUST NOT usar rachas, metas de entrenamiento, puntajes, culpa ni mensajes de logro, ni tratar las sesiones saltadas o canceladas con juicio.

**Accesos rápidos y últimos registros**

- **FR-010**: El inicio MUST ofrecer accesos directos a: registrar una comida (al día vigente), empezar a entrenar, ver el calendario de entrenamiento y abrir el perfil, todos operables por teclado y con nombre accesible claro.
- **FR-011**: El inicio MUST mostrar el último ítem de comida registrado, con su nombre, su comida del día y la fecha de su día, y un enlace a su detalle.
- **FR-012**: El inicio MUST mostrar la última sesión de entrenamiento realizada, con su fecha, su rutina de origen si la tuvo, sus marcas y un enlace a ella.
- **FR-013**: Un dato que falta o que no existe MUST mostrarse como faltante («Todavía no registraste…», «sin dato»); MUST NOT completarse con supuestos.

**Avisos existentes y comportamiento general**

- **FR-014**: El inicio MUST conservar el aviso de verificación de correo y el aviso de perfil incompleto existentes, con su comportamiento actual.
- **FR-015**: Cada bloque (calorías, entrenamiento, últimos registros) MUST tener sus propios estados de carga, vacío y error con «Reintentar»; el fallo de un bloque MUST NOT impedir mostrar los demás.
- **FR-016**: El inicio MUST ser solo de lectura y navegación: MUST NOT crear tablas ni escribir datos propios; las acciones del bloque de entrenamiento son las de la spec 006 y las escrituras que hacen son las de esa spec.
- **FR-017**: Sin conexión, el inicio MUST avisarlo y MUST NOT presentar datos desactualizados como actuales ni permitir acciones que escriben.
- **FR-018**: Los datos mostrados MUST ser solo los de la cuenta autenticada, exigir sesión vigente (spec 001) y MUST NOT mostrarse, ni siquiera por un instante, tras cambiar de cuenta o cerrar sesión.
- **FR-019**: Todo el texto MUST estar en español, ser neutral (Principio IV y Constitución v1.2.1) y pasar las pruebas de lenguaje neutral existentes; el estado nunca MUST depender solo del color.
- **FR-020**: El inicio MUST ser usable en pantalla de teléfono y de escritorio, sin desplazamiento horizontal, por teclado y con lector de pantalla, con áreas táctiles de 44 px o más.

### Key Entities

Esta spec no define entidades nuevas. Lee, sin modificarlas:

- **Día de comidas y su resumen** (specs 003 y 004): los ítems del día vigente, el objetivo que rige ese día y el resumen calculado.
- **Sesión de entrenamiento** (spec 006): estado (planificada, en curso, realizada, cancelada), fecha, rutina de origen y marcas.
- **Último ítem registrado**: el ítem de comida más reciente de la cuenta, con su día y su comida del día.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona entiende cuántas calorías lleva hoy y si tiene una sesión de entrenamiento pendiente o en curso en menos de 5 segundos desde que se abre el inicio.
- **SC-002**: Desde el inicio, el 100 % de las cuatro acciones frecuentes (registrar una comida, empezar a entrenar, calendario, perfil) se alcanza en un solo paso, con mouse o con teclado.
- **SC-003**: En el 100 % de los casos probados, las cifras del bloque de calorías coinciden exactamente con las de la vista del día de comidas (total, restantes, porcentaje, aclaraciones).
- **SC-004**: En el 100 % de los casos probados, el fallo de un bloque deja los otros dos visibles y operables.
- **SC-005**: El inicio con datos de una cuenta con 700 sesiones y varios años de comidas se muestra completo en menos de 2 segundos.
- **SC-006**: El 100 % de los datos faltantes se muestra como faltante y el 0 % se completa con supuestos.
- **SC-007**: Ningún texto del inicio contiene rachas, metas de entrenamiento, juicios sobre lo comido o entrenado ni mensajes de culpa, verificado por revisión de textos y por pruebas automáticas.
- **SC-008**: Todas las pantallas y estados nuevos se pueden usar y completar en teléfono y escritorio, por teclado y con lector de pantalla, sin errores de accesibilidad graves.

## Assumptions

- «Hoy» para las calorías es el día vigente según la regla del día de la spec 003 (incluida la hora de cierre del día); para el entrenamiento es el día de la zona horaria del perfil, como en la spec 006. Cuando difieren (por ejemplo, de madrugada), cada bloque usa el suyo y lo dice con su fecha.
- Se reutilizan las consultas y funciones existentes de las specs 003, 004 y 006; cualquier consulta nueva de solo lectura que haga falta (por ejemplo, «último ítem registrado») no crea tablas ni datos propios.
- Los accesos rápidos son enlaces a pantallas existentes; no inician acciones por sí mismos, salvo las que el bloque de entrenamiento ya ofrece según la spec 006.
- No hay personalización del inicio (orden o visibilidad de bloques), notificaciones, recordatorios ni sugerencias.
- Gráficos, tendencias, sueño, pasos, peso y recomendaciones automáticas quedan fuera; los bloques nuevos de esas specs (007, 008 y 010) se podrán sumar al inicio cuando existan.
- No hay funcionamiento sin conexión (Principio VI); el aviso global de falta de conexión de la spec 001 se mantiene.
- Es una aplicación de uso personal en este MVP, pero con aislamiento correcto entre cuentas.

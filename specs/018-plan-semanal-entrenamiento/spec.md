# Feature Specification: Plan semanal de entrenamiento y pestaña Entrenamiento rehecha

**Feature Branch**: `018-plan-semanal-entrenamiento`

**Created**: 2026-10-28

**Status**: Draft

**Input**: «Pestaña entrenamiento: hay cosas que me gustan, me gusta cómo se arma la rutina, pero el front está mal hecho, desprolijo y bastante feo. Me gustaría poder planificar una semana genérica y poder armar las rutinas y ponerlas en sus respectivos días y que se guarden para siempre en esos días: todos los lunes pecho, etc. Después, en el inicio, puedes marcar como completado el entrenamiento del día o tocar un botón de entrenamiento distinto y puedes poner o una rutina de las cargadas o una nueva de ese día.» Aclaración del autor: «si marcas un entrenamiento como completado es porque tenías una rutina asignada a ese día; si no, tiene que estar la opción de cargar entrenamiento y puedes cargar la rutina hecha.» (prueba de uso del autor, 2026-10-28, nota 4 de `Documentacion/notas-de-prueba-2026-10-28.md`). Roadmap: spec 018, ola 4. Depende de las specs 006, 016 y 017.

## Clarifications

### Session 2026-10-28

- Q: ¿Un día de la semana tiene una sola rutina asignada o varias? → A: Una sola. Un entrenamiento adicional el mismo día se carga con «Cargar entrenamiento», como hoy (la spec 006 ya admite más de una sesión por día).
- Q: ¿Qué guarda la sesión que se marca como completada? → A: Una sesión «realizada» que conserva como plan los ejercicios, series y objetivos de la rutina, sin ninguna serie realizada, y que se muestra como «Marcada como completada, sin detalle». Lo planificado no se muestra como realizado (spec 006, FR-016). La persona puede abrirla y cargar el detalle después.
- Q: ¿El plan crea sesiones planificadas en el calendario? → A: No. El plan es una plantilla que se lee en el momento: el día «toca» lo que dice el plan hasta que exista una sesión de ese día. No se generan filas de sesiones por adelantado ni se acumulan sesiones «sin registrar» por días pasados.
- Q: ¿Qué pasa si se edita o elimina una rutina que está en el plan? → A: El plan apunta a la rutina: editarla cambia lo que se propone de ahí en adelante, y las sesiones ya creadas no cambian (spec 006, FR-005). Eliminarla deja ese día del plan sin rutina y la pantalla del plan lo avisa en texto neutral.
- Q: ¿Hay días de descanso explícitos? → A: No. Un día sin rutina asignada es simplemente un día sin rutina; no se le agrega una marca ni un juicio.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Armar el plan semanal (Priority: P1)

La persona abre su plan semanal, ve los siete días de la semana y asigna a cada día una rutina de su catálogo («los lunes, pecho»), o lo deja sin rutina. El plan se guarda y se repite todas las semanas hasta que lo cambie. Puede cambiar la rutina de un día, quitarla o armar una rutina nueva sin salir del plan.

**Why this priority**: es lo central de lo que pidió el autor: hoy cada día se decide a mano y no hay lugar donde quede escrito qué toca cada día. Todo lo demás (el inicio, la semana) se apoya en este plan.

**Independent Test**: con dos rutinas creadas, asignar una al lunes y otra al jueves, dejar los demás días sin rutina, cerrar la sesión, volver a entrar y comprobar que el plan sigue igual; cambiar el lunes por otra rutina y quitar el jueves.

**Acceptance Scenarios**:

1. **Given** la pantalla del plan, **Then** muestra los siete días de la semana, de lunes a domingo, y para cada uno la rutina asignada o «Sin rutina».
2. **Given** un día, **When** la persona elige una rutina de su catálogo, **Then** queda asignada a ese día de todas las semanas y se conserva al recargar y al volver a ingresar.
3. **Given** un día con rutina asignada, **When** la persona la cambia o la quita, **Then** el plan refleja el cambio y las sesiones ya creadas no cambian.
4. **Given** que la persona no tiene rutinas, **Then** el plan lo dice y ofrece armar la primera con el mismo armador de rutinas de hoy.
5. **Given** una rutina asignada que luego se elimina, **Then** ese día queda sin rutina y la pantalla lo dice en texto neutral (por ejemplo «La rutina que tenías aquí ya no existe»), sin errores.
6. **Given** el mismo día de la semana, **Then** solo puede tener una rutina asignada.

---

### User Story 2 - Ver lo que toca hoy y marcarlo como completado (Priority: P1)

En el inicio, el bloque de entrenamiento del día dice qué rutina toca según el plan. Si la persona hizo ese entrenamiento, lo marca como completado con un solo gesto y el día queda registrado. Si hizo otro, elige «Hice otro entrenamiento». Marcar como completado solo existe cuando el día tenía una rutina asignada.

**Why this priority**: es el gesto diario que el autor pidió; sin él el plan no ahorra nada.

**Independent Test**: con una rutina asignada al día de hoy, abrir el inicio, tocar «Marcar como completado» y comprobar que aparece una sesión realizada de esa rutina, marcada como «sin detalle», que el día figura como entrenado en la semana y que el botón ya no se ofrece para hoy.

**Acceptance Scenarios**:

1. **Given** hoy tiene una rutina asignada y ninguna sesión realizada, **Then** el bloque muestra el nombre de la rutina, la cantidad de ejercicios, «Marcar como completado» y «Hice otro entrenamiento».
2. **When** la persona toca «Marcar como completado», **Then** se crea una sesión realizada de ese día con el plan de la rutina (ejercicios, series y objetivos tal como están en ese momento), sin series realizadas, marcada como «Marcada como completada, sin detalle».
3. **Given** una sesión marcada así, **Then** en ningún lugar muestra lo planificado como si fuera lo realizado; los ejercicios figuran como planificados y la persona puede abrirla y cargar el detalle real después.
4. **Given** que se toca el botón dos veces seguidas o se reintenta por una mala conexión, **Then** se crea una sola sesión (idempotencia).
5. **Given** que hoy ya tiene una sesión realizada, **Then** el bloque muestra lo hecho y no vuelve a ofrecer «Marcar como completado»; sí sigue ofreciendo cargar otro entrenamiento.
6. **Given** hoy sin ninguna rutina asignada, **Then** no se muestra «Marcar como completado» (ver la historia 3).
7. **Given** el día en curso y la regla del día de la spec 003, **Then** «hoy» es el mismo día que ya usa el inicio.

---

### User Story 3 - Cargar un entrenamiento distinto o sin rutina asignada (Priority: P1)

Si el día no tenía rutina asignada, o la persona hizo otra cosa, ve «Cargar entrenamiento». Ahí elige una rutina ya cargada (queda registrada como hecha ese día), o arma una nueva, o carga un entrenamiento vacío para registrar lo que hizo con detalle. Hacer algo distinto de lo asignado no cambia el plan.

**Why this priority**: el autor lo pidió expresamente: sin esta vía quedaría sin opción el día sin plan, que es el caso más común al empezar.

**Independent Test**: en un día sin rutina asignada elegir «Cargar entrenamiento», seleccionar una rutina y comprobar que queda una sesión de ese día; en un día con rutina asignada tocar «Hice otro entrenamiento», elegir otra rutina y comprobar que el plan sigue igual.

**Acceptance Scenarios**:

1. **Given** un día sin rutina asignada, **Then** el bloque muestra «Cargar entrenamiento» y no «Marcar como completado».
2. **When** la persona elige «Cargar entrenamiento», **Then** puede elegir una rutina de su catálogo, armar una rutina nueva o empezar un entrenamiento vacío.
3. **When** elige una rutina para registrarla como hecha, **Then** puede marcarla como completada con un gesto (sin detalle, igual que en la historia 2) o abrirla para cargar las series.
4. **Given** «Hice otro entrenamiento» en un día con rutina asignada, **Then** ofrece las mismas opciones y el plan no se modifica.
5. **Given** un día pasado (desde la semana del inicio o el calendario), **Then** se puede cargar o marcar un entrenamiento en ese día con las mismas opciones; un día futuro solo muestra lo que toca según el plan.
6. **Given** un entrenamiento en curso, **Then** el bloque ofrece continuar la sesión, como hoy (spec 006, FR-009).

---

### User Story 4 - La pestaña Entrenamiento rehecha (Priority: P1)

La pestaña Entrenamiento se rediseña completa con el sistema de la spec 017 (dirección C). Reúne en un lugar claro: lo de hoy, el plan semanal, las rutinas, el calendario y las últimas sesiones. Cómo se arma una rutina se conserva como está, y solo cambia cómo se ve.

**Why this priority**: es lo que pidió el autor («el front está mal hecho, desprolijo y feo»); el plan semanal necesita un lugar propio.

**Independent Test**: abrir la pestaña en escritorio y celular, llegar a cada sección (hoy, plan, rutinas, calendario, últimas sesiones), crear una rutina y comprobar que el armador se comporta igual que antes.

**Acceptance Scenarios**:

1. **Given** la pestaña, **Then** muestra, en este orden, lo de hoy (con las acciones de las historias 2 y 3), el plan semanal, las rutinas y las últimas sesiones, con un acceso al calendario.
2. **Given** cualquier sección, **Then** usa solo las piezas del sistema de la spec 017 y tiene estados de carga, vacío y error comunes.
3. **Given** el armador de rutinas, **Then** conserva sus pasos y funciones (nombre, ejercicios del catálogo o propios, orden, series, objetivos, duplicar, eliminar) sin cambios de comportamiento.
4. **Given** las funciones que existían (calendario, reprogramar, cancelar, correcciones, historia por ejercicio), **Then** siguen disponibles y funcionan igual.
5. **Given** 375 px de ancho, **Then** no hay desplazamiento horizontal.

---

### User Story 5 - La semana del inicio considera el plan (Priority: P2)

En la semana del inicio (spec 016), cada día muestra el estado del entrenamiento teniendo en cuenta el plan: «Plan» si ese día tiene rutina asignada y todavía no hay sesión, «Hecho» si hay una sesión realizada, y «Sin registro» si era un día con rutina asignada que ya pasó sin sesión. Un día sin rutina asignada y sin sesión no muestra nada.

**Why this priority**: da coherencia al plan en todas las pantallas, pero la app funciona sin esto.

**Independent Test**: con el plan lunes y jueves, abrir la semana y comprobar los estados de cada día antes y después de marcar uno como completado.

**Acceptance Scenarios**:

1. **Given** un día futuro con rutina asignada, **Then** el estado es «Plan» (forma y texto), no «Sin registro».
2. **Given** un día pasado con rutina asignada y sin sesión, **Then** el estado es «Sin registro», en texto neutral, sin avisos ni juicios (Principio IV).
3. **Given** un día con sesión realizada, **Then** el estado es «Hecho», con o sin detalle.
4. **Given** una sesión planificada a mano en el calendario (spec 006) para un día con rutina asignada por plan, **Then** manda la sesión planificada y el día no se cuenta dos veces.

---

### Edge Cases

- Una rutina asignada se edita (por ejemplo se le agregan ejercicios): lo que se propone y lo que se copia de ahí en adelante es la versión nueva; lo ya registrado no cambia.
- Una rutina asignada se duplica: la copia es otra rutina y no queda asignada.
- La rutina asignada tiene ejercicios que ya no existen en el catálogo: se usan el nombre y el tipo de medición que guardó la rutina (spec 006, FR-004 y FR-037).
- La persona cambia la zona horaria: «hoy» y el día de la semana se calculan en la zona vigente; las sesiones ya creadas conservan su fecha.
- Medianoche: la regla del día de la spec 003 define cuál es el día en curso para ofrecer las acciones.
- La persona marca como completado y se arrepiente: puede eliminar o corregir la sesión como cualquier otra (spec 006, FR-038 y FR-039); eliminarla devuelve el día al estado «Plan».
- Sin conexión: se avisa y no se permite guardar el plan ni marcar el día; lo escrito en formularios se conserva como borrador (spec 006, FR-045 y FR-048).
- Un día con un entrenamiento en curso de otro día: se ofrece continuar o terminar esa sesión antes de empezar otra, como hoy.
- Una cuenta nueva sin rutinas ni plan: los estados vacíos explican qué hacer primero (armar una rutina) sin culpar.
- Cambiar el plan no modifica sesiones pasadas ni futuras ya creadas, y no genera sesiones por adelantado.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La persona MUST poder tener un plan semanal con, para cada uno de los siete días de la semana, cero o una rutina de su catálogo asignada.
- **FR-002**: El plan MUST repetirse todas las semanas hasta que la persona lo cambie, y MUST conservarse al cerrar sesión y al volver a ingresar.
- **FR-003**: La persona MUST poder asignar, cambiar y quitar la rutina de cada día del plan, y MUST poder armar una rutina nueva desde la pantalla del plan.
- **FR-004**: El plan MUST ser una entidad aparte: MUST NOT cambiar el catálogo de rutinas ni las sesiones registradas, y MUST NOT crear sesiones por adelantado.
- **FR-005**: Editar una rutina asignada MUST cambiar lo que el plan propone de ahí en adelante y MUST NOT cambiar ninguna sesión ya creada (spec 006, FR-005); eliminarla MUST dejar ese día sin rutina y la pantalla del plan MUST decirlo en texto neutral.
- **FR-006**: El bloque de entrenamiento del inicio MUST mostrar, para el día elegido, la rutina que toca según el plan, o la sesión ya registrada, o la invitación a cargar un entrenamiento.
- **FR-007**: «Marcar como completado» MUST ofrecerse solo cuando el día tiene una rutina asignada por el plan (o elegida para ese día) y todavía no hay una sesión realizada de ese día.
- **FR-008**: Al marcar como completado, el sistema MUST crear una sesión realizada de ese día que guarde el plan de la rutina (ejercicios, series y objetivos tal como estaban en ese momento, spec 006, FR-015), sin series realizadas, y MUST marcarla como «Marcada como completada, sin detalle».
- **FR-009**: Una sesión marcada como completada MUST NOT mostrar lo planificado como realizado en ninguna pantalla (spec 006, FR-016) y MUST poder abrirse para cargar o corregir el detalle real.
- **FR-010**: Marcar como completado MUST ser idempotente: un doble toque o un reintento por mala conexión MUST NOT crear dos sesiones.
- **FR-011**: Cuando el día no tiene rutina asignada MUST mostrarse «Cargar entrenamiento», con tres opciones: elegir una rutina del catálogo (registrada como hecha ese día), armar una rutina nueva o empezar un entrenamiento vacío.
- **FR-012**: «Hice otro entrenamiento» MUST estar disponible en los días con rutina asignada, con las mismas opciones que «Cargar entrenamiento», y MUST NOT modificar el plan.
- **FR-013**: Las acciones de marcar y de cargar MUST funcionar también para un día pasado elegido desde la semana del inicio; un día futuro MUST mostrar solo lo que toca según el plan.
- **FR-014**: La pestaña Entrenamiento MUST reunir lo de hoy, el plan semanal, las rutinas, las últimas sesiones y un acceso al calendario, con las piezas y el estilo de la spec 017.
- **FR-015**: El armador de rutinas MUST conservar su comportamiento actual (spec 006, FR-001 a FR-006); esta spec solo cambia su presentación.
- **FR-016**: Las funciones existentes de la pestaña (calendario, reprogramar, cancelar, correcciones, historia por ejercicio) MUST seguir disponibles con el mismo comportamiento.
- **FR-017**: La semana del inicio MUST mostrar para cada día un estado de entrenamiento que considere el plan: «Plan», «Hecho», «Sin registro» o ninguno, siempre en forma y texto, sin rojo ni verde como juicio (Principio IV).
- **FR-018**: Si un día tiene a la vez una rutina por plan y una sesión planificada a mano en el calendario, MUST mandar la sesión planificada, y el día MUST NOT contarse dos veces.
- **FR-019**: Los datos del plan MUST ser privados de cada cuenta (ninguna cuenta puede ver, crear, cambiar ni eliminar el plan de otra) y MUST eliminarse junto con la cuenta.
- **FR-020**: Todas las pantallas nuevas o rehechas MUST tener estados de carga, vacío, éxito y error en español, con tuteo y lenguaje neutral: sin rachas, sin días «perdidos» y sin juicio sobre constancia o rendimiento (spec 006, FR-051).
- **FR-021**: Las pantallas MUST cumplir WCAG 2.1 AA, ser usables por teclado y lector de pantalla y no tener desplazamiento horizontal a 375 px.
- **FR-022**: Guardar el plan, marcar como completado y cargar un entrenamiento MUST informar el resultado, MUST NOT dar por guardado lo que no llegó al servidor, y sin conexión MUST avisarlo y conservar lo escrito como borrador (spec 006, FR-045 a FR-048).
- **FR-023**: Los registros técnicos (logs) MUST NOT contener el contenido del plan, de las rutinas ni de las sesiones.

### Key Entities _(include if feature involves data)_

- **Plan semanal**: la asignación de rutinas a los días de la semana de una persona. Para cada día de la semana (de lunes a domingo) tiene a lo sumo una rutina. Es privado de la cuenta y no contiene fechas: se repite cada semana.
- **Rutina**: la de la spec 006, sin cambios; el plan la referencia.
- **Sesión de entrenamiento**: la de la spec 006. Una sesión realizada puede llevar la marca «completada, sin detalle» cuando se registró con el gesto de marcar como completado y todavía no tiene series realizadas.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Armar un plan de cuatro días con rutinas ya creadas lleva menos de dos minutos y no requiere salir de la pantalla del plan.
- **SC-002**: Marcar como completado el entrenamiento del día se hace desde el inicio con un solo toque; cargar un entrenamiento distinto con una rutina del catálogo, con tres toques o menos.
- **SC-003**: El 100 % de las sesiones creadas con «Marcar como completado» muestra el plan de la rutina como planificado y ninguna serie como realizada; ninguna pantalla muestra un valor planificado como realizado.
- **SC-004**: Cambiar, quitar o eliminar una rutina del plan no modifica ninguna sesión ya creada (comprobado sobre sesiones realizadas, en curso y planificadas).
- **SC-005**: Un doble toque en «Marcar como completado» crea exactamente una sesión.
- **SC-006**: Ninguna cuenta puede leer ni cambiar el plan de otra, comprobado con una prueba de aislamiento.
- **SC-007**: Todas las pantallas de la pestaña Entrenamiento, el bloque del inicio y el plan no tienen violaciones graves o críticas de accesibilidad ni desplazamiento horizontal a 375 px.
- **SC-008**: Las pruebas funcionales de la spec 006 siguen pasando sin cambios de comportamiento.

## Assumptions

- El plan tiene una rutina por día de la semana; los entrenamientos adicionales de un día se cargan con «Cargar entrenamiento» (la spec 006 ya permite varias sesiones por día).
- El plan es una plantilla que se lee en el momento; no genera sesiones planificadas por adelantado ni cambia el calendario de la spec 006.
- El día de la semana de «hoy» se calcula con la zona horaria de la persona y la regla del día de la spec 003.
- «Completada, sin detalle» es una sesión realizada sin series realizadas; la distinción se muestra en texto y la persona puede agregar el detalle más tarde.
- No hay recordatorios ni notificaciones del plan (specs 021 y 024).
- No se agregan servicios externos ni dependencias; el plan usa la base de datos y el alojamiento ya existentes.

## Out of Scope

- Rotación por semanas distintas (semana A y semana B) o planes por mes.
- Descanso explícito, rachas, metas de frecuencia o mensajes sobre constancia.
- Recordatorios o notificaciones de entrenamiento (spec 021 y futura spec 024).
- Gráficos de progreso de entrenamiento (spec 012).
- Cambiar cómo se arma una rutina más allá de su presentación.

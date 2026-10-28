# Feature Specification: Rediseño con semana en el inicio

**Feature Branch**: `014-onboarding-calculo-rediseno`

**Created**: 2026-10-27

**Status**: Implemented (verificada localmente)

**Input**: "No me gusta el diseño de la página. Quiero un rediseño: la página principal muestra la semana, cada día con su objetivo calórico cumplido o no y su entrenamiento cumplido o no." Decisiones del usuario: estilo denso y de datos, negro y azul, nombre MyGuide, «cumplido» como rango con tolerancia sin rojo, recordatorio de peso solo como preferencia. Referencia: `Captura.PNG` (menú a la izquierda, resumen al centro, panel del día a la derecha). Investigación: `research_notes/Onboarding calorías y vista semanal/vista_semanal.md` y `diseno_denso.md`. Principios IV (sin juicios) y V (sin conclusiones firmes de un solo día).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver mi semana de un vistazo (Priority: P1)

El inicio muestra los siete días de la semana (lunes a domingo). Cada día muestra cuántas kcal se registraron frente al rango del objetivo de ese día y qué pasó con el entrenamiento. Se puede cambiar de semana.

**Independent Test**: Con un objetivo de 2.000 kcal, comidas de 1.000, 2.000 y 2.600 kcal en tres días, y una sesión realizada, una planificada futura y una planificada pasada sin registrar, abrir el inicio y comprobar el estado de cada día en texto y forma.

**Acceptance Scenarios**:

1. **Given** un día con objetivo y registros, **When** se ve la semana, **Then** el día muestra «En rango» si lo registrado está dentro de ±10 % del objetivo, «Por debajo» o «Por encima» si no, con la cifra y la diferencia en texto («−1.000 kcal»); nunca en rojo y nunca solo por color: cada estado tiene su propia forma (relleno, ▼, ▲).
2. **Given** un día sin ningún ítem registrado, **Then** dice «Sin registro», que no equivale a «Por debajo».
3. **Given** el día de hoy, **Then** se muestra «En curso» sin juzgarlo hasta que termine.
4. **Given** un día sin objetivo vigente, **Then** muestra solo lo registrado, sin rango ni estado.
5. **Given** sesiones de entrenamiento, **Then** cada día muestra: hecho (■), en curso, planificado (□), sin registrar (planificada de un día pasado), cancelado, o sin sesión; el texto de cada estado reutiliza los de la spec 006.
6. **Given** que se pasa de semana con las flechas, **Then** se muestran los datos de esa semana y un acceso para volver a la actual; no se puede elegir un día futuro para registrar comidas pero sí ver sesiones planificadas.
7. **Given** un lector de pantalla, **Then** cada día es un botón con una etiqueta que dice fecha, kcal, estado y entrenamiento.

### User Story 2 - Panel del día elegido (Priority: P1)

Al tocar un día, el panel muestra solo los datos de esa fecha: calorías frente al objetivo (misma tarjeta de la spec 004), peso del día si existe, entrenamiento con sus acciones y accesos para registrar. Un día pasado se distingue claramente de hoy.

**Acceptance Scenarios**:

1. **Given** el inicio recién abierto, **Then** el día elegido es hoy y el panel dice «Hoy».
2. **Given** un día pasado elegido, **Then** el panel dice «No es hoy» con la fecha y los accesos de registro apuntan a esa fecha.
3. **Given** hoy, **Then** el panel conserva las acciones de entrenamiento de la spec 013 (continuar, empezar, reprogramar, cancelar).
4. **Given** un dato faltante (sin peso, sin comidas), **Then** se muestra como faltante, sin valores supuestos.

### User Story 3 - Nueva estructura y navegación (Priority: P2)

La aplicación pasa a tema negro con acento azul, tipografía Schibsted Grotesk con cifras tabulares y menú lateral en escritorio (Inicio, Calendario, Entrenamiento, Nutrición, Medidas, Alimentos, Ejercicios, Sueño y actividad, Objetivo, Perfil). En celular el menú es una barra inferior con Inicio, Calendario, Entrenamiento, Nutrición y «Más».

**Acceptance Scenarios**:

1. **Given** un escritorio de 1.280 px, **Then** hay menú lateral, contenido central y, en el inicio, panel del día a la derecha.
2. **Given** un celular de 360 px, **Then** no hay desplazamiento horizontal, los objetivos táctiles miden al menos 44 px y «Más» abre el resto de enlaces y «Cerrar sesión».
3. **Given** cualquier pantalla, **Then** pasa axe AA (contraste incluido) y el foco es visible.
4. **Given** el menú, **Then** la sección actual está marcada con `aria-current="page"`.
5. **Given** el recorrido del primer ingreso, **Then** el menú no ofrece enlaces que lleven de vuelta a la bienvenida.

### User Story 4 - Recordatorio de peso como preferencia (Priority: P3)

En el perfil hay un ajuste «Recordarme pesarme» (apagado por defecto). Si está activo y no hay peso de hoy, el panel de hoy muestra un aviso discreto con acceso a Medidas. Sin notificaciones push; el peso sigue siendo opcional y los días sin medición son normales.

## Requirements *(mandatory)*

- **FR-001**: La semana MUST empezar el lunes y mostrar siete días; el estado de calorías de cada día MUST calcularse con el objetivo vigente ese día (spec 004) y los ítems de ese día.
- **FR-002**: Estados de calorías: `Sin objetivo`, `Sin registro`, `En curso` (solo hoy), `En rango` (|registrado − objetivo| ≤ 10 % del objetivo), `Por debajo`, `Por encima`. Cada uno MUST tener forma y texto propios además del color; ninguno usa rojo ni verde.
- **FR-003**: Estados de entrenamiento: `Hecho`, `En curso`, `Planificado`, `Sin registrar` (planificada con fecha pasada), `Cancelado` y `Sin sesión`; si hay varias sesiones el día muestra la de mayor prioridad (en curso, hecho, planificado, sin registrar, cancelado).
- **FR-004**: Ningún texto usa rachas, «cumplido/no cumplido», culpa ni comparaciones; la diferencia se informa de forma factual (Principio IV). La pantalla no muestra totales semanales como veredicto.
- **FR-005**: Cada día MUST ser un único control accesible con etiqueta completa; la selección se marca con `aria-pressed`.
- **FR-006**: El panel del día MUST reutilizar `GoalSummary` y las acciones de entrenamiento existentes, sin duplicar cálculos.
- **FR-007**: Cada bloque (semana, panel) carga y falla por su cuenta con reintento; sin conexión se avisa como en la spec 013.
- **FR-008**: El tema usa solo tokens (`bg`, `surface`, `ink`, `muted`, `line`, `accent`, `warn`); contraste de texto ≥ 4,5:1 y de marcas ≥ 3:1.
- **FR-009**: El menú no hace consultas: se renderiza sin proveedor de datos (carcasa también sin conexión).
- **FR-010**: El recordatorio de peso MUST guardarse como preferencia del perfil y mostrarse solo en el panel de hoy cuando no hay peso de hoy.

## Success Criteria

- **SC-001**: Con los datos del test independiente, los siete estados salen como se espera en la prueba de la semana.
- **SC-002**: Ninguna pantalla muestra desplazamiento horizontal en 360 px y todas pasan axe AA.
- **SC-003**: Los e2e de la spec 013 (inicio) siguen verdes, adaptados a la nueva estructura.

## Assumptions

- La tolerancia de ±10 % es una convención (no hay estudio que la respalde); queda como constante revisable.
- «Fotos» se agrega al menú cuando exista la spec 008 completa.
- La evolución del peso con promedio móvil (gráfico) es la spec 017.

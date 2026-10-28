# Feature Specification: Rediseño de la interfaz

**Feature Branch**: `017-redisenio-interfaz`

**Created**: 2026-10-28

**Status**: Draft

**Input**: «No me gusta demasiado el diseño de la mayoría de las pantallas, en general no estoy muy convencido.» (prueba de uso del autor, 2026-10-28; nota 2 de `Documentacion/notas-de-prueba-2026-10-28.md`). Decisión del autor: es un rediseño completo de la interfaz y de la experiencia de uso, no un retoque de algunas cards. Roadmap: spec 017, ola 4.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Elegir la dirección visual antes de construir (Priority: P1)

Antes de tocar las pantallas, la persona ve alternativas concretas de cómo podría verse MyGuide y elige una. Las alternativas son distintas entre sí (no variaciones de color de lo mismo) y se muestran sobre pantallas reales de la app con datos de ejemplo. Lo elegido queda registrado como la dirección del rediseño.

**Why this priority**: el autor dijo que no está convencido del diseño en general. Construir sin que elija repetiría el problema, y todo lo demás de esta spec y de las siguientes depende de esa elección.

**Independent Test**: abrir la exploración, ver al menos tres alternativas aplicadas a las mismas tres pantallas (inicio, registro de comidas y un formulario), elegir una y comprobar que la elección queda escrita en la documentación de la spec con sus motivos.

**Acceptance Scenarios**:

1. **Given** la exploración, **When** la persona la abre, **Then** ve al menos tres alternativas de dirección visual, cada una aplicada a las mismas pantallas, en escritorio y en celular.
2. **Given** las alternativas, **Then** cada una dice en pocas palabras qué cambia respecto del diseño actual (estructura, jerarquía, forma de las tarjetas, navegación, tipografía y color).
3. **Given** que la persona elige una alternativa o pide mezclar partes de varias, **Then** la dirección elegida queda documentada antes de implementar y las demás no se construyen.
4. **Given** que la persona no elige ninguna, **Then** se prepara una segunda ronda; no se implementa nada del rediseño sin una elección.
5. **Given** que la dirección elegida cambia la paleta, el nombre visible, el tipo de letra o la estructura de tres zonas del inicio (spec 016), **Then** el cambio es válido y se documenta como decisión.

---

### User Story 2 - Un sistema de componentes único y documentado (Priority: P1)

Existe un conjunto de piezas reutilizables con las que se arma cualquier pantalla: tarjeta, lista, formulario y sus campos, encabezado de pantalla, estado vacío, estado de carga, estado de error, mensajes de aviso, botones, etiquetas de estado y gráfico. Cada pieza tiene una sola apariencia y comportamiento, definidos con valores comunes de color, tipografía, espaciado y forma. Hay un documento de consulta que muestra cada pieza y sus estados.

**Why this priority**: la sensación de «desprolijo» viene de pantallas armadas cada una a su manera. Sin un sistema común, el rediseño se vuelve a descuadrar con cada spec nueva (entrenamiento, fotos, suplementos).

**Independent Test**: abrir la página de referencia del sistema y comprobar que muestra cada pieza en todos sus estados (normal, foco, deshabilitada, con error, vacía, cargando) y que cambiar un valor común (por ejemplo el color de acento) se refleja en todas las pantallas sin tocarlas una por una.

**Acceptance Scenarios**:

1. **Given** la página de referencia, **Then** muestra cada pieza con sus estados y una nota de cuándo usarla.
2. **Given** una pantalla cualquiera, **Then** sus tarjetas, listas, campos y botones son las piezas del sistema y no tienen estilos propios sueltos.
3. **Given** un valor común del sistema (color, tamaño de letra, espaciado, radio), **When** se cambia, **Then** todas las pantallas lo reflejan.
4. **Given** el gráfico del sistema, **Then** tiene unidades, fechas y cantidad de datos en texto, y no usa solo el color para distinguir series (el gráfico lo usan después las specs 010, 012 y 020).
5. **Given** una pieza que muestra un estado de calorías, peso o entrenamiento, **Then** lo dice en texto y con una forma distinta, sin rojo y verde como juicio.

---

### User Story 3 - Todas las pantallas existentes con el sistema nuevo (Priority: P1)

Las pantallas que existen hoy se rehacen con la dirección elegida y el sistema de componentes: inicio con la semana y el panel del día, comidas, alimentos y su detalle, ejercicios y su detalle, sueño y actividad, medidas, objetivo calórico y plan, perfil, primer ingreso, y registro, inicio de sesión y recuperación de cuenta. Todo sigue funcionando igual: mismos datos, mismas acciones, mismos textos de significado.

**Why this priority**: es lo que el autor pidió. El valor está en que la app entera se vea y se use de forma coherente, no en dos pantallas lindas.

**Independent Test**: recorrer cada pantalla de la lista en escritorio y en celular y comprobar que usa el sistema, que cada acción que existía sigue estando y que todas las pruebas funcionales anteriores pasan sin cambios de comportamiento.

**Acceptance Scenarios**:

1. **Given** cada pantalla de la lista, **Then** conserva todas las acciones y datos que tenía antes; nada se pierde ni se esconde sin un acceso equivalente.
2. **Given** las pruebas funcionales existentes, **Then** pasan; si una prueba necesita cambiar es solo por un cambio de estructura visual (por ejemplo un selector), nunca por un cambio de comportamiento.
3. **Given** cualquier pantalla a 375 px de ancho, **Then** no hay desplazamiento horizontal.
4. **Given** cualquier pantalla, **Then** no tiene violaciones de accesibilidad graves o críticas y el foco del teclado es visible.
5. **Given** la pestaña Entrenamiento, **Then** recibe los componentes comunes y sigue funcionando, pero su rediseño completo (plan semanal incluido) es la spec 018.

---

### User Story 4 - Navegación coherente (Priority: P2)

En escritorio hay un menú lateral y en celular una barra inferior, con las mismas secciones y los mismos nombres, de modo que la persona siempre sabe dónde está y llega a lo que más usa en un toque. La dirección elegida puede reorganizar qué secciones van en el primer nivel y cuáles en «Más».

**Why this priority**: el autor dijo que no le cierra «cómo se maneja la página». La navegación es lo que más pesa en esa sensación, pero depende de la dirección elegida (US1).

**Independent Test**: desde el inicio llegar a registrar una comida, empezar un entrenamiento y registrar el peso contando los toques, en escritorio y en celular; comprobar que la sección actual está marcada en texto y no solo por color.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla privada, **Then** el menú muestra las mismas secciones, con los mismos nombres y orden en escritorio y celular, y marca la actual (en texto y forma).
2. **Given** las tres acciones más usadas (registrar comida, empezar entrenamiento, registrar peso), **Then** se llega a cada una desde el inicio en dos toques o menos.
3. **Given** el primer ingreso (spec 014), **Then** no hay menú hasta completarlo, como hoy.
4. **Given** un teclado o un lector de pantalla, **Then** el menú se recorre completo y anuncia la sección actual.

---

### User Story 5 - Estados de carga, vacío y error iguales en todas partes (Priority: P2)

Cuando una pantalla o un bloque está cargando, vacío o falló, la persona ve el mismo tipo de mensaje y de acción en todas las pantallas: qué pasa, qué puede hacer y un botón de reintento si corresponde. Un bloque que falla no rompe el resto de la pantalla.

**Why this priority**: es parte de la coherencia, y los estados vacíos son los que más se notan en una cuenta nueva (como la que va a ver cualquier persona al empezar).

**Independent Test**: provocar en cada pantalla los tres estados (sin datos, cargando, error de red) y comprobar que usan las piezas comunes y que el resto de la pantalla sigue usable.

**Acceptance Scenarios**:

1. **Given** una lista sin elementos, **Then** muestra el estado vacío común con una acción para crear el primer elemento.
2. **Given** un bloque que falla al cargar, **Then** muestra el estado de error común con «Reintentar» y el resto de la pantalla sigue funcionando.
3. **Given** un bloque cargando, **Then** muestra el estado de carga común sin mover el resto de la pantalla.
4. **Given** cualquier mensaje de estos, **Then** es neutral y no culpa a la persona.

---

### Edge Cases

- La dirección elegida no sirve para alguna pantalla densa (tabla de alimentos, lista larga de ejercicios): se adapta esa pantalla sin romper el sistema, y se documenta la excepción.
- Un texto largo (nombre de alimento o de ejercicio muy largo, palabra sin cortes) no desborda ni tapa un botón.
- Tamaño de letra del sistema operativo aumentado o zoom del navegador al 200 %: la pantalla sigue usable sin pérdida de contenido.
- La persona usa solo teclado, o un lector de pantalla, o reduce las animaciones en su sistema: todo se puede hacer y no hay movimiento que no se pueda desactivar.
- Contraste insuficiente en la dirección elegida: se corrige el color antes de aceptarla; el criterio de accesibilidad prevalece sobre la estética.
- Una pantalla de una spec posterior (entrenamiento, fotos, suplementos, recordatorios) no existe todavía: el sistema las prevé con piezas comunes y no se anticipa nada más.
- Los gráficos del sistema se muestran con pocos datos o con ninguno: dicen cuántos datos hay y no inventan líneas ni conclusiones.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Antes de implementar, el sistema MUST ofrecer una exploración con al menos tres alternativas de dirección visual, aplicadas a las mismas pantallas de la app con datos de ejemplo, en escritorio y celular, para que la persona elija o combine.
- **FR-002**: La dirección elegida MUST quedar documentada (qué se eligió, qué se descartó y por qué) antes de empezar la implementación, y MUST poder cambiar la paleta, el tipo de letra, la estructura de las pantallas y la navegación actuales.
- **FR-003**: El sistema MUST definir valores comunes de color, tipografía, espaciado, formas y elevación, y las demás piezas MUST usarlos sin valores sueltos en las pantallas.
- **FR-004**: El sistema MUST ofrecer como piezas comunes: tarjeta, lista, formulario y campos, encabezado de pantalla, botones, etiquetas de estado, avisos, estado vacío, estado de carga, estado de error y gráfico.
- **FR-005**: MUST existir una página de referencia interna que muestre cada pieza en todos sus estados y diga cuándo usarla.
- **FR-006**: Todas las pantallas existentes (inicio con semana y panel del día, comidas, alimentos y detalle, ejercicios y detalle, sueño y actividad, medidas, objetivo calórico y plan, perfil, primer ingreso, registro, inicio de sesión y recuperación de cuenta) MUST usar las piezas comunes.
- **FR-007**: Cada pantalla MUST conservar todas las acciones, datos y significados que tenía; el rediseño MUST NOT agregar funciones, quitar funciones ni cambiar datos guardados.
- **FR-008**: La pestaña Entrenamiento MUST recibir las piezas comunes y seguir funcionando; su rediseño completo queda para la spec 018.
- **FR-009**: La navegación MUST ser la misma en escritorio (menú lateral) y celular (barra inferior): mismas secciones, nombres y orden, con la sección actual marcada en texto y forma.
- **FR-010**: Registrar una comida, empezar un entrenamiento y registrar el peso MUST poder hacerse desde el inicio en dos toques o menos.
- **FR-011**: Durante el primer ingreso (spec 014) el menú MUST seguir oculto hasta completarlo.
- **FR-012**: Los estados de carga, vacío y error MUST usar las piezas comunes en todas las pantallas; un bloque con error MUST ofrecer «Reintentar» y MUST NOT romper el resto de la pantalla.
- **FR-013**: Los estados de calorías, peso, entrenamiento y rendimiento MUST decirse en texto y con una forma distinta y MUST NOT usar rojo y verde como juicio (Principio IV).
- **FR-014**: Todas las pantallas MUST cumplir WCAG 2.1 AA: contraste suficiente, foco visible, etiquetas accesibles, nada que dependa solo del color y respeto de la preferencia de reducir movimiento.
- **FR-015**: Ninguna pantalla MUST tener desplazamiento horizontal a 375 px de ancho, ni a 200 % de zoom.
- **FR-016**: Los textos nuevos o cambiados MUST estar en español, con tuteo, neutrales y sin términos prohibidos por la Constitution (sin culpa, logro ni juicio sobre comida, cuerpo o rendimiento).
- **FR-017**: Las pruebas funcionales existentes MUST seguir pasando; un cambio en una prueba MUST limitarse a la estructura visual (por ejemplo cómo se localiza un elemento), nunca a lo que la prueba verifica.
- **FR-018**: El rediseño MUST NOT agregar tablas, columnas ni funciones de base de datos, ni servicios externos, ni depender de más de lo que el alojamiento gratuito ya soporta.
- **FR-019**: Si la exploración o el recorrido descubren una función que falta (no un problema de apariencia), MUST registrarse como propuesta de spec aparte y MUST NOT incluirse en esta.
- **FR-020**: La aplicación MUST seguir siendo una app instalable (PWA) y sus colores de tema y de inicio MUST coincidir con la dirección elegida.

### Key Entities

- **Dirección visual**: decisión de diseño elegida por la persona: paleta, tipografía, forma de las tarjetas, jerarquía de las pantallas, estructura de navegación y motivos de la elección. Se documenta en la spec; no es un dato de la aplicación.
- **Sistema de componentes**: conjunto de piezas reutilizables y sus valores comunes (color, tipografía, espaciado, formas). Se documenta con una página de referencia; no es un dato de la aplicación.
- **Pantalla**: cada vista de la aplicación con su inventario de acciones y datos, que sirve de lista de comprobación para confirmar que nada se perdió.

No hay entidades de datos nuevas ni se modifican las existentes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El autor elige una dirección visual de entre al menos tres alternativas antes de que empiece la implementación, y no necesita más de dos rondas de exploración.
- **SC-002**: El 100 % de las pantallas de la lista (FR-006) usa las piezas comunes; una búsqueda de estilos sueltos en esas pantallas no encuentra valores de color, tamaño ni espaciado fuera del sistema.
- **SC-003**: El 100 % de las acciones que existían antes del rediseño sigue disponible, comprobado contra un inventario por pantalla.
- **SC-004**: Todas las pruebas funcionales existentes pasan después del rediseño y ninguna cambia lo que verifica.
- **SC-005**: Cero violaciones de accesibilidad graves o críticas en todas las pantallas, en escritorio y en celular.
- **SC-006**: Cero desplazamientos horizontales en todas las pantallas a 375 px de ancho.
- **SC-007**: Registrar una comida, empezar un entrenamiento y registrar el peso se hace en dos toques o menos desde el inicio, en escritorio y en celular.
- **SC-008**: Después de recorrer la aplicación completa en su nueva versión, el autor la aprueba o indica ajustes concretos; la spec no se da por cerrada sin esa aprobación.

## Assumptions

- Es una spec de apariencia y de experiencia: no cambia datos ni agrega funciones. La paleta negro y azul de la spec 016 es el punto de partida, no un límite.
- Hay un solo tema (oscuro). El modo claro queda fuera; si la dirección elegida lo justifica se propone como spec aparte.
- La elección de la dirección visual la hace el autor mirando las maquetas; no hay pruebas con otras personas en esta spec.
- La pestaña Entrenamiento se rehace en la spec 018 con este sistema; mientras tanto solo recibe las piezas comunes.
- Las pantallas de las specs 019 a 023 se construyen con el sistema resultante; esta spec no las anticipa más que prever sus piezas (gráfico, aviso, lista con marca diaria).
- El tipo de letra, los íconos y los gráficos deben ser servibles sin costo y sin servicios externos en ejecución.
- Se mantiene el idioma español y el sistema métrico.

## Out of Scope

- Modo claro.
- Rediseño completo de la pestaña Entrenamiento y plan semanal (spec 018).
- Funciones nuevas, cambios de datos o de reglas de negocio.
- Animaciones decorativas.
- Un logotipo o identidad de marca nuevos, salvo que la dirección elegida los incluya como ajuste mínimo del encabezado.
- Pruebas de usabilidad con otras personas.

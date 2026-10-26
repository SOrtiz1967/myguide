# Feature Specification: Sueño, pasos y actividad (registro manual)

**Feature Branch**: `007-sueno-pasos-actividad`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Sueño, pasos y actividad de MyGuide (spec 007 del roadmap, registro manual; Principios IV, V y VI). La persona registra a mano, por día, cuánto durmió, cuántos pasos dio y cuántos minutos de actividad hizo, con su fuente y su fecha. Ve el último valor de cada uno y el historial, y puede corregir o eliminar un registro. Los datos que faltan se muestran como faltantes, no se suman fuentes distintas y no hay metas, gráficos, puntajes ni juicios. Las integraciones automáticas con otros dispositivos quedan fuera."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar el sueño de una noche (Priority: P1)

La persona anota cuánto durmió (horas y minutos) y la fecha en que se despertó (por omisión hoy), con una nota opcional. Lo ve en su historial con su unidad y su fecha. Si ya había un valor para ese día, el nuevo lo reemplaza.

**Why this priority**: Es el dato de recuperación más útil para cruzar más adelante con el entrenamiento y la comida, y alcanza para empezar.

**Independent Test**: Registrar «7:30» hoy y «6:45» de hace dos días; verlos en el historial del más reciente al más antiguo; registrar «8:00» otra vez hoy y ver que hoy queda un solo valor.

**Acceptance Scenarios**:

1. **Given** la pantalla de actividad, **When** escribe 7:30 (o 7,5 horas) y guarda, **Then** aparece «7 h 30 min» con la fecha de hoy.
2. **Given** un valor ya registrado hoy, **When** guarda otro para hoy, **Then** queda un solo valor (el último).
3. **Given** un valor vacío, un texto o fuera de rango, **When** guarda, **Then** se rechaza con un mensaje claro y no se guarda nada.
4. **Given** una fecha futura, **When** guarda, **Then** se rechaza.
5. **Given** un doble clic o un reintento tras un corte de red, **When** llega al servidor, **Then** queda un solo registro.

---

### User Story 2 - Registrar pasos y minutos de actividad (Priority: P2)

La persona anota los pasos del día y los minutos de actividad, de la misma forma que el sueño.

**Why this priority**: Completa la sección, pero el sueño solo ya es útil.

**Independent Test**: Registrar 8 500 pasos y 40 minutos de actividad hoy y verlos en sus historiales.

**Acceptance Scenarios**:

1. **Given** el formulario, **When** elige «Pasos», escribe 8500 y guarda, **Then** se registra «8.500 pasos».
2. **Given** un valor fuera de rango, **When** guarda, **Then** se rechaza explicando el rango.

---

### User Story 3 - Ver lo último, el historial, corregir y eliminar (Priority: P2)

La persona ve, por cada tipo, el último valor con su fecha o «Sin dato», y el historial del tipo elegido por tandas. Puede corregir un registro (valor, fecha y nota) o eliminarlo con confirmación.

**Why this priority**: Mantenimiento y consulta; depende de que ya haya registros.

**Independent Test**: Con registros de los tres tipos, ver el último de cada uno; corregir uno; eliminar otro con confirmación.

**Acceptance Scenarios**:

1. **Given** registros de varios tipos, **When** abre la pantalla, **Then** ve una tarjeta por tipo con su último valor y fecha, o «Sin dato».
2. **Given** el historial, **When** corrige un registro hacia un día que ya tiene valor de ese tipo, **Then** se avisa y no se pisa en silencio.
3. **Given** un registro, **When** lo elimina y confirma, **Then** desaparece y no cambia ningún otro.

---

### Edge Cases

- Un valor por tipo, por día y por fuente; hoy solo existe la fuente «manual» y se muestra con cada registro.
- Un día sin dato dice «Sin dato»; nunca se muestra 0 ni se estima.
- Sueño de una noche que cruza la medianoche: se registra en el día en que la persona se despierta.
- Sin conexión: se avisa, no se permite guardar y el borrador se conserva.
- Cambio de cuenta: no se muestran datos de la cuenta anterior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La persona MUST poder registrar por día el sueño (horas y minutos), los pasos y los minutos de actividad, con fecha y nota opcional.
- **FR-002**: Rangos: sueño de 1 minuto a 24 horas; pasos de 0 a 200.000; actividad de 0 a 1.440 minutos, todos enteros. El sueño se MUST aceptar como `h:mm` o como horas decimales; los demás como números enteros con o sin separador de miles. La validación MUST repetirse en el servidor.
- **FR-003**: La fecha MUST ser hoy (según la zona del perfil) o anterior, desde el año 2000.
- **FR-004**: Habrá como máximo un valor por tipo, por día y por fuente; guardar de nuevo MUST reemplazar el anterior de esa fuente.
- **FR-005**: Cada registro MUST guardar y mostrar su fuente (hoy, «manual»); los valores de fuentes distintas MUST NOT sumarse ni mezclarse.
- **FR-006**: Guardar MUST ser idempotente ante dobles envíos y reintentos.
- **FR-007**: La pantalla MUST mostrar por tipo el último valor con su fecha, o «Sin dato».
- **FR-008**: La persona MUST poder ver el historial de un tipo por tandas, corregir un registro (con aviso si el día ya tiene valor) y eliminarlo con confirmación.
- **FR-009**: Cada valor MUST mostrarse con su unidad, su fecha y su fuente; un dato faltante MUST decir «Sin dato».
- **FR-010**: La aplicación MUST NOT mostrar metas, gráficos, puntajes, comparaciones ni juicios («dormiste poco», «buen día»), ni sugerencias de cambiar hábitos.
- **FR-011**: Los registros son datos de salud: MUST ser privados de cada cuenta, exigir sesión vigente, y el cliente MUST NOT escribir tablas directamente.
- **FR-012**: El formulario MUST conservar un borrador local, borrado al cerrar sesión, e informar los guardados que no llegaron al servidor.
- **FR-013**: Estados de carga, vacío y error; español neutral; accesible; usable en teléfono y escritorio; sin depender solo del color.
- **FR-014**: Al eliminar la cuenta, sus registros MUST eliminarse con ella; los registros técnicos MUST NOT contener valores.

### Key Entities

- **Registro de actividad diaria**: un valor de un tipo (sueño, pasos o minutos de actividad) para un día y una fuente de una cuenta, con nota opcional.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona registra el sueño de anoche en menos de 15 segundos desde que abre la pantalla.
- **SC-002**: El 100 % de los valores fuera de rango, vacíos o con fecha futura es rechazado sin dejar registros.
- **SC-003**: El 100 % de los dobles envíos y reintentos deja un solo registro.
- **SC-004**: En pruebas con dos cuentas, el 100 % de los intentos de ver o cambiar registros de otra cuenta es rechazado.
- **SC-005**: El 100 % de los datos faltantes se muestra como «Sin dato» y el 0 % se completa o suma entre fuentes.
- **SC-006**: Ningún texto contiene juicios, metas ni comparaciones, verificado por revisión y pruebas automáticas.
- **SC-007**: Todas las pantallas se usan en teléfono y escritorio, por teclado y con lector de pantalla, sin errores de accesibilidad graves.

## Assumptions

- Solo registro manual: las integraciones con dispositivos o servicios de salud (decisión pendiente #5 del roadmap) quedan fuera; el campo «fuente» deja la puerta abierta sin implementarlas.
- Un valor por tipo, por día y por fuente. El sueño se atribuye al día en que la persona se despierta.
- La pantalla reutiliza el mismo patrón de la spec 008 (últimas tarjetas, formulario con borrador, historial).
- Sin gráficos ni correlaciones (spec 010); no hay funcionamiento sin conexión (Principio VI).
- Aplicación de uso personal en este MVP, con aislamiento correcto entre cuentas.

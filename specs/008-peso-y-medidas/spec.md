# Feature Specification: Peso y medidas (versión mínima)

**Feature Branch**: `008-peso-y-medidas`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Peso y medidas de MyGuide (spec 008 del roadmap, versión mínima para uso personal; Principios I, IV, V y VI). La persona registra su peso corporal y algunas medidas (cintura, cadera, pecho, brazo, muslo) con su unidad y su fecha, ve el historial y el último valor de cada una, y puede corregir o eliminar un registro. Sin fotos de progreso, sin gráficos, sin tendencias, sin metas y sin juicios: solo los datos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar mi peso (Priority: P1)

La persona anota su peso en kilogramos con la fecha del día (por omisión hoy, o un día pasado) y una nota opcional. Ve el registro en su historial, con la unidad y la fecha. Si ya había un peso ese día, el nuevo reemplaza al anterior.

**Why this priority**: El peso es la medida más pedida y alcanza para empezar a usar la sección.

**Independent Test**: Registrar 72,4 kg hoy y 73,0 kg de hace tres días; ver ambos en el historial del más reciente al más antiguo con «72,4 kg» y la fecha; registrar otra vez hoy 72,1 kg y ver que hoy queda un solo valor.

**Acceptance Scenarios**:

1. **Given** la pantalla de medidas, **When** escribe 72,4 (con coma o punto) y guarda, **Then** el registro aparece hoy con «72,4 kg».
2. **Given** un peso ya registrado hoy, **When** guarda otro valor para hoy, **Then** hoy queda un solo valor (el último guardado), sin duplicados.
3. **Given** un valor fuera de rango (menos de 20 kg o más de 500 kg), un texto o vacío, **When** guarda, **Then** se rechaza con un mensaje claro que explica el rango y no se guarda nada.
4. **Given** una fecha futura, **When** guarda, **Then** se rechaza con un mensaje claro.
5. **Given** un doble clic en «Guardar» o un reintento tras un corte de red, **When** llega al servidor, **Then** se crea un solo registro.

---

### User Story 2 - Registrar otras medidas (Priority: P2)

La persona registra cintura, cadera, pecho, brazo y muslo en centímetros, con fecha y nota opcional, de la misma forma que el peso.

**Why this priority**: Completa la sección con las medidas corporales habituales, pero el peso solo ya es útil.

**Independent Test**: Registrar una cintura de 84 cm y verla en su historial con «84 cm»; probar un valor de 5 cm y ver el rechazo.

**Acceptance Scenarios**:

1. **Given** el formulario, **When** elige «Cintura», escribe 84 y guarda, **Then** se registra «84 cm» con la fecha.
2. **Given** una medida fuera de rango (menos de 10 cm o más de 300 cm), **When** guarda, **Then** se rechaza explicando el rango.

---

### User Story 3 - Ver el historial y el último valor (Priority: P2)

La persona ve, para cada tipo de medida, el último valor con su fecha (o «sin dato» si nunca la registró) y el historial completo del tipo elegido, del más reciente al más antiguo. Puede corregir un registro (cambiar el valor, la fecha o la nota) o eliminarlo con confirmación.

**Why this priority**: Sirve para consultar y mantener los datos; depende de que ya haya registros.

**Independent Test**: Con tres registros de peso y uno de cintura, ver el último de cada medida y «sin dato» en las demás; corregir un valor y comprobar el cambio; eliminar otro con confirmación y comprobar que desaparece.

**Acceptance Scenarios**:

1. **Given** registros de varias medidas, **When** abre la pantalla, **Then** ve una tarjeta por medida con su último valor y su fecha, o «Sin dato».
2. **Given** el historial de una medida, **When** lo abre, **Then** ve cada registro con valor, unidad, fecha y nota, del más reciente al más antiguo, por tandas con «Ver más».
3. **Given** un registro, **When** lo corrige, **Then** se guarda el cambio; si la nueva fecha ya tiene un valor de esa medida, se avisa y no se pisa en silencio.
4. **Given** un registro, **When** lo elimina y confirma, **Then** desaparece y no cambia ningún otro.

---

### Edge Cases

- Varias medidas el mismo día: una por tipo y por día; tipos distintos conviven.
- Sin registros: cada tarjeta dice «Sin dato» y se invita a registrar; no hay «0».
- Valores con coma o punto decimal, con separador de miles o con unidades escritas por error (por ejemplo «72 kg»): se rechazan con mensaje claro.
- Sin conexión: se avisa, no se permite guardar y el borrador del formulario se conserva.
- Cambio de cuenta: nunca se muestran datos de la cuenta anterior.
- Cambio de zona horaria: la fecha ya guardada no se mueve; «hoy» sigue la zona del perfil.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La persona MUST poder registrar su peso corporal en kg y las medidas cintura, cadera, pecho, brazo y muslo en cm, cada una con fecha y nota opcional.
- **FR-002**: El peso MUST estar entre 20 y 500 kg y las demás medidas entre 10 y 300 cm, con un decimal; se MUST aceptar coma o punto decimal y rechazar vacíos, textos y valores fuera de rango con un mensaje que explique el rango; la validación MUST repetirse en el servidor.
- **FR-003**: La fecha MUST ser hoy (según la zona del perfil) o anterior, desde el año 2000; una fecha futura MUST rechazarse.
- **FR-004**: Habrá como máximo un valor por medida y por día: guardar de nuevo en el mismo día MUST reemplazar el valor anterior de esa medida y ese día.
- **FR-005**: Guardar MUST ser idempotente ante dobles envíos y reintentos con el mismo identificador de solicitud.
- **FR-006**: La pantalla MUST mostrar, por medida, el último valor con su fecha o «Sin dato».
- **FR-007**: La persona MUST poder ver el historial de una medida, del más reciente al más antiguo, por tandas, con valor, unidad, fecha y nota.
- **FR-008**: La persona MUST poder corregir un registro (valor, fecha y nota) y eliminarlo con confirmación; corregir hacia una fecha que ya tiene valor de esa medida MUST avisar y no pisarlo en silencio.
- **FR-009**: Cada valor MUST mostrarse con su unidad y su fecha; un dato que falta MUST decir «Sin dato» y nunca completarse ni interpolarse.
- **FR-010**: La aplicación MUST NOT mostrar metas, gráficos, tendencias, diferencias entre registros, índices (como IMC) ni juicios («subiste», «bajaste», «bien», «mal»), ni sugerir cambios de peso; solo los datos.
- **FR-011**: Los registros son datos de salud: MUST ser privados de cada cuenta, exigir sesión vigente y no ser legibles ni modificables por otra cuenta ni por una petición anónima; el cliente MUST NOT escribir tablas directamente.
- **FR-012**: El formulario MUST conservar un borrador local que se borra al cerrar sesión; los guardados que no llegaron al servidor MUST informarse como tales.
- **FR-013**: Todas las pantallas MUST tener estados de carga, vacío y error, estar en español con lenguaje neutral, ser accesibles por teclado y lector de pantalla, usables en teléfono y escritorio, sin depender solo del color.
- **FR-014**: Al eliminar la cuenta, sus registros MUST eliminarse con ella; los registros técnicos MUST NOT contener valores de medidas.
- **FR-015**: Los registros MUST poder usarse desde el inicio: el último peso con su fecha aparece en «Lo último que registraste».

### Key Entities

- **Medida corporal**: un valor de un tipo (peso, cintura, cadera, pecho, brazo o muslo) para un día de una cuenta, con su unidad implícita (kg o cm), nota opcional y la solicitud que lo creó.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona registra su peso de hoy en menos de 15 segundos desde que abre la pantalla de medidas.
- **SC-002**: El 100 % de los intentos de guardar valores fuera de rango, vacíos o con fecha futura es rechazado y no deja registros.
- **SC-003**: El 100 % de los dobles envíos y reintentos con la misma solicitud deja un solo registro.
- **SC-004**: En pruebas con dos cuentas, el 100 % de los intentos de ver o cambiar medidas de otra cuenta es rechazado.
- **SC-005**: El 100 % de los datos faltantes se muestra como «Sin dato» y el 0 % se completa o interpola.
- **SC-006**: Ningún texto de la sección contiene juicios, metas ni comparaciones, verificado por revisión y pruebas automáticas.
- **SC-007**: El historial de una medida con 2 000 registros muestra su primera tanda en menos de 1 segundo.
- **SC-008**: Todas las pantallas se usan en teléfono y escritorio, por teclado y con lector de pantalla, sin errores de accesibilidad graves.

## Assumptions

- Es la versión mínima de la spec 008 del roadmap: las **fotos de progreso**, su procesamiento y la comparación visual quedan para una spec posterior; no hay gráficos ni tendencias (spec 010).
- Solo sistema métrico (kg y cm), el único del perfil hoy; otras unidades quedan para más adelante.
- Un valor por medida y por día; si la persona se pesa varias veces, vale el último que guarde.
- La nota admite hasta 200 caracteres.
- No hay funcionamiento sin conexión (Principio VI).
- Aplicación de uso personal en este MVP, con aislamiento correcto entre cuentas.

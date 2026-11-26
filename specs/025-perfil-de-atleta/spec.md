# Feature Specification: Perfil de atleta

**Feature Branch**: `025-perfil-de-atleta`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Crear un perfil suficientemente completo para que MyGuide adapte sus recomendaciones de entrenamiento y nutrición a cada persona. No es solo el perfil de cuenta: es el contexto deportivo y de objetivos." (`MyGuide_nuevas_specs.md`, spec 025). Decisión de planteo: **extiende** el perfil de la spec 014 (sexo, nacimiento, altura, objetivo único, experiencia, trabajo y días de entrenamiento); no duplica ni vuelve a pedir esos datos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Completar mi contexto deportivo (Priority: P1)

Desde el perfil, la persona agrega lo que MyGuide todavía no sabe: uno o varios objetivos con prioridad, disponibilidad (días, duración, horario, lugar y equipamiento), preferencias de entrenamiento (ejercicios favoritos o evitados, músculos prioritarios) y de alimentación (alimentos evitados, comidas por día), y su contexto de recuperación (horas de sueño habituales, recuperación percibida, pasos aproximados). Todo es opcional salvo lo que ya pide la spec 014.

**Why this priority**: es la base de las specs 027 a 037; sin este contexto las recomendaciones serían genéricas.

**Independent Test**: Con una cuenta que ya hizo el recorrido de la spec 014, abrir el perfil, completar los bloques nuevos, guardar, recargar y comprobar que todo se conserva y que dejar un bloque vacío no impide guardar.

**Acceptance Scenarios**:

1. **Given** un perfil completo según la spec 014, **When** abre la sección «Perfil de atleta», **Then** ve los datos de la 014 (sin pedirlos de nuevo) y los bloques nuevos, todos opcionales.
2. **Given** que elige más de un objetivo, **When** los ordena, **Then** queda una prioridad por objetivo y puede cambiarla; el objetivo principal sigue coincidiendo con el de la spec 014.
3. **Given** el bloque de disponibilidad, **When** indica días, duración, lugar y equipamiento, **Then** se guardan y no se convierten en una restricción obligatoria para ninguna otra función.
4. **Given** ejercicios favoritos o evitados, **When** los busca en el catálogo (spec 005), **Then** los elige desde el catálogo y puede quitarlos.
5. **Given** que borra un dato opcional, **When** guarda, **Then** el dato queda sin valor y ninguna función lo trata como cero.
6. **Given** que no hay conexión o el guardado falla, **When** guarda, **Then** no se muestra como guardado y lo escrito se conserva.

---

### User Story 2 - Cambiar mi perfil sin reescribir el pasado (Priority: P1)

Cuando la persona cambia algo que afecta cálculos futuros (objetivo, días de entrenamiento, disponibilidad), el cambio rige desde una fecha y lo anterior queda como historial.

**Why this priority**: Principio II de la Constitution; un cambio de perfil no debe alterar tendencias ni recomendaciones pasadas.

**Independent Test**: Cambiar los días de entrenamiento de 3 a 5 con vigencia desde hoy y comprobar que el historial muestra el valor anterior con su período y que los datos registrados antes no cambian.

**Acceptance Scenarios**:

1. **Given** un cambio de objetivo o de días de entrenamiento, **When** guarda, **Then** el valor nuevo rige desde hoy (o desde la fecha que elija, nunca anterior a la última vigente) y el anterior queda en el historial con sus fechas.
2. **Given** el historial del perfil, **When** lo consulta, **Then** ve cada valor con su fecha de vigencia y no puede editar el pasado salvo corrigiendo un error de carga explícito.
3. **Given** un cambio de objetivo, **When** guarda, **Then** el objetivo calórico vigente no cambia solo; se ofrece revisarlo (specs 015 y 027).

---

### User Story 3 - Ver y exportar lo que MyGuide sabe de mí (Priority: P2)

La persona ve un resumen legible de su perfil de atleta y puede descargarlo con el resto de sus datos y eliminarlo con la cuenta (spec 011).

**Independent Test**: Completar el perfil, descargar los datos y comprobar que incluyen los bloques nuevos; eliminar la cuenta y comprobar que no queda nada.

**Acceptance Scenarios**:

1. **Given** un perfil de atleta, **When** abre «Tus datos» (spec 011), **Then** la descarga incluye los bloques nuevos con sus vigencias.
2. **Given** que elimina su cuenta, **When** se completa, **Then** también se eliminan sus datos de atleta.

### Edge Cases

- Objetivos repetidos o dos con la misma prioridad: se rechazan y se pide ordenarlos.
- Un ejercicio favorito que luego se elimina del catálogo propio: la preferencia se quita sin romper el perfil.
- Disponibilidad incoherente (por ejemplo, más días de los que tiene la semana): se corrige con un mensaje junto al campo.
- Una cuenta anterior a esta spec: el perfil de atleta aparece vacío salvo los datos de la 014; nada se completa por suposición.
- Objetivo personalizado sin texto: no se acepta; con texto, se limita su largo y se muestra tal cual, sin interpretarlo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El perfil de atleta MUST reutilizar los datos de la spec 014 (sexo, fecha de nacimiento, altura, objetivo, experiencia, trabajo y días de entrenamiento) y MUST NOT pedirlos ni guardarlos por duplicado. El peso actual sale del último registro de Medidas (spec 008).
- **FR-002**: La persona MUST poder elegir uno o más objetivos entre: hipertrofia, fuerza, pérdida gradual de grasa, mantenimiento, recomposición, rendimiento deportivo, condición física y uno personalizado (texto corto), con una prioridad por objetivo. El objetivo principal MUST seguir siendo compatible con el de la spec 014 (ver Assumptions).
- **FR-003**: MUST poder guardar disponibilidad: días por semana, duración por sesión, horario habitual, lugar (gimnasio, casa u otro) y equipamiento disponible.
- **FR-004**: MUST poder guardar preferencias de entrenamiento (ejercicios favoritos y evitados elegidos del catálogo, músculos prioritarios, frecuencia deseada) y de alimentación (alimentos evitados elegidos del catálogo, cantidad habitual de comidas).
- **FR-005**: MUST poder guardar contexto de recuperación y actividad: horas de sueño habituales, recuperación percibida y pasos aproximados.
- **FR-006**: Todo dato nuevo MUST ser opcional; un dato sin completar queda ausente, nunca en cero ni inventado.
- **FR-007**: Los cambios que afecten cálculos futuros (objetivos, días de entrenamiento, disponibilidad) MUST guardarse con fecha de vigencia y conservar el historial; MUST NOT sobrescribir ni reinterpretar datos pasados.
- **FR-008**: Las preferencias (favoritos, evitados, músculos prioritarios) MUST tratarse como sugerencias para otras specs y MUST NOT convertirse en restricciones obligatorias.
- **FR-009**: Cambiar el perfil MUST NOT modificar por sí solo el objetivo calórico ni ningún plan vigente.
- **FR-010**: Cada persona accede solo a sus datos de atleta (aislamiento por cuenta). La exportación y la eliminación de cuenta (spec 011) MUST incluirlos.
- **FR-011**: El guardado MUST ser idempotente y no mostrarse como hecho hasta que el servidor lo confirme.
- **FR-012**: Los textos son neutrales: sin juicios sobre el cuerpo ni el rendimiento. Los datos de salud se piden solo si sirven a una función, y cada bloque explica para qué se usa.
- **FR-013**: La pantalla MUST ser accesible por teclado y lector de pantalla y usable sin desplazamiento horizontal en 360 px.

### Key Entities

- **Perfil de atleta**: contexto deportivo de una persona; extiende el perfil de cuenta (spec 014). Contiene disponibilidad, preferencias y contexto de recuperación, con vigencia por fecha.
- **Objetivo con prioridad**: un objetivo elegido, su orden y su período de vigencia.
- **Preferencia**: favorito o evitado, de ejercicio o de alimento, apuntando al catálogo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona completa todos los bloques nuevos en menos de 3 minutos, y puede guardar con cualquiera de ellos vacío.
- **SC-002**: Ningún dato de la spec 014 se pide dos veces en el flujo.
- **SC-003**: Tras cambiar un valor con vigencia, el historial conserva el anterior con sus fechas en el 100 % de los casos y los registros pasados no se alteran.
- **SC-004**: La descarga de datos y la eliminación de cuenta cubren el 100 % de los datos nuevos.

## Assumptions

- El sexo y la fecha de nacimiento ya son obligatorios por la spec 014 (la estimación calórica los usa); esta spec no los vuelve opcionales. El documento original los trata como opcionales: se aplica lo ya decidido en 014 y se registra como decisión abierta.
- Los tres objetivos de la 014 (ganar músculo, perder grasa, recomposición) se conservan; los objetivos nuevos se agregan en una lista con prioridad y el principal se mapea al de la 014 para no romper el cálculo calórico (spec 015).
- Fuera de alcance: generar rutinas o planes (specs 028, 030, 036), cálculos de macros (027) y avisos (spec 021).
- Depende de las specs 001, 005, 008, 011 y 014.
- Las unidades son las ya usadas (kg, cm); no se agrega selector de unidades en esta spec.

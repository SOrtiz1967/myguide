# Feature Specification: Analizador de rutina

**Feature Branch**: `036-analizador-de-rutina`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Analizar una rutina completa." (`MyGuide_nuevas_specs.md`, spec 036). No impone una rutina única; usa las rutinas de la spec 006, el volumen de la 031 y el perfil de atleta de la 025.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el análisis de una rutina (Priority: P1)

Al abrir una rutina, la persona ve su análisis: frecuencia por grupo muscular, series por grupo, distribución semanal, ejercicios repetidos, duración estimada, intervalos de recuperación entre sesiones del mismo grupo y coincidencia con sus objetivos.

**Why this priority**: permite revisar una rutina antes de ejecutarla, no solo después.

**Independent Test**: Con una rutina de pecho 14 series, espalda 6 y brazos 16, comprobar los conteos y que aparece la observación de distribución desigual.

**Acceptance Scenarios**:

1. **Given** una rutina, **When** abre «Analizar», **Then** ve series y frecuencia por grupo, distribución por día, ejercicios repetidos y duración estimada con su método.
2. **Given** objetivos y músculos prioritarios en el perfil (spec 025), **When** se analiza, **Then** se compara el reparto con esas prioridades.
3. **Given** una rutina sin ejercicios con músculos cargados, **When** se analiza, **Then** esos ejercicios se listan como «sin grupo» y se invita a completarlos.
4. **Given** una rutina vacía, **When** abre «Analizar», **Then** se explica que no hay qué analizar.

---

### User Story 2 - Leer observaciones, no órdenes (Priority: P1)

El análisis incluye observaciones en lenguaje neutral («La rutina concentra más volumen en brazos y pecho que en espalda. Si tu prioridad es un torso equilibrado, podrías redistribuir parte del volumen») y la persona decide qué hacer.

**Independent Test**: Revisar los textos generados para una rutina desbalanceada y comprobar que ninguno impone una rutina ni usa «debés» o «tenés que».

**Acceptance Scenarios**:

1. **Given** una distribución desigual, **When** se analiza, **Then** la observación presenta el dato y una opción, no una orden.
2. **Given** que la persona ignora una observación, **When** vuelve a analizar, **Then** puede mantenerla oculta hasta que cambien los datos.
3. **Given** una rutina sin observaciones, **When** se analiza, **Then** se informa que no se detectó nada que señalar, sin implicar que sea «óptima».

### Edge Cases

- Rutina con ejercicios de duración o cardio: se cuentan aparte y no suman al volumen de fuerza.
- Duración estimada: sin tiempos de descanso definidos, se usa un valor documentado y se indica.
- Rutinas con días rotativos o sin días fijos: se analiza por sesión, no por día de la semana.
- Ejercicios propios con músculos incompletos: el análisis marca la limitación.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST analizarse una rutina: frecuencia y series por grupo muscular, distribución semanal, ejercicios repetidos, duración estimada, descanso entre sesiones del mismo grupo y coincidencia con los objetivos y prioridades del perfil.
- **FR-002**: El cálculo MUST ser determinista y MUST reutilizar la regla de series directas e indirectas de la spec 031.
- **FR-003**: Las observaciones MUST ser neutrales, mostrar el dato que las originó y MUST NOT imponer una rutina única ni usar lenguaje de orden.
- **FR-004**: La duración estimada MUST mostrar su método y supuestos.
- **FR-005**: Ejercicios sin músculos MUST listarse aparte y no inventarse.
- **FR-006**: Una rutina sin observaciones MUST informarlo sin presentarla como «óptima».
- **FR-007**: La persona MUST poder ocultar una observación hasta que cambien los datos de la rutina.
- **FR-008**: El análisis MUST NOT modificar la rutina por sí solo.
- **FR-009**: Cada persona ve solo el análisis de sus rutinas (aislamiento por cuenta).
- **FR-010**: Accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.

### Key Entities

- **Análisis de rutina**: derivado; métricas por grupo, distribución, duración y observaciones, sobre una versión de la rutina.
- **Observación**: dato, texto neutral, estado (visible u oculta).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con rutinas de prueba, los conteos por grupo coinciden con los esperados en el 100 % de los casos.
- **SC-002**: Ningún texto del análisis usa lenguaje de orden (revisión de textos).
- **SC-003**: El análisis de una rutina aparece en menos de 2 segundos.

## Assumptions

- Depende de las specs 005, 006, 025 y 031.
- Fuera de alcance: generar rutinas completas o reemplazar ejercicios automáticamente.
- La IA no es necesaria para el análisis; si luego se quisiera una explicación en lenguaje natural, sería una spec aparte.

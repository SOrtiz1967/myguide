# Feature Specification: PRs y récords personales

**Feature Branch**: `032-prs-records`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Detectar mejoras relevantes." (`MyGuide_nuevas_specs.md`, spec 032). Los récords se conservan históricamente y solo cambian por corrección explícita del registro original.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver un aviso al lograr un récord (Priority: P1)

Al guardar una sesión, si alguna serie supera un récord anterior de ese ejercicio, la persona ve «Nuevo récord» con el tipo y el valor (por ejemplo «Press inclinado, 27,5 kg × 10»).

**Why this priority**: refuerza el seguimiento con un dato real y concreto.

**Independent Test**: Con historial de máximo 25 kg × 10, guardar 27,5 kg × 10 y comprobar que aparece el récord de mayor peso; guardar de nuevo 27,5 × 8 y comprobar que no aparece.

**Acceptance Scenarios**:

1. **Given** historial de un ejercicio, **When** guarda una serie con mayor peso, **Then** se registra un récord de peso con fecha y sesión.
2. **Given** el mismo peso con más repeticiones, **When** guarda, **Then** se registra un récord de repeticiones con ese peso.
3. **Given** el primer registro de un ejercicio, **When** lo guarda, **Then** no se anuncia como récord (no hay base de comparación) y queda como punto de partida.
4. **Given** series por duración o distancia, **When** mejora la marca, **Then** se detecta el récord equivalente.

---

### User Story 2 - Consultar mis récords (Priority: P1)

Por ejercicio, la persona ve sus récords vigentes y su historia: mayor peso, más repeticiones con el mismo peso, mejor volumen, mejor estimación de 1RM y mejor rendimiento dentro de un rango de repeticiones.

**Independent Test**: Abrir un ejercicio con 10 sesiones y comprobar que cada tipo de récord muestra su valor, fecha y sesión de origen.

**Acceptance Scenarios**:

1. **Given** un ejercicio con historial, **When** abre sus récords, **Then** ve cada tipo con valor, fecha y enlace a la sesión.
2. **Given** una estimación de 1RM, **When** la ve, **Then** se indica que es una estimación, con la fórmula y la salvedad de que pierde precisión con muchas repeticiones.
3. **Given** que corrige o elimina el registro que originó un récord, **When** se guarda la corrección, **Then** los récords se recalculan; sin corrección, no cambian.

### Edge Cases

- Series con esfuerzo muy distinto (spec 029): el récord se detecta por los datos objetivos; el esfuerzo se muestra junto al valor.
- Dos series iguales el mismo día: cuenta una sola como récord.
- Ejercicio renombrado o copiado: los récords siguen al ejercicio original; las copias empiezan de cero.
- Series en cualquier orden de carga: se considera el valor, no la posición.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST detectarse al guardar una sesión los récords de: mayor peso, más repeticiones con el mismo peso, mejor volumen (peso × repeticiones) de una serie y de la sesión, mejor estimación de 1RM y mejor rendimiento dentro de un rango de repeticiones.
- **FR-002**: Cada récord MUST guardarse con valor, tipo, fecha y sesión de origen; MUST conservarse históricamente y solo cambiar por corrección explícita del registro original.
- **FR-003**: La estimación de 1RM MUST identificarse como estimación y mostrar su método.
- **FR-004**: El primer registro de un ejercicio MUST NOT anunciarse como récord.
- **FR-005**: El aviso de récord MUST ser sobrio, sin comparaciones con otras personas ni presión por superarlo.
- **FR-006**: La detección MUST ser determinista y no usar IA; es idempotente (guardar dos veces la misma sesión no duplica récords).
- **FR-007**: Corregir o eliminar un registro MUST recalcular los récords afectados y conservar su historia.
- **FR-008**: Cada persona ve solo sus récords (aislamiento por cuenta); entran en exportación y eliminación (spec 011).
- **FR-009**: Accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.

### Key Entities

- **Récord personal**: persona, ejercicio, tipo, valor, fecha, sesión y serie de origen, y vigencia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con historiales de prueba, los récords detectados coinciden con los esperados en el 100 % de los casos.
- **SC-002**: Guardar dos veces la misma sesión no genera récords duplicados.
- **SC-003**: Corregir un registro recalcula los récords afectados en el 100 % de las pruebas.

## Assumptions

- Los rangos de repeticiones para «mejor rendimiento dentro de un rango» se definen en `research.md`.
- Depende de las specs 006 y 012; mejora con la 029.
- Fuera de alcance: rankings entre personas, logros o insignias.

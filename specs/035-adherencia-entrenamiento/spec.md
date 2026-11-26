# Feature Specification: Adherencia al entrenamiento

**Feature Branch**: `035-adherencia-entrenamiento`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Medir cuánto del plan realmente se cumple." (`MyGuide_nuevas_specs.md`, spec 035). Usa el plan semanal de la spec 018 y las sesiones de la 006.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver cuánto cumplí de lo planificado (Priority: P1)

La persona ve sesiones planificadas, realizadas y porcentaje («22 de 24 sesiones realizadas, 91,7 %») para un período a elegir, junto con la frecuencia real y la consistencia semanal.

**Why this priority**: separa «la rutina no funciona» de «todavía no hay consistencia suficiente para evaluarla».

**Independent Test**: Con 4 semanas de plan de 3 sesiones y 11 realizadas, comprobar 11 de 12 y 91,7 %.

**Acceptance Scenarios**:

1. **Given** un plan semanal y sesiones, **When** abre «Adherencia», **Then** ve planificadas, realizadas y porcentaje del período.
2. **Given** sesiones reprogramadas, modificadas o canceladas (spec 006), **When** se calcula, **Then** la regla de conteo está explicada y es la misma en toda la pantalla.
3. **Given** un período sin plan, **When** abre la pantalla, **Then** se informa que no hay plan que comparar y se muestra solo la frecuencia real.
4. **Given** el porcentaje, **When** lo ve, **Then** se redondea a un decimal y se indica el período usado.

---

### User Story 2 - Ver series planificadas contra realizadas (Priority: P2)

La persona compara series planificadas y realizadas por semana y por ejercicio, y ve la consistencia semanal como una serie de barras.

**Independent Test**: Planificar 3 series y registrar 2 para un ejercicio, y comprobar 2 de 3 en la semana.

**Acceptance Scenarios**:

1. **Given** una rutina con series definidas, **When** abre el detalle, **Then** ve series planificadas y realizadas por semana.
2. **Given** pocas semanas de datos, **When** abre la consistencia, **Then** se informa que hay pocos datos y no se concluye nada.
3. **Given** que supera lo planificado, **When** lo ve, **Then** se informa sin juicio y el porcentaje puede pasar de 100 %, indicándolo.

### Edge Cases

- Semana en curso: se marca como incompleta y no baja el promedio.
- Plan cambiado a mitad del período: se calcula con el plan vigente en cada semana (vigencia por fecha).
- Sesión realizada sin estar planificada: cuenta en la frecuencia real y no en el porcentaje, indicándolo.
- Vacaciones o pausa marcadas: se excluyen del período si la persona lo indica.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST calcularse sesiones planificadas, realizadas y porcentaje de adherencia para un período elegible (4, 8 o 12 semanas).
- **FR-002**: MUST calcularse series planificadas contra realizadas, frecuencia real y consistencia semanal.
- **FR-003**: La regla de qué sesiones cuentan (reprogramadas, modificadas, canceladas) MUST estar documentada y mostrarse.
- **FR-004**: El plan de cada semana MUST ser el vigente en esa fecha; cambiar el plan MUST NOT reescribir semanas pasadas.
- **FR-005**: La semana en curso MUST marcarse como incompleta y excluirse del promedio cerrado.
- **FR-006**: La persona MUST poder marcar pausas para excluirlas del cálculo.
- **FR-007**: El cálculo MUST ser determinista y no usar IA; el texto es neutral, sin culpar por incumplir ni presionar.
- **FR-008**: Con pocos datos MUST informarse y no sacar conclusiones.
- **FR-009**: Cada persona ve solo sus datos (aislamiento por cuenta).
- **FR-010**: Accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.

### Key Entities

- **Adherencia del período**: derivada; planificadas, realizadas, porcentaje, período y pausas.
- **Pausa**: rango de fechas que la persona marca para excluir del cálculo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con planes y sesiones de prueba, los porcentajes coinciden con los esperados en el 100 % de los casos.
- **SC-002**: Cambiar el plan no modifica el porcentaje de semanas ya cerradas.
- **SC-003**: Una persona ve su adherencia de las últimas 4 semanas en menos de 10 segundos.

## Assumptions

- Depende de las specs 006, 012 y 018.
- Fuera de alcance: recordatorios por baja adherencia (spec 021, 024) y recomendaciones (spec 037).

# Feature Specification: Detección de estancamiento

**Feature Branch**: `033-deteccion-estancamiento`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Detectar períodos en los que el rendimiento deja de mejorar." (`MyGuide_nuevas_specs.md`, spec 033). Muestra factores observables sin afirmar causalidad (Principio V).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver qué ejercicios están estancados (Priority: P1)

La persona ve los ejercicios con «posible estancamiento»: varias sesiones seguidas sin una mejora clara de peso, repeticiones, volumen o esfuerzo, con el detalle («27,5 kg durante 5 sesiones, rendimiento similar»).

**Why this priority**: ayuda a decidir cuándo revisar un ejercicio, sin juzgar.

**Independent Test**: Con 5 sesiones de 27,5 kg × 9–10 sin mejora, comprobar que aparece «Posible estancamiento»; con una mejora en la última, que no aparece.

**Acceptance Scenarios**:

1. **Given** un ejercicio con al menos el mínimo de sesiones sin mejora, **When** abre «Estancamiento», **Then** ve el ejercicio, las sesiones comparadas y el período.
2. **Given** menos sesiones que el mínimo, **When** abre la pantalla, **Then** no se marca nada y se explica por qué.
3. **Given** una mejora posterior, **When** se recalcula, **Then** el ejercicio sale del listado.
4. **Given** una pausa larga sin entrenar, **When** se calcula, **Then** el tiempo de pausa no cuenta como estancamiento.

---

### User Story 2 - Ver factores observables sin causalidad (Priority: P1)

Junto al estancamiento, la persona ve factores observables del mismo período (volumen sin cambios, esfuerzo elevado, recuperación declarada baja, sueño menor, déficit energético, poca progresión, cambio de frecuencia) presentados como coincidencias, no como causas.

**Independent Test**: Con sueño promedio menor en las dos últimas semanas, comprobar que se muestra como «también se observa…» con período y cantidad de datos, sin la palabra «causa».

**Acceptance Scenarios**:

1. **Given** un estancamiento con datos de sueño, **When** abre el detalle, **Then** lee algo como «También se observa menor sueño promedio durante las últimas dos semanas», con período y cantidad de registros.
2. **Given** datos faltantes (sueño sin registrar), **When** abre el detalle, **Then** el factor se omite o se indica «sin datos», sin suponer.
3. **Given** cualquier factor, **When** lo ve, **Then** el texto nunca afirma que ese factor causó el estancamiento.

### Edge Cases

- Ejercicios nuevos o con rangos de repeticiones que cambiaron: se reinicia la comparación desde el cambio.
- Deload planificado o semana de descarga: la persona puede marcarla y no cuenta.
- Esfuerzo (spec 029) mejorando con igual peso y repeticiones: no es estancamiento; se indica.
- Datos de un solo factor: se muestra solo ese factor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST marcarse un ejercicio como «posible estancamiento» cuando, en un mínimo de sesiones definido en el plan, no hay mejora clara en peso, repeticiones, volumen o esfuerzo.
- **FR-002**: La detección MUST ser determinista, documentada y revisable (`research.md`), y no usar IA.
- **FR-003**: MUST mostrarse el detalle: sesiones comparadas, período y criterio usado.
- **FR-004**: MUST mostrarse factores observables del mismo período (volumen, esfuerzo, recuperación, sueño, balance energético, progresión, frecuencia) con período y cantidad de datos, y MUST NOT afirmar causalidad.
- **FR-005**: Los datos faltantes MUST mostrarse como faltantes y MUST NOT completarse con supuestos (Principio V).
- **FR-006**: Los textos MUST ser neutrales, sin culpar ni presionar; es una observación, no un diagnóstico.
- **FR-007**: La persona MUST poder descartar un aviso y marcar una semana de descarga para que no cuente.
- **FR-008**: Con datos insuficientes MUST informarse y no marcar estancamiento.
- **FR-009**: Cada persona ve solo sus datos (aislamiento por cuenta).
- **FR-010**: Accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.

### Key Entities

- **Aviso de estancamiento**: derivado; ejercicio, sesiones comparadas, período, estado (vigente o descartado).
- **Semana de descarga**: marca de la persona sobre una semana para no contarla.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con historiales de prueba, la detección coincide con lo esperado en el 100 % de los casos.
- **SC-002**: Ningún texto de la pantalla afirma causalidad (revisión de textos).
- **SC-003**: Con menos sesiones que el mínimo, nunca se marca estancamiento.

## Assumptions

- Depende de las specs 006, 012, 007 (sueño) y 029 (esfuerzo, opcional); los factores de balance energético usan la spec 010.
- El mínimo de sesiones y el criterio de «mejora clara» se fijan en `research.md`.
- Fuera de alcance: acciones automáticas sobre la rutina (spec 036) y recomendaciones (spec 037).

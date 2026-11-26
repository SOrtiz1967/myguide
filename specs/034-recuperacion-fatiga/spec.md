# Feature Specification: Recuperación y fatiga

**Feature Branch**: `034-recuperacion-fatiga`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Relacionar entrenamiento con recuperación sin realizar diagnósticos." (`MyGuide_nuevas_specs.md`, spec 034). Principio V: los patrones se presentan como observaciones con período y cantidad de datos, sin causalidad.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar cómo llego y cómo salí del entrenamiento (Priority: P1)

Antes de una sesión, la persona puede indicar sueño percibido, energía, fatiga, estrés y molestias opcionales. Después, rendimiento percibido y dificultad. Todo es opcional y se hace en pocos toques.

**Why this priority**: es el dato de contexto que falta para interpretar el rendimiento.

**Independent Test**: Abrir una sesión, completar el chequeo previo con dos campos, terminar la sesión, completar el posterior, y comprobar que se guardan y se ven en la sesión.

**Acceptance Scenarios**:

1. **Given** una sesión por empezar, **When** abre el chequeo previo, **Then** puede completar cualquier subconjunto de campos o saltearlo.
2. **Given** una sesión terminada, **When** abre el chequeo posterior, **Then** puede indicar rendimiento percibido, sesión completada y dificultad.
3. **Given** un campo sin completar, **When** guarda, **Then** queda sin dato, nunca como valor intermedio.
4. **Given** una molestia indicada, **When** la guarda, **Then** se trata como nota personal: no se interpreta ni se usa como diagnóstico.

---

### User Story 2 - Ver patrones entre recuperación y rendimiento (Priority: P2)

La persona ve patrones como «En tus últimas 8 sesiones de pierna, 4 ocurrieron después de dormir menos de 6 horas. En esas sesiones el rendimiento promedio fue menor», con período, cantidad de datos y la aclaración de que es una relación observada.

**Independent Test**: Con 8 sesiones de prueba, comprobar que el patrón muestra los conteos correctos y no contiene lenguaje causal; con 3 sesiones, que no se muestra.

**Acceptance Scenarios**:

1. **Given** suficientes sesiones con sueño y rendimiento, **When** abre «Recuperación», **Then** ve el patrón con período y cantidad de registros.
2. **Given** pocos datos, **When** abre la pantalla, **Then** se dice que no hay información suficiente.
3. **Given** que la recuperación declarada es baja varios días seguidos, **When** abre la pantalla, **Then** ve un aviso neutral como «Tu recuperación declarada viene siendo baja. Podés revisar tu descanso y tu carga de entrenamiento».

---

### User Story 3 - Señales que merecen atención profesional (Priority: P2)

Si la persona declara molestias o fatiga persistentes durante un período largo, MyGuide lo comunica con neutralidad y sugiere consultar a un profesional, sin diagnosticar.

**Independent Test**: Con 14 días de fatiga alta declarada, comprobar que aparece la sugerencia de consultar sin nombrar ninguna condición.

**Acceptance Scenarios**:

1. **Given** una señal persistente en el período definido, **When** abre «Recuperación», **Then** ve una nota informativa que recomienda apoyo profesional sin diagnóstico.
2. **Given** que la descarta, **When** vuelve, **Then** no se repite hasta que haya una nueva señal.

### Edge Cases

- Sin registro de sueño ese día: el dato falta y el patrón no lo cuenta.
- Chequeos hechos fuera del día de la sesión: se asocian solo a la sesión elegida.
- Sesiones sin chequeo: se cuentan en el rendimiento pero no en el patrón de recuperación.
- Datos de salud sensibles (molestias): texto libre limitado; no se envían a ningún proveedor externo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST poder registrarse, opcionalmente y por sesión, el chequeo previo (sueño percibido, energía, fatiga, estrés, molestias) y el posterior (rendimiento percibido, sesión completada, dificultad).
- **FR-002**: Todos los campos MUST ser opcionales; un campo sin completar MUST quedar sin dato.
- **FR-003**: MUST mostrarse patrones entre recuperación y rendimiento con período y cantidad de registros, como relación observada y MUST NOT afirmar causalidad ni diagnosticar.
- **FR-004**: Los patrones MUST usar el sueño ya registrado (spec 007) y no pedirlo de nuevo; los datos faltantes MUST tratarse como faltantes.
- **FR-005**: Con datos insuficientes MUST informarse y no mostrar un patrón.
- **FR-006**: Ante señales persistentes MUST mostrarse una nota neutral que sugiera apoyo profesional, sin diagnóstico y sin nombrar condiciones.
- **FR-007**: Las molestias y notas MUST ser datos personales protegidos, sin enviarse a proveedores externos.
- **FR-008**: Los registros MUST poder editarse y eliminarse; entran en exportación y eliminación de cuenta (spec 011).
- **FR-009**: El chequeo MUST completarse en pocos toques y ser accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.
- **FR-010**: Cada persona ve solo sus registros (aislamiento por cuenta).

### Key Entities

- **Chequeo de sesión**: previo y posterior, asociado a una sesión de la persona, con campos opcionales.
- **Patrón de recuperación**: derivado; relación observada entre un factor y el rendimiento, con período y conteos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Completar el chequeo previo toma menos de 15 segundos.
- **SC-002**: Ningún texto de patrones o avisos contiene lenguaje causal ni diagnóstico (revisión de textos).
- **SC-003**: Con menos datos que el mínimo, nunca se muestra un patrón.

## Assumptions

- Las escalas (por ejemplo 1 a 5) y el mínimo de sesiones se fijan en `research.md`.
- Depende de las specs 006, 007 y 010; alimenta a las 030, 033 y 037.
- Fuera de alcance: seguimiento de lesiones, integración con dispositivos y diagnóstico alguno.

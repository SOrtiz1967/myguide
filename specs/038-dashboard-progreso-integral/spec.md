# Feature Specification: Dashboard de progreso integral

**Feature Branch**: `038-dashboard-progreso-integral`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Unificar entrenamiento, nutrición, recuperación y evolución física." (`MyGuide_nuevas_specs.md`, spec 038). Convive con «Tendencias» (spec 010) y los gráficos de progreso (spec 012): los integra en una vista de resumen sin reemplazarlos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver cómo voy en 7, 30 o 90 días (Priority: P1)

La persona elige un período y ve en una sola pantalla: entrenamiento (sesiones, adherencia, récords, volumen, ejercicios que progresan y estancados), nutrición (calorías y proteína promedio, adherencia a macros, distribución por comida), recuperación (sueño, energía, fatiga) y evolución (peso, medidas, fotos, tendencia).

**Why this priority**: es la lectura global del progreso.

**Independent Test**: Con 30 días de datos de prueba, comprobar que cada bloque muestra los valores esperados y que cambiar a 7 días los recalcula.

**Acceptance Scenarios**:

1. **Given** datos del período, **When** abre el dashboard, **Then** ve los cuatro bloques con sus métricas y el período elegido.
2. **Given** un bloque sin datos, **When** lo ve, **Then** se indica «sin datos» y se enlaza a donde registrarlos, sin completar con supuestos.
3. **Given** cada métrica, **When** la ve, **Then** muestra unidad, período y cantidad de registros; si el período está incompleto, lo indica.
4. **Given** el tipo de dato, **When** hay fuente manual o integrada, **Then** se identifica la fuente (Principio V).

---

### User Story 2 - Leer un resumen sin afirmaciones causales (Priority: P1)

Arriba del dashboard, un resumen en lenguaje neutral («Peso: estable. Entrenamiento: 12/13 sesiones. PRs: 6. Proteína: 91 % del objetivo promedio. Sueño: 7 h 05 min») y una lectura prudente («mantuviste el peso mientras mejoraste varios indicadores de rendimiento»).

**Independent Test**: Revisar los resúmenes para varios conjuntos de datos y comprobar que describen sin causalidad («mientras», no «porque»), y que con datos insuficientes no se genera lectura.

**Acceptance Scenarios**:

1. **Given** datos suficientes, **When** abre el dashboard, **Then** el resumen muestra cada indicador y una lectura neutral.
2. **Given** datos insuficientes, **When** abre el dashboard, **Then** no se genera lectura y se informa la limitación.
3. **Given** que mejoró un indicador y cambió otro, **When** se redacta la lectura, **Then** no afirma que uno causó al otro.

---

### User Story 3 - Navegar al detalle (Priority: P2)

Cada métrica enlaza a su pantalla de detalle (Tendencias, Medidas, Evolución del ejercicio, Volumen, Récords, etc.) con el mismo período.

**Independent Test**: Tocar «Peso» con 30 días elegidos y comprobar que abre la evolución del peso en los mismos 30 días.

**Acceptance Scenarios**:

1. **Given** una métrica, **When** la toca, **Then** abre su detalle con el período conservado.
2. **Given** que vuelve, **When** regresa al dashboard, **Then** conserva el período elegido.

### Edge Cases

- Cuenta nueva con pocos días: se muestra lo que haya, con aviso de período corto.
- Datos de una sola medición de peso o una sola foto: no se concluye tendencia (Principio V).
- Módulos todavía no disponibles (por ejemplo, récords sin la spec 032): el bloque se omite sin dejar huecos.
- Cambios de zona horaria: los períodos se calculan en la zona de la persona.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST mostrarse por período (7, 30 y 90 días) los bloques de entrenamiento, nutrición, recuperación y evolución con las métricas del documento de origen.
- **FR-002**: Cada métrica MUST mostrar unidad, período, cantidad de registros y fuente; los períodos incompletos MUST indicarse.
- **FR-003**: MUST NOT completarse con valores inventados un dato faltante; MUST mostrarse «sin datos» con acceso a registrarlo.
- **FR-004**: El resumen y la lectura MUST ser neutrales, MUST NOT afirmar causalidad y MUST NOT generarse con datos insuficientes.
- **FR-005**: MUST NOT concluir tendencias a partir de una sola medición de peso, foto o sesión.
- **FR-006**: Las métricas MUST derivarse de los datos y cálculos de las specs previas, sin duplicar su lógica; si una fuente cambia, el dashboard cambia.
- **FR-007**: Cada métrica MUST enlazar a su detalle conservando el período.
- **FR-008**: Los textos MUST ser neutrales; las fotos y datos sensibles MUST NOT enviarse a servicios externos.
- **FR-009**: Cada persona ve solo sus datos (aislamiento por cuenta).
- **FR-010**: Accesible por teclado y lector de pantalla, gráficos con alternativa textual y sin desplazamiento horizontal en 360 px.
- **FR-011**: «Peso estable» MUST evaluarse sobre el promedio móvil de 7 días con una banda de ±0,5 % y un mínimo de pesajes en la ventana, nunca con un pesaje diario aislado; la persona MUST poder ocultar el peso y las calorías.

### Key Entities

- **Resumen de período**: derivado; indicadores de los cuatro bloques con sus conteos y fuentes.
- **Lectura**: texto neutral derivado de los indicadores, sin causalidad.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El dashboard de 30 días se muestra en menos de 3 segundos con un año de datos.
- **SC-002**: Los indicadores coinciden con las pantallas de detalle en el 100 % de las pruebas.
- **SC-003**: Ninguna lectura contiene lenguaje causal (revisión de textos).
- **SC-004**: Una persona encuentra su adherencia y su sueño promedio del mes en menos de 10 segundos.

## Assumptions

- Es la última spec de la fase D; depende de casi todas las anteriores y debe degradarse con elegancia si alguna falta.
- Los bloques con módulos aún no implementados se omiten, no se simulan.
- Fuera de alcance: exportar un reporte a PDF y compartir el dashboard con terceros.

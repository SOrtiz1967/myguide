# Feature Specification: Recomendaciones personalizadas

**Feature Branch**: `037-recomendaciones-personalizadas`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Unificar los datos anteriores en recomendaciones accionables." (`MyGuide_nuevas_specs.md`, spec 037). Principio IV: sugerencias informativas, proporcionales a la calidad de los datos, no coercitivas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver las recomendaciones de la semana (Priority: P1)

La persona ve una lista corta de recomendaciones agrupadas (entrenamiento, volumen, recuperación, nutrición) generadas a partir de sus datos, por ejemplo «Tu press inclinado mejoró 2 sesiones consecutivas. Podés mantener el peso e intentar una repetición más».

**Why this priority**: es lo que convierte los datos en una decisión.

**Independent Test**: Con datos de prueba de dos semanas, comprobar que cada recomendación aparece con su dato, período, confianza y acción, y que con datos insuficientes no aparece ninguna.

**Acceptance Scenarios**:

1. **Given** datos suficientes, **When** abre «Esta semana», **Then** ve recomendaciones agrupadas por área.
2. **Given** una recomendación, **When** la abre, **Then** ve el dato que la originó, el período, el nivel de confianza, la acción sugerida y cómo ignorarla.
3. **Given** datos insuficientes para un área, **When** abre la pantalla, **Then** esa área no genera recomendaciones y lo dice.
4. **Given** una recomendación ignorada, **When** vuelve a la pantalla, **Then** no reaparece mientras los datos no cambien de forma relevante.

---

### User Story 2 - Recomendaciones sobre nutrición sin presión (Priority: P1)

Las recomendaciones de nutrición (por ejemplo, proteína por debajo del objetivo estimado) se redactan sin culpar, sin sugerir restricciones ni compensaciones, y respetan el rango y la incertidumbre del objetivo.

**Independent Test**: Con consumo de proteína por debajo del rango durante 7 días, comprobar que el texto informa el dato sin juicio y sin proponer saltarse comidas; con exceso calórico, que no aparece ninguna recomendación de recorte.

**Acceptance Scenarios**:

1. **Given** proteína promedio bajo el rango objetivo, **When** se genera, **Then** se informa el promedio y el rango y se ofrece una opción neutral.
2. **Given** exceso calórico, **When** se genera, **Then** no se sugiere ayuno, ejercicio compensatorio ni restricción.
3. **Given** datos de pocos días, **When** se genera, **Then** no se recomienda y se informa la limitación.

---

### User Story 3 - Controlar qué recomendaciones recibo (Priority: P2)

La persona puede ocultar tipos de recomendaciones (por ejemplo, nutrición) y ver por qué una recomendación no aparece.

**Independent Test**: Desactivar nutrición y comprobar que no se muestran; volver a activarla y comprobar que reaparecen.

**Acceptance Scenarios**:

1. **Given** que oculta un tipo, **When** abre la pantalla, **Then** no ve ese tipo y se informa que está oculto.
2. **Given** que vuelve a activarlo, **When** abre la pantalla, **Then** reaparece.

### Edge Cases

- Recomendaciones contradictorias entre áreas: se muestra la de mayor confianza y se indica la otra como contexto.
- Sin conexión: se muestran las últimas calculadas con su fecha.
- Datos corregidos después de generar: se recalculan y la recomendación obsoleta desaparece.
- Señales de salud preocupantes (spec 034): se muestran como nota neutral con sugerencia de apoyo profesional.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST generarse recomendaciones por área (entrenamiento, volumen, recuperación, nutrición) a partir de las specs 026 a 036.
- **FR-002**: Cada recomendación MUST mostrar el dato que la originó, el período, el nivel de confianza, la acción sugerida y la opción de ignorarla.
- **FR-003**: MUST NOT generarse recomendaciones con datos insuficientes; MUST informarse la limitación.
- **FR-004**: Las recomendaciones MUST ser sugerencias informativas, sin órdenes, sin diagnósticos y sin atribuir causalidad (Principio IV y V).
- **FR-005**: MUST NOT sugerirse ayuno, ejercicio compensatorio, restricciones extremas ni lenguaje culpabilizante.
- **FR-006**: La generación MUST ser determinista y basada en reglas documentadas; si se usara IA para redactar, MUST recibir solo datos derivados y mínimos y MUST NOT inventar datos ni cifras.
- **FR-007**: Una recomendación ignorada MUST no reaparecer mientras los datos no cambien de forma relevante.
- **FR-008**: La persona MUST poder ocultar tipos de recomendaciones.
- **FR-009**: Las recomendaciones MUST recalcularse cuando cambian los datos y no conservarse como verdad histórica.
- **FR-010**: Cada persona ve solo las suyas (aislamiento por cuenta).
- **FR-011**: Accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.

### Key Entities

- **Recomendación**: área, dato de origen, período, confianza, acción sugerida y estado (visible, ignorada).
- **Preferencia de recomendaciones**: tipos visibles u ocultos por persona.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las recomendaciones de prueba muestra dato, período, confianza y acción.
- **SC-002**: Con datos por debajo del mínimo, ninguna recomendación se genera.
- **SC-003**: Ninguna recomendación contiene lenguaje de orden, culpa o compensación (revisión de textos).

## Assumptions

- Es la última capa antes del dashboard (038); depende de las specs 027, 030, 031, 033, 034 y 035 (cada área aparece cuando existe su spec).
- Los niveles de confianza y los mínimos de datos se definen en `research.md`.
- Fuera de alcance: notificaciones push de recomendaciones (spec 024) y planes completos generados por IA.

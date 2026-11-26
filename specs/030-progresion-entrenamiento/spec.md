# Feature Specification: Progresión automática de entrenamiento

**Feature Branch**: `030-progresion-entrenamiento`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Convertir el historial en una propuesta concreta para la siguiente sesión." (`MyGuide_nuevas_specs.md`, spec 030). La lógica es determinista; la IA no es necesaria.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el objetivo sugerido de cada ejercicio (Priority: P1)

Al preparar o iniciar una sesión, cada ejercicio con historial muestra una sugerencia: peso, rango de repeticiones y una meta («superar el rendimiento anterior sin aumentar peso todavía»), con el motivo.

**Why this priority**: es el valor principal de «decidir qué hacer después» con los datos propios.

**Independent Test**: Con historial «27,5 kg: 10/9/8 reps, ~2 RIR» y rango 8–12, comprobar la sugerencia de mantener el peso y buscar más repeticiones; con el extremo superior alcanzado de forma consistente, la de subir peso y volver a la parte baja del rango.

**Acceptance Scenarios**:

1. **Given** historial reciente del ejercicio, **When** abre la sesión, **Then** ve la sugerencia con peso, rango, meta y el dato que la originó (fecha, series, esfuerzo).
2. **Given** que alcanzó el extremo superior del rango en varias sesiones, **When** abre la sesión, **Then** se sugiere aumentar el peso y volver a la parte baja del rango.
3. **Given** poco historial (menos que el mínimo), **When** abre la sesión, **Then** no se muestra una sugerencia y se dice «sin información suficiente».
4. **Given** que no hay esfuerzo registrado (spec 029), **When** se calcula, **Then** la sugerencia usa peso y repeticiones y lo indica.
5. **Given** una sugerencia, **When** la acepta, la edita o la ignora, **Then** la sesión se registra con lo que la persona haga y la sugerencia no se impone.

---

### User Story 2 - Definir el rango y el criterio de un ejercicio (Priority: P2)

La persona puede definir, por ejercicio, el rango de repeticiones y el incremento de peso (por ejemplo 2,5 kg), y desactivar la sugerencia para ese ejercicio.

**Independent Test**: Cambiar el rango a 6–10 y comprobar que las sugerencias siguientes lo usan.

**Acceptance Scenarios**:

1. **Given** un ejercicio con rango propio, **When** se calcula, **Then** se usa ese rango en lugar del predeterminado.
2. **Given** una sugerencia desactivada, **When** abre la sesión, **Then** no se muestra para ese ejercicio.

### Edge Cases

- Ejercicios por duración o distancia: sin sugerencia de repeticiones; se propone solo superar el valor anterior si hay historial.
- Semanas sin entrenar o cambio de rutina: el historial viejo pierde peso en la decisión; se indica.
- Series descartadas o editadas después: la sugerencia se recalcula con los datos vigentes.
- Peso corporal o ejercicios sin carga: el incremento se aplica a repeticiones, no a peso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada ejercicio con historial suficiente MUST mostrar una sugerencia con peso, rango de repeticiones y meta, y el dato que la originó.
- **FR-002**: La sugerencia MUST calcularse de forma determinista a partir de repeticiones, peso, series, esfuerzo (spec 029), historial, frecuencia, fatiga reciente declarada (spec 034, si existe) y objetivo del ejercicio; MUST NOT usar IA.
- **FR-003**: Las reglas (cuándo mantener, cuándo subir peso, cuándo bajar) y el mínimo de historial MUST estar documentados y ser revisables (`research.md`).
- **FR-004**: La sugerencia MUST ser una propuesta: la persona puede aceptarla, editarla o ignorarla, y el registro real es lo que cuenta.
- **FR-005**: Con datos insuficientes MUST mostrarse «sin información suficiente», no una sugerencia.
- **FR-006**: MUST poder definirse por ejercicio el rango de repeticiones y el incremento, y desactivarse la sugerencia.
- **FR-007**: Cada sugerencia MUST explicar por qué se generó, en lenguaje neutral y sin presionar («podés intentar…»).
- **FR-008**: MUST NOT sugerir aumentos tras una sola sesión buena ni reaccionar a una sola sesión mala.
- **FR-009**: Las sugerencias no se guardan como historial; se recalculan con los datos vigentes y no alteran sesiones pasadas.
- **FR-010**: Accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.

### Key Entities

- **Sugerencia de progresión**: derivada, no persistida; incluye peso, rango, meta y evidencia.
- **Criterio de progresión del ejercicio**: rango de repeticiones, incremento y activación, por persona y ejercicio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con historiales de prueba conocidos, la sugerencia coincide con la esperada en el 100 % de los casos.
- **SC-002**: Una persona entiende por qué se sugiere un cambio sin abrir otra pantalla.
- **SC-003**: Con menos historial que el mínimo, nunca se muestra una sugerencia numérica.

## Assumptions

- Mejora con el esfuerzo (spec 029) pero funciona sin él.
- Depende de las specs 006, 012 y 029; usa la 034 solo si existe.
- Fuera de alcance: plan de entrenamiento completo, deload automático y sugerencias de ejercicios nuevos (spec 036).

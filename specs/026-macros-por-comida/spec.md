# Feature Specification: Macros por comida

**Feature Branch**: `026-macros-por-comida`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Mostrar calorías y macronutrientes de cada comida, no solamente el total diario." (`MyGuide_nuevas_specs.md`, spec 026). Apoya el Principio III de la Constitution (estimaciones transparentes y corregibles).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver los macros de cada comida (Priority: P1)

En el día, cada comida (desayuno, almuerzo, etc.) muestra su total de calorías, proteínas, carbohidratos y grasas, y cada alimento muestra los suyos. Fibra y sodio aparecen solo si el alimento tiene un dato confiable.

**Why this priority**: es lo que pide la persona para entender cómo se reparte lo que come; las demás specs de nutrición lo usan.

**Independent Test**: Registrar arroz, pollo y aceite en una comida y comprobar que la tabla de la comida suma los valores de cada alimento y coincide con el total del día.

**Acceptance Scenarios**:

1. **Given** una comida con varios alimentos, **When** abre el día, **Then** ve por alimento kcal, proteínas, carbohidratos y grasas, y una fila de total por comida.
2. **Given** alimentos sin dato de un macro, **When** se muestra la comida, **Then** ese valor aparece como «sin dato», no como 0, y el total lo indica.
3. **Given** que el total del día es la suma de las comidas, **When** compara, **Then** los totales por comida y el total diario coinciden.
4. **Given** fibra o sodio disponibles solo en algunos alimentos, **When** se muestra, **Then** se informan como «parcial» con la cantidad de alimentos que aportan el dato.

---

### User Story 2 - Ver mi progreso diario de macros (Priority: P1)

Si existe un objetivo de macros (spec 027), el día muestra «Proteína 92 / 140 g», «Carbohidratos 180 / 280 g» y «Grasas 54 / 75 g». Sin objetivo, muestra solo lo consumido.

**Independent Test**: Con y sin objetivo de macros, comprobar que el progreso aparece solo cuando hay objetivo y que superarlo se informa de forma neutral.

**Acceptance Scenarios**:

1. **Given** un objetivo de macros vigente, **When** abre el día, **Then** ve consumido y objetivo (o rango) por macro.
2. **Given** que supera un objetivo, **When** lo ve, **Then** el texto informa la diferencia sin juicios y sin sugerir compensar (Principio IV).
3. **Given** que no hay objetivo, **When** abre el día, **Then** solo ve lo consumido y un acceso para definirlo.

---

### User Story 3 - Macros de comidas estimadas con IA (Priority: P2)

Cuando una comida viene de la estimación con IA (spec 009), se guarda la estimación original, la persona edita cantidades y los macros se recalculan de forma determinista a partir de los valores estructurados; los valores estimados se marcan y se conserva la confirmación.

**Independent Test**: Estimar una comida con IA, cambiar una cantidad, confirmar, y comprobar que los macros se recalcularon sin llamar a la IA, que figura como «estimado» y que la estimación original se conserva.

**Acceptance Scenarios**:

1. **Given** una estimación con IA, **When** edita una cantidad, **Then** los macros se recalculan con los valores por unidad del alimento, sin nueva consulta a la IA.
2. **Given** una comida confirmada, **When** se muestra, **Then** distingue valores estimados, de etiqueta o fuente, y confirmados por la persona.
3. **Given** que la IA no está disponible, **When** registra la comida a mano, **Then** los macros se calculan igual.

### Edge Cases

- Comida con un solo alimento o vacía: se muestra el total sin tabla vacía.
- Cantidades muy pequeñas o grandes: se respeta la precisión de los datos de origen, sin falsa precisión (calorías enteras, macros con un decimal como máximo).
- Alimento propio sin macros cargados: «sin dato», con enlace para completarlo.
- Cambiar la cantidad de un registro pasado: no modifica los otros registros ni el objetivo de ese día.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada comida MUST mostrar calorías, proteínas, carbohidratos y grasas por alimento y en total; fibra y sodio MUST mostrarse solo cuando exista un dato confiable y, si es parcial, indicarlo.
- **FR-002**: Un macro sin dato MUST mostrarse como «sin dato» y MUST NOT contarse como cero sin avisar.
- **FR-003**: La suma de las comidas MUST coincidir con el total del día.
- **FR-004**: Con objetivo de macros vigente (spec 027) MUST mostrarse consumido y objetivo por macro; los objetivos MUST venir de esa spec y no estar fijos en el código. Sin objetivo, solo lo consumido.
- **FR-005**: Superar un objetivo MUST informarse de forma neutral, sin sugerir saltarse comidas, compensar con ejercicio ni restringir (Principio IV).
- **FR-006**: Para comidas estimadas con IA MUST conservarse la estimación original, permitir editar cantidades, recalcular los macros de forma determinista a partir de valores estructurados, marcar los valores estimados y registrar la confirmación de la persona.
- **FR-007**: La IA MUST NOT calcular el total final cuando ya existen cantidades y valores estructurados.
- **FR-008**: Los valores MUST distinguir su origen: estimado, de etiqueta o fuente, o confirmado por la persona (Principio III).
- **FR-009**: Los registros históricos MUST conservar sus macros del momento (instantánea): editar un alimento del catálogo luego no cambia comidas pasadas.
- **FR-010**: Un fallo de la IA MUST NOT impedir el registro manual de la comida.
- **FR-011**: Accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.

### Key Entities

- **Comida del día**: agrupación de registros de una persona en un tipo de comida y una fecha, con totales derivados.
- **Valor nutricional con origen**: calorías y macros de un registro, con su origen (estimado, fuente o confirmado).
- **Objetivo de macros**: ver spec 027; solo se consulta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100 % de los días de prueba, la suma por comida coincide con el total diario.
- **SC-002**: Una persona identifica cuántos gramos de proteína lleva en cada comida en menos de 5 segundos desde el día.
- **SC-003**: Recalcular tras editar una cantidad no hace ninguna consulta a la IA y se refleja de inmediato.
- **SC-004**: Ningún macro sin dato se muestra como 0.

## Assumptions

- Las specs 003, 004 y 009 ya guardan calorías y macros por registro; si faltara algún campo (fibra, sodio), se agrega sin tocar los registros previos.
- Depende de la spec 027 solo para mostrar objetivos; sin ella la spec funciona mostrando lo consumido.
- Fuera de alcance: sugerir alimentos o repartir macros entre comidas (spec 028).

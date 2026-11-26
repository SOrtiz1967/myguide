# Feature Specification: Plan alimentario por día y actividad

**Feature Branch**: `028-plan-alimentario`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Generar una propuesta de distribución alimentaria diaria adaptada al tipo de día. No debe presentarse como dieta médica ni como única forma correcta de comer." (`MyGuide_nuevas_specs.md`, spec 028). Se apoya en la spec 018 (plan semanal de entrenamiento) para saber qué días se entrena.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recibir una propuesta de comidas para el día (Priority: P1)

La persona indica cantidad de comidas, horarios, horario de entrenamiento, alimentos disponibles o excluidos y, opcionalmente, un presupuesto. MyGuide propone una distribución del objetivo del día (spec 027) entre comidas, con alimentos y cantidades concretas, adaptada al tipo de día (descanso, entrenamiento, entrenamiento intenso, alta o baja actividad).

**Why this priority**: es el valor central de la spec; convierte un objetivo en algo que se puede cocinar.

**Independent Test**: Con un objetivo de macros vigente y un plan semanal con un día de pierna, pedir la propuesta de ese día y comprobar que suma dentro del rango del objetivo, usa solo alimentos del catálogo y excluye los marcados.

**Acceptance Scenarios**:

1. **Given** un objetivo vigente y las preferencias, **When** pide una propuesta, **Then** ve las comidas del día con alimentos, cantidades, calorías y macros por comida y el total del día.
2. **Given** un día de entrenamiento y uno de descanso, **When** compara, **Then** los totales pueden diferir y cada diferencia indica su motivo (el modelo), nunca como castigo ni compensación.
3. **Given** alimentos excluidos o evitados (spec 025), **When** se genera, **Then** no aparecen.
4. **Given** que no hay objetivo vigente, **When** intenta generar, **Then** se le ofrece definirlo (spec 027) y no se genera nada.
5. **Given** que el catálogo no alcanza para cubrir un macro, **When** se genera, **Then** se informa la limitación en lugar de inventar valores.

---

### User Story 2 - Editar, sustituir y confirmar (Priority: P1)

La persona edita la propuesta, cambia un alimento por otro equivalente (por ejemplo pollo → carne magra → atún → huevos) y el sistema recalcula calorías y macros; el plan solo vale cuando lo confirma.

**Independent Test**: Sustituir el pollo por atún en una comida y comprobar que los totales se recalculan y que el plan sigue como borrador hasta confirmarlo.

**Acceptance Scenarios**:

1. **Given** una propuesta, **When** sustituye un alimento, **Then** se ofrecen equivalentes del catálogo y los totales se recalculan.
2. **Given** una propuesta editada, **When** la confirma, **Then** queda como plan de ese día; sin confirmar es un borrador.
3. **Given** un plan confirmado, **When** registra lo que realmente comió, **Then** lo registrado (spec 003) prevalece y el plan no se modifica ni se marca como incumplido.

---

### User Story 3 - Plan semanal y lista de compras (Priority: P3)

La persona extiende el plan a la semana y convierte los planes confirmados en una lista de compras con alimentos, cantidades y total semanal.

**Independent Test**: Confirmar planes de 3 días y generar la lista; comprobar que las cantidades por alimento son la suma de los planes.

**Acceptance Scenarios**:

1. **Given** planes confirmados, **When** genera la lista, **Then** ve cada alimento con su cantidad total.
2. **Given** que cambia un plan, **When** vuelve a la lista, **Then** esta se recalcula.

### Edge Cases

- Día sin plan de entrenamiento definido: se trata como actividad estándar, indicándolo.
- Comió más o menos de lo planificado: no se propone compensar al día siguiente ni restringir (Principio IV); el plan de mañana no depende de hoy.
- Plan cuyo total queda fuera del rango del objetivo tras editar: se avisa de forma neutral, se permite igual guardarlo.
- Alimento eliminado del catálogo propio después de confirmar: el plan conserva su nombre y valores del momento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La propuesta MUST partir del objetivo vigente (spec 027) y del tipo de día, derivado del plan semanal de entrenamiento (spec 018) y de la actividad registrada; la persona puede cambiar el tipo de día.
- **FR-002**: La persona MUST poder indicar cantidad de comidas, horarios, horario de entrenamiento, alimentos disponibles, alimentos excluidos y presupuesto opcional; las preferencias de la spec 025 se usan como punto de partida.
- **FR-003**: La distribución y las cantidades MUST calcularse de forma determinista a partir de valores del catálogo (spec 002); la IA, si se usa, solo sugiere combinaciones y MUST NOT calcular los totales.
- **FR-004**: Cada diferencia entre tipos de día MUST mostrar su motivo; MUST NOT presentarse como castigo ni compensación.
- **FR-005**: La persona MUST poder editar, sustituir alimentos por equivalentes del catálogo y ver el recálculo inmediato de calorías y macros.
- **FR-006**: Una propuesta MUST ser borrador hasta que la persona la confirme; el plan confirmado es editable.
- **FR-007**: Planificado y consumido MUST ser datos distintos; el registro real prevalece sobre el plan y MUST NOT modificarse a partir de él.
- **FR-008**: El plan MUST NOT sugerir compensar excesos con restricciones del día siguiente ni usar lenguaje culpabilizante; no se presenta como dieta médica ni como la única forma correcta.
- **FR-009**: La lista de compras MUST sumar cantidades de los planes confirmados y recalcularse al cambiarlos.
- **FR-010**: Un plan confirmado MUST conservar nombres y valores nutricionales del momento (instantánea).
- **FR-011**: Cada persona accede solo a sus planes (aislamiento por cuenta); entran en exportación y eliminación (spec 011).
- **FR-012**: Si falla la IA o el servicio, la persona MUST poder armar el plan a mano.
- **FR-013**: El ajuste de energía por tipo de día (+5 % en días de entrenamiento) MUST estar desactivado por defecto, ser opcional y mostrarse como una opción de planificación, sin presentarse como recomendación científica (no hay evidencia directa; ver `research.md`).
- **FR-014**: La orientación de proteína por comida (0,25–0,4 g/kg por toma) MUST mostrarse como guía suave y nunca como límite ni como fallo.

### Key Entities

- **Plan de comidas del día**: fecha, tipo de día, estado (borrador o confirmado) y comidas.
- **Comida planificada**: orden, horario y alimentos con cantidad y valores del momento.
- **Lista de compras**: alimentos y cantidades derivados de los planes confirmados de un período.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una propuesta de un día se genera y se puede confirmar en menos de 2 minutos.
- **SC-002**: El total propuesto cae dentro del rango del objetivo en el 100 % de las generaciones de prueba con alimentos suficientes.
- **SC-003**: Ninguna propuesta incluye un alimento excluido.
- **SC-004**: Sustituir un alimento actualiza los totales sin recargar la pantalla.

## Assumptions

- Requiere el objetivo de macros (spec 027) y el catálogo con macros (spec 002); sin ellos la función no se ofrece.
- «Tipo de día» tiene cinco valores del documento de origen; la regla para derivarlo del entrenamiento se define en `research.md`.
- Fuera de alcance: dietas médicas, restricciones clínicas, compras en línea y precios (el presupuesto es solo una preferencia).
- Depende de las specs 002, 003, 018, 025 y 027; usa la estimación con IA (spec 009) solo de forma opcional.

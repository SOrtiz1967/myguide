# Feature Specification: Estimación de necesidades de macros según objetivo

**Feature Branch**: `027-necesidades-de-macros`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Calcular una propuesta de calorías y macronutrientes diarios según perfil, objetivo y actividad." (`MyGuide_nuevas_specs.md`, spec 027). Decisión de planteo: **extiende** la spec 015 (cálculo calórico, fórmula Mifflin-St Jeor y proteína sugerida) y la 004 (objetivo calórico vigente); reutiliza el mantenimiento estimado de la 010 para el ajuste con datos reales.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver una propuesta de calorías y macros con su método (Priority: P1)

Con su perfil de atleta (spec 025), la persona ve una propuesta de energía y de proteína, grasas y carbohidratos como rangos, con el método, los supuestos, la fecha y los datos usados. Puede confirmarla, editarla o dejarla.

**Why this priority**: es el objetivo que alimenta macros por comida (026), el plan alimentario (028) y las recomendaciones (037).

**Independent Test**: Con un perfil conocido, comprobar que la propuesta coincide con los números de las pruebas del cálculo (calorías de la 015; macros nuevos) y que confirmar crea objetivos vigentes con fecha.

**Acceptance Scenarios**:

1. **Given** datos suficientes, **When** abre la propuesta, **Then** ve energía como rango (por ejemplo 2.500–2.650 kcal), proteína y grasas como rangos en gramos y carbohidratos como el resto de la energía.
2. **Given** la propuesta, **When** abre «Cómo se calcula», **Then** ve el método, las entradas con los valores de la persona, los supuestos y la fecha del cálculo.
3. **Given** que faltan datos, **When** abre la propuesta, **Then** se dice qué falta y no se muestra una cifra como confiable.
4. **Given** que confirma, **When** guarda, **Then** quedan objetivos de energía y macros vigentes desde hoy, con historial; nada cambia sin su confirmación.
5. **Given** que escribe otros valores, **When** guarda, **Then** se aplican las mismas validaciones de seguridad y se conserva lo que eligió.

---

### User Story 2 - Revisar el objetivo con datos reales (Priority: P2)

Tras suficientes semanas de datos, MyGuide compara el objetivo estimado con el peso real, la actividad y la adherencia, y si hay evidencia suficiente sugiere revisar el objetivo. Nunca reacciona a uno o dos pesajes.

**Independent Test**: Con datos simulados de 8 semanas con peso estable pese a un objetivo de déficit, comprobar que aparece una sugerencia de revisión con su evidencia; con 1 semana de datos, comprobar que no aparece.

**Acceptance Scenarios**:

1. **Given** menos datos que el mínimo, **When** abre la revisión, **Then** dice que no hay información suficiente.
2. **Given** datos suficientes con tendencia incompatible con el objetivo, **When** abre la revisión, **Then** ve la comparación, el período y la cantidad de datos, y una sugerencia que puede ignorar o aceptar.
3. **Given** que acepta, **When** confirma un valor nuevo, **Then** se crea un objetivo nuevo con vigencia desde hoy y el anterior queda en el historial.

---

### User Story 3 - Avisos de seguridad (Priority: P1)

La propuesta evita extremos: no propone déficits agresivos, avisa si faltan datos y nunca se presenta como exacta.

**Independent Test**: Con un perfil de IMC bajo y objetivo de perder grasa, comprobar que la propuesta se mantiene en mantenimiento con una nota informativa.

**Acceptance Scenarios**:

1. **Given** un déficit que cruzaría los pisos de la spec 015 o un IMC menor de 18,5, **When** se calcula, **Then** la propuesta no baja del piso o se mantiene en mantenimiento, con nota informativa y sugerencia de consultar a un profesional.
2. **Given** una persona menor de 18 años, **When** intenta usar la función, **Then** se explica que es solo para adultos.

### Edge Cases

- Peso con pocos registros o muy variable: se advierte y se usa el promedio del período.
- Sin entrenos registrados: se usan los días declarados (como en la spec 015).
- Perfil cambiado de objetivo: la propuesta vigente no cambia sola; se ofrece recalcular.
- Cambios en el perfil durante el cálculo: gana el último dato confirmado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La propuesta MUST usar el perfil de atleta (spec 025), el peso, la altura, la edad, el objetivo, la frecuencia de entrenamiento, la actividad diaria y, si existen, los pasos y la tendencia de peso.
- **FR-002**: La energía MUST reutilizar el método de la spec 015 y presentarse como rango. Proteína y grasas MUST presentarse como rangos en g/kg con su fuente; los carbohidratos como el resto de la energía.
- **FR-003**: MUST mostrar método, supuestos, fecha, rango o incertidumbre y datos usados (Principio V). Ningún valor se presenta como exacto.
- **FR-004**: El cálculo MUST ser determinista y no usar IA.
- **FR-005**: Cambiar un objetivo MUST requerir confirmación explícita; los objetivos de energía y de macros MUST guardarse con vigencia e historial.
- **FR-006**: La revisión con datos reales MUST requerir un mínimo de semanas y de pesajes definido en el plan, usar tendencias (no valores sueltos) y comunicar «sin información suficiente» cuando no se alcance.
- **FR-007**: MUST NOT proponerse déficits agresivos ni valores bajo los pisos de seguridad de la spec 015; se informa de forma neutral (Principio IV).
- **FR-008**: Solo adultos (18 años o más), igual que la spec 015.
- **FR-009**: Los textos son neutrales: sin «deberías», sin promesas de resultado.
- **FR-010**: Cada persona accede solo a sus objetivos (aislamiento por cuenta); entran en exportación y eliminación (spec 011).
- **FR-011**: El guardado es idempotente y no se muestra como hecho hasta la confirmación del servidor.
- **FR-012**: Los rangos de proteína MUST basarse en fuentes citadas: 1,6 g/kg por defecto dentro de 1,4–2,0 g/kg; valores sobre 2,2 g/kg solo como opción en déficit con entrenamiento; para mayores de 65 años no menos de 1,0–1,2 g/kg; con aviso neutral de consultar a un profesional ante enfermedad renal. Grasa, hidratos, fibra y sodio MUST mostrarse como rangos informativos y no como objetivos que «fallan».
- **FR-013**: La tendencia de peso MUST calcularse sobre un promedio móvil de 7 días y exigir un mínimo de pesajes en la ventana; «peso estable» se evalúa con una banda de ±0,5 % sobre ese promedio, declarada como criterio de producto (no hay estudio que fije el umbral).

### Key Entities

- **Objetivo de macros**: energía, proteína, grasas y carbohidratos (rangos), con vigencia, método y entradas usadas.
- **Revisión de objetivo**: comparación entre objetivo y datos reales en un período, con su evidencia y su resultado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con perfiles de prueba conocidos, la propuesta coincide con los valores esperados en el 100 % de los casos.
- **SC-002**: Ninguna propuesta cruza los pisos de seguridad en las pruebas con perfiles extremos.
- **SC-003**: Con menos datos que el mínimo, nunca aparece una sugerencia de revisión.
- **SC-004**: Ningún objetivo cambia sin confirmación de la persona.

## Assumptions

- Los rangos de macros (g/kg de proteína, porcentaje mínimo de grasas) salen de la investigación previa a la implementación (ver «Nota para crear las specs reales» del documento de origen); `research.md` define fórmulas, fuentes, límites y manejo de datos faltantes.
- El objetivo calórico vigente de la spec 004 sigue siendo la fuente para el resumen diario; esta spec le agrega macros.
- Depende de las specs 004, 008, 010, 015 y 025.
- Fuera de alcance: plan de comidas (spec 028) y recomendaciones (spec 037).

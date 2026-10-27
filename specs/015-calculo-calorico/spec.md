# Feature Specification: Cálculo de calorías diarias

**Feature Branch**: `014-onboarding-calculo-rediseno`

**Created**: 2026-10-27

**Status**: Implemented (verificada localmente)

**Input**: "Teniendo todas las variables y los entrenamientos del usuario, se debe poder calcular las calorías necesarias por día." Decisión del usuario: fórmula más entrenos reales, la app propone y la persona confirma; nunca cambia sola (Principio IV; método documentado y revisable, Principio V).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver mi objetivo calórico propuesto y confirmarlo (Priority: P1)

Con sus datos y su objetivo, la persona ve una estimación de sus calorías de mantenimiento, el objetivo diario propuesto, un rango orientativo, los gramos de proteína sugeridos y el método con los datos que intervienen. Puede confirmarlo, escribir otro valor o dejarlo para después.

**Independent Test**: Con un perfil conocido (hombre, 30 años, 175 cm, 75 kg, trabajo mixto, 3 días, intermedio, ganar músculo), comprobar mantenimiento y objetivo contra los números de `calorie.test.ts`, y que confirmar crea el objetivo vigente.

**Acceptance Scenarios**:

1. **Given** datos completos, **When** se muestra la propuesta, **Then** se ven el mantenimiento, el ajuste por objetivo (superávit, déficit o mantenimiento) con su porcentaje, el objetivo propuesto redondeado a 10 kcal, un rango orientativo y la frase «estimación aproximada, puede variar entre personas».
2. **Given** la propuesta, **When** abre «Cómo se calcula», **Then** ve las entradas (edad, sexo, altura, peso, trabajo, entrenos por semana), la fórmula y los pasos con los números de la persona.
3. **Given** entrenos registrados (al menos 4 sesiones realizadas en las últimas 4 semanas), **When** se calcula, **Then** se usa el promedio real de sesiones por semana y se indica «según tus entrenos registrados»; si no, se usan los días declarados y se indica «según los días que indicaste».
4. **Given** objetivo perder grasa, **When** el resultado quedaría por debajo del piso (1 200 kcal mujer, 1 500 kcal hombre) o el IMC es menor de 18,5, **Then** el objetivo propuesto no baja del piso o se mantiene en mantenimiento, con una nota informativa y sugerencia de consultar a un profesional; nunca se propone un déficit extremo.
5. **Given** la propuesta, **When** la confirma, **Then** se guarda con `set_energy_goal`; si elige otro valor, se aplican las mismas reglas de la spec 004 (1 000 a 6 000 kcal).
6. **Given** que no confirma, **When** vuelve a la app, **Then** no se crea ningún objetivo ni se cambia el vigente.
7. **Given** un perfil o peso faltante, **When** abre `/plan`, **Then** se dice qué dato falta y se enlaza al perfil o a Medidas; no se muestra una cifra como si fuera confiable.

## Requirements *(mandatory)*

- **FR-001**: El metabolismo en reposo MUST calcularse con Mifflin-St Jeor: `10·kg + 6,25·cm − 5·edad + 5` (hombre) o `− 161` (mujer).
- **FR-002**: El gasto base MUST ser `reposo × F_base`, con F_base 1,35 (trabajo sentada), 1,50 (mixto) o 1,65 (de pie), sin contar el entrenamiento estructurado.
- **FR-003**: El gasto de entrenamiento MUST sumarse aparte: `(MET − 1) × kg × horas` por sesión, con MET 4,5 y 1 hora, por las sesiones por semana, dividido 7. Se presenta como estimación aproximada.
- **FR-004**: El mantenimiento es la suma de FR-002 y FR-003. El ajuste por objetivo MUST ser: ganar músculo +15 % (principiante), +10 % (intermedia) o +7 % (avanzada), con tope de +500 kcal; perder grasa −17 %; recomposición 0 %.
- **FR-005**: El resultado MUST redondearse a 10 kcal, mostrarse con un rango orientativo de ±10 % y aplicar los pisos y la excepción de IMC de la historia 1.
- **FR-006**: Proteína sugerida: 1,6 a 2,2 g/kg (ganar músculo) o 1,8 a 2,4 g/kg (perder grasa y recomposición), mostrada como rango en gramos y como sugerencia.
- **FR-007**: La propuesta MUST mostrar sus entradas y su método (Principio V). Sin edad, sexo, altura, peso, trabajo, días, experiencia u objetivo no se calcula.
- **FR-008**: El cálculo MUST ser puro y determinista en el cliente; el servidor valida el valor final con las reglas de `set_energy_goal`.
- **FR-009**: Textos neutrales: sin «deberías», sin promesas de peso o físico, sin juicios; la nota de piso es informativa.
- **FR-010**: `/plan` MUST permitir recalcular en cualquier momento con los datos actuales (último peso, perfil y entrenos); desde Objetivo y Perfil hay un enlace.

## Success Criteria

- **SC-001**: Para los casos de la tabla de `calorie.test.ts` el resultado coincide con el cálculo a mano.
- **SC-002**: Ninguna propuesta queda por debajo del piso ni propone déficit con IMC bajo.
- **SC-003**: Confirmar crea exactamente un cambio de objetivo, incluso con reintentos.

## Assumptions

- Los números (F_base, MET, porcentajes, pisos) son convenciones documentadas en `research_notes/.../calculo_calorico.md`; varias no tienen fuente primaria y se marcan como tales en el método.
- Un enfoque adaptativo (contrastar con la tendencia real de peso e ingesta) queda para una spec posterior.

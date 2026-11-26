# Feature Specification: RIR/RPE y esfuerzo por serie

**Feature Branch**: `029-rir-rpe-esfuerzo`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Registrar el esfuerzo real de cada serie para interpretar mejor el rendimiento." (`MyGuide_nuevas_specs.md`, spec 029). Apoya el Principio V (esfuerzo percibido). Hoy cada serie de la spec 006 guarda repeticiones, peso, duración o distancia, sin esfuerzo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar el esfuerzo de cada serie (Priority: P1)

Al cargar una serie, la persona puede indicar su esfuerzo como RIR (repeticiones en reserva) o RPE (esfuerzo percibido), según la escala que prefiera, y una nota opcional. Es opcional: una serie sin esfuerzo sigue siendo válida.

**Why this priority**: es el dato base de la progresión (030), el estancamiento (033) y la recuperación (034).

**Independent Test**: Cargar «27,5 kg × 10, 2 RIR», guardar, reabrir la sesión y comprobar que se conserva; cargar otra sin esfuerzo y comprobar que es válida.

**Acceptance Scenarios**:

1. **Given** una serie con peso y repeticiones, **When** agrega RIR 2, **Then** se guarda y se muestra como «27,5 kg × 10 · 2 RIR».
2. **Given** que la persona prefiere RPE, **When** agrega RPE 8, **Then** se guarda y se muestra en su escala; internamente ambos se representan de forma consistente.
3. **Given** un valor fuera de rango (por ejemplo RIR 15 o RPE 11), **When** intenta guardar, **Then** ve el error junto al campo y no se guarda.
4. **Given** una serie sin esfuerzo, **When** la guarda, **Then** es válida y el esfuerzo queda «sin dato», nunca 0.
5. **Given** que falla el guardado, **When** reintenta, **Then** no se duplica la serie.

---

### User Story 2 - Elegir mi escala y ver el historial con esfuerzo (Priority: P1)

La persona elige RIR o RPE en su perfil; el historial del ejercicio (spec 006) y la evolución (spec 012) muestran el esfuerzo en su escala y no tratan series con distinto esfuerzo como equivalentes.

**Independent Test**: Registrar «27,5 × 10 @ 2 RIR» y «27,5 × 10 @ 0 RIR» y comprobar que en el historial se muestran como rendimientos distintos.

**Acceptance Scenarios**:

1. **Given** dos sesiones con igual peso y repeticiones y distinto esfuerzo, **When** las compara en el historial, **Then** el esfuerzo se muestra junto a cada una y no se las trata como idénticas.
2. **Given** que cambia de RIR a RPE, **When** abre el historial, **Then** los datos anteriores se muestran convertidos o con su escala original indicada, sin perder información.
3. **Given** una sesión con series sin esfuerzo, **When** la ve, **Then** se muestra «sin dato» donde falte.

### Edge Cases

- Series de ejercicios por duración o distancia: el esfuerzo es opcional también.
- Series previas a esta spec: quedan sin esfuerzo, no se completan.
- Convertir RIR↔RPE: la equivalencia usada se documenta en el plan y se muestra a la persona.
- Copiar una sesión desde una rutina o sesión anterior: el esfuerzo no se copia (es un dato real de esa serie).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada serie MUST poder tener un esfuerzo opcional, en RIR o RPE, y una nota opcional.
- **FR-002**: La persona MUST poder elegir su escala preferida; internamente el esfuerzo MUST representarse de forma consistente para poder compararlo.
- **FR-003**: MUST validarse el rango (RIR 0 a 9; RPE 1 a 10, con pasos de 0,5; RIR 10 equivaldría a RPE 0, sin esfuerzo) en la base de datos y en la pantalla.
- **FR-004**: Una serie sin esfuerzo MUST seguir siendo válida y mostrarse como «sin dato».
- **FR-005**: El historial y los gráficos MUST mostrar el esfuerzo junto al peso y las repeticiones, y MUST NOT tratar como equivalentes series con distinto esfuerzo.
- **FR-006**: Las series ya registradas MUST conservarse sin cambios; no se completan con valores supuestos.
- **FR-007**: Cambiar la escala preferida MUST NOT alterar datos guardados.
- **FR-008**: El guardado MUST ser idempotente y no mostrarse como hecho hasta que el servidor lo confirme.
- **FR-009**: El esfuerzo y las notas son datos personales: aislamiento por cuenta, y entran en exportación y eliminación (spec 011).
- **FR-010**: La carga de esfuerzo MUST ser usable en el gimnasio: máximo un toque adicional por serie, accesible por teclado y sin desplazamiento horizontal en 360 px.
- **FR-011**: La pantalla MUST presentar RIR 0–4 (RPE 6–10) como rango principal; valores de RIR mayores a 4 MUST aceptarse pero mostrarse como esfuerzo ligero/aproximado. El texto de ayuda MUST indicar que el esfuerzo percibido tiene un margen de error de alrededor de ±1 repetición, y llegar al fallo MUST NOT ser requisito.

### Key Entities

- **Serie**: ya existe (spec 006); se le suma esfuerzo (valor, escala) y nota opcional.
- **Preferencia de escala**: RIR o RPE, parte del perfil de atleta (spec 025).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cargar el esfuerzo de una serie agrega como máximo un toque o una selección a la carga actual.
- **SC-002**: El 100 % de las series previas a la spec se conservan intactas.
- **SC-003**: Dos series con mismo peso y repeticiones y distinto esfuerzo nunca se muestran como idénticas.

## Assumptions

- La escala preferida vive en el perfil de atleta (spec 025); hasta que exista se usa un valor por defecto (RIR).
- Fuera de alcance: interpretar el esfuerzo (specs 030 y 033) y fatiga previa/posterior a la sesión (spec 034).
- Depende de las specs 006 y 012.
- Ya existe un esfuerzo por **ejercicio** (spec 006, 1 a 10). Se conserva sin cambios; esta spec agrega el esfuerzo por **serie**.

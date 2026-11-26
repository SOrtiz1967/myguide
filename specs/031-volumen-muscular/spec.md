# Feature Specification: Volumen por grupo muscular

**Feature Branch**: `031-volumen-muscular`

**Created**: 2026-11-25

**Status**: Draft

**Input**: "Mostrar cuánto volumen recibe cada grupo muscular." (`MyGuide_nuevas_specs.md`, spec 031). Usa los músculos primarios y secundarios que ya tiene el catálogo de ejercicios (spec 005).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver las series por grupo muscular (Priority: P1)

La persona ve, por semana, cuántas series directas e indirectas recibió cada grupo muscular, la frecuencia semanal y el volumen por sesión.

**Why this priority**: permite ver el reparto real del entrenamiento y es base para el analizador de rutina (036) y las recomendaciones (037).

**Independent Test**: Registrar sesiones con press inclinado (pecho primario, tríceps secundario) y comprobar que las series cuentan como directas para pecho e indirectas para tríceps.

**Acceptance Scenarios**:

1. **Given** sesiones realizadas en una semana, **When** abre «Volumen», **Then** ve por grupo muscular series directas, series indirectas, frecuencia semanal y volumen por sesión.
2. **Given** un ejercicio con músculos primarios y secundarios, **When** se cuenta, **Then** las series cuentan como directas para el primario y como indirectas para el secundario, indicando la regla.
3. **Given** una semana sin series para un grupo, **When** la ve, **Then** muestra 0 series (hubo entrenamiento sin ese grupo) y distingue de «sin datos» (no hubo sesiones).
4. **Given** una sesión planificada pero no realizada, **When** se calcula, **Then** no cuenta.

---

### User Story 2 - Comparar con semanas anteriores (Priority: P1)

La persona compara el volumen de la semana con el promedio de las últimas 4 semanas y ve la tendencia.

**Independent Test**: Con 5 semanas de datos, comprobar que la comparación usa el promedio de las 4 previas y marca la variación.

**Acceptance Scenarios**:

1. **Given** al menos 4 semanas previas, **When** abre «Volumen», **Then** ve cada grupo contra su promedio y la tendencia.
2. **Given** menos semanas que el mínimo, **When** abre la comparación, **Then** se dice que no hay información suficiente.
3. **Given** un volumen alto o bajo, **When** lo ve, **Then** el texto informa el dato y sugiere revisar si es sostenible y si el rendimiento progresa, sin afirmar un número «exacto» necesario.

### Edge Cases

- Ejercicios propios sin músculos cargados: se listan aparte como «sin grupo» y se invita a completarlos.
- Ejercicios cardio o de duración: no cuentan como series de fuerza.
- Series de calentamiento: se cuentan solo si la persona lo decide (opción única, indicada en el plan).
- Semanas incompletas (la actual): se marcan como en curso y no se comparan como cerradas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST calcularse por semana y grupo muscular: series directas, series indirectas, frecuencia (días con series del grupo) y volumen promedio por sesión.
- **FR-002**: La asignación directa/indirecta MUST salir de los músculos primarios y secundarios del ejercicio del momento de la sesión (instantánea) y la regla MUST mostrarse. La spec 006 todavía no guarda esa instantánea de músculos: esta spec la agrega (ver `plan.md`).
- **FR-003**: Solo sesiones realizadas MUST contar.
- **FR-004**: MUST permitir comparar con el promedio de las últimas 4 semanas y mostrar tendencia; con datos insuficientes MUST decirlo.
- **FR-005**: Los textos MUST NOT afirmar cantidades «necesarias»; MUST informar el dato y sugerir revisarlo según el objetivo (Principio IV).
- **FR-006**: El cálculo MUST ser determinista y no usar IA; las semanas cerradas no cambian si se edita el catálogo después.
- **FR-007**: Distinguir 0 series de «sin datos» MUST ser explícito.
- **FR-008**: Los gráficos MUST mostrar fechas, unidades y semanas incompletas indicadas (Principio V).
- **FR-009**: Cada persona ve solo su volumen (aislamiento por cuenta).
- **FR-010**: Accesible por teclado y lector de pantalla, sin desplazamiento horizontal en 360 px.

### Key Entities

- **Volumen semanal por grupo**: derivado, no persistido (o persistido solo como caché recalculable): grupo, semana, series directas, indirectas, frecuencia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con sesiones de prueba, los conteos coinciden con los esperados en el 100 % de los casos.
- **SC-002**: Una persona identifica su grupo con menos series de la semana en menos de 10 segundos.
- **SC-003**: Ninguna pantalla presenta una cantidad como «la» correcta.

## Assumptions

- La lista de grupos musculares es la del catálogo de ejercicios (spec 005); si es muy fina, el plan define cómo agruparlos.
- Fuera de alcance: recomendaciones de volumen ideal (specs 036 y 037).
- Depende de las specs 005, 006 y 012.

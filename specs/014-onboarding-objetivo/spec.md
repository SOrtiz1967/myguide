# Feature Specification: Primer ingreso y objetivo físico

**Feature Branch**: `014-onboarding-calculo-rediseno`

**Created**: 2026-10-27

**Status**: Implemented (verificada localmente)

**Input**: "Cuando un usuario se loguea por primera vez debe pedirle todos los datos (edad, altura, peso, etc.). Luego, dentro de la app, establecer el objetivo: ganancia muscular, pérdida de grasa o recomposición corporal. Con todas las variables y los entrenamientos se calcula las calorías diarias." (Principios IV y V; investigación en `research_notes/Onboarding calorías y vista semanal/`.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Completar mis datos al entrar por primera vez (Priority: P1)

La persona crea su cuenta e ingresa. Antes de usar la app, un recorrido de cuatro pasos le pide sexo, fecha de nacimiento, altura y peso; luego su actividad (trabajo, días de entrenamiento por semana y experiencia); luego su objetivo; y por último le muestra su objetivo calórico propuesto (spec 015) para confirmar.

**Independent Test**: Registrar una cuenta nueva, comprobar que cualquier ruta privada lleva a `/bienvenida`, completar los cuatro pasos y comprobar que el perfil, el primer peso y el objetivo calórico quedan guardados y que la app se abre en el inicio.

**Acceptance Scenarios**:

1. **Given** una cuenta sin recorrido completado, **When** entra a cualquier ruta privada, **Then** ve `/bienvenida` y solo puede completar el recorrido o cerrar sesión.
2. **Given** el paso 1, **When** deja un dato obligatorio vacío o fuera de rango, **Then** ve el error junto al campo y no avanza; cada dato explica para qué se pide.
3. **Given** una fecha de nacimiento que da menos de 18 años, **When** intenta avanzar, **Then** se le explica que la estimación calórica es solo para personas adultas y no se guarda nada.
4. **Given** un paso avanzado, **When** vuelve atrás, **Then** conserva lo escrito; si recarga la página, recupera el borrador local.
5. **Given** el paso final, **When** confirma, **Then** se guardan el perfil, el peso de hoy (primer registro de Medidas) y el objetivo calórico; recién entonces se muestra el inicio.
6. **Given** que el guardado falla o no hay conexión, **When** confirma, **Then** no se muestra como guardado, lo escrito se conserva y reintentar no duplica el peso ni el objetivo.

### User Story 2 - Elegir y cambiar mi objetivo (Priority: P1)

El objetivo físico (ganar músculo, perder grasa, recomposición) se elige en el recorrido y se puede cambiar después desde el perfil, junto con la experiencia, el tipo de trabajo y los días de entrenamiento.

**Acceptance Scenarios**:

1. **Given** un perfil completo, **When** abre `/perfil`, **Then** ve y puede editar el objetivo, la experiencia, el trabajo y los días de entrenamiento.
2. **Given** que cambia el objetivo, **When** guarda, **Then** el objetivo calórico vigente no cambia solo; la app ofrece recalcular (spec 015) y la persona decide.

## Requirements *(mandatory)*

- **FR-001**: Una cuenta sin recorrido completado (`onboarding_completed_at` vacío) MUST ser enviada a `/bienvenida` desde cualquier ruta privada. Mientras se carga o falla la carga del perfil no se redirige: se muestra carga o error con reintento.
- **FR-002**: El recorrido MUST tener cuatro pasos con «Paso n de 4», botón para volver sin perder datos y borrador local (nunca contraseñas).
- **FR-003**: Datos obligatorios: sexo (mujer u hombre; se usa en la fórmula y se explica), fecha de nacimiento (18 a 120 años), altura (50 a 250 cm), peso (rango de la spec 008), trabajo (sentada, mixta, de pie), días de entrenamiento por semana (0 a 7), experiencia (principiante, intermedia, avanzada) y objetivo (ganar músculo, perder grasa, recomposición).
- **FR-004**: La base MUST rechazar completar el recorrido si falta alguno de esos datos o si la persona es menor de 18 años, aunque el cliente no lo valide.
- **FR-005**: Al confirmar se guardan, en este orden y de forma idempotente: peso de hoy, objetivo calórico (si se eligió) y, al final, el perfil con la zona horaria del dispositivo y la marca de recorrido completado. Si algo falla la marca no queda puesta y reintentar no duplica nada. Nada se muestra como guardado hasta que el servidor confirma.
- **FR-006**: El perfil MUST permitir editar objetivo, experiencia, trabajo y días de entrenamiento; cambiarlos no modifica el objetivo calórico por sí solo.
- **FR-007**: Los textos usan lenguaje neutral (sin juicios sobre el cuerpo, la comida o el rendimiento); cada objetivo se describe sin promesas de resultado.
- **FR-008**: Cada persona accede solo a sus datos (RLS existente del perfil); el recorrido no suma tablas con datos de otras cuentas.
- **FR-009**: Accesible por teclado y lector de pantalla, con foco al cambiar de paso, sin desplazamiento horizontal en 360 px.

## Success Criteria

- **SC-001**: Una cuenta nueva completa el recorrido en menos de dos minutos y termina con perfil, peso y objetivo guardados.
- **SC-002**: Ninguna ruta privada se muestra a una cuenta con el recorrido pendiente.
- **SC-003**: Reintentar un guardado fallido nunca duplica el peso ni el objetivo.

## Assumptions

- El sexo se limita a dos valores porque la fórmula de Mifflin-St Jeor los usa; la base ya lo restringe así desde la spec 001.
- Las cuentas existentes también pasan por el recorrido la próxima vez que ingresen; sus datos de perfil previos se conservan como valores iniciales.
- Alcance fuera de esta spec: recordatorio de peso (preferencia, spec 016), fotos, notificaciones push.

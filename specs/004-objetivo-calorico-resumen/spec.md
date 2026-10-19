# Feature Specification: Objetivo calórico y resumen diario

**Feature Branch**: `004-objetivo-calorico-resumen`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Objetivo calórico y resumen diario de MyGuide (spec 004 del roadmap, Principio IV). La persona puede configurar, ver, cambiar y quitar un objetivo de energía diaria (kcal). Mientras no haya objetivo, la app no muestra calorías restantes ni progreso: solo lo consumido. Con objetivo, el resumen del día muestra el objetivo, lo registrado y las calorías restantes calculadas de forma transparente (objetivo menos total registrado del día, con la cuenta visible), diferenciando lo estimado de lo confirmado según el origen de cada ítem y marcando lo que falta (ítems sin dato de energía) para no presentar el total como exacto. Si se supera el objetivo, la app informa la diferencia con lenguaje neutral, sin sugerir saltarse comidas, compensar con ejercicio ni restricciones extremas, sin culpa ni moralizar ni clasificar alimentos. El objetivo se puede revisar y cambiar en cualquier momento, nunca se ajusta solo por fluctuaciones diarias, y cambiar el objetivo no reescribe lo ya mostrado de días pasados. Valores válidos con límites razonables y mensaje claro. Registro de objetivo idempotente, guardados que no llegaron al servidor se informan como tales y los formularios conservan su borrador local. Privacidad: el objetivo es dato de salud, solo lo ve su dueño. Fuera de alcance: calorías de mantenimiento y gasto, recomendaciones automáticas, objetivos de macronutrientes, peso objetivo, estimación con IA, registro sin conexión."

## Clarifications

### Session 2026-10-19

- Q: ¿Qué rango de kcal diarias se admite como objetivo y desde qué valor aparece la nota informativa? → A: De 1.000 a 6.000 kcal; por debajo de 1.200 kcal se muestra una nota informativa y neutral que menciona consultar a un profesional si hay dudas, sin impedir guardar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fijar mi objetivo de energía diaria (Priority: P1)

La persona decide cuántas kilocalorías quiere tomar como referencia por día y las guarda. Puede volver a verlas cuando quiera. Mientras no lo haga, la aplicación sigue funcionando como hasta ahora y no le muestra metas ni calorías restantes.

**Why this priority**: Sin objetivo no hay nada que comparar; es la base de todo el resumen. Y la decisión de tener o no un objetivo es de la persona, no de la aplicación.

**Independent Test**: Con una cuenta nueva, comprobar que el día no muestra objetivo ni restantes; guardar un objetivo de 2.000 kcal y comprobar que se muestra en el resumen del día y al volver a abrir la pantalla del objetivo.

**Acceptance Scenarios**:

1. **Given** una cuenta sin objetivo, **When** la persona ve un día, **Then** ve lo registrado como hasta ahora, sin objetivo, sin barra de progreso y sin calorías restantes, y con una invitación opcional y neutral a fijar un objetivo.
2. **Given** la pantalla del objetivo, **When** la persona escribe 2.000 y guarda, **Then** el objetivo queda guardado, se confirma el guardado y el resumen del día lo muestra.
3. **Given** un valor fuera del rango admitido, vacío, con letras o con decimales, **When** la persona intenta guardar, **Then** se rechaza con un mensaje que explica el rango admitido y no se guarda nada.
4. **Given** que la persona escribe el valor con separador de miles ("2.000") o con coma decimal, **When** guarda, **Then** se interpreta bien.
5. **Given** un doble clic en "Guardar" o un reintento de red, **When** se envía, **Then** se guarda un solo objetivo (sin duplicados en el historial).
6. **Given** que se cortó la conexión al guardar, **When** falla, **Then** la persona ve que no se guardó, el formulario conserva lo escrito y puede reintentar.
7. **Given** que la persona dejó el formulario a medias y volvió a abrir la aplicación, **When** vuelve a la pantalla, **Then** encuentra el borrador local (que se borra al cerrar sesión, spec 001).

---

### User Story 2 - Ver cuánto llevo y cuánto me queda hoy (Priority: P1)

Con un objetivo configurado, el resumen del día muestra tres cifras claras: el objetivo, lo registrado y lo que queda, con la cuenta a la vista ("2.000 − 1.350 = 650 kcal"). Cada día que la persona consulta muestra su propio resumen.

**Why this priority**: Es el valor central de la spec: saber de un vistazo dónde está respecto de su referencia, sin hacer cuentas.

**Independent Test**: Con un objetivo de 2.000 kcal y ítems por 1.350 kcal en el día, comprobar que se ven el objetivo, el registrado, los 650 kcal restantes, la cuenta y el porcentaje; agregar un ítem de 200 kcal y comprobar que todo se actualiza sin recargar.

**Acceptance Scenarios**:

1. **Given** un objetivo de 2.000 kcal y 1.350 kcal registradas, **When** la persona abre el día, **Then** ve "Objetivo 2.000 kcal", "Registrado 1.350 kcal", "Restan 650 kcal", la cuenta que lo explica y el avance como texto ("68 % del objetivo") además de una barra.
2. **Given** el resumen visible, **When** la persona agrega, edita, mueve o elimina un ítem del día, **Then** las cifras del resumen se actualizan al instante con el mismo cálculo.
3. **Given** que la persona navega al día anterior o a una fecha concreta, **When** ve ese día, **Then** el resumen muestra el objetivo que regía ese día y el total de ese día (ver la historia 5).
4. **Given** un día sin ítems y con objetivo, **When** se abre, **Then** el resumen muestra 0 registradas y el objetivo completo como restante, sin tratarlo como un fallo.
5. **Given** que el resumen usa la misma regla del día de la spec 003, **When** es la una de la madrugada y se está registrando el día que se cierra, **Then** el resumen que se muestra es el de ese día y su fecha es visible.
6. **Given** un teléfono, **When** se ve el resumen, **Then** no hay desplazamiento horizontal y el resumen se entiende sin color (el estado se dice con palabras).

---

### User Story 3 - Entender qué tan firme es la cifra (Priority: P1)

La persona sabe cuánto de lo registrado es firme y cuánto es aproximado o está incompleto. El resumen no presenta como exacto un total que no lo es.

**Why this priority**: El Principio IV obliga a calcular las calorías restantes de forma transparente y a diferenciar lo estimado de lo confirmado; es lo que separa un resumen honesto de uno engañoso.

**Independent Test**: Con un día que incluye un ítem sin dato de energía y un ítem estimado pendiente de confirmar, comprobar que el resumen los señala por separado, que dice cuántos ítems faltan y que la cifra restante lleva su aclaración.

**Acceptance Scenarios**:

1. **Given** un ítem del día sin dato de energía, **When** se calcula el resumen, **Then** el resumen indica cuántos ítems no tienen energía y que el restante es "como máximo" la cifra mostrada, en lugar de presentarla como exacta.
2. **Given** ítems estimados pendientes de confirmar (los que traerá la spec 009), **When** se calcula el resumen, **Then** se incluyen en lo registrado pero se muestran aparte ("de los cuales 300 kcal son estimadas y están sin confirmar"), y el restante lleva la aclaración de que depende de esa estimación.
3. **Given** ítems manuales (valores escritos por la persona), **When** se calcula el resumen, **Then** cuentan como cualquier otro ítem confirmado y conservan su marca de origen en la lista.
4. **Given** que todos los ítems tienen energía y están confirmados, **When** se ve el resumen, **Then** no aparece ninguna aclaración de incertidumbre innecesaria.
5. **Given** cualquier resumen, **When** la persona abre "cómo se calcula", **Then** ve la fórmula (objetivo − registrado), qué ítems intervienen y cuáles no (los sin energía), en lenguaje simple.

---

### User Story 4 - Si supero el objetivo, solo se me informa (Priority: P1)

Cuando lo registrado supera el objetivo, la aplicación muestra la diferencia con una frase neutral y no hace nada más: no sugiere saltarse comidas, compensar con ejercicio ni restringir, no usa colores ni íconos de alarma y no juzga ningún alimento.

**Why this priority**: Es una obligación de seguridad de la Constitución (Principio IV) y de la salud de quien usa la aplicación; un mal mensaje aquí puede fomentar conductas perjudiciales.

**Independent Test**: Con un objetivo de 2.000 kcal y 2.250 registradas, comprobar que se muestra "Registraste 250 kcal más que tu objetivo de hoy" (o equivalente factual), sin ninguna recomendación, sin estilo de error y sin ninguna de las palabras prohibidas.

**Acceptance Scenarios**:

1. **Given** un total mayor que el objetivo, **When** se ve el resumen, **Then** se informa la diferencia en kcal con una frase factual y neutral, sin calificar lo ocurrido.
2. **Given** ese mismo estado, **When** se revisa todo el texto de la pantalla, **Then** no hay sugerencias de ayuno, de saltar comidas, de compensar con ejercicio ni de recortes, ni palabras de culpa o juicio, ni clasificación de alimentos en buenos o malos.
3. **Given** ese estado, **When** se ve la barra de avance, **Then** llega al tope sin cambiar a un estilo de alarma (sin rojo de error ni íconos de advertencia).
4. **Given** que se superó el objetivo varios días seguidos, **When** la persona ve cualquier día, **Then** la aplicación no cambia el objetivo, no agrega avisos ni muestra rachas o castigos.
5. **Given** que el objetivo es menor a 1.200 kcal (ver FR-005), **When** se guarda o se ve, **Then** una nota informativa, sin tono de orden ni diagnóstico, menciona que ante dudas sobre la alimentación conviene consultar a un profesional.

---

### User Story 5 - Revisar, cambiar o quitar el objetivo sin alterar el pasado (Priority: P2)

La persona puede cambiar su objetivo cuando lo decida, o quitarlo. El cambio rige desde hoy; los días anteriores siguen mostrando el objetivo que tenían. La aplicación nunca lo modifica por su cuenta.

**Why this priority**: Los objetivos se revisan con el tiempo (Principio IV) y el historial debe seguir siendo fiel (Principio II); pero se puede usar la aplicación bien con un solo objetivo fijo, por eso va después de lo esencial.

**Independent Test**: Con 2.000 kcal vigentes desde hace una semana, cambiar a 1.800 hoy y comprobar que hoy y los días siguientes usan 1.800 y que ayer sigue mostrando 2.000; quitar el objetivo y comprobar que hoy deja de mostrar restantes mientras ayer conserva el suyo.

**Acceptance Scenarios**:

1. **Given** un objetivo vigente, **When** la persona abre la pantalla del objetivo, **Then** ve el valor actual, desde cuándo rige y puede cambiarlo.
2. **Given** que cambia el valor, **When** guarda, **Then** el nuevo valor rige desde el día de hoy (en la zona horaria del perfil) y los días anteriores conservan el valor que tenían.
3. **Given** que cambia el valor dos veces el mismo día, **When** ve ese día, **Then** rige el último valor guardado.
4. **Given** un objetivo vigente, **When** la persona elige quitarlo y confirma, **Then** desde hoy no hay objetivo (ni progreso ni restantes) y los días anteriores conservan el suyo.
5. **Given** que la persona quita el objetivo, **When** vuelve a fijar uno, **Then** rige desde ese día y los días intermedios sin objetivo quedan sin objetivo.
6. **Given** días anteriores a la primera vez que se fijó un objetivo, **When** se ven, **Then** muestran solo lo registrado.
7. **Given** cualquier uso, **When** pasa el tiempo, **Then** la aplicación nunca cambia el valor por sí sola (ni por fluctuaciones diarias, ni por superar el objetivo, ni por otros datos).
8. **Given** una fecha futura cercana (hasta 7 días, spec 003), **When** se ve, **Then** muestra el objetivo vigente hoy.

---

### Edge Cases

- Una persona sin objetivo nunca ve calorías restantes, porcentaje ni barra, ni siquiera ocultos o en cero.
- Objetivo con total registrado exactamente igual: restan 0 kcal y se dice así, sin frase de exceso.
- Un día con muchos ítems (por ejemplo, 60): el resumen se calcula igual y la vista sigue cumpliendo el tiempo de la spec 003.
- Un ítem con energía 0 (por ejemplo, agua) cuenta como 0 y no como "sin dato".
- Si cambia el objetivo mientras la persona tiene abierto el día en otra pestaña o dispositivo, al volver a enfocarla se muestra el valor vigente.
- Si la zona horaria del perfil cambia, los días ya vividos conservan su objetivo; el valor que rige hoy se calcula con la zona vigente (como en la spec 003).
- Cambiar el objetivo a la 01:00 mientras se está registrando el día que se cierra: rige desde el día nuevo; el día que se cierra conserva el valor anterior.
- Eliminar un ítem, el alimento de origen o cambiar el catálogo no cambia el objetivo; y el objetivo no modifica ningún ítem.
- Valor que parece un error de tipeo (por ejemplo, 20.000) o menor a 1.000: se rechaza con el rango; no se corrige solo. Un valor de 1.000 a 1.199 se guarda y muestra la nota informativa.
- Sin conexión, la aplicación no permite guardar, no muestra nada como guardado y conserva el borrador (spec 001).
- La sesión vence mientras se edita el objetivo: se pide ingresar de nuevo y el borrador se conserva hasta cerrar sesión.
- Cuentas distintas nunca ven ni cambian el objetivo ni el historial de otra.
- Una persona cierra sesión y otra entra en la misma pestaña (por ejemplo, en un dispositivo compartido): la segunda no ve, ni por un instante, el objetivo ni los ítems de la primera.

## Requirements *(mandatory)*

### Objetivo

- **FR-001**: La persona MUST poder fijar un objetivo de energía diaria, en kilocalorías enteras, ver el valor vigente, cambiarlo y quitarlo.
- **FR-002**: Mientras no haya objetivo vigente en un día, la aplicación MUST mostrar para ese día solo lo registrado y MUST NOT mostrar calorías restantes, porcentaje de avance, barra de progreso ni mensajes sobre el objetivo, salvo una invitación opcional y neutral a fijar uno.
- **FR-003**: El objetivo MUST ser un número entero de kcal; se MUST aceptar el valor escrito con separador de miles o con coma o punto decimal, y rechazar vacíos, textos, negativos y decimales no enteros con un mensaje claro.
- **FR-004**: El objetivo MUST estar entre 1.000 y 6.000 kcal por día, ambos incluidos; fuera de ese rango se MUST rechazar con un mensaje que explique el rango admitido.
- **FR-005**: Cuando el objetivo guardado sea menor a 1.200 kcal, la aplicación MUST mostrar una nota informativa, neutral y sin tono de orden ni diagnóstico, que recomiende consultar a un profesional si hay dudas sobre la alimentación; MUST permitir guardar el valor porque está dentro del rango admitido.
- **FR-006**: Fijar o cambiar el objetivo MUST ser idempotente ante dobles envíos y reintentos (no deja entradas duplicadas en el historial).
- **FR-007**: El objetivo MUST poder revisarse en cualquier momento; la aplicación MUST NOT cambiarlo, sugerirlo ni ajustarlo automáticamente a partir de lo registrado, de fluctuaciones diarias o de superarlo.

### Historial de objetivos (Principio II)

- **FR-008**: Cada día MUST conservar el objetivo que regía ese día: un cambio MUST regir desde el día de hoy en la zona horaria del perfil y MUST NOT alterar el objetivo que se muestra para días anteriores.
- **FR-009**: Si se guarda más de un cambio el mismo día, MUST regir el último guardado para ese día.
- **FR-010**: Quitar el objetivo MUST dejar sin objetivo desde hoy; los días anteriores MUST conservar el suyo, y los días anteriores a la primera vez que se fijó uno MUST mostrar solo lo registrado.
- **FR-011**: Las fechas futuras permitidas por la spec 003 (hasta 7 días) MUST mostrar el objetivo vigente hoy.

### Resumen diario (Principio IV)

- **FR-012**: Con objetivo vigente en el día mostrado, el resumen del día MUST mostrar el objetivo, el total registrado, las calorías restantes y el avance como texto (porcentaje) además de cualquier barra, y MUST mostrar la cuenta que lo explica (objetivo menos registrado).
- **FR-013**: Las calorías restantes MUST ser el objetivo menos la energía registrada del día (suma de los ítems del día con dato de energía), expresadas en kcal enteras, y MUST usar los mismos totales que la vista del día de la spec 003.
- **FR-014**: El resumen MUST actualizarse al agregar, editar, mover o eliminar un ítem, y MUST mostrarse para cualquier día que la persona consulte, incluido el día que se cierra según la regla del día de la spec 003.
- **FR-015**: Si hay ítems del día sin dato de energía, el resumen MUST indicar cuántos son y que las calorías restantes son "como máximo" la cifra mostrada; MUST NOT presentarlas como exactas.
- **FR-016**: Los ítems estimados pendientes de confirmar MUST contarse dentro de lo registrado y MUST mostrarse aparte con su subtotal, con la aclaración de que el restante depende de esa estimación; los ítems manuales, del catálogo y confirmados MUST contarse como confirmados.
- **FR-017**: Cuando todos los ítems tengan energía y estén confirmados, el resumen MUST NOT mostrar aclaraciones de incertidumbre.
- **FR-018**: La aplicación MUST ofrecer una explicación breve de cómo se calcula el resumen (fórmula, ítems incluidos y excluidos).
- **FR-019**: Cuando lo registrado supere el objetivo, la aplicación MUST informar la diferencia con una frase factual y neutral y MUST NOT sugerir saltarse comidas, ayunar, compensar con ejercicio ni restringir, ni usar lenguaje que culpe, juzgue o clasifique alimentos como buenos o malos.
- **FR-020**: El estado de superar el objetivo MUST NOT presentarse con estilo de alarma (colores o íconos de error o advertencia), y la barra de avance MUST llegar a un tope sin cambiar de significado.
- **FR-021**: Cuando lo registrado sea exactamente el objetivo, el resumen MUST decir que restan 0 kcal, sin frase de exceso.
- **FR-022**: La aplicación MUST NOT mostrar rachas, puntajes, insignias ni comparaciones con otras personas relacionadas con el objetivo.

### Privacidad, estados y robustez

- **FR-023**: El objetivo y su historial son datos de salud: MUST ser privados de cada cuenta; ninguna otra cuenta ni petición anónima puede leerlos ni modificarlos, y MUST exigir sesión vigente (spec 001).
- **FR-024**: Los valores MUST validarse también en el servidor, no solo en la pantalla.
- **FR-025**: Los guardados que no llegaron al servidor MUST informarse como tales y el formulario MUST conservar su borrador local, que se borra al cerrar sesión (spec 001).
- **FR-026**: Todas las pantallas y estados nuevos MUST tener estados de carga, vacío, éxito y error, en español, y ser accesibles por teclado y lector de pantalla, sin depender solo del color.
- **FR-027**: Los registros técnicos (logs) MUST NOT contener el valor del objetivo ni datos que identifiquen a la persona.
- **FR-028**: Al eliminar una cuenta, su objetivo y su historial MUST eliminarse con ella.
- **FR-029**: Al cerrar sesión o al entrar con otra cuenta en el mismo navegador, la aplicación MUST NOT conservar ni mostrar datos de la cuenta anterior (objetivo, ítems, fotos), ni siquiera por un instante mientras se cargan los de la nueva.

### Key Entities *(include if feature involves data)*

- **Objetivo de energía diaria**: referencia en kcal enteras elegida por la persona, con la fecha desde la que rige y su dueña o dueño. El conjunto de sus cambios forma un historial; quitar el objetivo también es un cambio del historial. Privado de cada cuenta.
- **Resumen del día** (calculado, no se guarda): para un día dado, el objetivo que regía, el total registrado, cuánto de eso es estimado sin confirmar, cuántos ítems no tienen energía, las calorías restantes o la diferencia y el avance. Se deriva de los ítems de la spec 003 y del historial de objetivos.
- **Ítem registrado** (spec 003): aporta su energía y su origen (manual, del catálogo, estimado o confirmado); esta spec no lo modifica.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Fijar un objetivo por primera vez lleva como máximo 3 interacciones desde la vista del día (abrir el objetivo, escribir el valor, guardar) y menos de 20 segundos en una prueba guiada.
- **SC-002**: Con un objetivo configurado, el resumen del día aparece junto con el resto de la vista del día, sin interacciones extra, y la vista de un día con 60 ítems sigue cargando completa en menos de 2 segundos en un teléfono con conexión móvil típica en el 95 % de los casos (mismo criterio que la spec 003).
- **SC-003**: Las calorías restantes coinciden con "objetivo − suma de la energía de los ítems con dato" en el 100 % de los casos de prueba, incluidos días vacíos, con ítems sin energía, con estimados y con el objetivo superado.
- **SC-004**: Cambiar o quitar el objetivo no modifica el resumen de ningún día anterior en el 100 % de los casos de prueba, incluido un cambio de zona horaria del perfil.
- **SC-005**: En el 100 % de los estados con el objetivo superado, el texto de toda la pantalla no contiene sugerencias de ayuno, de saltar comidas, de compensar con ejercicio ni de recortes, ni lenguaje de culpa o juicio (verificado con una lista de términos prohibidos sobre todo el texto de la pantalla), y no usa estilo de alarma.
- **SC-006**: Ninguna operación repetida (doble clic, reintento) crea entradas duplicadas en el historial en el 100 % de las pruebas de idempotencia.
- **SC-007**: Ninguna cuenta puede leer ni modificar el objetivo ni el historial de otra por ningún camino probado (tablas, funciones y petición anónima), y al cambiar de cuenta en el mismo navegador la segunda nunca ve datos de la primera en el 100 % de las pruebas.
- **SC-008**: Todas las pantallas nuevas pasan la revisión automática de accesibilidad sin problemas graves, se entienden sin depender del color y funcionan en anchos de teléfono y de escritorio sin desplazamiento horizontal.
- **SC-009**: Sin objetivo configurado, el 100 % de las pantallas de prueba no muestra restantes, porcentaje ni barra de progreso.

## Assumptions

- La única persona usuaria del MVP es el autor, pero todo se construye multiusuario y privado por cuenta (como en las specs 001 a 003).
- El objetivo es solo de energía diaria (kcal). Objetivos de macronutrientes, de peso o de agua quedan fuera de esta spec.
- Un solo valor por día; no hay objetivos distintos por día de la semana ni por tipo de día (entrenamiento o descanso).
- "Hoy" se calcula con la zona horaria del perfil; el cambio de objetivo rige desde el día calendario de hoy aunque se esté registrando el día que se cierra (spec 003).
- No se ofrece en esta spec una referencia calórica "sugerida" ni una calculadora de mantenimiento: el perfil no incluye el peso y el cálculo de calorías de mantenimiento requiere un método documentado y datos suficientes (Principio V), por lo que queda para la spec de mantenimiento y gasto (007 u 008). Esta spec solo registra el valor que la persona elige.
- Las calorías de las bebidas, los ítems manuales y los del catálogo cuentan igual; la energía de un ítem es la de su instantánea (spec 003), así que editar el alimento de origen no cambia ningún resumen pasado.
- Los ítems "estimados" llegarán con la spec 009; en esta spec el cálculo y la presentación ya los separan, pero en el uso real todos los ítems son confirmados.
- La aplicación no muestra el resumen en la pantalla de inicio en esta spec; vive en la vista del día. Un resumen de varios días o semanal queda para una spec posterior.
- Sin conexión no se puede guardar el objetivo (spec 001, Principio VI); el borrador se conserva localmente.
- El texto de los mensajes se mantiene en un solo lugar para poder revisarlo contra la lista de términos prohibidos del Principio IV.

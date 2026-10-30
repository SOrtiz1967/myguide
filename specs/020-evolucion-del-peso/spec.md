# Feature Specification: Evolución del peso

**Feature Branch**: `020-evolucion-del-peso`

**Created**: 2026-10-30

**Status**: Draft

**Input**: guía de diseño del autor (2026-10-27): «gráfico del peso con promedio móvil de 7 días y elección de período, con unidades, fechas y cantidad de datos; peso en ayunas opcional y configurable; sin conclusiones a partir de pocos puntos». Roadmap: spec 020, ola 4. Depende de la spec 008 (peso y medidas) y del sistema de la spec 017. Principios: IV, V, VI.

## Clarifications

### Session 2026-10-30

- Q: ¿Dónde se ve la evolución? → A: En la pantalla «Medidas» (`/medidas`), como un bloque «Evolución del peso» sobre el historial, cuando la medida elegida es el peso. No hay una pantalla nueva ni una entrada nueva en el menú.
- Q: ¿Qué es el «promedio de 7 días»? → A: Para cada día con un peso registrado, el promedio de los pesos registrados en los 7 días de calendario que terminan ese día (inclusive). Se muestra solo si en esa ventana hay al menos 3 registros; si no, ese día no tiene promedio. Los días sin registro no se rellenan ni se interpolan.
- Q: ¿Qué períodos hay? → A: Últimos 30 días, 90 días, 6 meses, 1 año y Todo. Por omisión, 90 días. Los períodos terminan hoy (según la zona del perfil).
- Q: ¿Cómo es el peso «en ayunas, opcional y configurable»? → A: Opcional: al registrar o corregir un peso hay una casilla «Lo medí en ayunas»; sin marcar el registro queda «sin indicar» y no se afirma que no lo fuera. Configurable: sobre el gráfico se elige «Todos los pesos» o «Solo en ayunas»; la elección se recuerda en el navegador de la persona. Con «Solo en ayunas» el gráfico y los números usan únicamente los pesos marcados.
- Q: ¿Qué conclusiones muestra? → A: Ninguna. Solo cifras descriptivas del período (cantidad de registros, último peso, promedio de 7 días más reciente si existe, mínimo y máximo con sus fechas). No hay «bajaste», «subiste», tendencias, metas, ni colores de bien o mal.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ver cómo va mi peso en el tiempo (Priority: P1)

La persona abre «Medidas» con el peso elegido y ve un gráfico de sus pesos del período elegido: un punto por cada peso registrado y una línea con el promedio de 7 días. Cada eje tiene su unidad y sus fechas, y debajo se lee cuántos registros hay.

**Why this priority**: es el pedido central: ver la evolución, no solo una lista.

**Independent Test**: con 12 pesos repartidos en 5 semanas, abrir Medidas, ver el gráfico con 12 puntos y la línea del promedio, cambiar el período y comprobar que cambia lo mostrado y la cantidad de registros.

**Acceptance Scenarios**:

1. **Given** pesos registrados dentro del período, **Then** el gráfico muestra un punto por registro, con su fecha en el eje horizontal y los kilogramos en el vertical.
2. **Given** días con al menos 3 registros en los 7 días que los terminan, **Then** la línea del promedio pasa por ellos y se interrumpe donde faltan datos (más de 7 días entre dos puntos del promedio), sin unir lo que no se midió.
3. **Given** el gráfico, **Then** se ve una leyenda («Peso registrado», «Promedio de 7 días»), la cantidad de registros del período y la unidad (kg).
4. **Given** el selector de período, **When** se elige otro, **Then** el gráfico y los números se actualizan sin cambiar de pantalla; el período por omisión es 90 días.
5. **Given** que se pasa el puntero o se enfoca con el teclado un punto, **Then** se lee su fecha y su valor (y el promedio de ese día si existe); lo mismo se puede leer en una tabla alternativa.
6. **Given** el peso registrado en un día, **Then** el eje vertical se ajusta al rango de los datos del período con algo de margen, sin empezar en cero, y lo dice en texto.

---

### User Story 2 - Pocos datos, sin conclusiones (Priority: P1)

Si hay pocos registros, el gráfico muestra lo que hay y lo dice. No aparece promedio ni frases de cambio cuando no hay datos suficientes.

**Why this priority**: es la regla de la Constitution (Principio V) y evita mensajes engañosos.

**Independent Test**: con 0, 1, 2 y 3 pesos comprobar qué se muestra en cada caso.

**Acceptance Scenarios**:

1. **Given** ningún peso en el período, **Then** un estado vacío lo dice y ofrece registrar un peso; si hay pesos fuera del período, sugiere ampliar el período.
2. **Given** un solo peso, **Then** se muestra el punto y el texto «Un solo registro no alcanza para ver una evolución».
3. **Given** menos de 3 registros en alguna ventana, **Then** esa ventana no tiene promedio y el gráfico lo aclara una vez en texto, sin rellenar.
4. **Given** cualquier cantidad de datos, **Then** la pantalla no muestra frases de cambio, tendencia, meta ni juicio sobre el peso.

---

### User Story 3 - Peso en ayunas (Priority: P2)

La persona puede marcar un peso como medido en ayunas y, si le sirve, ver el gráfico solo con esos pesos.

**Why this priority**: mejora la comparabilidad entre registros, pero el gráfico sirve sin ella.

**Independent Test**: registrar tres pesos, marcar dos en ayunas, elegir «Solo en ayunas» y comprobar que el gráfico y la cantidad usan solo esos dos; recargar y comprobar que la elección se conserva.

**Acceptance Scenarios**:

1. **Given** el formulario de peso, **Then** hay una casilla opcional «Lo medí en ayunas»; también está al corregir un registro.
2. **Given** pesos marcados y sin marcar, **When** se elige «Solo en ayunas», **Then** el gráfico, el promedio y las cifras usan solo los marcados y se dice cuántos registros del período quedaron fuera por no tener indicado si fue en ayunas.
3. **Given** «Solo en ayunas» con menos de 3 pesos marcados en una ventana, **Then** esa ventana no tiene promedio.
4. **Given** la elección, **When** se recarga la página, **Then** se conserva en ese navegador; si el almacenamiento del navegador no está disponible, se usa «Todos los pesos» sin errores.
5. **Given** el historial, **Then** los registros marcados lo indican en texto («En ayunas»); los demás no muestran nada.
6. **Given** una medida que no es peso, **Then** no hay casilla de ayunas.

---

### User Story 4 - Cifras del período (Priority: P3)

Debajo del gráfico, cifras descriptivas del período: cantidad de registros, último peso con su fecha, promedio de 7 días más reciente (si existe) y los pesos mínimo y máximo con sus fechas.

**Why this priority**: acompaña al gráfico con datos exactos; no es imprescindible.

**Independent Test**: con registros conocidos comprobar cada cifra y que sin datos suficientes el promedio dice «Sin dato».

**Acceptance Scenarios**:

1. **Given** registros en el período, **Then** se muestran la cantidad, el último peso y su fecha, y el mínimo y el máximo con sus fechas, con unidad.
2. **Given** que no hay promedio de 7 días en el último día con registro, **Then** esa cifra dice «Sin dato» y explica que faltan registros.
3. **Given** cualquier cifra, **Then** el texto es neutral y no compara con una meta ni con un período anterior.

---

### Edge Cases

- Dos pesos el mismo día: no existe, es un valor por día (spec 008).
- Un peso corregido o eliminado: el gráfico se actualiza al volver del formulario.
- Un período sin datos con pesos antes: el estado vacío sugiere «Todo».
- Todos los pesos iguales: el eje vertical se ensancha un margen fijo para no quedar plano.
- Muchos registros (por ejemplo un año): los puntos se achican y no se rotulan uno por uno; el valor se ve con el puntero, el teclado o la tabla.
- Cambio de zona horaria: «hoy» y los períodos siguen la zona del perfil; los pesos ya guardados no se mueven.
- Carga y error: el gráfico conserva el cuadro anterior mientras recarga; si falla, un mensaje con «Reintentar».
- Sin conexión al leer: se muestra el último gráfico en memoria si existe y el aviso común de falta de conexión.
- Cuenta nueva sin pesos: el bloque invita a registrar el primero.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La pantalla «Medidas», con el peso elegido, MUST mostrar un bloque «Evolución del peso» con un gráfico de los pesos del período elegido.
- **FR-002**: El gráfico MUST mostrar un punto por cada peso registrado, con su fecha y su valor en kg, y MUST indicar la unidad, las fechas del período y la cantidad de registros.
- **FR-003**: El gráfico MUST mostrar el promedio de 7 días: para cada día con peso, el promedio de los registros de los 7 días que lo terminan, solo si hay al menos 3 registros en esa ventana.
- **FR-004**: Los días sin registro MUST NOT rellenarse ni interpolarse; la línea del promedio MUST interrumpirse cuando entre dos puntos con promedio pasan más de 7 días.
- **FR-005**: La persona MUST poder elegir el período entre 30 días, 90 días, 6 meses, 1 año y Todo (por omisión, 90 días), y el gráfico y las cifras MUST actualizarse con esa elección.
- **FR-006**: El eje vertical MUST ajustarse al rango de los datos del período con un margen, MUST NOT empezar necesariamente en cero y MUST decirlo en texto; con todos los valores iguales MUST ensancharse un margen fijo.
- **FR-007**: Con 0 registros MUST mostrarse un estado vacío con invitación a registrar; con 1 registro MUST mostrarse el punto y el texto de que no alcanza para ver una evolución; las ventanas con menos de 3 registros MUST no tener promedio.
- **FR-008**: La pantalla MUST NOT mostrar frases de cambio, tendencia, meta o juicio sobre el peso (Principios IV y V), ni usar rojo o verde como juicio.
- **FR-009**: Cada registro de peso MUST poder marcarse opcionalmente como «en ayunas», al guardar y al corregir; un registro sin marca MUST quedar «sin indicar» y MUST NOT afirmarse que no fue en ayunas. Solo el peso admite la marca, y la validación MUST repetirse en el servidor.
- **FR-010**: La persona MUST poder elegir «Todos los pesos» o «Solo en ayunas» para el gráfico y las cifras; la elección MUST recordarse en el navegador y, si no se puede leer o escribir, MUST usarse «Todos los pesos» sin errores. Con «Solo en ayunas» MUST decirse cuántos registros del período quedaron fuera.
- **FR-011**: Debajo del gráfico MUST mostrarse la cantidad de registros, el último peso con su fecha, el promedio de 7 días más reciente («Sin dato» si no existe) y el mínimo y el máximo con sus fechas.
- **FR-012**: El gráfico MUST tener una leyenda con forma además de color (punto y línea), valores accesibles por puntero, teclado y una tabla alternativa, y MUST NOT depender solo del color.
- **FR-013**: El gráfico MUST ser legible a 375 px sin desplazamiento horizontal de la página, y MUST cumplir WCAG 2.1 AA (contraste de las marcas de al menos 3:1 sobre la superficie, texto alternativo, foco visible).
- **FR-014**: Mientras se recarga, el gráfico MUST conservar el cuadro anterior; si falla la carga MUST mostrar un error con «Reintentar».
- **FR-015**: El historial MUST indicar en texto «En ayunas» en los pesos marcados.
- **FR-016**: Las pruebas funcionales de la spec 008 MUST seguir pasando sin cambios de comportamiento.
- **FR-017**: Los registros técnicos MUST NOT contener pesos ni fechas de la persona.

### Key Entities _(include if feature involves data)_

- **Registro de peso**: el de la spec 008 (un valor en kg por día) con una marca opcional «en ayunas».
- **Serie del gráfico**: los pesos del período elegido y, derivado de ellos, el promedio de 7 días por día con peso; no se guarda.
- **Preferencia del gráfico**: «Todos los pesos» o «Solo en ayunas», guardada en el navegador.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Con registros conocidos, cada punto, cada promedio de 7 días, el mínimo, el máximo y las cantidades coinciden con el cálculo de referencia en las pruebas (incluidos los límites de 2 y 3 registros por ventana y los huecos de más de 7 días).
- **SC-002**: Cambiar de período o de filtro actualiza el gráfico en menos de 1 segundo con un año de datos.
- **SC-003**: Con 0, 1 y 2 registros ninguna pantalla muestra promedio, cambio ni tendencia.
- **SC-004**: El bloque no tiene violaciones graves o críticas de accesibilidad ni desplazamiento horizontal a 375 y 1280 px, y todos los valores se leen sin color ni puntero.
- **SC-005**: Marcar un peso «en ayunas» y filtrar «Solo en ayunas» deja el gráfico con exactamente los marcados.
- **SC-006**: Las pruebas de las specs 008 y 016 siguen pasando.

## Assumptions

- Los pesos se leen con la misma consulta de la spec 008; con un año de datos son como mucho 365 filas, y «Todo» crece de a una por día, algo que una cuenta personal soporta sin paginar.
- El promedio de 7 días y las cifras se calculan en el navegador; no hay vistas ni tablas nuevas, salvo la marca de ayunas.
- La preferencia «Todos / Solo en ayunas» es del navegador; si más adelante hace falta que viaje con la cuenta, va a la spec 021 (ajustes y recordatorios).
- El gráfico es un SVG propio, sin librería externa, que las specs 010 y 012 podrán reutilizar.
- El peso se muestra siempre en kilogramos (sistema métrico por defecto de la Constitution).

## Out of Scope

- Metas de peso, proyecciones, ritmo de cambio, comparación con un período anterior o cualquier mensaje de cambio (spec 010, si corresponde, con las reglas de la Constitution).
- Gráficos de las otras medidas (cintura, cadera, etc.).
- Correlaciones con calorías o entrenamiento (spec 010).
- Exportar el gráfico o los datos (spec 011).
- Recordatorios para pesarse (spec 021).
- Peso en libras u otras unidades.

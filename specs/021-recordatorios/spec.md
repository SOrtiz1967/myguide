# Feature Specification: Recordatorios configurables

**Feature Branch**: `021-recordatorios`

**Created**: 2026-10-30

**Status**: Draft

**Input**: nota 3 del autor (2026-10-28): «cosas como registrar el peso o las fotos se debe poder configurar cada cuánto se tiene que cargar y que sea una notificación». Decisión del 2026-10-28: el aviso es una notificación dentro de la app; las notificaciones push del sistema quedan como feature futuro (spec 024). Roadmap: spec 021, ola 4. Depende de las specs 008 (peso), 019 (fotos de progreso) y 022 (suplementos). Reemplaza la casilla «Recordarme pesarme» de la spec 016. Principios: I, IV, VI.

## Clarifications

### Session 2026-10-30

- Q: ¿Para qué cosas hay recordatorios? → A: Para tres: el peso, las fotos de progreso y los suplementos. Cada uno se configura por separado y es opcional; ninguno viene encendido salvo el recordatorio de peso de quien ya lo tenía activado.
- Q: ¿Qué frecuencias hay? → A: «Todos los días», «Cada tantos días» (de 2 a 30) y «Ciertos días de la semana» (uno o más). Los suplementos solo admiten «Todos los días» y «Ciertos días de la semana», porque se marcan día por día.
- Q: ¿Cuándo aparece el aviso? → A: En el inicio, como una tarjeta, el día en que corresponde según la frecuencia y mientras lo pedido no esté registrado. Peso y fotos: «cada tantos días» cuenta desde el último registro (desde la última foto o el último peso); «todos los días» y «ciertos días» corresponden en esos días si ese día no hay registro. Suplementos: corresponde en esos días si hay suplementos sin archivar y alguno no está marcado hoy.
- Q: ¿Cómo se evita insistir? → A: Cada tarjeta se muestra una vez por día como mucho y tiene «Más tarde» (se oculta hasta mañana) y «Desactivar». No hay contadores, rachas ni textos de culpa. Si hoy ya se registró lo pedido, la tarjeta no aparece.
- Q: ¿Qué pasa con la casilla de la spec 016? → A: Se elimina. Quienes la tenían activada pasan a un recordatorio diario de peso (migración); el aviso suelto del panel del día y la casilla del perfil dejan de existir.
- Q: ¿Dónde se configura? → A: En el perfil, en una sección «Recordatorios».
- Q: ¿Y con la aplicación cerrada? → A: No avisa: es la limitación que justifica la spec 024. La configuración se guarda en la cuenta para que la 024 la use sin rehacerla.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configurar mis recordatorios (Priority: P1)

En el perfil, la persona ve una sección «Recordatorios» con peso, fotos de progreso y suplementos. Para cada uno puede activarlo o no y elegir la frecuencia.

**Why this priority**: sin configuración no hay recordatorios.

**Independent Test**: activar el peso «Todos los días», las fotos «Cada 14 días» y los suplementos los lunes, miércoles y viernes; recargar y ver que se conserva; cambiar uno y desactivar otro.

**Acceptance Scenarios**:

1. **Given** la sección, **Then** muestra los tres recordatorios, cada uno con su interruptor y, si está activo, su frecuencia.
2. **When** la persona elige «Cada tantos días» y escribe un número fuera de 2 a 30, **Then** se rechaza con un mensaje claro y no se guarda nada.
3. **When** elige «Ciertos días de la semana» sin marcar ningún día, **Then** se rechaza con un mensaje claro.
4. **Given** los suplementos, **Then** no se ofrece «Cada tantos días».
5. **When** guarda, **Then** el resultado se informa, se conserva al recargar y sin conexión se avisa sin dar nada por guardado.
6. **Given** una cuenta que tenía activada la casilla de la spec 016, **Then** tiene un recordatorio diario de peso activo.

---

### User Story 2 - Ver el aviso en el inicio (Priority: P1)

Cuando corresponde, el inicio muestra una tarjeta discreta con el aviso y un acceso directo para registrar lo pedido. Se puede dejar para más tarde o desactivar.

**Why this priority**: es el aviso en sí.

**Independent Test**: con el peso diario y sin peso hoy, ver la tarjeta; registrar el peso y verla desaparecer; con otra cuenta, tocar «Más tarde» y comprobar que no vuelve hoy ni al recargar.

**Acceptance Scenarios**:

1. **Given** un recordatorio activo que corresponde hoy y nada registrado, **Then** el inicio muestra una tarjeta con un texto neutral y un enlace para registrarlo (peso: Medidas; fotos: Fotos; suplementos: el bloque de suplementos del día).
2. **When** se registra lo pedido, **Then** la tarjeta desaparece.
3. **When** se toca «Más tarde», **Then** la tarjeta desaparece hasta mañana (también después de recargar o de cambiar de dispositivo).
4. **When** se toca «Desactivar», **Then** el recordatorio queda apagado y la tarjeta desaparece; se puede volver a encender en el perfil.
5. **Given** «cada tantos días», **Then** corresponde cuando pasaron al menos esos días desde el último registro (o nunca hubo uno).
6. **Given** que un día no corresponde por la frecuencia, **Then** no hay tarjeta.
7. **Given** que no hay conexión o el inicio falla en cargar el aviso, **Then** el resto del inicio sigue funcionando.
8. **Given** varios recordatorios que corresponden, **Then** hay una tarjeta por cada uno, en el orden peso, fotos y suplementos.

---

### User Story 3 - Sin presión y sin culpa (Priority: P1)

Los avisos son informativos, opcionales y fáciles de apagar.

**Why this priority**: Principio IV.

**Independent Test**: revisar todos los textos; comprobar que no hay contadores, rachas ni frases de culpa y que cada tarjeta se puede posponer y desactivar.

**Acceptance Scenarios**:

1. **Given** cualquier tarjeta, **Then** su texto dice que es opcional y no usa frases como «olvidaste», «no cumpliste», «llevas N días sin…» ni mayúsculas ni signos de alarma.
2. **Given** un recordatorio ignorado, **Then** no escala: no aparece más de una vez por día ni cambia de tono.
3. **Given** las pantallas, **Then** cumplen WCAG 2.1 AA, son usables por teclado y no tienen desplazamiento horizontal a 375 px.

---

### Edge Cases

- Cambio de zona horaria: «hoy» y el día de la semana siguen la zona del perfil.
- «Más tarde» y cambio de configuración: cambiar la configuración de un recordatorio quita el «más tarde» pendiente.
- Sin suplementos sin archivar: el recordatorio de suplementos no aparece (no hay nada que marcar) y la sección del perfil lo dice.
- Un peso o una foto con fecha de hoy registrados antes de abrir el inicio: la tarjeta no aparece.
- Registrar un peso con fecha pasada no cuenta como «hoy», pero sí como último registro para «cada tantos días».
- Sesión vencida: no se lee ni se escribe nada hasta volver a ingresar.
- Cuenta nueva: sin recordatorios, el inicio no muestra tarjetas.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La persona MUST poder activar, desactivar y configurar un recordatorio por separado para el peso, las fotos de progreso y los suplementos.
- **FR-002**: La frecuencia MUST ser «Todos los días», «Cada tantos días» (2 a 30) o «Ciertos días de la semana» (uno o más, de lunes a domingo); los suplementos MUST NOT admitir «Cada tantos días». La validación MUST repetirse en el servidor.
- **FR-003**: La configuración MUST guardarse en la cuenta, MUST ser privada de cada cuenta y MUST eliminarse junto con ella; MUST poder leerla un futuro servicio de notificaciones sin cambiar su forma (spec 024).
- **FR-004**: El inicio MUST mostrar una tarjeta por cada recordatorio activo que corresponda hoy según su frecuencia y cuyo registro todavía no exista, con un acceso directo para registrarlo.
- **FR-005**: Con «Cada tantos días», el aviso MUST corresponder cuando hayan pasado al menos esos días desde el último peso o la última foto registrados (o si nunca hubo uno).
- **FR-006**: Con «Todos los días» y «Ciertos días», el aviso MUST corresponder en esos días mientras ese día no tenga registro; para los suplementos, mientras haya suplementos sin archivar y alguno no esté marcado ese día.
- **FR-007**: Cada tarjeta MUST ofrecer «Más tarde» (se oculta hasta el día siguiente en la zona de la persona y queda guardado en la cuenta) y «Desactivar», y MUST NOT mostrarse más de una vez por día después de posponerla.
- **FR-008**: Los textos MUST ser neutrales y opcionales (Principio IV): sin culpa, sin juicio, sin contadores de días sin registrar, sin rachas, sin tono de urgencia; MUST decir que el aviso es opcional.
- **FR-009**: Se MUST eliminar la casilla «Recordarme pesarme» del perfil y el aviso suelto del panel del día, y MUST migrarse lo activado a un recordatorio diario de peso.
- **FR-010**: La sección «Recordatorios» del perfil MUST informar el resultado de guardar, MUST NOT dar por guardado lo que no llegó al servidor y MUST avisar la falta de conexión.
- **FR-011**: El aviso MUST ser solo dentro de la aplicación; MUST NOT pedir permisos del dispositivo ni enviar notificaciones con la aplicación cerrada.
- **FR-012**: Todas las pantallas MUST tener estados de carga, vacío, éxito y error en español, con tuteo, cumplir WCAG 2.1 AA, ser usables por teclado y no tener desplazamiento horizontal a 375 px.
- **FR-013**: Un fallo al calcular o cargar los avisos MUST NOT impedir el uso del resto del inicio.
- **FR-014**: Los registros técnicos MUST NOT contener la configuración de la persona ni lo que registró.
- **FR-015**: Las pruebas funcionales existentes del inicio y del perfil MUST seguir pasando, salvo las que probaban la casilla eliminada, que MUST reemplazarse por las de esta spec.

### Key Entities _(include if feature involves data)_

- **Recordatorio**: configuración de un tipo (peso, fotos o suplementos) de una cuenta: activo o no, frecuencia, y «más tarde hasta» opcional. Uno por tipo y cuenta. No guarda mensajes ni contadores.
- **Aviso del día**: tarjeta calculada en el navegador a partir de un recordatorio, lo ya registrado y el día de hoy; no se guarda.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Configurar un recordatorio lleva menos de 30 segundos y tres toques o menos.
- **SC-002**: Para cada combinación de frecuencia y de registro existente (hoy, antes, nunca), la tarjeta aparece exactamente cuando corresponde según la regla, comprobado con pruebas.
- **SC-003**: Después de «Más tarde», la tarjeta no vuelve a aparecer ese día en ningún dispositivo; después de «Desactivar», tampoco hasta volver a encenderlo.
- **SC-004**: Ningún texto de la función contiene frases de culpa, urgencia o conteo de días sin registrar.
- **SC-005**: Ninguna cuenta puede leer ni cambiar los recordatorios de otra (prueba de aislamiento).
- **SC-006**: Las pantallas no tienen violaciones graves o críticas de accesibilidad ni desplazamiento horizontal a 375 y 1280 px.
- **SC-007**: Las cuentas que tenían el recordatorio de peso activado conservan un aviso diario de peso tras la migración.

## Assumptions

- El cálculo de qué avisos corresponden es en el navegador, con los datos que el inicio ya puede leer; el servidor guarda solo la configuración y el «más tarde».
- «Todos los días» y «ciertos días» miran si hay un registro con fecha de hoy; un peso o una foto con fecha de hoy cuenta aunque se haya cargado antes.
- Los suplementos corresponden solo si hay al menos uno sin archivar.
- No hay horarios dentro del día: el aviso depende del día, no de la hora.
- La spec 024 agregará el envío con la aplicación cerrada sobre esta misma configuración.

## Out of Scope

- Notificaciones push o avisos con la aplicación cerrada (spec 024).
- Horarios del día, sonidos o vibración.
- Recordatorios de comidas, entrenamiento u otras funciones.
- Mensajes personalizados, rachas o estadísticas de cumplimiento.
- Recordatorios compartidos con otras personas.

# Feature Specification: Suplementación

**Feature Branch**: `022-suplementacion`

**Created**: 2026-10-30

**Status**: Draft

**Input**: nota 8 del autor (2026-10-28): «un apartado donde definir mis suplementos (por ejemplo creatina, multivitamínico) y marcar cada día cuáles tomé; que aparezca en el inicio, en el panel del día». Roadmap: spec 022, ola 4. Se implementa antes que la 021 porque los recordatorios de la 021 la necesitan. Principios: I, IV, VI.

## Clarifications

### Session 2026-10-30

- Q: ¿Qué guarda un suplemento? → A: Un nombre (hasta 60 caracteres) y, si la persona quiere, una dosis como texto libre que ella escribe (hasta 60 caracteres, por ejemplo «5 g»). La aplicación no sugiere ni valida dosis ni horarios.
- Q: ¿Qué es un día sin marca? → A: «Sin registro». No existe «olvidado», «pendiente de culpa» ni «incumplido». El estado de cada suplemento en un día es solo «Tomado» o «Sin registro».
- Q: ¿Se pueden eliminar suplementos? → A: Se pueden archivar (dejan de aparecer en la lista de cada día pero conservan sus marcas pasadas, que se siguen viendo en esos días) y eliminar (borra el suplemento y sus marcas, con confirmación). Un suplemento archivado se puede restaurar.
- Q: ¿Qué límites hay? → A: Hasta 30 suplementos sin archivar por cuenta; el nombre no se repite entre los no archivados (sin distinguir mayúsculas). No se marcan días futuros.
- Q: ¿Dónde se ve? → A: Una pantalla propia «Suplementos» (`/suplementos`, en «Más») para armar la lista y, en el inicio, un bloque «Suplementos» en el panel del día elegido, donde se marca lo tomado.
- Q: ¿Hay horarios, recordatorios o racha? → A: No. Los recordatorios son la spec 021. No hay rachas, porcentajes ni «cumplimiento».

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Armar mi lista de suplementos (Priority: P1)

La persona abre «Suplementos» y agrega los que toma, con nombre y, si quiere, una dosis escrita por ella. Puede corregirlos, archivarlos y eliminarlos.

**Why this priority**: sin lista no hay nada que marcar.

**Independent Test**: agregar «Creatina» con «5 g» y «Vitamina D» sin dosis, corregir la dosis, archivar uno y ver que sale de la lista principal y aparece en «Archivados».

**Acceptance Scenarios**:

1. **Given** la pantalla, **When** la persona escribe un nombre (y una dosis opcional) y guarda, **Then** el suplemento aparece en su lista.
2. **Given** un nombre vacío o de más de 60 caracteres, una dosis de más de 60 o un nombre ya usado por otro no archivado, **When** guarda, **Then** se rechaza con un mensaje claro y no se guarda nada.
3. **Given** un doble toque o un reintento, **Then** se crea uno solo.
4. **Given** un suplemento, **When** se corrige, **Then** cambia el nombre y la dosis sin tocar sus marcas.
5. **Given** un suplemento, **When** se archiva, **Then** sale de la lista principal y de los días nuevos, y sus marcas pasadas se conservan; **When** se restaura, **Then** vuelve (si su nombre no lo usa ya otro).
6. **Given** un suplemento, **When** se elimina y se confirma, **Then** desaparece junto con sus marcas.
7. **Given** 30 suplementos sin archivar, **When** intenta agregar otro, **Then** se le avisa del máximo en texto neutral.
8. **Given** una cuenta nueva, **Then** un estado vacío explica cómo empezar, sin presión y sin recomendar ningún suplemento.

---

### User Story 2 - Marcar lo que tomé cada día (Priority: P1)

En el inicio, el panel del día elegido muestra los suplementos de la persona, cada uno con su estado: «Tomado» o «Sin registro». Con un toque lo marca o lo desmarca.

**Why this priority**: es el gesto diario que se pidió.

**Independent Test**: con dos suplementos, abrir el inicio, marcar uno como tomado, recargar y ver el estado; elegir un día pasado y marcarlo; comprobar que un día futuro no deja marcar.

**Acceptance Scenarios**:

1. **Given** suplementos sin archivar, **Then** el panel del día los lista cada uno con su estado en texto y forma («Tomado» o «Sin registro»), no solo por color.
2. **When** la persona marca uno, **Then** queda «Tomado» para ese día y se conserva al recargar; **When** lo desmarca, **Then** vuelve a «Sin registro».
3. **Given** un día pasado, **Then** se puede marcar o desmarcar igual; un día futuro lo muestra sin permitir marcar.
4. **Given** un suplemento archivado con una marca en ese día, **Then** aparece en ese día (para conservar lo ya registrado) y puede desmarcarse.
5. **Given** que falla el guardado o no hay conexión, **Then** se avisa, el estado no cambia y no se da por guardado lo que no llegó al servidor.
6. **Given** una cuenta sin suplementos, **Then** el bloque lo dice y enlaza a «Suplementos», sin insistir.
7. **Given** cualquier día, **Then** no se muestran rachas, porcentajes, ni frases como «olvidaste».

---

### User Story 3 - Todo es mío y neutral (Priority: P1)

Los suplementos y sus marcas son privados de la cuenta. La aplicación no recomienda nada.

**Why this priority**: Principios I y IV.

**Independent Test**: con dos cuentas, comprobar el aislamiento; revisar los textos de la sección.

**Acceptance Scenarios**:

1. **Given** dos cuentas, **Then** ninguna ve, crea, cambia, marca ni elimina los suplementos de la otra.
2. **Given** los textos de la sección, **Then** no recomiendan suplementos, dosis, horarios ni combinaciones, ni afirman efectos, y aclaran que la dosis es lo que la persona escribe.
3. **Given** una sesión vencida, **Then** no se lee ni se escribe nada hasta volver a ingresar.
4. **Given** los registros técnicos, **Then** no contienen nombres ni dosis.

---

### Edge Cases

- Nombre repetido entre uno archivado y uno nuevo: se permite (el índice solo cubre los no archivados); al restaurar el archivado, si hay otro con ese nombre, se rechaza con mensaje.
- Marcar un día y archivar después: la marca queda y se ve en ese día.
- Cambio de zona horaria: «hoy» sigue la zona del perfil; las marcas ya guardadas no se mueven.
- Sin conexión: se avisa y no se permite guardar; lo escrito en el formulario se conserva.
- Texto con caracteres especiales o muy largo: se muestra como texto (sin interpretarlo) y se rompe en renglones sin desbordar a 375 px.
- Carga y error: cada bloque carga y falla por su cuenta con «Reintentar».

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La persona MUST poder crear suplementos con un nombre (1 a 60 caracteres, recortado) y una dosis opcional de texto libre (1 a 60 caracteres, recortada), y MUST poder corregirlos.
- **FR-002**: El nombre MUST NOT repetirse entre los suplementos sin archivar de la cuenta (sin distinguir mayúsculas); la validación MUST repetirse en el servidor.
- **FR-003**: Crear MUST ser idempotente ante dobles envíos y reintentos con el mismo identificador de solicitud.
- **FR-004**: La cuenta MUST poder tener hasta 30 suplementos sin archivar; al llegar al máximo MUST avisarse en texto neutral.
- **FR-005**: La persona MUST poder archivar y restaurar suplementos; archivar MUST conservar sus marcas.
- **FR-006**: La persona MUST poder eliminar un suplemento con confirmación; eliminar MUST borrar sus marcas.
- **FR-007**: La persona MUST poder marcar y desmarcar, para un día, cada suplemento; el estado de un suplemento en un día MUST ser solo «Tomado» o «Sin registro».
- **FR-008**: Marcar MUST ser idempotente y MUST NOT permitir días futuros (según la zona de la persona) ni anteriores al año 2000.
- **FR-009**: El panel del día del inicio MUST mostrar un bloque «Suplementos» con los suplementos sin archivar y los archivados que tengan una marca ese día, cada uno con su estado en texto y forma además de color, y con la acción de marcar o desmarcar.
- **FR-010**: La pantalla «Suplementos» MUST permitir armar y mantener la lista, y MUST estar en la navegación («Más»).
- **FR-011**: La aplicación MUST NOT recomendar suplementos, dosis, horarios ni combinaciones, ni afirmar efectos, ni mostrar rachas, porcentajes de cumplimiento o frases de culpa (Principio IV); los textos MUST aclarar que la dosis es la que escribe la persona.
- **FR-012**: Los suplementos y sus marcas MUST ser privados de cada cuenta (ninguna cuenta puede ver, crear, cambiar, marcar ni eliminar los de otra), MUST requerir la sesión vigente y MUST eliminarse junto con la cuenta.
- **FR-013**: Guardar, marcar y eliminar MUST informar el resultado, MUST NOT dar por guardado lo que no llegó al servidor y, sin conexión, MUST avisarlo; el formulario de alta MUST conservar lo escrito si falla.
- **FR-014**: Todas las pantallas MUST tener estados de carga, vacío, éxito y error en español, con tuteo y lenguaje neutral, cumplir WCAG 2.1 AA, ser usables por teclado y lector de pantalla y no tener desplazamiento horizontal a 375 px.
- **FR-015**: Los registros técnicos MUST NOT contener nombres ni dosis de suplementos.
- **FR-016**: Las pruebas funcionales existentes del inicio MUST seguir pasando sin cambios de comportamiento.

### Key Entities _(include if feature involves data)_

- **Suplemento**: elemento de la lista de una persona con nombre, dosis opcional en texto libre y marca de archivado. Privado de la cuenta.
- **Marca de un día**: la constancia de que un suplemento se tomó en una fecha. Su ausencia es «sin registro».

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Agregar un suplemento lleva menos de 20 segundos y marcarlo en el inicio, un toque.
- **SC-002**: Ninguna cuenta puede leer ni cambiar los suplementos o marcas de otra (prueba de aislamiento).
- **SC-003**: Un doble toque en «Agregar» o en «Tomado» deja exactamente un suplemento o una marca.
- **SC-004**: Archivar y restaurar conservan el 100 % de las marcas; eliminar las borra.
- **SC-005**: Ninguna pantalla de la sección tiene violaciones graves o críticas de accesibilidad ni desplazamiento horizontal a 375 y 1280 px, y ningún texto recomienda, juzga ni culpa.
- **SC-006**: Las pruebas del inicio de las specs 013 y 016 siguen pasando.

## Assumptions

- Un suplemento no tiene horario, frecuencia ni cantidad por toma: «tomado» es un sí o un no por día. Si la persona toma algo más de una vez al día, lo anota en la dosis o como dos suplementos.
- Un suplemento sin archivar se lista todos los días, incluso los anteriores a su creación; esos días figuran «Sin registro», sin juicio.
- Los recordatorios de suplementos pertenecen a la spec 021, que lee estas marcas.
- No hay catálogo, búsqueda ni sugerencias de suplementos: todo es texto de la persona.

## Out of Scope

- Recordatorios y notificaciones (spec 021 y 024).
- Recomendar, validar o interpretar suplementos, dosis, horarios o interacciones.
- Rachas, porcentajes de cumplimiento, gráficos o análisis.
- Horarios, varias tomas por día o cantidades por toma.
- Catálogo o base de datos de suplementos.

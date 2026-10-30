# Feature Specification: Fotos de progreso

**Feature Branch**: `019-fotos-de-progreso`

**Created**: 2026-10-30

**Status**: Draft

**Input**: pedido de fotos del autor (2026-10-28) y la parte que la spec 008 dejó pendiente: «una sección propia donde subir fotos de progreso, verlas ordenadas por fecha, eliminarlas y compararlas». Roadmap: spec 019, ola 4. Depende de las specs 001 (cuenta y sesión), 003 (mismo tratamiento de fotos que las comidas) y 017 (sistema de componentes). Principios: I, V, VI.

## Clarifications

### Session 2026-10-30

- Q: ¿Una foto por día o varias? → A: Varias. Cada foto tiene su fecha y, de forma opcional, una pose («Frente», «Perfil», «Espalda» u «Otra»). La pose sirve para comparar fotos de condiciones parecidas (Constitution, Principio V).
- Q: ¿Se puede corregir la fecha o la pose después de subir? → A: Sí, sin volver a subir el archivo. La fecha de la foto es la de la toma que declara la persona; no se lee del archivo, porque los metadatos se eliminan.
- Q: ¿Hay un tope de fotos? → A: Sí, 200 por cuenta, para cuidar el almacenamiento del plan gratuito. Al llegar se avisa en texto neutral y se pide eliminar alguna; no se borra nada solo.
- Q: ¿Dónde vive la sección? → A: En una pantalla propia («Fotos», ruta `/fotos`) dentro del grupo «Más» de la navegación, no dentro de «Medidas». Medidas conserva peso y medidas sin cambios.
- Q: ¿Qué compara la comparación? → A: Dos fotos elegidas por la persona, una al lado de la otra, con su fecha y su pose. No hay superposición, puntuación, medición ni texto sobre el cuerpo; si las poses difieren se dice en texto neutral que la comparación puede no ser pareja.
- Q: ¿Se envían a algún servicio externo? → A: No. Ninguna foto de progreso sale de la base y del almacenamiento propios; no hay IA, ni analítica, ni enlaces públicos.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Subir una foto de progreso (Priority: P1)

La persona abre «Fotos», elige una imagen de su teléfono o de la cámara, indica la fecha de la toma (por defecto, hoy) y, si quiere, la pose, y la sube. La foto se reduce y se limpia de metadatos antes de guardarse en privado, y aparece en su lista.

**Why this priority**: sin subir no hay nada que ver ni comparar. Es lo que el autor pidió.

**Independent Test**: subir una foto con GPS en sus metadatos, comprobar que aparece en la lista con la fecha elegida y que el archivo guardado no conserva ningún metadato.

**Acceptance Scenarios**:

1. **Given** la pantalla «Fotos», **When** la persona elige una imagen válida, fecha y pose opcional, **Then** la foto se guarda y aparece en la lista con su fecha y su pose.
2. **Given** una imagen con geolocalización, cámara u otros metadatos, **Then** lo guardado no contiene ninguno (Constitution, Principio I).
3. **Given** una imagen grande, **Then** se reduce antes de subir (lado mayor de 1600 px como máximo, sin agrandar) y el archivo guardado pesa como mucho 3 MB.
4. **Given** un archivo que no es una imagen, una imagen que no se puede leer o un formato que el navegador no decodifica, **Then** se explica en texto claro qué pasó y qué hacer, y no se guarda nada.
5. **Given** que la persona ya tiene 200 fotos, **Then** se le avisa en texto neutral que llegó al máximo y que puede eliminar alguna; no se borra nada solo.
6. **Given** que se toca «Subir» dos veces seguidas, **Then** no queda la foto duplicada por el doble toque (el botón se bloquea mientras sube).
7. **Given** que no hay conexión, **Then** se avisa y no se da la foto por guardada.

---

### User Story 2 - Ver mis fotos ordenadas por fecha (Priority: P1)

La persona ve todas sus fotos, de la más reciente a la más antigua, agrupadas por fecha, con miniaturas. Puede abrir una foto en grande, ver su fecha y su pose, corregir ambas o eliminarla.

**Why this priority**: ver la evolución en el tiempo es el sentido de la sección.

**Independent Test**: subir tres fotos con fechas distintas y comprobar el orden, abrir una, cambiarle la fecha y ver que se reordena, y eliminarla con confirmación.

**Acceptance Scenarios**:

1. **Given** varias fotos, **Then** se listan de la fecha más reciente a la más antigua, agrupadas por fecha, y las del mismo día conservan el orden en que se subieron.
2. **Given** una foto, **When** se abre, **Then** se ve en grande con su fecha y su pose, sin texto que juzgue el cuerpo.
3. **Given** una foto, **When** la persona corrige la fecha o la pose, **Then** el cambio se guarda, la lista se reordena y el archivo no se vuelve a subir ni se modifica.
4. **Given** una foto, **When** la persona la elimina y confirma, **Then** desaparece de la lista y se borran tanto el registro como el archivo guardado; sin confirmación no se elimina nada.
5. **Given** que la persona no tiene fotos, **Then** un estado vacío explica cómo subir la primera, sin culpa ni presión.
6. **Given** carga lenta o un error al leer, **Then** hay un estado de carga y un estado de error con reintento.

---

### User Story 3 - Comparar dos fechas lado a lado (Priority: P1)

La persona elige dos fotos de su lista y las ve una al lado de la otra, cada una con su fecha y su pose, para seguir su propio progreso a ojo. No hay análisis ni juicio.

**Why this priority**: es lo que el autor pidió y lo que pide la Constitution para las fotos de progreso.

**Independent Test**: con tres fotos, elegir dos, ver la comparación con las fechas y las poses, cambiar una de las dos, y probar que con una sola foto elegida no se arma la comparación.

**Acceptance Scenarios**:

1. **Given** dos fotos elegidas, **Then** se muestran lado a lado (una debajo de la otra a 375 px si no entran) con la fecha y la pose de cada una, y cuántos días las separan, como dato.
2. **Given** dos fotos con poses distintas o sin pose, **Then** un aviso neutral dice que la comparación puede no ser pareja; no impide comparar.
3. **Given** cualquier comparación, **Then** un texto fijo aclara que son fotos para seguimiento propio, que la luz, el ángulo y la postura cambian lo que se ve y que no es una medición.
4. **Given** una sola foto elegida, **Then** no se arma la comparación y se indica que falta elegir otra.
5. **Given** una foto elegida que se elimina, **Then** la comparación se cierra sin errores.
6. **Given** la comparación, **Then** no hay IA, puntaje, medición, superposición ni frases sobre cambios del cuerpo.

---

### User Story 4 - Mis fotos son solo mías (Priority: P1)

Las fotos están en almacenamiento privado, sin listados ni enlaces públicos. Solo se muestran con enlaces temporales a la persona con la sesión vigente, y se eliminan cuando se eliminan.

**Why this priority**: son los datos más sensibles de la app (Principio I).

**Independent Test**: con dos cuentas, comprobar que una no puede listar, leer, cambiar ni borrar las fotos de la otra, ni por la API ni por Storage; y que un enlace firmado vence.

**Acceptance Scenarios**:

1. **Given** dos cuentas, **Then** ninguna puede ver, crear, cambiar ni eliminar fotos de la otra.
2. **Given** el almacenamiento, **Then** no tiene listados ni acceso público, y ningún rol del navegador puede escribir ni borrar archivos directamente.
3. **Given** el enlace con el que se muestra una foto, **Then** vence a los pocos minutos y no sirve para otra cuenta.
4. **Given** una sesión vencida, **Then** no se pueden ver ni subir fotos hasta volver a ingresar.
5. **Given** cualquier registro técnico (logs, reportes), **Then** no contiene la foto, su ruta ni su fecha.

---

### Edge Cases

- Una foto con orientación EXIF (vertical tomada con el teléfono): al volver a codificar en el navegador se conserva la orientación visible y el archivo guardado ya no depende de metadatos.
- HEIC/HEIF del iPhone: si el navegador no lo decodifica, el mensaje lo explica y sugiere elegir la foto desde la galería como JPEG; si lo decodifica, se convierte a JPEG.
- Subida interrumpida o falla del almacenamiento a mitad: no queda un archivo huérfano ni una fila sin archivo; la persona ve un error con reintento.
- Reemplazo de fecha futura: una fecha posterior a mañana (margen por zona horaria) o anterior al 2000 se rechaza con un mensaje claro.
- Dos fotos de la misma fecha y pose: ambas son válidas; se muestran juntas.
- Cambio de zona horaria: la fecha de cada foto es la que se indicó y no se recalcula.
- Eliminar una foto que ya no existe (otra pestaña): responde igual, sin error visible.
- Una foto que no carga (enlace vencido): se pide un enlace nuevo solo, sin que la persona haga nada; si sigue fallando, texto de error con reintento.
- La cuenta se elimina: las fotos y sus archivos deben borrarse con ella (spec 011; ver Supuestos).
- Muchas fotos: la lista pide los datos de todas (hasta 200) pero solo genera el enlace de las que están a la vista.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La aplicación MUST ofrecer una sección propia «Fotos» (ruta `/fotos`), accesible desde la navegación de escritorio y desde «Más» en el celular.
- **FR-002**: La persona MUST poder subir una foto indicando su fecha de toma (por defecto, hoy en su zona horaria) y, de forma opcional, la pose («Frente», «Perfil», «Espalda» u «Otra»).
- **FR-003**: Antes de subir, el navegador MUST reducir la imagen (lado mayor de 1600 px como máximo, sin agrandar) y volver a codificarla como JPEG; el servidor MUST verificar que sea JPEG, MUST rechazar lo que no lo sea o no se pueda leer, y MUST limitar el tamaño a 3 MB.
- **FR-004**: El servidor MUST eliminar todos los metadatos (EXIF, incluida la geolocalización, XMP, IPTC y comentarios) antes de almacenar la foto y MUST NOT confiar en la limpieza hecha por el navegador (Principio I).
- **FR-005**: Las fotos MUST guardarse en un almacenamiento privado, sin listados ni acceso público, cifradas en reposo con lo que ofrece el proveedor (documentado en la verificación) y transmitidas cifradas.
- **FR-006**: Solo la función de servidor de las fotos de progreso MUST poder escribir y borrar archivos; la persona MUST ver sus fotos solo mediante enlaces firmados que vencen a los 10 minutos como máximo y solo para su propia carpeta y con la sesión vigente.
- **FR-007**: La aplicación MUST listar las fotos de la persona de la fecha más reciente a la más antigua, agrupadas por fecha, con miniatura, fecha y pose.
- **FR-008**: La persona MUST poder abrir una foto en grande y corregir su fecha y su pose sin volver a subir el archivo.
- **FR-009**: La persona MUST poder eliminar una foto, con confirmación; eliminar MUST borrar el registro y el archivo. Eliminar una foto inexistente MUST responder sin error.
- **FR-010**: La aplicación MUST permitir hasta 200 fotos por cuenta; al llegar al máximo MUST avisarlo en texto neutral sin borrar nada.
- **FR-011**: La persona MUST poder comparar dos fotos lado a lado, mostrando la fecha, la pose y los días que las separan de cada par; la comparación MUST NOT procesar las fotos (sin IA, superposición, puntaje ni medición).
- **FR-012**: Si las poses de las dos fotos comparadas difieren o falta alguna, la comparación MUST mostrar un aviso neutral de que puede no ser pareja y MUST NOT impedirla.
- **FR-013**: La comparación MUST incluir un texto fijo que aclare que sirve para el seguimiento propio y que no es una medición clínica, y MUST NOT incluir frases que juzguen, elogien o critiquen el cuerpo o su cambio (Principios IV y V).
- **FR-014**: Las fotos de progreso MUST NOT enviarse a servicios externos de IA ni a ningún proveedor distinto del alojamiento propio (Principio I).
- **FR-015**: Subir, corregir y eliminar MUST informar el resultado, MUST NOT dar por guardado lo que no llegó al servidor y, sin conexión, MUST avisarlo.
- **FR-016**: Una subida fallida a mitad de camino MUST NOT dejar un archivo sin registro ni un registro sin archivo.
- **FR-017**: Subir fotos MUST tener un límite de frecuencia por cuenta (30 por hora) y responder con un mensaje claro al superarlo.
- **FR-018**: Los datos de las fotos MUST ser privados de cada cuenta: ninguna cuenta puede ver, crear, cambiar ni eliminar fotos de otra, comprobado con una prueba de aislamiento.
- **FR-019**: Los registros técnicos (logs) MUST NOT contener la foto, su ruta, su fecha, la pose ni el identificador de la persona (Principio IX).
- **FR-020**: Todas las pantallas MUST tener estados de carga, vacío, éxito y error en español, con tuteo, lenguaje neutral y sin presión; MUST cumplir WCAG 2.1 AA (teclado, lector de pantalla, texto alternativo descriptivo sin juicio, foco visible), usar las piezas de la spec 017 y no tener desplazamiento horizontal a 375 px.
- **FR-021**: La pantalla de comparación MUST ser usable sin depender del color ni de gestos complejos: elegir y cambiar las dos fotos MUST poder hacerse por teclado.
- **FR-022**: Las pruebas funcionales existentes (peso y medidas, fotos de las comidas) MUST seguir pasando sin cambios de comportamiento.

### Key Entities _(include if feature involves data)_

- **Foto de progreso**: imagen JPEG ya limpia y reducida, privada de una cuenta. Tiene fecha de la toma, pose opcional (frente, perfil, espalda u otra), dimensiones, peso en bytes y fecha de subida. No tiene texto libre ni etiquetas sobre el cuerpo.
- **Comparación**: vista transitoria de dos fotos elegidas; no se guarda.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Subir una foto desde la galería lleva menos de 30 segundos con una conexión normal y tres toques o menos después de elegir el archivo.
- **SC-002**: El 100 % de las fotos guardadas queda sin metadatos (comprobado con imágenes de prueba con GPS, cámara, XMP, IPTC y comentario).
- **SC-003**: Ninguna foto guardada pesa más de 3 MB ni tiene un lado mayor de 1600 px cuando se sube desde la aplicación.
- **SC-004**: Ninguna cuenta puede leer, listar, cambiar ni borrar fotos de otra, ni por la API ni por Storage (prueba de aislamiento con dos cuentas).
- **SC-005**: Comparar dos fotos desde la lista lleva tres toques o menos y la pantalla no tiene desplazamiento horizontal a 375 px.
- **SC-006**: Eliminar una foto elimina su registro y su archivo (comprobado en la base y en el almacenamiento).
- **SC-007**: Ninguna pantalla de la sección tiene violaciones graves o críticas de accesibilidad, y ninguna usa lenguaje que juzgue el cuerpo.
- **SC-008**: Las pruebas funcionales de las specs 003 y 008 siguen pasando sin cambios.

## Assumptions

- Se reutiliza el tratamiento de fotos de la spec 003: reducción en el navegador y limpieza de metadatos en el servidor con el mismo código; solo cambian el almacenamiento (un bucket propio `progress-photos`), la tabla y el contrato de la función.
- La fecha de la foto es la que declara la persona (por defecto, hoy en su zona horaria); no se lee del archivo.
- El cifrado en reposo es el del proveedor de almacenamiento por defecto, suficiente para el MVP según la Constitution; el cifrado adicional de la aplicación queda fuera.
- Eliminar la cuenta debería borrar las carpetas `progress-photos/<id>` y `meal-photos/<id>`: eso pertenece a la spec 011 (privacidad y ciclo de vida de los datos) y se agrega a su alcance; esta spec solo deja el dato fácil de encontrar (carpeta por id de cuenta).
- Sin conexión no se sube nada: la aplicación es solo en línea para escrituras, como el resto.
- El límite de 200 fotos y de 3 MB por foto da un tope de pocos cientos de MB por cuenta en el peor caso, y alrededor de 60–100 MB en el caso normal, frente al gigabyte del plan gratuito (ver `despliegue.md`).

## Out of Scope

- Análisis de las fotos con IA, mediciones corporales o porcentaje de grasa a partir de imágenes (Constitution).
- Superposición, alineación automática, recorte guiado o transformaciones de las fotos.
- Compartir, exportar o publicar fotos; enlaces públicos.
- Bloqueo con PIN u ocultamiento de la sección en el dispositivo (fuera del MVP según la Constitution).
- Notas o etiquetas libres por foto; vincular fotos al peso o a las medidas.
- Cifrado adicional a nivel de aplicación.
- Recordatorios para sacar fotos (spec 021).
- Eliminar las fotos al eliminar la cuenta (spec 011).

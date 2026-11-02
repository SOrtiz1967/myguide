# Feature Specification: Privacidad y ciclo de vida de los datos

**Feature Branch**: `011-privacidad-ciclo-de-vida`

**Created**: 2026-11-01

**Status**: Draft

**Input**: roadmap, spec 011 (ola 3): exportación, eliminación de registros y de cuenta, retención de copias de seguridad, plazo de retención de logs y herramienta de monitoreo; decisiones pendientes #7 y #9; la eliminación de cuenta debe borrar las carpetas `meal-photos/<user_id>/` y `progress-photos/<user_id>/`. Obligatoria antes de publicar con usuarios reales. Principios: I, IX.

## Clarifications

### Session 2026-11-01

- Q: ¿Cómo se exportan los datos? → A: Desde una pantalla «Tus datos» (`/privacidad`) con dos descargas: un archivo JSON con todos los registros de la cuenta (perfil, comidas, alimentos propios, objetivos, ejercicios propios, rutinas, plan semanal, sesiones, sueño y actividad, medidas, suplementos, recordatorios y registros de fotos) y un ZIP con las fotos (de comidas y de progreso) tal como están guardadas. Se generan en el navegador con lo que la persona ya puede leer; no hay un servicio de exportación aparte.
- Q: ¿Qué contiene y qué no contiene el JSON? → A: Solo datos de la cuenta, con la fecha de exportación y la versión del formato. No incluye contraseñas ni claves, el catálogo común de alimentos y ejercicios, ni los resultados temporales de la IA. Los valores faltantes se exportan como nulos, nunca como cero.
- Q: ¿Cómo se elimina la cuenta? → A: Desde la misma pantalla, con la contraseña actual y una confirmación escrita. El servidor borra primero los archivos de `meal-photos/<user_id>/` y `progress-photos/<user_id>/` y después la cuenta, y con ella todos sus registros (todas las tablas dependen de la cuenta y se borran en cascada). Es definitivo y no hay período de gracia.
- Q: ¿Y eliminar registros sin eliminar la cuenta? → A: Ya es posible registro por registro en cada pantalla (comidas, medidas, fotos, suplementos, rutinas, etc.). Esta spec no agrega un borrado masivo por categoría; la guía de la pantalla «Tus datos» explica dónde se borra cada tipo de dato.
- Q: ¿Qué pasa con las copias de seguridad del proveedor? → A: Los datos eliminados pueden permanecer en las copias de seguridad de Supabase por un tiempo limitado, que la aplicación informa como «hasta 30 días» (cota conservadora, a confirmar con el plan contratado en `Documentacion/privacidad.md`). No se restauran copias para recuperar cuentas eliminadas salvo una falla grave del servicio, y en ese caso se vuelve a eliminar lo que ya se había eliminado. Decisión #7.
- Q: ¿Qué plazo tienen los registros técnicos y qué herramienta de monitoreo se usa? → A: Los registros técnicos de las funciones no contienen datos personales (Principio IX) y se conservan lo que ofrece el panel de Supabase (hasta 7 días en el plan gratuito; la aplicación no los copia a otro lugar). El monitoreo es el panel de Supabase más las alertas por correo del proveedor; no se agrega una herramienta externa ni analítica de uso. Los registros propios de la aplicación se limpian solos: las marcas del límite de uso al día siguiente y los resultados de la IA a las 24 horas. Decisión #9.
- Q: ¿Qué cambia en el aviso de privacidad? → A: Se publica una versión nueva (`2026-11-01`) que reemplaza la promesa de «se agregarán» por lo que ya existe, y detalla servicios de terceros (Supabase, Brevo, Cloudflare Turnstile, Google Gemini), plazos y derechos. Las cuentas nuevas aceptan la versión vigente. Las cuentas existentes ven el aviso completo en `/privacidad`; no se les pide aceptar de nuevo (no cambia ningún uso de sus datos).
- Q: ¿Hay un documento de política completo? → A: Sí, `Documentacion/privacidad.md`, con datos que se guardan, quién los trata, retención, exportación, eliminación y copias de seguridad. La pantalla muestra un resumen y el mismo contenido esencial.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Descargar mis datos (Priority: P1)

La persona entra a «Tus datos» y descarga un archivo con todo lo que registró y, aparte, un ZIP con sus fotos.

**Why this priority**: derecho de acceso y portabilidad; la Constitution exige definirlo antes de publicar.

**Independent Test**: con una cuenta que tenga comidas, medidas, suplementos y una foto, descargar ambos archivos y comprobar que contienen lo registrado y nada de otra cuenta.

**Acceptance Scenarios**:

1. **Given** una cuenta con registros, **When** descarga sus datos, **Then** recibe un archivo JSON con cada tipo de registro propio, la fecha de exportación y la versión del formato.
2. **Given** dos cuentas, **Then** el archivo de una no contiene nada de la otra.
3. **Given** una cuenta con fotos, **When** descarga las fotos, **Then** recibe un ZIP con cada foto de comidas y de progreso, con nombre por fecha, y el archivo se puede abrir.
4. **Given** una cuenta sin fotos, **Then** se avisa que no hay fotos y no se descarga un ZIP vacío.
5. **Given** que falla la lectura, la red o una foto, **Then** se informa cuál no se pudo y no se entrega un archivo que parezca completo.
6. **Given** una descarga en curso, **Then** se muestra el avance, se puede cancelar y un doble toque no inicia dos.
7. **Given** cualquier dato sin valor, **Then** se exporta como nulo, nunca como cero.

---

### User Story 2 - Eliminar mi cuenta y mis datos (Priority: P1)

La persona elige «Eliminar mi cuenta», confirma con su contraseña y una frase, y todo lo suyo se borra, incluidos los archivos de fotos.

**Why this priority**: derecho de supresión; obligatorio antes de publicar.

**Independent Test**: crear una cuenta con registros y fotos, eliminarla y comprobar que no queda ninguna fila ni archivo suyo y que no puede volver a ingresar.

**Acceptance Scenarios**:

1. **Given** la pantalla, **Then** explica en lenguaje claro qué se borra, que es definitivo, qué puede quedar en copias de seguridad (hasta 30 días) y sugiere descargar los datos antes.
2. **Given** una contraseña incorrecta o la frase de confirmación sin escribir, **Then** no se elimina nada y se explica por qué.
3. **Given** la contraseña correcta y la confirmación, **When** confirma, **Then** se borran los archivos de ambas carpetas de fotos, la cuenta y todos sus registros, se cierra la sesión y se la lleva a la pantalla de ingreso con un aviso de que la cuenta fue eliminada.
4. **Given** la cuenta eliminada, **Then** no puede ingresar, no queda ninguna fila suya en ninguna tabla ni archivo en los depósitos, y su correo puede registrarse de nuevo.
5. **Given** un doble toque o un reintento, **Then** la eliminación se hace una sola vez y el reintento no falla de forma confusa.
6. **Given** que falla el borrado de archivos, **Then** la cuenta no se elimina a medias: se informa el error, no se pierde acceso y se puede reintentar.
7. **Given** más de 5 intentos de eliminación por hora, **Then** se limita el uso en texto neutral.
8. **Given** una sesión vencida, **Then** no se elimina nada hasta volver a ingresar.

---

### User Story 3 - Saber qué se guarda y con quién se comparte (Priority: P2)

La persona puede leer, desde la aplicación, qué datos se guardan, quién los trata, cuánto tiempo se conservan y cuáles son sus derechos.

**Why this priority**: transparencia; el aviso de la spec 001 prometía esto.

**Independent Test**: abrir «Tus datos» y comprobar que lista los servicios, los plazos y el camino para exportar y eliminar; registrar una cuenta nueva y comprobar que acepta la versión vigente del aviso.

**Acceptance Scenarios**:

1. **Given** la pantalla, **Then** muestra qué datos se guardan, qué servicios los tratan (Supabase, Brevo, Cloudflare Turnstile, Google Gemini y para qué), que las fotos de progreso nunca se envían a la IA y los plazos de retención.
2. **Given** el registro, **Then** el aviso resumido refleja el estado real (exportar y eliminar ya existen) y se acepta la versión vigente.
3. **Given** el menú, **Then** «Tus datos» es accesible desde «Más» y desde el perfil.
4. **Given** los textos, **Then** son neutrales, en español con tuteo, sin lenguaje legal innecesario ni presión.

---

### User Story 4 - Los datos temporales no se acumulan (Priority: P3)

Los resultados temporales de la IA y las marcas del límite de uso no se conservan más de lo necesario.

**Why this priority**: minimización; Principio I.

**Independent Test**: comprobar que los resultados de la IA de más de 24 horas y las marcas de uso de más de un día se eliminan, y que ninguna de estas tablas guarda texto de comidas fuera de ese plazo.

**Acceptance Scenarios**:

1. **Given** resultados de la IA de más de 24 horas, **Then** se eliminan cuando se guarda un resultado nuevo (de cualquier cuenta).
2. **Given** marcas del límite de uso de más de un día, **Then** se eliminan (ya ocurre; queda cubierto por prueba).

---

### Edge Cases

- Una cuenta con muchas fotos (hasta 200 de progreso más las de comidas): el ZIP se arma por partes sin cargar todo a la vez en memoria más de lo necesario y se puede cancelar.
- Una foto que ya no existe en el depósito: se omite, se informa en el resultado y el resto se descarga.
- Una cuenta sin carpeta de fotos: eliminar no falla.
- Cierre de la pestaña durante la eliminación: la operación es idempotente; al reintentar con la sesión válida continúa o, si la cuenta ya no existe, informa que ya no existe.
- La persona elimina la cuenta en un dispositivo y tiene la sesión abierta en otro: la sesión del otro deja de ser válida al instante porque la cuenta ya no existe.
- Sin conexión: se avisa y no se intenta; nada cambia.
- Texto de la frase de confirmación con mayúsculas, minúsculas o espacios: se compara sin distinguir mayúsculas y recortado.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: La aplicación MUST ofrecer una pantalla «Tus datos» (`/privacidad`) accesible desde «Más» y desde el perfil, con resumen de privacidad, exportación y eliminación de cuenta.
- **FR-002**: La persona MUST poder descargar un archivo JSON con todos los registros de su cuenta, con fecha de exportación y versión del formato; los datos faltantes MUST exportarse como nulos.
- **FR-003**: El archivo de exportación MUST contener únicamente datos de la cuenta que lo pide y MUST NOT incluir contraseñas, claves, tokens, el catálogo común ni los resultados temporales de la IA.
- **FR-004**: Una prueba MUST garantizar que toda tabla con datos de una cuenta esté incluida en la exportación, de modo que una tabla futura no quede afuera sin que alguien lo decida.
- **FR-005**: La persona MUST poder descargar un ZIP con sus fotos de comidas y de progreso; si no hay fotos MUST avisarse; si alguna falta o falla MUST informarse cuál y no presentarse el resultado como completo.
- **FR-006**: Las descargas MUST mostrar avance, permitir cancelar, evitar duplicarse con un doble toque y anunciarse a lectores de pantalla.
- **FR-007**: La persona MUST poder eliminar su cuenta confirmando con su contraseña actual y una frase escrita; sin ambas MUST NOT eliminarse nada.
- **FR-008**: La eliminación MUST borrar primero los archivos de `meal-photos/<user_id>/` y `progress-photos/<user_id>/` y después la cuenta; si el borrado de archivos falla MUST NOT eliminar la cuenta y MUST poder reintentarse.
- **FR-009**: Al eliminar la cuenta MUST borrarse todo registro de la cuenta en todas las tablas (borrado en cascada); una prueba MUST garantizar que toda tabla con `user_id` dependa de la cuenta con borrado en cascada.
- **FR-010**: La eliminación MUST ser idempotente, MUST requerir sesión vigente, MUST limitarse a 5 intentos por hora y por cuenta y MUST cerrar la sesión de la persona en la aplicación al terminar.
- **FR-011**: La pantalla MUST informar con claridad qué se borra, que es definitivo, que puede permanecer en copias de seguridad del proveedor hasta 30 días y MUST sugerir descargar los datos antes.
- **FR-012**: Los registros técnicos de la exportación y la eliminación MUST NOT contener datos personales, identificadores de la persona, rutas de archivos ni correos.
- **FR-013**: Los resultados temporales de la IA de más de 24 horas MUST eliminarse de forma global al guardar uno nuevo, y las marcas del límite de uso de más de un día MUST eliminarse.
- **FR-014**: El aviso de privacidad resumido del registro MUST actualizarse a una versión nueva vigente (`2026-11-01`) que refleje el estado real; las cuentas nuevas MUST aceptar la versión vigente.
- **FR-015**: Debe existir `Documentacion/privacidad.md` con datos que se guardan, quién los trata y para qué, plazos de retención, exportación, eliminación, copias de seguridad y monitoreo, y la pantalla MUST resumir el mismo contenido esencial.
- **FR-016**: Todas las pantallas nuevas MUST tener estados de carga, vacío, éxito y error en español con tuteo y lenguaje neutral, cumplir WCAG 2.1 AA, ser usables por teclado y lector de pantalla y no tener desplazamiento horizontal a 375 px.
- **FR-017**: Las pruebas funcionales existentes MUST seguir pasando sin cambios de comportamiento.

### Key Entities _(include if feature involves data)_

- **Exportación**: archivo generado al momento, no se guarda en el servidor. Contiene los registros de una cuenta por tipo.
- **Solicitud de eliminación**: operación sobre una cuenta; no se guarda como registro (la cuenta deja de existir).
- **Versión del aviso de privacidad** (existente): se agrega la `2026-11-01` como vigente.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Una persona descarga sus datos en menos de 3 toques desde «Más» y el archivo contiene el 100 % de los tipos de registro de la cuenta (prueba de cobertura).
- **SC-002**: Tras eliminar una cuenta de prueba con registros en todas las tablas y fotos en ambas carpetas, quedan 0 filas y 0 archivos suyos.
- **SC-003**: Ninguna exportación contiene datos de otra cuenta (prueba de aislamiento).
- **SC-004**: Si el borrado de archivos falla, la cuenta sigue existiendo en el 100 % de los casos simulados.
- **SC-005**: Los registros técnicos de las funciones nuevas no contienen datos personales (prueba).
- **SC-006**: Ninguna pantalla nueva tiene violaciones graves o críticas de accesibilidad ni desplazamiento horizontal a 375 y 1280 px.
- **SC-007**: Las pruebas existentes siguen pasando.

## Assumptions

- La persona es la única que usa la cuenta; no hay cuentas compartidas, menores ni representantes.
- El proveedor de datos (Supabase) conserva copias de seguridad según su plan; el plazo informado (30 días) es una cota que se confirma al contratar el plan de producción.
- El correo de la persona figura en la cuenta del proveedor; la exportación incluye el correo y la zona horaria del perfil porque son datos suyos.
- La confirmación por correo previa a eliminar no se exige: la contraseña actual y la sesión vigente bastan para el MVP.
- No hay recuperación de una cuenta eliminada.

## Out of Scope

- Borrado masivo por categoría sin eliminar la cuenta.
- Exportación en formatos distintos de JSON y ZIP, o importación de datos.
- Portabilidad hacia otras aplicaciones.
- Solicitudes de acceso por terceros, representantes o autoridades.
- Herramientas externas de monitoreo, analítica de uso o seguimiento de errores del navegador.
- Período de gracia o recuperación de cuentas eliminadas.
- Cumplimiento legal específico de una jurisdicción: esta spec define el comportamiento del producto; la revisión legal es del autor antes de abrir la aplicación.

# Feature Specification: Cuentas, perfil y base de la PWA

**Feature Branch**: `001-cuentas-perfil-pwa`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Spec 001 del roadmap: registro, inicio y cierre de sesión; perfil (fecha de nacimiento, sexo, altura, zona horaria, unidades métricas); modelo de propiedad de registros; esqueleto de PWA online-only con mensaje sin conexión y borradores locales que se borran al cerrar sesión; estados de carga, vacío, éxito y error."

## Clarifications

### Session 2026-10-16

- Q: ¿Debe la persona confirmar que es dueña del correo antes de poder usar su cuenta? → A: Confirmación no bloqueante (por ser un MVP): puede entrar de inmediato, pero la recuperación de contraseña solo funciona con el correo confirmado y se le recuerda confirmarlo.
- Q: ¿Puede la persona cambiar su correo y su contraseña estando con sesión iniciada? → A: Solo la contraseña (pidiendo la contraseña actual); el correo queda fijo en el MVP.
- Q: ¿Debe la persona ver y aceptar un aviso de privacidad al crear su cuenta? → A: Aviso simple con aceptación: resumen breve en español de qué datos se guardan y cómo se protegen; debe marcar que lo leyó y la cuenta guarda qué versión aceptó y cuándo.
- Q: Al cambiar o recuperar la contraseña, ¿se cierran las sesiones abiertas en otros dispositivos? → A: Sí, se cierran todas las demás; la sesión actual se mantiene cuando el cambio se hace desde dentro de la aplicación.
- Q: ¿Por cuánto tiempo se mantiene abierta la sesión si la persona no usa la aplicación? → A: 30 días de inactividad; la sesión se renueva con cada uso y vence tras 30 días sin abrir la aplicación.

### Session 2026-10-16 (resolución del análisis de consistencia)

- Q: ¿Dónde se usa el captcha? → A: Solo en registro y recuperación de contraseña. El inicio de sesión no depende de ningún servicio externo y se protege con límites de intentos.
- Q: ¿Qué límite de intentos fallidos de inicio de sesión se aplica? → A: Solo el límite por IP que ofrece la plataforma, ajustado al valor más estricto razonable, más una contraseña mínima de 10 caracteres. El bloqueo por cuenta (por ejemplo, 5 intentos en 15 minutos) no es aplicable de forma real en el plan gratuito, porque el endpoint de autenticación es público; queda como mejora para el plan de pago.
- Q: Si el captcha no responde en registro o recuperación, ¿qué hace la aplicación? → A: Bloquea la operación con un aviso claro y la persona puede reintentar más tarde; sin captcha no se crean cuentas ni se piden recuperaciones. El inicio de sesión no se ve afectado.
- Q: Al registrarse con un correo que ya tiene cuenta, ¿qué mensaje se muestra? → A: Un mensaje claro ("Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña"). Revela que el correo existe; se acepta como residual del MVP, mitigado por captcha y límites por IP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una cuenta e iniciar sesión (Priority: P1)

Una persona crea su cuenta con correo electrónico y contraseña, inicia sesión, mantiene su sesión abierta entre visitas, puede cerrarla cuando quiera y puede recuperar el acceso si olvida su contraseña. Sin una cuenta no se puede guardar ningún dato de bienestar, por lo que esta historia es la base de toda la aplicación.

**Why this priority**: Todas las demás funcionalidades guardan datos personales sensibles que, según la Constitution (Principio I), deben estar autenticados y asociados a una cuenta. Nada más puede construirse ni probarse sin esto.

**Independent Test**: Se puede probar por completo creando una cuenta, cerrando sesión, volviendo a iniciar sesión, y recuperando la contraseña con un enlace recibido por correo. Entrega valor porque deja una app protegida y lista para recibir datos.

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta, **When** completa el registro con un correo y una contraseña válidos y marca que leyó el aviso de privacidad, **Then** la cuenta queda creada, la sesión queda iniciada y se la guía a completar su perfil.
2. **Given** una cuenta existente, **When** la persona inicia sesión con credenciales correctas, **Then** accede a la aplicación y su sesión se mantiene al cerrar y volver a abrir la aplicación, y solo vence tras 30 días sin usarla.
3. **Given** una persona con sesión iniciada, **When** cierra sesión, **Then** la sesión termina y no puede ver datos privados sin volver a autenticarse.
4. **Given** una persona con el correo confirmado que olvidó su contraseña, **When** solicita recuperarla y usa el enlace recibido, **Then** puede establecer una contraseña nueva y volver a ingresar.
5. **Given** una persona recién registrada con el correo sin confirmar, **When** inicia sesión, **Then** puede usar la aplicación y ve un recordatorio para confirmar su correo, con la opción de reenviar el enlace.
6. **Given** una persona con el correo sin confirmar, **When** solicita recuperar su contraseña, **Then** el sistema no envía el enlace de recuperación y le indica que primero debe confirmar el correo.
7. **Given** credenciales incorrectas, **When** intenta iniciar sesión, **Then** recibe un mensaje de error claro que no revela si el correo existe.
8. **Given** una persona con sesión iniciada, **When** ingresa su contraseña actual y una contraseña nueva válida, **Then** la contraseña se actualiza y se cierran las sesiones abiertas en otros dispositivos; si la contraseña actual es incorrecta, el cambio se rechaza con un mensaje claro.
9. **Given** una persona con sesiones abiertas en dos dispositivos, **When** recupera su contraseña desde un enlace de recuperación, **Then** todas sus sesiones anteriores se cierran y debe iniciar sesión con la contraseña nueva.
10. **Given** un correo que ya tiene cuenta, **When** alguien intenta registrarse con él, **Then** ve el mensaje "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña" y no se crea una cuenta nueva.
11. **Given** una IP que supera el límite de intentos de inicio de sesión fallidos, **When** intenta ingresar de nuevo, **Then** el intento se rechaza temporalmente con un aviso de que debe esperar, sin revelar si el correo existe; pasado el período de espera puede intentarlo otra vez.

---

### User Story 2 - Mis datos son solo míos (Priority: P1)

Cada dato que la aplicación guarda pertenece a una única cuenta. Ninguna persona, ni siquiera otra con sesión iniciada, puede leer, modificar ni eliminar los datos de otra. Quien no inició sesión no puede acceder a ningún dato ni archivo privado.

**Why this priority**: Es el modelo de propiedad que todos los registros futuros (comidas, sesiones, fotos, mediciones) van a heredar. Si no se establece desde el inicio, corregirlo después implica rehacer todo el almacenamiento.

**Independent Test**: Con dos cuentas de prueba, cada una crea su perfil; se verifica que la cuenta A no puede ver ni modificar el perfil de la cuenta B, y que una solicitud sin sesión es rechazada.

**Acceptance Scenarios**:

1. **Given** dos cuentas con perfil completo, **When** la cuenta A intenta leer o modificar el perfil de la cuenta B, **Then** el acceso es rechazado y no se revela información de B.
2. **Given** una persona sin sesión iniciada, **When** intenta abrir cualquier pantalla privada o pedir datos privados, **Then** es redirigida al inicio de sesión y no recibe datos.
3. **Given** una sesión que expiró, **When** la persona intenta guardar un cambio, **Then** se le pide volver a autenticarse y el cambio no se pierde silenciosamente (ver Historia 4).

---

### User Story 3 - Configurar mi perfil (Priority: P2)

La persona completa y puede editar su perfil: fecha de nacimiento, sexo (opcional), altura y zona horaria. El sistema de unidades es siempre métrico y así se muestra. Estos datos luego se usan en otras funcionalidades (por ejemplo, estimar el gasto energético) y para interpretar fechas y horas correctamente.

**Why this priority**: Es necesario para las funcionalidades de nutrición y entrenamiento que dependen de estos datos, pero el acceso protegido (Historias 1 y 2) debe existir antes.

**Independent Test**: Iniciar sesión con una cuenta nueva, completar el perfil, cerrar y reabrir la aplicación y comprobar que los valores persisten con sus unidades. Se puede editar y corregir cualquier campo.

**Acceptance Scenarios**:

1. **Given** una cuenta recién creada, **When** la persona completa el perfil con valores válidos, **Then** el perfil queda guardado y se confirma el éxito.
2. **Given** un perfil guardado, **When** la persona edita la altura, **Then** el nuevo valor se guarda y se muestra con su unidad (cm).
3. **Given** el perfil, **When** la persona no desea indicar su sexo, **Then** puede omitirlo y la aplicación lo trata como dato no informado, sin suponer un valor.
4. **Given** un valor fuera de un rango razonable (por ejemplo, una altura negativa), **When** intenta guardar, **Then** se muestra un error comprensible y no se guarda.
5. **Given** que la zona horaria detectada del dispositivo difiere de la guardada, **When** la persona abre la aplicación, **Then** la aplicación no cambia la zona horaria sin su confirmación.

---

### User Story 4 - Instalar la app y saber cuándo no hay conexión (Priority: P2)

La persona puede instalar la aplicación en su teléfono o computadora como una app y abrirla desde allí. La aplicación requiere conexión: si no hay conexión, se abre únicamente para mostrar un mensaje claro de que no está disponible, y nunca da a entender que un dato se guardó si no llegó al servidor. Si se pierde el trabajo en un formulario por una recarga o un corte de red, el borrador se conserva localmente hasta que el servidor confirme el guardado, y se elimina al cerrar sesión.

**Why this priority**: Define el comportamiento de la PWA y la protección contra pérdida de datos que reutilizarán todos los formularios futuros, pero el producto ya es utilizable sin instalar.

**Independent Test**: Instalar la app, abrirla sin conexión y verificar el mensaje. Con conexión, empezar a editar el perfil, recargar la pestaña y comprobar que el borrador reaparece; cerrar sesión y comprobar que el borrador ya no está.

**Acceptance Scenarios**:

1. **Given** un navegador compatible, **When** la persona usa la opción de instalar, **Then** la aplicación queda instalada y se abre en su propia ventana.
2. **Given** que no hay conexión, **When** la persona abre la aplicación o intenta guardar algo, **Then** ve un mensaje claro de que la aplicación no está disponible sin conexión y no se muestra ningún dato como guardado.
3. **Given** un formulario de perfil a medio completar, **When** la pestaña se recarga accidentalmente o falla la red, **Then** al volver los datos ingresados se recuperan como borrador y no se consideran guardados hasta confirmación del servidor.
4. **Given** un borrador local pendiente, **When** la persona cierra sesión, **Then** el borrador se elimina del dispositivo.
5. **Given** que el servidor confirmó el guardado, **When** la persona vuelve al formulario, **Then** el borrador local se descarta.

---

### Edge Cases

- ¿Qué pasa si se intenta registrar un correo que ya tiene cuenta? Se muestra un mensaje claro de que ya existe (decisión del autor); esto revela que el correo está registrado y se acepta como residual del MVP, mitigado por captcha y límite por IP.
- ¿Qué pasa si el captcha no responde al registrarse o pedir una recuperación? La operación se bloquea con un aviso claro para reintentar más tarde; el inicio de sesión sigue funcionando.
- ¿Qué pasa si el proveedor de correo falla al enviar la confirmación o la recuperación? La cuenta se crea igual y se puede usar; se informa que el correo no pudo enviarse y se ofrece reintentar. El fallo queda registrado con su causa técnica y sin datos personales.
- ¿Qué pasa si alguien intenta adivinar contraseñas repetidamente? Al superar el límite de intentos por IP, los intentos siguientes se rechazan temporalmente; el aviso no revela si el correo existe. No hay bloqueo por cuenta en el MVP.
- ¿Qué pasa si la persona nunca confirma su correo? La cuenta sigue usable, pero sin recuperación de contraseña; si olvida la contraseña, no podrá recuperar el acceso por este medio.
- ¿Qué pasa si el enlace de confirmación venció? Se ofrece reenviar uno nuevo.
- ¿Qué pasa si la contraseña es débil o demasiado corta? Se rechaza con una indicación clara de los requisitos.
- ¿Qué pasa con un doble clic en "Crear cuenta" o un reintento de red? No se crean cuentas duplicadas (idempotencia, Principio II).
- ¿Qué pasa si el enlace de recuperación de contraseña venció o ya fue usado? Se informa que no es válido y se ofrece pedir uno nuevo.
- ¿Qué pasa si la sesión expira mientras la persona completa el perfil? Se le pide autenticarse de nuevo y el borrador se conserva localmente.
- ¿Qué pasa si se pierde la conexión justo al guardar? Se informa el fallo, se conserva el borrador y no se muestra como guardado.
- ¿Qué pasa en un dispositivo compartido? Al cerrar sesión no queda ningún borrador ni dato privado accesible en el navegador.
- ¿Qué pasa si la persona viaja y cambia de zona horaria? La zona horaria del perfil solo cambia cuando la persona lo confirma, y los registros históricos no se reinterpretan.
- ¿Qué pasa si se intenta guardar una fecha de nacimiento futura o una altura fuera de un rango razonable? Se rechaza con un mensaje comprensible.
- ¿Qué pasa en navegadores que no permiten instalar la PWA? La aplicación sigue funcionando en el navegador.

## Requirements *(mandatory)*

### Functional Requirements

**Cuentas y sesión**

- **FR-001**: El sistema MUST permitir crear una cuenta con correo electrónico y contraseña.
- **FR-002**: El sistema MUST validar el formato del correo y exigir una contraseña que cumpla requisitos mínimos de seguridad, informándolos claramente.
- **FR-003**: El sistema MUST permitir iniciar y cerrar sesión, y mantener la sesión abierta entre visitas; la sesión MUST renovarse con cada uso y vencer tras 30 días sin actividad, pidiendo iniciar sesión de nuevo.
- **FR-004**: El sistema MUST permitir recuperar el acceso mediante un enlace temporal y de un solo uso enviado al correo de la cuenta, siempre que ese correo esté confirmado (ver FR-026).
- **FR-005**: Los mensajes de error de inicio de sesión y de recuperación MUST NOT revelar si un correo tiene cuenta. La única excepción aceptada es el registro con un correo ya existente (ver Edge Cases).
- **FR-006**: El sistema MUST aplicar un límite de intentos de inicio de sesión por IP, con el valor más estricto razonable que permita la plataforma (valor concreto documentado en el plan), y MUST rechazar temporalmente los intentos que lo superen sin revelar si el correo existe. El bloqueo por cuenta queda fuera del MVP.
- **FR-007**: La creación de cuenta y la solicitud de recuperación MUST ser idempotentes ante dobles envíos o reintentos de red.
- **FR-008**: El registro de cuentas MUST estar abierto a cualquier persona con un correo válido, y el sistema MUST incluir protecciones contra registros automatizados o abusivos: un captcha en el registro y en la solicitud de recuperación, y un límite de solicitudes por IP. Si el captcha no está disponible, la operación MUST bloquearse con un aviso claro para reintentar más tarde. El inicio de sesión MUST NOT usar captcha.

- **FR-026**: Tras el registro, el sistema MUST enviar un enlace de confirmación del correo. La cuenta MUST poder usarse sin confirmarlo, pero MUST mostrar un recordatorio visible con la opción de reenviar el enlace hasta que se confirme. Si el proveedor de correo falla, la cuenta MUST crearse igual, la persona MUST ser informada de que el correo no pudo enviarse con la opción de reintentar, y el fallo MUST registrarse con su causa técnica sin datos personales.
- **FR-027**: Si el correo no está confirmado, la solicitud de recuperación de contraseña MUST NOT enviar el enlace de recuperación, y MUST informar que primero debe confirmarse el correo.

- **FR-028**: Con sesión iniciada, el usuario MUST poder cambiar su contraseña ingresando la contraseña actual y una nueva que cumpla los requisitos de FR-002. El correo de la cuenta MUST NOT poder modificarse en el MVP.
- **FR-030**: Al cambiar la contraseña, el sistema MUST cerrar todas las demás sesiones de la cuenta y mantener la sesión actual. Al restablecerla mediante un enlace de recuperación, el sistema MUST cerrar todas las sesiones de la cuenta.

- **FR-029**: El registro MUST mostrar un aviso de privacidad breve, en español, que indique qué datos se guardan y cómo se protegen, y MUST exigir que la persona marque que lo leyó para crear la cuenta. La cuenta MUST guardar qué versión del aviso aceptó y cuándo, y el sistema MUST rechazar versiones del aviso que no estén vigentes.

**Propiedad y acceso a los datos**

- **FR-009**: Todo registro del sistema MUST pertenecer a exactamente una cuenta.
- **FR-010**: Toda lectura, escritura y eliminación MUST verificar que quien la solicita es la propietaria del registro, sin confiar en datos enviados por el cliente.
- **FR-011**: El sistema MUST rechazar con una respuesta uniforme cualquier acceso de una cuenta a registros de otra, sin revelar si el registro existe.
- **FR-012**: Ninguna pantalla ni dato privado MUST ser accesible sin una sesión iniciada.

**Perfil**

- **FR-013**: El usuario MUST poder ingresar y editar fecha de nacimiento, sexo (opcional, con la opción de no indicarlo), altura y zona horaria.
- **FR-014**: El sistema MUST validar los valores del perfil dentro de rangos razonables y mostrar errores comprensibles.
- **FR-015**: El sistema MUST usar el sistema métrico en todo valor mostrado, indicando siempre su unidad.
- **FR-016**: El sistema MUST proponer la zona horaria del dispositivo, pero solo cambiar la guardada con confirmación del usuario.
- **FR-017**: Un dato de perfil no informado MUST mostrarse como no informado y MUST NOT reemplazarse con valores supuestos.
- **FR-031**: Las fechas del perfil MUST mostrarse e ingresarse con el formato de la configuración regional del usuario (por ejemplo, día/mes/año en español de Argentina).

**PWA, conexión y borradores**

- **FR-018**: La aplicación MUST ser instalable como PWA en plataformas compatibles y MUST ser responsive en pantallas pequeñas y grandes.
- **FR-019**: La aplicación MUST NOT ofrecer funciones de registro ni consulta sin conexión ni cola de sincronización diferida.
- **FR-020**: Sin conexión, la aplicación MUST mostrar un mensaje claro de no disponibilidad y MUST NOT dar a entender que algo se guardó si no llegó al servidor.
- **FR-021**: Los formularios en curso MUST conservar su estado de borrador localmente hasta recibir confirmación del servidor.
- **FR-022**: Al cerrar sesión, el sistema MUST eliminar todo borrador y dato privado almacenado localmente en el dispositivo.

**Experiencia y accesibilidad**

- **FR-023**: Cada pantalla principal MUST tener estados de carga, vacío, éxito y error definidos.
- **FR-024**: La interfaz MUST estar en español, con controles con etiquetas accesibles, navegación por teclado y errores comprensibles.
- **FR-025**: La aplicación MUST NOT depender de una integración externa para el inicio de sesión ni la edición del perfil. El registro y la recuperación solo dependen del envío de correos y del captcha (ver FR-008); una caída de estos servicios MUST NOT impedir iniciar sesión ni usar la aplicación.

### Key Entities *(include if feature involves data)*

- **Cuenta**: la identidad de una persona en la aplicación. Atributos: correo electrónico, estado de confirmación del correo (confirmado o sin confirmar), credencial de acceso, versión del aviso de privacidad aceptada y fecha de aceptación, fecha de creación. Es la propietaria de todos los registros futuros.
- **Sesión**: el estado de acceso de una cuenta en un dispositivo; puede iniciarse, expirar o cerrarse.
- **Solicitud de recuperación de acceso**: un permiso temporal y de un solo uso para restablecer la contraseña de una cuenta.
- **Perfil**: datos personales de la cuenta, relación uno a uno con la Cuenta. Atributos: fecha de nacimiento, sexo (opcional), altura (cm), zona horaria, sistema de unidades (métrico).
- **Borrador local**: copia temporal, en el dispositivo, de un formulario aún no confirmado por el servidor; se elimina al confirmarse o al cerrar sesión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona nueva puede crear su cuenta y completar su perfil en menos de 3 minutos.
- **SC-002**: Una persona con cuenta puede iniciar sesión en menos de 30 segundos.
- **SC-003**: En pruebas con dos cuentas, el 100 % de los intentos de leer, modificar o eliminar datos de la otra cuenta o sin sesión son rechazados.
- **SC-004**: Una persona que olvidó su contraseña puede recuperar el acceso en menos de 5 minutos.
- **SC-005**: Al recargar la pestaña a mitad de un formulario, el 100 % de los datos ingresados se recuperan como borrador, y tras cerrar sesión ninguno queda en el dispositivo.
- **SC-006**: Sin conexión, en el 100 % de los intentos de guardar se informa claramente que no está disponible y ningún dato se muestra como guardado.
- **SC-007**: Las vistas de cuenta y perfil se pueden usar y completar sin errores en pantalla de teléfono y de escritorio.
- **SC-008**: La aplicación cumple los criterios técnicos de instalación como PWA en las plataformas objetivo.
- **SC-009**: Un doble clic o un reintento de red al crear la cuenta resulta en una única cuenta en el 100 % de los casos.

## Assumptions

- Las personas usuarias inician sesión con correo y contraseña. Otros métodos (por ejemplo, cuentas de terceros) quedan fuera de esta spec.
- Las dependencias externas aceptadas en esta spec son el envío de correos (confirmación y recuperación) y el captcha (registro y recuperación). El inicio de sesión no depende de ninguna.
- El aviso de privacidad es un resumen breve, no una política legal completa ni términos de uso; su redacción final y la política completa se definen en la spec 011. Qué ocurre cuando cambia la versión del aviso (volver a pedir aceptación) queda fuera de esta spec.
- El correo de la cuenta no se puede cambiar en el MVP; un correo mal escrito exige crear una cuenta nueva. Cambiar el correo queda para una spec posterior.
- La confirmación del correo no es bloqueante solo por ser un MVP. Antes de publicar para otras personas debe reevaluarse si pasa a ser obligatoria.
- La verificación de edad y las protecciones para menores están fuera del alcance del MVP (Constitution, "Fuera del alcance del MVP"). Se pide la fecha de nacimiento solo como dato de perfil, sin verificarla.
- El sexo es opcional. Se recoge porque lo usarán más adelante las estimaciones de gasto energético; mientras no se informe, esas estimaciones deberán indicarlo.
- La zona horaria se propone según el dispositivo y el usuario puede cambiarla. La regla de corte del día a las 00:00 y la imputación de comidas se definen en la spec 003.
- Solo se ofrece el sistema métrico (kg, cm, g, ml, kcal), según la Constitution.
- Las políticas de exportación, eliminación completa de cuenta y retención de copias de seguridad se definen en la spec 011 y no forman parte de esta spec.
- Las decisiones técnicas (framework, backend, autenticación, base de datos, almacenamiento) se resuelven en el plan de esta spec, no aquí.
- Los requisitos concretos de la contraseña (longitud mínima y máxima) se fijan en el plan. Los límites de intentos de inicio de sesión ya están definidos en FR-006.
- El plazo de retención de los registros técnicos (logs) generados por esta spec se define en la spec 011 (Constitution, Principio IX); hasta entonces rige el plazo por defecto del proveedor y se documenta como deuda.
- El MVP lo usa una sola persona, pero el registro es abierto (decisión del autor) y esta spec implementa la autenticación y el aislamiento entre cuentas por tratarse de datos de salud accesibles por internet (Principio I). Con registro abierto, la spec 011 (privacidad y ciclo de vida de los datos) es obligatoria antes de publicar.

# Constitution — Fitness Tracking App

**Versión:** 1.2.0  
**Ratificada:** 2026-10-16  
**Última modificación:** 2026-10-16  
**Estado:** Ratificada para el MVP  
**Metodología:** Spec-Driven Development (Spec Kit)  
**Idioma del producto:** Español  
**Plataforma objetivo:** Aplicación web responsive instalable como PWA, multiusuario y con conexión obligatoria

## Propósito

Construir una aplicación personal de seguimiento de bienestar y entrenamiento que permita registrar y analizar alimentación, sueño, actividad diaria, entrenamientos y evolución física. La aplicación debe ayudar al usuario a comprender tendencias y tomar decisiones informadas, sin presentar estimaciones como certezas ni fomentar conductas alimentarias o de ejercicio perjudiciales.

Esta Constitution define principios permanentes para todas las funcionalidades. Los detalles de pantallas, flujos, proveedores, algoritmos e integraciones se definirán en las especificaciones y planes de implementación correspondientes.

## Principios fundamentales

### I. Privacidad, seguridad y control de los datos

- La aplicación MUST tratar fotos corporales, fotos de comidas, peso, medidas, sueño, alimentación y registros de entrenamiento como datos personales que requieren protección.
- El acceso a los datos MUST estar autenticado y autorizado; ningún dato privado ni archivo de usuario MUST quedar públicamente accesible por defecto.
- Las claves de API y otros secretos MUST NOT incluirse en el código del frontend, repositorios, logs del cliente ni variables públicas compiladas. Las llamadas que requieran secretos MUST pasar por un backend o una función de servidor segura.
- La aplicación MUST solicitar solo los permisos necesarios y explicar por qué se necesitan.
- El usuario MUST poder consultar, editar y eliminar sus propios registros. La política de exportación, eliminación completa y retención de copias de seguridad MUST definirse antes de publicar una versión con usuarios reales.
- Las fotos y los datos sensibles MUST manejarse con acceso restringido y transmitirse mediante canales seguros.
- Las funciones de analítica y proveedores externos MUST recibir únicamente los datos necesarios para la tarea autorizada. En el MVP, el envío de imágenes a proveedores de IA se limita exclusivamente a fotos de comidas; las fotos de progreso corporal MUST NOT enviarse a servicios externos de IA. Para el análisis de comidas no se exige restricción de uso para entrenamiento de modelos por parte del proveedor de IA.
- La aplicación es multiusuario: cada registro MUST pertenecer a una cuenta, y toda lectura, escritura y eliminación MUST verificar que el solicitante es el propietario del registro.
- Las fotos MUST almacenarse en un almacenamiento privado, cifradas en reposo y transmitidas cifradas. Para el MVP basta con el cifrado en reposo que ofrezca por defecto el proveedor de almacenamiento elegido, siempre que quede documentado; el cifrado adicional a nivel de aplicación queda fuera del MVP.
- Los metadatos de las fotos subidas (EXIF, incluida la geolocalización) MUST eliminarse en el servidor antes de almacenarlas, salvo que una especificación justifique conservar alguno.

**Criterios verificables**
- No hay secretos de API en el bundle del frontend ni en el repositorio.
- Las pruebas verifican que un usuario no pueda acceder a registros de otro.
- Los archivos privados no se pueden recuperar mediante una URL pública sin autorización.
- Existe un flujo documentado para eliminar registros y cuenta, y se informa qué datos podrían permanecer temporalmente en copias de seguridad.
- Una foto con geolocalización en su EXIF no la conserva una vez almacenada.
- El almacenamiento de fotos no tiene listados ni accesos públicos habilitados.
- Ningún flujo del MVP envía fotos corporales o de progreso físico a proveedores externos de IA.

### II. Integridad, trazabilidad y propiedad de los registros

- La aplicación MUST distinguir entre datos introducidos por el usuario, datos importados, estimaciones automáticas y valores confirmados.
- Las estimaciones de IA MUST NOT sobrescribir silenciosamente información confirmada por el usuario.
- La planificación y la ejecución real MUST almacenarse como conceptos separados. Reprogramar una sesión MUST NOT borrar ni reescribir el registro de lo que realmente ocurrió.
- Los registros históricos confirmados (como sesiones de entrenamiento completadas y comidas registradas) MUST almacenar una instantánea (snapshot) o mantener referencias inmutables de los valores relevantes en ese momento (macros y calorías del alimento, nombre y tipo de medición del ejercicio), de modo que editar o eliminar un ítem del catálogo general MUST NOT alterar retroactivamente el historial.
- Los cambios importantes —como editar una comida confirmada, modificar una rutina o reprogramar un entrenamiento— MUST conservar un estado coherente y evitar duplicaciones.
- La aplicación MUST validar entradas y manejar fallos de red, reintentos y operaciones repetidas sin crear registros duplicados. Las operaciones de creación de registros críticos (comidas, entrenamientos, mediciones) y las solicitudes de análisis por IA MUST ser idempotentes para evitar que dobles clics o reintentos de red dupliquen datos o consuman cuota de IA por duplicado.
- Las fechas y horas MUST manejarse de forma consistente con la zona horaria del usuario. El día calendario finaliza a las 00:00 hs, pero la aplicación MUST permitir que el usuario impute registros (como una última comida nocturna pasada la medianoche) al día que esté gestionando antes de pasar o abrir los registros del día siguiente.

**Criterios verificables**
- Mover una sesión en el calendario no cambia las fechas ni los ejercicios de sesiones ya realizadas.
- Editar un alimento o un ejercicio del catálogo no modifica las calorías ni los datos de comidas o sesiones ya confirmadas en fechas anteriores.
- Un registro confirmado no cambia al volver a analizar una foto.
- Reintentar una operación o hacer doble envío no genera comidas, sesiones ni llamadas a la IA duplicadas.
- El usuario puede identificar el origen y el estado de un dato: manual, importado, estimado o confirmado.
- El usuario puede cargar una comida pasada la medianoche dentro del día que está cerrando, y comenzar un nuevo día de registro cuando lo disponga.

### III. Estimaciones nutricionales transparentes y corregibles

- El usuario MUST poder registrar una comida escribiéndola, sin necesidad de adjuntar una foto. La foto MUST ser opcional.
- Cuando se utilice una imagen o texto para identificar alimentos, la aplicación MUST presentar los resultados como estimaciones y permitir corregir alimentos, ingredientes, cantidades y porciones antes de confirmar.
- Las calorías y macronutrientes MUST calcularse a partir de datos identificables y de cantidades explícitas o estimadas que se muestren al usuario.
- La aplicación MUST indicar cuándo faltan datos, cuándo una porción es incierta y cuándo no se pudo estimar de forma confiable.
- Los resultados nutricionales MUST NOT comunicarse con una precisión mayor que la que permiten los datos de entrada.
- La app MUST distinguir entre valores estimados, valores de etiquetas o fuentes nutricionales y valores confirmados por el usuario.
- La elección de proveedor de IA, base de datos nutricional y método de cálculo MUST documentarse en las especificaciones técnicas y validarse antes de implementarse.
- Los errores o la indisponibilidad de un proveedor externo MUST permitir que el usuario registre la comida manualmente.

**Criterios verificables**
- Es posible crear y confirmar una comida sin foto.
- Es posible editar una estimación antes de guardarla como confirmada.
- La interfaz identifica que los valores estimados pueden contener errores.
- Un fallo de la IA no impide el registro manual de la comida.

### IV. Información de salud responsable y recomendaciones no coercitivas

- La aplicación MUST mostrar calorías consumidas y el progreso respecto del objetivo diario únicamente cuando exista un objetivo configurado.
- Las calorías restantes MUST calcularse de forma transparente a partir del objetivo y de los registros del día, diferenciando los valores estimados de los confirmados.
- Si el usuario supera el objetivo, la app MUST informar la diferencia de manera neutral y MUST NOT sugerir saltarse comidas, compensar mediante ejercicio ni aplicar restricciones extremas.
- Las recomendaciones MUST ser informativas, proporcionales a la calidad de la información y presentadas como sugerencias, no como órdenes ni diagnósticos.
- La aplicación MUST comunicar las limitaciones de sus análisis y MUST NOT diagnosticar enfermedades ni afirmar que puede determinar con exactitud el porcentaje de grasa corporal a partir de fotos.
- Los objetivos energéticos, las estimaciones de gasto y las recomendaciones deben poder revisarse; no se deben ajustar automáticamente de manera agresiva a partir de fluctuaciones diarias.
- La app MUST evitar lenguaje culpabilizante, moralizante o que clasifique alimentos como buenos o malos.
- Cuando los datos sean insuficientes o exista una señal potencialmente preocupante, la aplicación MUST comunicar la limitación y recomendar apoyo profesional cuando corresponda, sin emitir un diagnóstico.

**Criterios verificables**
- El resumen diario muestra el objetivo, el total registrado y la diferencia con etiquetas claras sobre la incertidumbre.
- Superar el objetivo no activa recomendaciones de ayuno, ejercicio compensatorio o recortes extremos.
- Las recomendaciones indican qué datos las motivan y evitan atribuir causalidad a simples correlaciones.

### V. Seguimiento consistente de entrenamiento, recuperación y evolución

- La aplicación MUST permitir registrar ejercicios, series, repeticiones, cargas y, cuando corresponda, esfuerzo percibido, sustituciones y notas.
- La aplicación MUST distinguir rutina planificada, sesión realizada, sesión modificada, sesión reprogramada y sesión cancelada.
- El calendario MUST permitir mover entrenamientos sin perder el historial ni duplicar sesiones.
- La aplicación MUST permitir registrar sueño, descanso, energía y actividad diaria, dejando claro cuándo un dato es manual o procede de una integración.
- Los gráficos MUST permitir comparar períodos y mostrar unidades, fechas y contexto suficiente para interpretar la tendencia.
- La aplicación MUST evitar conclusiones firmes basadas en una única medición de peso, foto o sesión.
- Las fotos de progreso MUST poder compararse por fecha y, cuando sea posible, con condiciones de captura similares; la comparación visual es para seguimiento del usuario, no se procesa mediante IA en el MVP y no debe presentarse como una medición clínica exacta.
- El sueño, la actividad diaria y los pasos son datos de contexto: la aplicación SHOULD usarlos para relacionarlos con el rendimiento, el gasto energético y la alimentación, y para proponer mejoras de hábitos, siempre como sugerencias y no como conclusiones.
- Las relaciones entre sueño, rendimiento, actividad y alimentación MUST presentarse como patrones observados en los datos del usuario, indicando el período y la cantidad de datos usados, y MUST NOT afirmar causalidad.
- Los pasos y la actividad MUST registrar su fuente (manual o integración con un dispositivo o servicio) y su fecha. Cuando haya valores de más de una fuente para el mismo día, la aplicación MUST NOT sumarlos ni combinarlos silenciosamente.
- El gasto calórico derivado de pasos, actividad o entrenamientos MUST presentarse como una estimación aproximada, con su método explicado y sin precisión excesiva.
- Las calorías de mantenimiento MUST calcularse con un método documentado y revisable —por ejemplo, una fórmula basada en datos del perfil contrastada con la tendencia real de peso y consumo registrado—, mostrando qué datos intervienen. Mientras no haya datos suficientes, la aplicación MUST comunicarlo en lugar de mostrar un valor como si fuera confiable.
- Un dato de sueño, pasos o actividad faltante MUST mostrarse como faltante y MUST NOT completarse con valores supuestos.

**Criterios verificables**
- Se puede registrar una sesión distinta de la planificada sin perder la rutina original.
- Los gráficos muestran fechas y unidades.
- Las variaciones diarias no se presentan como cambios confirmados de grasa o músculo.
- Los datos faltantes se identifican y no se sustituyen silenciosamente por valores inventados.
- Cada valor de pasos o actividad muestra su fuente.
- Las calorías de mantenimiento y el gasto estimado indican cómo se calcularon y con qué datos.
- Con pocos días de datos, la aplicación informa que no hay información suficiente en lugar de mostrar un número de mantenimiento.
- Una relación entre sueño y rendimiento se presenta como correlación, con el período y la cantidad de registros usados.

### VI. Experiencia simple, accesible y adaptable

- La aplicación MUST ser responsive y usable en pantallas pequeñas y grandes.
- La aplicación MUST ser instalable como Progressive Web App (PWA) en plataformas compatibles.
- La aplicación requiere conexión a internet: la PWA MUST NOT ofrecer funcionamiento sin conexión ni cola de sincronización diferida. Sin conexión, la aplicación MUST mostrar un mensaje claro indicando que no está disponible y MUST NOT dar a entender que un registro se guardó si no llegó al servidor.
- La aplicación SHOULD poder abrirse sin conexión únicamente para mostrar ese mensaje (caparazón de la PWA); esto no implica ninguna función de registro o consulta offline.
- Las tareas frecuentes —registrar comida, iniciar o completar un entrenamiento, registrar sueño— SHOULD requerir pocos pasos. Los formularios de carga en curso (especialmente una sesión de entrenamiento activa o el borrador de una comida) MUST persistir su estado de borrador localmente en el navegador (`localStorage` o `sessionStorage`) hasta recibir confirmación del servidor, evitando la pérdida de datos ingresados por recargas accidentales de pestaña o fallos de red recuperables, sin que esto constituya un modo offline.
- Las imágenes subidas o capturadas SHOULD redimensionarse y comprimirse antes del envío o almacenamiento definitivo para optimizar el uso de datos móviles, los tiempos de carga y el procesamiento.
- La interfaz MUST estar en español, con mensajes claros, unidades consistentes y formatos adecuados a la configuración regional del usuario.
- El sistema de unidades por defecto MUST ser el métrico (kg, cm, g, ml, kcal). En el MVP no se ofrece otro sistema; cualquier cambio se define en una especificación posterior. Cada valor mostrado MUST indicar su unidad.
- Los controles MUST tener etiquetas accesibles, navegación por teclado cuando corresponda y estados de error comprensibles.
- Las funciones principales MUST tener estados de carga, vacío, éxito y error definidos.
- La app MUST NOT depender de una integración externa para las funciones básicas de registro manual.

**Criterios verificables**
- Las vistas principales funcionan en anchos móviles y de escritorio.
- La PWA cumple los requisitos técnicos de instalación de las plataformas objetivo.
- Se pueden completar las tareas centrales sin depender de imágenes o integraciones externas.
- Los errores de red o recargas accidentales de página no borran silenciosamente los datos de un formulario o entrenamiento en curso antes de confirmarse en el servidor.
- Sin conexión, la aplicación informa que no está disponible y no muestra como guardado ningún registro nuevo.
- Todos los valores numéricos mostrados incluyen su unidad.

### VII. Arquitectura mantenible y uso seguro de servicios externos

- El proyecto MUST utilizar React y TypeScript para la interfaz, salvo que una decisión documentada y aprobada justifique un cambio.
- La elección del framework React, backend, base de datos, almacenamiento de archivos, proveedor de IA y fuente nutricional MUST resolverse durante la fase de investigación y planificación, comparando seguridad, costo, mantenimiento, capacidades y complejidad.
- Las claves de API MUST gestionarse en el servidor mediante variables de entorno o un gestor de secretos adecuado.
- Las integraciones externas MUST estar encapsuladas detrás de interfaces o módulos definidos, de modo que sea posible sustituir un proveedor sin reescribir la lógica de negocio.
- Toda respuesta proveniente de un proveedor de IA MUST validarse en tiempo de ejecución contra un esquema estricto (por ejemplo, JSON Schema o Zod). Si la respuesta no cumple el contrato estructural esperado, el sistema MUST tratarlo como un fallo del proveedor y habilitar el flujo de carga o corrección manual.
- Los errores, límites de uso, tiempos de espera y respuestas inválidas de servicios externos MUST manejarse explícitamente.
- Las dependencias MUST mantenerse razonablemente actualizadas y evitarse dependencias innecesarias.
- La lógica de negocio y los cálculos deterministas MUST mantenerse separados de la presentación y de las respuestas no deterministas de IA.
- Los datos personales MUST NOT enviarse a proveedores externos sin una finalidad explícita y una integración documentada.

**Criterios verificables**
- Los secretos solo están disponibles en el entorno de servidor.
- Los cálculos deterministas tienen pruebas unitarias.
- Los adaptadores de IA validan el esquema de salida en tiempo de ejecución y cuentan con manejo de errores y pruebas con respuestas simuladas (incluyendo respuestas malformadas).
- Las decisiones técnicas principales quedan documentadas con su justificación.

### VIII. Calidad, pruebas y desarrollo guiado por especificaciones

- Toda funcionalidad MUST comenzar con una especificación que describa el problema, los usuarios, el alcance, los criterios de aceptación y los casos límite.
- La implementación MUST seguir las especificaciones aprobadas; los cambios de alcance MUST actualizar primero la especificación correspondiente.
- Las tareas MUST ser suficientemente pequeñas para poder implementarse y verificarse de forma independiente.
- Las funcionalidades centrales MUST contar con pruebas automatizadas adecuadas al riesgo, incluyendo validación de datos, permisos, cálculos y persistencia.
- Los bloques de pruebas automatizadas SHOULD referenciar explícitamente el criterio de aceptación de la especificación o el principio de la Constitution que verifican.
- Los cambios MUST pasar los controles de formato, lint, tipos y pruebas definidos por el proyecto antes de considerarse terminados.
- Los errores MUST manejarse de forma explícita; no se deben ocultar fallos mediante valores por defecto engañosos.
- La documentación MUST mantenerse alineada con el comportamiento real de la aplicación.

**Criterios verificables**
- Cada especificación contiene criterios de aceptación comprobables.
- Las funciones críticas tienen pruebas automatizadas trazables a sus criterios o principios.
- El proyecto tiene comandos documentados para instalar, ejecutar, comprobar tipos y correr pruebas.
- Una funcionalidad no se considera completa solo porque compila: debe satisfacer sus criterios de aceptación.

### IX. Observabilidad, telemetría y privacidad

- Los logs, reportes de errores y métricas del cliente y del servidor MUST NOT contener contenido personal del usuario: ni el texto de las comidas, fotos, peso, medidas, sueño, notas, ni tokens, contraseñas o secretos.
- Los eventos de telemetría y los logs MUST identificar al usuario únicamente mediante identificadores opacos, y solo cuando sea necesario para diagnosticar un problema.
- La aplicación MUST registrar de forma estructurada los errores del servidor y de los servicios externos (fallos de IA, errores de validación de esquemas, límites de uso, tiempos de espera) con datos técnicos suficientes para diagnosticarlos, sin incluir datos personales.
- Cualquier herramienta de monitoreo de errores MUST configurarse para depurar datos personales antes de enviarlos.
- La analítica de comportamiento de terceros y los rastreadores publicitarios MUST NOT usarse en el MVP. Incorporar cualquier analítica posterior MUST requerir una decisión técnica documentada, recopilar solo métricas agregadas necesarias e informar al usuario.
- La retención de logs MUST tener un plazo definido y documentado.
- Las métricas de uso y costo de servicios externos (llamadas de IA, cuotas) SHOULD medirse a nivel agregado para controlar costos y límites.

**Criterios verificables**
- Una revisión de logs y reportes de errores de una sesión de prueba no encuentra contenido de comidas, fotos, pesos ni notas.
- No hay SDKs de analítica ni rastreadores de terceros en el bundle del MVP.
- El plazo de retención de logs está documentado.
- Un fallo simulado de un proveedor externo queda registrado con su causa técnica y sin datos del usuario.

### X. Catálogos de referencia de alimentos y ejercicios

- La aplicación MUST contar con un catálogo de alimentos (incluidos productos de marca) y un catálogo de ejercicios, con valores nutricionales y datos de ejercicio consultables por el usuario.
- Los catálogos MUST mantenerse como una copia propia en la base de datos de la aplicación, importada desde sus fuentes. La búsqueda y el registro MUST NOT depender de consultar en vivo a un tercero (ver Principio VI).
- Cada ítem MUST registrar su procedencia: fuente, identificador de origen, fecha de importación y si proviene del catálogo importado o fue creado por el usuario. La interfaz MUST permitir identificar ese origen (ver Principio II).
- Las fuentes MUST tener una licencia compatible con el uso previsto, y la aplicación MUST cumplir las obligaciones de atribución y de redistribución que esa licencia imponga. La licencia de cada fuente MUST documentarse antes de importarla.
- El usuario MUST poder crear sus propios alimentos y ejercicios, y editar una copia propia de uno del catálogo sin alterar el original ni los registros históricos (ver Principio II).
- Los valores nutricionales MUST almacenarse normalizados por 100 g o 100 ml, con la porción o unidad de consumo como dato separado, y MUST indicar su unidad.
- Los datos de fuentes colaborativas pueden ser incompletos o erróneos: la aplicación MUST permitir corregirlos y MUST indicar cuándo faltan valores en lugar de completarlos con supuestos.
- Los nombres y descripciones del catálogo mostrados al usuario MUST estar en español; las traducciones automáticas o importadas MUST poder revisarse y corregirse.

**Criterios verificables**
- Buscar y registrar un alimento o un ejercicio del catálogo funciona sin acceso a servicios de terceros.
- Cada ítem del catálogo muestra su fuente y su tipo de origen (importado o propio).
- Existe un documento con la licencia y las obligaciones de atribución de cada fuente importada, y la aplicación las cumple.
- Se puede crear un alimento y un ejercicio propios, y editar una copia de uno del catálogo sin que cambie el original.
- Editar un ítem del catálogo no modifica comidas ni sesiones ya confirmadas.
- Un alimento con valores faltantes los muestra como faltantes.

## Reglas de decisión técnica

Las siguientes decisiones están pendientes y NO se consideran fijadas por esta Constitution:

1. Framework basado en React (por ejemplo, Vite o Next.js) y estructura de despliegue.
2. Backend, autenticación, base de datos y estrategia de almacenamiento de fotos.
3. Proveedor de IA para analizar fotos o descripciones de comidas.
4. Fuentes del catálogo de alimentos (genéricos y marcas) y del catálogo de ejercicios, formato y proceso de importación, estrategia de traducción al español y método para calcular calorías y macronutrientes. Debe validarse licencia, cobertura y calidad de cada fuente (ver Principio X).
5. Cómo se obtienen los pasos y la actividad: registro manual, APIs del dispositivo o servicios de salud. Debe investigarse la viabilidad real en una PWA, ya que el acceso a sensores o a servicios de salud desde el navegador es limitado según la plataforma. Hasta que se decida, el registro manual es la vía de base.
6. Estrategia de costos, límites de uso, cuotas, compresión de imágenes y comportamiento ante indisponibilidad de servicios.
7. Política concreta de exportación, retención y eliminación de datos.
8. Método concreto para estimar el gasto calórico y las calorías de mantenimiento, y los umbrales mínimos de datos para mostrarlos.
9. Plazo de retención de logs y herramienta de monitoreo de errores.

Cada decisión MUST documentarse en la especificación o plan técnico correspondiente, junto con alternativas evaluadas, razones de elección, riesgos y consecuencias.

### Decisiones ya tomadas

- La aplicación es multiusuario (ver Principio I).
- En el MVP, la IA solo procesa fotos y textos de comidas; las fotos de progreso corporal no se envían a la IA y no se exigen políticas de exclusión de entrenamiento de modelos para las fotos de comidas (ver Principio I).
- El día calendario corta a las 00:00 hs en la zona horaria del usuario, pero el usuario puede imputar comidas al día que aún está cerrando antes de iniciar o pasar al registro del día siguiente (ver Principio II).
- La aplicación requiere conexión a internet; no hay funcionamiento offline ni sincronización diferida, aunque sí persistencia local de borradores en curso para evitar pérdidas accidentales (ver Principio VI).
- Sistema métrico por defecto en el MVP (ver Principio VI).
- Los catálogos de alimentos y de ejercicios son copias propias importadas, con alimentos y ejercicios creados por el usuario (ver Principio X).

## Fuera del alcance del MVP

Los siguientes temas se reconocen pero se posponen a versiones posteriores. Su ausencia en el MVP no es un incumplimiento de esta Constitution, y cada uno MUST abordarse mediante una especificación propia antes de implementarse:

- Análisis de fotos de progreso corporal mediante IA.
- Edad mínima, verificación de edad y protecciones para menores de edad.
- Opciones para usuarios con historial de trastornos alimentarios (por ejemplo, ocultar calorías o desactivar objetivos).
- Cifrado adicional a nivel de aplicación de las fotos corporales y bloqueo con PIN u otros mecanismos en el dispositivo.
- Funcionamiento sin conexión y sincronización diferida.
- Selección de otros sistemas de unidades.

Esto no exime al MVP de cumplir los límites de alcance y el lenguaje no coercitivo del Principio IV.

## Límites de alcance

La aplicación se orienta al seguimiento personal y a la educación sobre hábitos. Por defecto:

- NO es un dispositivo médico ni una herramienta de diagnóstico.
- NO garantiza exactitud en estimaciones de calorías, porciones, gasto energético, composición corporal o análisis de imágenes.
- NO sustituye el asesoramiento médico, nutricional o de entrenamiento profesional.
- NO debe incentivar la restricción extrema, la compensación por comidas ni el entrenamiento a través de lesiones.
- NO debe publicar fotos, peso ni datos personales del usuario sin una acción explícita y autorizada.
- NO debe incorporar integraciones, costos recurrentes o servicios externos sin una decisión técnica documentada.

## Gobernanza de la Constitution

- Toda nueva especificación MUST cumplir estos principios.
- Si una funcionalidad parece entrar en conflicto con un principio, el conflicto MUST documentarse y resolverse antes de implementar.
- Las modificaciones de esta Constitution MUST incluir la razón del cambio y una revisión de las especificaciones afectadas.
- Los principios se aplican tanto a la interfaz como al backend, las integraciones, los procesos de datos y las pruebas.
- Las palabras **MUST**, **MUST NOT**, **SHOULD** y **MAY** se interpretan como requisitos obligatorios, prohibiciones, recomendaciones fuertes y opciones, respectivamente.
- La Constitution usa versionado semántico: MAJOR para eliminar o redefinir un principio de forma incompatible, MINOR para agregar un principio o ampliar sustancialmente uno existente, PATCH para aclaraciones y correcciones de redacción. Cada cambio MUST actualizar la versión y la fecha de última modificación, y registrarse en el historial de versiones.

## Historial de versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.2.0 | 2026-10-16 | Se agrega el Principio X (catálogos de referencia de alimentos y ejercicios): copia local importada, procedencia por ítem, licencias y atribución, ítems propios del usuario, valores normalizados por 100 g/ml y traducción al español revisable. Se amplía la decisión técnica pendiente #4 y se registra la decisión tomada sobre catálogos. |
| 1.1.1 | 2026-10-16 | Corrección de redacción en el Principio I ("offrezca" → "ofrezca"). |
| 1.1.0 | 2026-10-16 | Se delimita el uso de IA en imágenes exclusivamente a fotos de comidas (sin exigir exclusión de entrenamiento de modelos). Se define el corte de día a las 00:00 hs con imputación flexible de comidas al día en curso antes de abrir uno nuevo. Se agregan reglas de inmutabilidad (snapshots) para el historial, idempotencia en mutaciones y llamadas a IA, persistencia local de borradores de formularios (`localStorage`/`sessionStorage`), compresión de imágenes, validación de esquemas en respuestas de IA y trazabilidad de pruebas en SDD. |
| 1.0.0 | 2026-10-16 | Ratificación para el MVP. Se define la aplicación como multiusuario y online-only, sistema métrico por defecto, eliminación de EXIF y cifrado en reposo básico para fotos, reglas para sueño, pasos, actividad y estimación de gasto y mantenimiento, nuevo Principio IX de observabilidad y telemetría, y sección de temas fuera del alcance del MVP. |
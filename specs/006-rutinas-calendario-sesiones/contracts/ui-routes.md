# Contrato: rutas, pantallas y estados de la interfaz

**Feature**: 006-rutinas-calendario-sesiones | Todas las rutas requieren sesión iniciada y sesión vigente (como el resto de la aplicación). Todo el texto está en español en `app/src/copy/es.ts`, clave `training`, y pasa la prueba de lenguaje neutral (Decisión 12).

## Navegación

El menú principal suma el enlace **Entrenamiento** (junto a Comidas, Alimentos, Ejercicios y Perfil). Se mantiene la barra de pestañas existente en teléfono.

## Rutas

| Ruta | Pantalla | Qué muestra |
|---|---|---|
| `/entrenamiento` | Inicio de entrenamiento | «Hoy» (la sesión de hoy si existe, o elegir una rutina para empezar), la sesión en curso si la hay, el calendario del mes y accesos a Rutinas |
| `/entrenamiento/dia/:fecha` | Un día | Las sesiones de esa fecha (`AAAA-MM-DD`) con su estado y marcas; acciones: planificar una rutina, registrar una sesión |
| `/entrenamiento/sesion/:id` | Una sesión | Según el estado: planificada (plan y acciones), en curso (editor), realizada (plan frente a realizado, correcciones), cancelada |
| `/entrenamiento/rutinas` | Mis rutinas | Lista de rutinas con su cantidad de ejercicios; crear una nueva |
| `/entrenamiento/rutinas/nueva` | Nueva rutina | Formulario con borrador local |
| `/entrenamiento/rutinas/:id` | Una rutina | Ejercicios, series y objetivos; acciones: editar, duplicar, eliminar, planificar |
| `/entrenamiento/rutinas/:id/editar` | Editar rutina | El mismo formulario, cargado |
| `/ejercicios/:id/historia` | Historia de un ejercicio | Las últimas veces, por tandas; enlace desde el detalle del ejercicio (spec 005) y desde una sesión |

Una ruta con una fecha inválida, o con un identificador ajeno o inexistente, muestra «No encontramos este entrenamiento» (las sesiones y rutinas ajenas son indistinguibles de las inexistentes).

## Pantallas y estados

### Inicio de entrenamiento y calendario

- **Cuadrícula del mes**: 7 columnas (lunes a domingo), un enlace por día con nombre accesible completo («jueves 22 de octubre: 1 sesión realizada, 1 planificada»). Cada día muestra el estado de sus sesiones con **texto o forma además del color**. Botones «Mes anterior», «Mes siguiente» y «Hoy».
- **Estados**: cargando; mes sin sesiones (invitación neutral a planificar o registrar una); error con «Reintentar»; sin conexión (aviso, sin datos desactualizados presentados como actuales).
- **«Hoy»**: si no hay sesión de hoy, un selector de rutina del catálogo con «Empezar» y la opción «Sesión vacía». Con una sesión en curso, un acceso destacado a «Continuar la sesión».
- Una sesión planificada con fecha pasada se rotula **«Sin registrar»** (texto neutral) con las acciones «Registrar», «Reprogramar» y «Cancelar».

### Día

- Lista de las sesiones del día en orden estable, cada una con estado, marcas («Reprogramada», «Modificada», «Corregida») y rutina.
- Acciones: «Planificar una rutina» (elegir de la lista, o «Sesión vacía»), «Registrar un entrenamiento» (para hoy o una fecha pasada). Para una fecha pasada solo se ofrece registrar; para hoy o futura, planificar.
- Cambiar la rutina de un día o quitarla (solo si está planificada).

### Sesión

- **Planificada**: plan (ejercicios, series y objetivos), acciones «Empezar» (si la fecha es hoy o anterior), «Reprogramar», «Cambiar la rutina», «Cancelar», «Eliminar».
- **Cancelada**: plan conservado, acción «Volver a planificar».
- **En curso (editor)**:
  - Encabezado con la fecha, el indicador de guardado («Guardado», «Guardando…», «Sin guardar en el servidor: …») y «Terminar sesión».
  - **Plan** y **Realizado** en bloques distintos y rotulados: cada ítem del plan muestra su objetivo como referencia (nunca como valor anotado) y su estado («Sin hacer todavía», «Hecho», «No realizado» al terminar).
  - Por ejercicio realizado: nombre, series (campos según el tipo de medición con unidad visible: kg, repeticiones, mm:ss, km), esfuerzo percibido 1 a 10 con etiquetas neutrales y «sin dato», nota, «Sustituir por…», «Quitar», «La última vez» (un paso, sin salir), «Ver historia».
  - «Agregar un ejercicio»: usa la búsqueda de la spec 005 (propios y del catálogo) en un panel; si no hay ejercicios, ofrece crear uno.
  - Series: «Agregar serie», «Copiar la serie anterior» (comodidad), «Quitar serie»; una serie vacía no se guarda.
- **Realizada**: plan y realizado por separado, marcas, nota, «Corregir» (vuelve al editor con el mismo guardado), «Eliminar» con confirmación.
- **Errores** (en lenguaje claro, nunca el texto crudo del servidor): no guardado por conexión; `stale_revision` («Esta sesión cambió en otro dispositivo») con las opciones «Conservar la de este dispositivo» y «Usar la del servidor»; `session_in_progress`; `invalid_*` con el campo señalado.

### Rutinas

- **Lista**: nombre y cantidad de ejercicios; estados de carga, vacío («Todavía no armaste rutinas»), error.
- **Formulario**: nombre; lista de ejercicios reordenable (botones «Subir/Bajar», sin depender de arrastrar); por ejercicio, series y objetivos según el tipo de medición; «Agregar ejercicio» (búsqueda de la spec 005); borrador local; «Guardar» confirma solo con la respuesta del servidor; doble clic crea una sola.
- **Detalle**: muestra un aviso por ítem cuando el ejercicio ya no existe o cambió su tipo de medición («Revisá los objetivos de este ejercicio»).
- **Eliminar**: confirmación; texto: «Se elimina solo la rutina. Las sesiones que ya creaste con ella no cambian».

### Historia de un ejercicio

- Lista por tandas («Ver más»), de la más reciente a la más antigua: fecha, nombre guardado, series con unidades y esfuerzo percibido (o «sin dato»), enlace a la sesión.
- Estado vacío: «Todavía no lo registraste». Sin metas, sin comparaciones, sin gráficos (spec 012).

## Accesibilidad y adaptación

- Campos con etiqueta; errores asociados al campo; foco al primer error al intentar guardar; áreas táctiles de 44 px o más (incluidas las series en el teléfono).
- Teclado: el calendario se recorre con Tab; las listas reordenables usan botones; el panel de agregar ejercicio y el diálogo de eliminar atrapan el foco, se cierran con Escape y devuelven el foco.
- Estados anunciados con regiones `status`/`alert` (guardado, errores, conflictos).
- Teléfono: el editor muestra un ejercicio por tarjeta, con las series en filas compactas; escritorio: dos columnas (plan y realizado).
- Sin conexión: se informa, no se permite guardar, y el borrador se conserva.

## Lenguaje

Reglas verificables (prueba de textos): no hay rachas, días «perdidos», culpa, felicitaciones por constancia ni valoraciones del rendimiento; lo no hecho se dice «No realizado» o «Sin registrar»; ningún mensaje sugiere entrenar con dolor o lesión.

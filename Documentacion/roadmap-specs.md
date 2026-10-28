# Roadmap de specs — Fitness Tracking App

Basado en la Constitution v1.2.1. Este documento define el corte y el contenido previsto de cada spec. Las specs 001 a 008, 013, 014, 015 y 016 están implementadas; el resto está pendiente (ver la tabla de estado del `README.md`).

**Contexto del MVP:** el MVP lo usa solo el autor. Las reglas de privacidad y autenticación de la Constitution se mantienen igual. Lo que se pospone es el trabajo orientado a usuarios externos (ver spec 011).

**Orden de implementación:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011. La spec 012 (gráficos de progreso de entrenamiento) está redactada pero se desarrolla recién después de la 006 y cuando el autor lo decida; su número respeta el final del roadmap. Las specs 017 a 023 (ola 4) salen de la primera prueba de uso del autor, ver [`notas-de-prueba-2026-10-28.md`](notas-de-prueba-2026-10-28.md).

## Ola 1: base

### 001 — Cuentas, perfil y base de la PWA

- Registro, inicio y cierre de sesión.
- Perfil: edad, sexo, altura, zona horaria, unidades métricas.
- Modelo de propiedad de registros (cada registro pertenece a una cuenta).
- Esqueleto de PWA: instalable, mensaje sin conexión, borradores locales que se borran al cerrar sesión.
- Estados de carga, vacío, éxito y error.
- Las decisiones técnicas pendientes #1 y #2 (framework, backend, auth, base de datos, almacenamiento) se resuelven en el plan de esta spec.
- Principios: I, VI, VII, VIII.

## Ola 2: registro manual (el producto funciona sin IA)

### 002 — Catálogo de alimentos

- Importación de alimentos genéricos y de marca a una copia local.
- Búsqueda, alimentos propios, copia editable de uno del catálogo.
- Procedencia por ítem, valores por 100 g/ml, valores faltantes visibles.
- Decisión pendiente #4: fuentes, licencias, cobertura para Argentina.
- Principios: II, III, X.
- **Estado (2026-10-19): implementada.** Fuentes: Open Food Facts (ODbL 1.0, ≈3.900 productos utilizables de Argentina) y USDA FoodData Central (CC0, genéricos). Cobertura medida: solo ≈26 % de los productos de Argentina de Open Food Facts tiene energía y macronutrientes, por eso los alimentos propios y las copias editables pesan más. Pendientes del autor: cargar USDA (traducción de nombres), carga en producción y revisión legal de la ODbL antes de abrir la aplicación (T077, T078). Resultados en [`specs/002-catalogo-de-alimentos/research.md`](../specs/002-catalogo-de-alimentos/research.md).

### 003 — Registro de comidas

- Registro por texto o por catálogo, foto opcional.
- Estados manual, estimado y confirmado; snapshots de macros; idempotencia.
- Regla del día: imputar comidas pasada la medianoche al día en curso.
- Principios: II, III, VI.
- **Estado (2026-10-19): implementada** (verificación final en curso). Ítems con instantánea inmutable y origen visible, regla del día (el día que se cierra), repetir una comida y foto opcional privada con limpieza de metadatos en el servidor. Mediciones y decisiones en [`specs/003-registro-de-comidas/research.md`](../specs/003-registro-de-comidas/research.md). Pendiente: al construir la eliminación de cuentas hay que borrar también los archivos de `meal-photos/<user_id>/`.

### 004 — Objetivo calórico y resumen diario

- Objetivo configurable y calorías restantes, con incertidumbre explícita.
- Mensajes neutrales al superar el objetivo, sin lenguaje culpabilizante.
- Principios: IV.
- **Estado (2026-10-20): implementada y verificada.** Historial de solo altas del objetivo (cada día conserva el que regía), tarjeta «Objetivo del día» en la vista del día, restante «como máximo» cuando faltan datos de energía, estimados sin confirmar aparte, frase neutral al superar el objetivo y nota informativa por debajo de 1.200 kcal (rango 1.000 a 6.000). Corrige además un defecto heredado: la caché de consultas ya no se comparte entre cuentas en una misma pestaña. Decisiones y mediciones en [`specs/004-objetivo-calorico-resumen/research.md`](../specs/004-objetivo-calorico-resumen/research.md).
- **Queda fuera a propósito (para la spec 007/008):** una referencia calórica sugerida o calculadora de mantenimiento; el perfil no guarda peso y el método necesita ser documentado y revisable (Principio V).

### 005 — Catálogo de ejercicios

- Importación de ejercicios a una copia local, traducción revisable al español.
- Ejercicios propios, copia editable, tipo de medición.
- Decisión pendiente #4 (parte de ejercicios): fuentes y licencias.
- Principios: II, X.
- **Estado (2026-10-21): implementada y verificada.** Catálogo local de 897 ejercicios en español (876 de free-exercise-db, de dominio público, con traducción automática sin revisar, y 21 propios de MyGuide en CC0), búsqueda sin acentos por nombre, nombre original o sinónimo, filtros por músculo y equipamiento, ejercicios propios, copia editable, editar y eliminar, y pantalla de fuentes. Con 20.000 filas la búsqueda responde en menos de 60 ms. Decisiones y mediciones en [`specs/005-catalogo-de-ejercicios/research.md`](../specs/005-catalogo-de-ejercicios/research.md).
- **Para la spec 006:** cada ejercicio tiene un `id` (uuid) que no cambia nunca; la sesión debe **copiar** el nombre y el tipo de medición (`reps_weight`, `reps_bodyweight`, `duration`, `distance_duration`) en su propio registro y no depender de la fila del ejercicio, porque un ejercicio propio se puede editar o eliminar. La referencia al ejercicio en la sesión no debe borrar ni bloquear nada (`on delete set null` o sin clave foránea). El selector de ejercicios puede reutilizar `search_exercises`.
- **Queda fuera a propósito:** imágenes y videos, dificultad y mecánica, calorías por ejercicio (spec 007/008), recomendaciones automáticas.
- **Pendiente del autor** (en [`Documentacion/issues-autor/08-ejercicios-licencias.md`](issues-autor/08-ejercicios-licencias.md)): confirmar la procedencia de los pasos de free-exercise-db antes de abrir la aplicación a terceros, la dedicación CC0 de `myguide-base` y la carga en producción.

### 006 — Rutinas, calendario y sesiones

- Rutina planificada, sesión realizada, modificada, reprogramada y cancelada.
- Registro de ejercicios, series, repeticiones, cargas, esfuerzo percibido, sustituciones y notas.
- Mover sesiones sin perder historial ni duplicar; snapshots de ejercicios.
- Persistencia de borrador de una sesión activa.
- Principios: II, V, VI.
- **Estado (2026-10-21): implementada y verificada** (`specs/006-rutinas-calendario-sesiones/`, ver su `verification.md`). Decisiones del autor: las rutinas son un catálogo de entrenamientos sin días asignados ni repetición automática (cada día se elige cuál toca), el esfuerzo percibido es uno por ejercicio de la sesión (para todas sus series en conjunto) y los gráficos quedan fuera. **Decisión revertida el 2026-10-28:** el autor pidió un plan semanal («todos los lunes, pecho»); la spec 018 lo agrega como entidad aparte y el catálogo de rutinas no cambia. Deja lista la lectura `exercise_history` y las copias de nombre y tipo de medición que usará la spec 012 (gráficos de progreso de entrenamiento).

### 007 — Sueño, pasos y actividad

- Registro manual con fuente y fecha.
- Datos faltantes mostrados como faltantes; sin sumar fuentes distintas.
- Decisión pendiente #5: viabilidad de integraciones en una PWA (el registro manual es la base).
- Principios: V.
- **Estado (2026-10-26): implementada y verificada** (`specs/007-sueno-pasos-actividad/`), solo registro manual con fuente; las integraciones con dispositivos quedan fuera. **Nota del 2026-10-28:** el autor confirma que cargar sueño y pasos debe seguir siendo opcional y deja para un feature futuro «calcularlo» (sin spec; ver `notas-de-prueba-2026-10-28.md`).

### 008 — Peso, medidas y fotos de progreso

- Mediciones con unidad y fecha.
- Subida de fotos: eliminación de EXIF, compresión, almacenamiento privado y cifrado en reposo.
- Comparación visual por fecha, sin IA.
- Principios: I, V, VI.
- **Estado (2026-10-26): versión mínima implementada** (`specs/008-peso-y-medidas/`): peso y medidas con historial, sin fotos de progreso. Las fotos, su procesamiento y la comparación visual quedan pendientes.

## Ola 3: inteligencia y cierre

### 009 — Estimación de comidas con IA

- Adaptador de proveedor desacoplado, validación de esquema en ejecución.
- Fallo del proveedor cae al registro manual; idempotencia y control de cuota.
- Solo fotos y textos de comidas; nunca fotos de progreso.
- **Caso agregado el 2026-10-28:** cuando la persona escribe a mano un alimento que no está en el catálogo, la IA propone sus calorías y macros a partir del nombre y la cantidad. Es una estimación: se muestra como tal, se distingue de un valor de etiqueta o confirmado por la persona, se corrige antes de guardar y, si la IA falla, se carga a mano (Principio III). Falta decidir si queda guardado como alimento propio «estimado por IA».
- Decisiones pendientes #3 y #6.
- Principios: I, II, III, VII, IX.

### 010 — Tendencias, mantenimiento y correlaciones

- Gráficos comparativos con unidades y fechas.
- Calorías de mantenimiento con umbral mínimo de datos y método explicado.
- Patrones entre sueño, rendimiento y alimentación, sin causalidad.
- Decisión pendiente #8.
- **Ampliación del 2026-10-28:** el autor pidió explorar más el análisis de alimentación, entrenamiento, progreso y nutrición. Antes de escribir la spec hay una investigación pendiente con las preguntas de `notas-de-prueba-2026-10-28.md`.
- Principios: IV, V.

### 011 — Privacidad y ciclo de vida de los datos

- Exportación, eliminación de registros y de cuenta, retención de copias de seguridad.
- Plazo de retención de logs y herramienta de monitoreo.
- Decisiones pendientes #7 y #9.
- Obligatoria antes de publicar con usuarios reales; no bloquea el uso personal del MVP.
- Principios: I, IX.

### 012 — Gráficos de progreso de entrenamiento

- Evolución de un ejercicio por sesión (medidas según su tipo de medición), elección de período y comparación de dos períodos, con unidades, fechas y cantidad de datos.
- Resumen de sesiones realizadas por semana y por mes, sin metas ni rachas.
- Sin conclusiones firmes a partir de una sola sesión; datos faltantes como faltantes; sin recomendaciones.
- Se amplía con la investigación de análisis de datos pedida el 2026-10-28 (ver `notas-de-prueba-2026-10-28.md`). El gráfico del peso con promedio móvil va en la spec 020.
- Depende de la 006. Comparte lenguaje visual con los gráficos de la 010, pero esta spec solo trata de entrenamiento.
- Principios: II, IV, V, VI.
- **Estado (2026-10-21): especificada (`specs/012-graficos-progreso-entrenamiento/spec.md`) y dejada para después**, sin rama ni plan.

### 013 — Inicio «Hoy»

- Pantalla de inicio con las calorías del día frente al objetivo, el entrenamiento de hoy, cuatro accesos rápidos y lo último registrado (comida, sesión, peso y sueño).
- No estaba en el roadmap original: se agregó el 2026-10-26 para poder usar la aplicación a diario.
- Principios: IV, V, VI.
- **Estado (2026-10-26): implementada y verificada** (`specs/013-inicio-hoy/`).

## Ola 4: ajustes tras el uso personal

Nacen de la primera prueba de uso del autor (2026-10-28). Las notas originales y la trazabilidad están en [`notas-de-prueba-2026-10-28.md`](notas-de-prueba-2026-10-28.md). Ninguna de estas specs está escrita todavía.

**Orden propuesto:** 017 → 018 → 019 → 020 → 021 → 022 → 023 (la 024, notificaciones push, queda como feature futuro), con las specs 009, 010 y 012 de la ola 3 intercaladas cuando el autor las priorice. La 017 va primero para que las pantallas siguientes nazcan con el criterio visual ya corregido; la 021 va después de la 019 y la 022 porque avisa sobre el peso, las fotos y los suplementos, y necesita que existan.

### 017 — Rediseño de la interfaz y de la experiencia de uso

- **Alcance (aclarado el 2026-10-28):** el autor no está convencido del diseño en general y la mayoría de las pantallas no le gustan. No es un retoque de algunas cards: es un rediseño de toda la interfaz.
- Arranca con exploración de dirección visual antes de tocar código: el autor ve alternativas concretas (maquetas) para la estructura de cada pantalla, la jerarquía, las cards y la navegación, y elige una. La paleta negro y azul, el nombre MyGuide y la estructura de tres zonas del inicio (spec 016) se pueden revisar si la exploración lo justifica.
- Luego, un conjunto único de componentes (card, lista, formulario, encabezado de pantalla, estado vacío, gráfico) y su aplicación a todas las pantallas existentes. La pestaña Entrenamiento se rehace en la 018, con el mismo sistema.
- Sin funciones nuevas ni cambios de datos; si la exploración descubre una función faltante, pasa a una spec propia.
- Se hace con la skill de diseño de interfaces y con investigación de apps de referencia, igual que la spec 016. Se mantienen las verificaciones de accesibilidad, de 375 px y de lenguaje neutral (sin rojo y verde como juicio).
- Principios: VI.
- Origen: nota 2.

### 018 — Plan semanal de entrenamiento y pestaña Entrenamiento rehecha

- **Plan semanal:** la persona arma una semana genérica asignando rutinas de su catálogo a los días de la semana («todos los lunes, pecho»). Se guarda y se repite cada semana hasta que lo cambie. Un día puede quedar sin rutina (descanso).
- **Inicio:** el día muestra lo que toca según el plan. Si ese día tiene una rutina asignada, hay un botón para marcarla como completada. Si no tiene ninguna, la opción es «Cargar entrenamiento», donde se elige una rutina ya cargada (queda registrada como hecha) o se arma una nueva. También se puede elegir un entrenamiento distinto del asignado. Cambiar un día puntual no modifica el plan.
- **Pestaña Entrenamiento:** rehacer el frente completo (hoy desprolijo). Se conserva cómo se arma una rutina, que al autor le gusta.
- **Relación con la spec 006:** revierte la decisión «rutinas sin días asignados». El plan es una entidad aparte; el catálogo de rutinas y las sesiones registradas no cambian. El estado de entrenamiento de la semana del inicio (spec 016) pasa a considerar el plan.
- **Aclarado el 2026-10-28:** «marcar como completado» solo existe cuando el día tenía una rutina asignada; sin rutina asignada se carga el entrenamiento hecho. Queda por definir en la aclaración de la spec si la sesión marcada así copia las series planificadas de la rutina o queda sin series, y cómo se distingue de una sesión con detalle cargado (Principio II).
- Depende de la 006 y la 016. Principios: II, V, VI.
- Origen: nota 4.

### 019 — Fotos de progreso

- Sección propia donde la persona sube fotos de progreso, las ve ordenadas por fecha y las elimina.
- Eliminación de EXIF, compresión, almacenamiento privado y cifrado en reposo; sin enviar nunca estas fotos a la IA (Principio I, decisión ya tomada).
- Comparación visual de dos fechas lado a lado, sin IA ni juicios sobre el cuerpo.
- Completa la parte de fotos de la spec 008, que quedó en versión mínima.
- Límite a vigilar: el almacenamiento del plan gratuito de Supabase (ver `despliegue.md`).
- Principios: I, V, VI.
- Origen: pedido de fotos del autor (2026-10-28) y la spec 008.

### 020 — Evolución del peso

- Gráfico del peso con promedio móvil de 7 días y elección de período, con unidades, fechas y cantidad de datos.
- Peso en ayunas opcional y configurable.
- Sin conclusiones a partir de pocos puntos; datos faltantes como faltantes (Principio V).
- Depende de la 008. Comparte el lenguaje visual con los gráficos de las specs 010 y 012. Principios: IV, V.
- Origen: guía de diseño del autor (2026-10-27).

### 021 — Recordatorios y notificaciones configurables

- Para el peso, las fotos de progreso y los suplementos: la persona elige cada cuánto toca cargarlo (cada día, cada tantos días, ciertos días de la semana). El aviso es una notificación dentro de la app.
- **Decidido el 2026-10-28:** el autor prefiere notificaciones push del sistema pero las deja como feature futuro (spec 024). Esta spec entrega solo el aviso dentro de la app y deja la configuración preparada para que la push se agregue después sin rehacerla.
- Reemplaza el recordatorio de peso de la spec 016 (casilla sin notificación) y absorbe `profiles.weight_reminder`.
- Lenguaje neutral y sin culpa (Principio IV): el aviso se puede posponer o desactivar, y no se repite insistentemente.
- **Aviso dentro de la app:** tarjeta en el inicio cuando toca cargar algo. No necesita servicios externos ni permisos. No avisa con la app cerrada, y esa limitación es la razón del feature futuro 024.
- Depende de la 019 y la 022. Principios: I, IV, VI, VII.
- Origen: nota 3.

### 022 — Suplementación

- Apartado donde la persona define sus suplementos (por ejemplo creatina, multivitamínico) y marca cada día cuáles tomó.
- Los suplementos son una lista propia y privada; la dosis, si se anota, es texto libre que escribe la persona.
- Aparece en el inicio, en el panel del día elegido, con la marca de hecho o pendiente.
- La app no recomienda suplementos, dosis, horarios ni combinaciones, ni afirma efectos (Principio IV y límites de alcance). Un día sin marca es «sin registro», no «olvidado».
- Principios: I, IV, VI.
- Origen: nota 8.

### 023 — Ampliación del catálogo de alimentos

- Empieza con una investigación de fuentes antes de importar nada: cobertura medida para Argentina, licencia, atribución y costo de limpiar los nombres.
- Candidatas a evaluar (sin verificar): carga completa de USDA FoodData Central (hoy pendiente, issue 02 del autor), mayor volumen de Open Food Facts de Argentina, tablas argentinas de composición de alimentos y otras fuentes que surjan. Cada fuente nueva exige su licencia y atribución en `fuentes-datos.md` (Principio X).
- Complementa la spec 009: el catálogo reduce los alimentos que hay que estimar con IA.
- Principios: II, X.
- Origen: nota 7.

### 024 — Notificaciones push (feature futuro)

- Avisos del sistema con la app cerrada para los recordatorios de la spec 021. Pedido por el autor el 2026-10-28 y **dejado para más adelante**: no entra en el orden propuesto.
- Requiere una decisión técnica documentada antes de implementar (la Constitution exige justificar los servicios nuevos y el hosting es gratuito): service worker, claves VAPID, guardar la suscripción de cada dispositivo (dato personal, Principio I, con baja al cerrar sesión o eliminar la cuenta) y un programador de envíos. En el plan gratuito de Supabase se resolvería con `pg_cron` y una Edge Function, sin proveedor de pago.
- En iPhone solo funciona con la app instalada en la pantalla de inicio (iOS 16.4 o posterior).
- Depende de la 021. Principios: I, IV, VII.
- Origen: nota 3.

## Notas de la spec 001 (cerrada el 2026-10-17)

- **Confirmación de correo:** es no bloqueante solo por ser un MVP. Antes de abrir la aplicación a otras personas debe reevaluarse si pasa a ser obligatoria.
- **Registro abierto:** la spec 011 (privacidad y ciclo de vida de los datos) es **obligatoria antes de publicar**.
- **Pendientes de la spec 001:** prueba de envío real de correo (T009), refuerzo opcional con Auth Hook (T031) y despliegue inicial (T077).
- Verificación y revisión de seguridad: `specs/001-cuentas-perfil-pwa/verification.md`.

### 014, 015 y 016 — Primer ingreso, cálculo calórico y rediseño con semana

Implementadas y verificadas localmente. La 014 pide al entrar por primera vez sexo, nacimiento, altura, peso, actividad, días de entrenamiento, experiencia y objetivo (ganar músculo, perder grasa o recomposición) y no deja usar la app hasta completarlo. La 015 calcula el objetivo calórico con Mifflin-St Jeor más el gasto de los entrenos, con pisos y tope; se propone y la persona confirma (`/plan`). La 016 cambia el diseño a negro y azul con menú lateral (escritorio) y barra inferior (celular), y el inicio muestra la semana con el estado de cada día (rango de ±10 % del objetivo y entrenamiento) y el panel del día elegido, más el recordatorio de peso como preferencia. Pendiente: fotos de progreso (spec 019) y evolución del peso con promedio móvil (spec 020). El recordatorio de peso como casilla sin notificación lo reemplaza la spec 021. Los números del cálculo son convenciones; ver `research_notes/`.

# Investigación: rutinas, calendario y sesiones de entrenamiento

**Feature**: 006-rutinas-calendario-sesiones | **Fecha**: 2026-10-21

Esta spec no tiene fuentes externas ni licencias que investigar (a diferencia de la 005): las decisiones son de modelo de datos, de integridad (Principio II) y de experiencia (Principio VI). Reutiliza lo que ya funciona en las specs 001 a 005: funciones `security definer` atómicas e idempotentes, instantáneas inmutables (spec 003), zona horaria del perfil resuelta en el servidor (specs 003 y 004), borradores locales (spec 001) y la búsqueda de ejercicios (spec 005). Ningún punto quedó como «NEEDS CLARIFICATION».

## Decisión 1: el plan y lo realizado son tablas distintas

**Decisión**: una sesión tiene dos conjuntos de filas separados: `session_plan_items` (lo que se pensaba hacer, copiado al crear la sesión) y `session_exercises` con `session_sets` (lo que se hizo). Un ejercicio realizado puede apuntar al ítem del plan que cumple (`plan_item_id`), con una marca `is_substitute` si lo reemplaza. Un ítem del plan sin ejercicio realizado con series es «no realizado».

**Por qué**: el Principio II exige que planificación y ejecución sean conceptos separados y que reprogramar o cambiar lo hecho nunca reescriba el otro. Con tablas distintas es imposible, por construcción, que un valor planificado aparezca como realizado (SC-006), y el plan queda inmutable.

**Alternativas descartadas**:
- Una sola tabla de ítems con columnas `planned_*` y `done_*`: mezcla los dos conceptos, hace que «sin dato» y «no planificado» se confundan con `null` y obliga a tocar las mismas filas al planificar y al ejecutar.
- Guardar el plan como `jsonb` dentro de la sesión: no se puede consultar ni restringir, y duplica la lógica de validación.

## Decisión 2: la instantánea del ejercicio se copia en cada fila y el vínculo es `on delete set null`

**Decisión**: tanto `session_plan_items` como `session_exercises` (y `routine_exercises`) guardan `exercise_name` y `measurement_type` copiados al agregar el ejercicio, más `exercise_id` con clave foránea a `exercises` **`on delete set null`** (el mismo patrón que `meal_entries.food_id`). Un disparador impide cambiar la instantánea después de insertar la fila; solo permite que `exercise_id` pase a nulo, que es lo que hace la base cuando se elimina el ejercicio.

**Por qué**: la spec 005 dejó el `id` del ejercicio estable e inmutable y una prueba guardiana que prohíbe `on delete cascade` hacia `exercises`. Con `set null`, eliminar un ejercicio propio no bloquea nada ni borra sesiones (FR-036) y el historial sigue mostrando el nombre guardado (FR-035).

**Alternativas descartadas**:
- Sin clave foránea (id suelto): el historial de un ejercicio eliminado seguiría agrupado, pero una referencia sin integridad deja ids huérfanos y rompería el guardián de claves foráneas. Un ejercicio eliminado ya no tiene historia consultable, y sus sesiones siguen visibles desde el calendario, que es lo que pide la spec.
- Leer siempre el nombre del ejercicio vivo: es justo lo que prohíbe el Principio II.

**Consecuencia asumida**: la historia de un ejercicio agrupa por `exercise_id`; una copia propia es otro ejercicio con su propia historia (suposición de la spec).

## Decisión 3: estados, marcas y la regla de «modificada»

**Decisión**: el estado es uno de `planned`, `in_progress`, `completed`, `cancelled`. Las marcas son datos de la sesión, no estados:
- **Reprogramada**: `rescheduled_count > 0`; el recorrido de fechas está en `session_date_changes` (de solo altas).
- **Modificada**: columna `modified`, calculada por el servidor al terminar o corregir, solo si `has_plan`. Es verdadera si algún ítem del plan quedó sin series propias («no realizado»), si fue sustituido, si hay un ejercicio realizado con series que no estaba en el plan, o si un ejercicio realizado tiene una cantidad de series distinta de las planificadas. **No** depende de repeticiones, peso, duración ni distancia (FR-019).
- **Corregida**: `corrected_at`, que se fija cuando se guarda una sesión ya realizada.

**Por qué**: guardar `modified` evita recalcular en cada lectura del calendario y la regla vive en un solo lugar (una función SQL probada con pgTAP). Se recalcula siempre en el servidor, nunca en el cliente.

**Alternativas descartadas**:
- Calcular «modificada» al leer: cada vista del calendario pagaría un recorrido por todas las filas hijas, y la regla se duplicaría en cliente y servidor.
- Estados separados «modificada» y «reprogramada»: no son excluyentes con «realizada» ni con «planificada».

## Decisión 4: todas las escrituras pasan por funciones; guardar la sesión es «reemplazar todo» con revisión

**Decisión**: el cliente no inserta ni actualiza tablas; llama a funciones `security definer` (con `search_path` vacío, `auth.uid()` y sesión vigente verificados), como en la spec 005. Las funciones de ciclo de vida son pequeñas (planificar, reprogramar, cancelar, iniciar). Guardar el contenido de una sesión es **una sola función** `save_session(id, payload, expected_revision, finish)` que reemplaza los ejercicios y las series de la sesión por los del payload, de forma atómica. La sesión tiene una columna `revision` que sube con cada guardado; si `expected_revision` no coincide, la función rechaza con `stale_revision`.

**Por qué**:
- El estado de una sesión en curso vive en el formulario (borrador local), así que «enviar el estado completo» es lo natural y es **idempotente por construcción**: repetir el envío deja el mismo resultado (FR-047).
- Operaciones granulares (agregar serie, quitar serie, mover ejercicio...) multiplicarían las llamadas, dejarían estados parciales ante un corte y exigirían una cola de operaciones, que la Constitution no permite (sin sincronización diferida).
- La revisión detecta que otro dispositivo guardó antes sin pisarlo en silencio (Principio II). El payload de una sesión es chico (hasta 30 ejercicios × 20 series), unos pocos KB.

**Alternativas descartadas**:
- Operaciones granulares con una cola local: es sincronización diferida.
- «El último gana» sin revisión: pisaría en silencio lo que otro dispositivo guardó.
- Bloqueo pesimista por sesión: complica sin necesidad para un uso personal.

## Decisión 5: borrador local siempre; autoguardado al servidor con indicador de estado

**Decisión**: todo lo que se escribe en una sesión (en curso o en corrección) se guarda en el borrador local (`useDraft`, `localStorage`, clave por cuenta y sesión) en cada cambio, y se borra al confirmarse el guardado en el servidor y al cerrar sesión (FR-045). Mientras la sesión está en curso, la aplicación además **guarda en el servidor** con un retardo corto después del último cambio (una sola solicitud en vuelo, siempre con el estado más reciente) y muestra un indicador: «Guardado», «Guardando…» o «Sin guardar en el servidor» con la causa (FR-046). Al abrir una sesión, si hay borrador con cambios sin confirmar, se ofrece recuperarlo; si el servidor tiene una revisión más nueva que la del borrador, se avisa que la sesión cambió en otro dispositivo y se elige qué versión conservar.

**Por qué**: es lo que pide el Principio VI (borrador local hasta recibir confirmación, sin modo offline) y evita perder una sesión si se cierra la pestaña. El guardado automático hace que la sesión «En curso» exista de verdad en el servidor, así que se ve en el calendario desde otro dispositivo.

**Alternativas descartadas**:
- Guardar solo al terminar: una sesión en curso desaparecería para el resto de la aplicación y una pérdida del dispositivo perdería todo.
- Guardar con cada tecla: sobrecarga sin valor.

## Decisión 6: fechas y zona horaria

**Decisión**: una sesión pertenece a un día calendario (`session_date`, tipo `date`). El «hoy» lo calcula el servidor con la zona del perfil (`private.effective_timezone`), como en las specs 003 y 004; el reloj del dispositivo no decide. Reglas:
- Se puede **registrar** (iniciar) una sesión en una fecha de hoy o pasada.
- Se puede **planificar** o **reprogramar** a una fecha de hoy o futura; nunca a una pasada.
- Una sesión planificada se puede iniciar si su fecha es de hoy o anterior (la vencida «Sin registrar»); conserva su fecha.
- Una sesión realizada o en curso no cambia de fecha jamás.
- Una sesión que cruza la medianoche conserva el día en que empezó (la fecha se fija al iniciar).

No se usa la regla del «día que se está cerrando» de la spec 003: para las comidas tiene sentido imputar una cena tardía al día anterior; en entrenamiento, quien entrenó ayer elige «ayer» explícitamente, y así hay una sola fecha por sesión, sin ambigüedad.

**Alternativas descartadas**: aplicar también la regla del día que cierra (dos días posibles para «hoy» complicarían el calendario sin beneficio); fiarse del reloj del dispositivo (manipulable y desfasado, ya descartado en la spec 004).

## Decisión 7: una sola sesión en curso por persona

**Decisión**: índice único parcial sobre `(user_id)` donde `status = 'in_progress'`. Iniciar otra sesión con una abierta responde `session_in_progress` con el identificador de la abierta, y la interfaz ofrece continuarla (FR-009).

**Por qué**: evita sesiones duplicadas por error (un doble toque en otra pestaña) y simplifica el borrador local (uno solo por persona y dispositivo).

## Decisión 8: idempotencia

**Decisión**:
- Crear (rutina, sesión planificada, sesión iniciada) y reprogramar: `request_id` guardado como `client_request_id` con índice único `(user_id, client_request_id)`; repetir la solicitud devuelve el mismo registro, incluso si es un reintento tardío tras otro cambio (el patrón de `set_energy_goal`).
- Cancelar y terminar: naturalmente idempotentes (si ya está en el estado destino, devuelven el resultado sin cambiar nada).
- Guardar contenido: reemplazo completo con revisión (Decisión 4).
- Editar una rutina: reemplazo completo de sus ítems; repetirlo deja el mismo resultado.

## Decisión 9: las rutinas son un catálogo sin días; se copian al planificar

**Decisión**: una rutina es un nombre y una lista ordenada de ítems (ejercicio, series y objetivos opcionales). No tiene días ni repetición (aclaración del autor). Al planificar o iniciar una sesión desde una rutina, el servidor **copia** sus ítems a `session_plan_items`, **refrescando** el nombre y el tipo de medición desde el ejercicio vigente (FR-037); si el ejercicio ya no existe usa los que guardó la rutina y lo marca. Al guardar una rutina también se refrescan las instantáneas de sus ítems.

**Cambio de tipo de medición**: si el tipo vigente de un ejercicio difiere del guardado en la rutina, los objetivos que no corresponden al tipo nuevo no se descartan al instante: la pantalla de la rutina los muestra aparte con un aviso para revisarlos y el guardado exige corregirlos. Al copiar a una sesión, solo pasan los objetivos compatibles con el tipo vigente y el ítem del plan queda con `targets_dropped = true`, que la sesión muestra con un aviso neutral (no es un descarte silencioso).

**Duplicar** una rutina copia el contenido con el nombre «… (copia)» recortado a 80 caracteres.

**Por qué**: el plan de una sesión no debe cambiar si la rutina se edita después (FR-005, FR-015), y el catálogo sin días es lo que pidió el autor para tener flexibilidad.

## Decisión 10: la historia de un ejercicio es una función de lectura paginada

**Decisión**: `exercise_history(exercise_id, exclude_session_id, page_size, page_offset)` (`security invoker`, así RLS filtra) devuelve las sesiones **realizadas** donde se registró el ejercicio, de la más reciente a la más antigua, cada una con su fecha, el nombre guardado, el esfuerzo percibido y las series en un `jsonb` ordenado. «La última vez» dentro de una sesión es la misma función con `page_size = 1` y `exclude_session_id` de la sesión actual. Índice `(user_id, exercise_id)` sobre `session_exercises`.

**Por qué**: una consulta con un índice por ejercicio alcanza para SC-010 (500 sesiones, primera tanda < 1 s) sin vistas materializadas. No guarda datos propios (la entidad «historia» es derivada).

**Alternativas descartadas**: tabla de historia desnormalizada (duplica datos y se desincroniza al corregir sesiones); calcular en el cliente (traería todas las series).

## Decisión 11: calendario propio, sin librería

**Decisión**: el calendario mensual se arma con una cuadrícula de 7 columnas propia: cada día es un enlace con un nombre accesible completo («jueves 22 de octubre, 1 sesión realizada y 1 planificada»), navegable con Tab; las flechas «mes anterior/siguiente» son botones. La lectura del mes es una consulta por rango de fechas (`session_date` entre el primer y el último día visible) sin series, solo estado, marcas y rutina. El día abierto carga el detalle de sus sesiones.

**Por qué**: no se agrega ninguna dependencia (Principio VII, alcance acotado), y una cuadrícula de enlaces es más accesible que una biblioteca genérica. Las bibliotecas evaluadas (`react-big-calendar`, `fullcalendar`) pesan cientos de KB y traen su propio manejo de fechas y de foco.

## Decisión 12: lenguaje neutral verificable

**Decisión**: todos los textos de la sección viven en `copy/es.ts` (clave `training`) y una prueba unitaria (el patrón de `goalCopy.test.ts` de la spec 004) recorre cada texto y falla si aparece alguno de los términos prohibidos (racha, perdiste/perdido, fallaste/falló, culpa, mejoraste/retrocediste, récord, vago, flojo, objetivo cumplido...). «Sin registrar» y «No realizado» son los textos de lo no hecho.

## Decisión 13: límites y rangos (los de la spec, reimpuestos en la base)

| Dato | Límite |
|---|---|
| Nombre de rutina | 1 a 80 caracteres, sin espacios en los extremos |
| Ejercicios por rutina / por plan / realizados por sesión | 1 a 30 en una rutina; hasta 30 en un plan y hasta 30 realizados |
| Series planificadas por ejercicio | 1 a 20 |
| Series realizadas por ejercicio | 0 a 20 |
| Repeticiones | entero 1 a 999 |
| Peso | 0 a 999,9 kg (admite dos decimales) |
| Duración | 1 segundo a 24 horas (se guarda en segundos) |
| Distancia | mayor que 0, hasta 999,9 km (hasta tres decimales) |
| Esfuerzo percibido | entero 1 a 10, uno por ejercicio realizado |
| Nota de sesión / de ejercicio | 1.000 / 500 caracteres |
| Fecha | desde 2000-01-01 |

La interfaz acepta coma decimal; la base reimpone todo (si el cliente falla, la base rechaza).

## Decisión 14: lo que se deja fuera, a propósito

- **Gráficos**: spec 012 (redactada, pendiente).
- **Calorías de las sesiones**: spec 007/008.
- **Músculos en la instantánea**: la sesión guarda nombre y tipo de medición, no los músculos; si se quiere ver trabajo por músculo habrá que decidir si también se guardan (anotado en la spec 012).
- **Cronómetros de descanso, supersets, ciclos semanales, plantillas del sistema, compartir o importar rutinas**: fuera de alcance (spec).
- **Hora de inicio y de fin como dato visible**: se guardan `started_at` y `finished_at` solo para ordenar las sesiones de un mismo día y detectar el cruce de la medianoche.

## Decisión 15: estrategia de pruebas y datos de desarrollo

**Decisión**: pgTAP para el esquema, RLS, funciones, transiciones, la regla de «modificada», la inmutabilidad de instantáneas y el guardián de claves foráneas; Vitest para esquemas Zod, texto, calendario, formularios y el editor de sesión (autoguardado, revisión, borrador); Playwright + axe para los flujos, el aislamiento por la API real, la accesibilidad y la medición. Ayudantes de siembra `tests.create_routine` y `tests.create_session` (solo local, en `supabase/seed.sql`). Las pruebas pgTAP empiezan con `delete from public.workout_sessions` y `delete from public.routines` dentro de su transacción (lección de las specs 002 y 003).

## Riesgos y verificaciones previas a implementar

1. **Editor de sesión (la pantalla más compleja del proyecto)**: lista anidada (ejercicios → series) con autoguardado, revisión y borrador. Mitigación: la lógica de estado va en un hook puro y probado (`useSessionEditor`) separado de los componentes; el payload y su validación son los mismos en cliente y servidor.
2. **Concurrencia entre dispositivos**: la revisión evita pisar en silencio, pero la resolución del conflicto es una decisión de la persona. Se prueba con dos sesiones del navegador.
3. **Regla de «modificada»**: tiene casos límite (ejercicio con cero series, sustitución, ejercicio agregado vacío). Se fija con una tabla de casos en pgTAP antes de implementar la función.
4. **Zona horaria y medianoche**: se prueba con hora simulada, como en la spec 004 (parámetros `p_now` y `p_zone` en una función privada).
5. **Calendario accesible**: cuadrícula de enlaces con nombres completos; se verifica con axe y recorrido por teclado.
6. **Tamaño de las consultas**: mes con 200 sesiones y historia con 500; se miden con datos sintéticos (T de medición).
7. **Cambio del tipo de medición de un ejercicio con rutinas**: los objetivos incompatibles se tratan de forma explícita (Decisión 9), con pruebas.

## Resultados de prototipos

*(Se completa durante la implementación.)*

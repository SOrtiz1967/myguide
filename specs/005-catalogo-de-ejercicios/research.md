# Research: Catálogo de ejercicios

**Feature**: 005-catalogo-de-ejercicios | **Fecha**: 2026-10-20

Decisiones técnicas de la spec 005. Cierra la decisión técnica pendiente **#4 de la Constitution para ejercicios** (fuentes, formato, proceso de importación y estrategia de traducción). Se apoya en el stack y los patrones de las specs 001 a 004; en especial en el catálogo de alimentos (spec 002), del que copia el modelo de datos, la búsqueda, el pipeline de carga y las pantallas.

## Qué se midió para decidir (2026-10-20)

Se descargaron y analizaron las dos candidatas serias. Los datos descargados quedaron fuera del repositorio (no se confía en ellos hasta pasar por la carga validada).

| | **free-exercise-db** (`yuhonas/free-exercise-db`) | **wger** (`wger.de`, API pública) |
|---|---|---|
| Licencia de los datos | **Unlicense** (dominio público), `LICENSE.md` del repositorio | **CC BY-SA 4.0** (779 ejercicios), **CC BY-SA 3.0** (132) y **CC0** (21), por ejercicio, con el autor de cada uno |
| Ejercicios | 876 | 932 |
| Idioma | Solo inglés | Inglés en todos; **español en 645** (el 69 %) |
| Músculos | 17 valores fijos, siempre con músculo principal | Más finos (músculos con nombre latino), 162 sin músculo informado |
| Equipamiento | 13 valores fijos; 77 sin dato | 12 valores; 219 sin dato |
| Categorías / tipo | `strength`, `stretching`, `plyometrics`, `powerlifting`, `olympic weightlifting`, `strongman`, `cardio` | `Legs`, `Back`, `Arms`, `Shoulders`, `Abs`, `Chest`, `Cardio`, `Calves` (por zona del cuerpo, no por tipo de ejercicio) |
| Cardio / resistencia | 14 ejercicios | 51 |
| Descripción | Pasos en inglés (mediana de 590 caracteres), 5 ejercicios sin pasos | HTML, en el idioma de cada traducción |
| Identificador | Estable y legible (`3_4_Sit-Up`) | Numérico y `uuid` |
| Formato | Un archivo JSON de ~1 MB, sin API | API REST paginada, con límite de uso |
| Obligaciones | Ninguna | Atribución por ejercicio (autor y licencia), indicar los cambios (traducir es un cambio) y **compartir igual** lo adaptado |
| Procedencia del contenido | **No documentada**: el repositorio parte de `exercises.json` de otro autor, que tampoco declara de dónde salen los textos | Documentada: cada ejercicio indica su autor y su licencia |

Versión analizada de free-exercise-db: commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (2026-09-27), `dist/exercises.json` con SHA-256 `5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf`.

## Decisión 1: fuentes del catálogo

- **Decisión**: dos fuentes cargadas por el pipeline del autor.
  1. **`free-exercise-db`** (Unlicense) como base: 876 ejercicios de fuerza, peso corporal, pliometría, halterofilia, movilidad y algo de cardio.
  2. **`myguide-base`** (obra del propio autor del proyecto, dedicada al dominio público con CC0 1.0): unos 20 ejercicios de resistencia, deporte y movilidad que la base no cubre (caminar, correr al aire libre, natación, ciclismo, fútbol, pádel, tenis, baile, yoga...), con nombre y descripción ya en español. Es un archivo versionado del repositorio (`supabase/import/data/ejercicios-base.json`).
- **Por qué free-exercise-db y no wger**: una licencia sin obligaciones. wger tiene mejor cobertura en español (645 traducciones), pero CC BY-SA obliga a atribuir cada ejercicio con su autor, a indicar que se tradujo o modificó y a compartir lo adaptado con la misma licencia. Eso complica el modelo (una atribución por fila, mezcla de CC BY-SA 3.0 y 4.0) y el uso futuro de las copias y de los datos del catálogo, para un ahorro que se resuelve de otra forma (Decisión 4). La estructura de datos de free-exercise-db (valores fijos de músculo y equipamiento) además encaja con las listas cerradas que pide la spec.
- **Por qué una fuente propia**: free-exercise-db tiene solo 14 ejercicios de cardio y casi nada de resistencia o deportes (sin natación ni caminata), que son la mitad de lo que hace una persona que se mueve. Un archivo propio da licencia limpia y nombres en español sin traducción.
- **Alternativas evaluadas**: **wger** como complemento futuro (se mantiene la arquitectura de varias fuentes para poder sumarla después si se revisa la licencia de compartir igual); **`wrkout/exercises.json`** (el origen de free-exercise-db: misma licencia declarada y misma duda sobre la procedencia, sin las correcciones posteriores); **ExRx** (su sitio publica una página de licenciamiento comercial y no una licencia abierta; `exrx.net/store/other/licensing`); **RepDB** (según su descripción pública, exige atribución incluso en el plan gratuito); **MuscleWiki y otras APIs comerciales** (no se revisaron sus términos). Ninguna de estas tres se analizó en profundidad: no se encontró en ellas una licencia abierta que permita una copia local sin obligaciones, que es lo que pide el Principio X.

## Decisión 2: licencia, procedencia y qué se le pide al autor

- **Lo que está claro**: free-exercise-db declara la Unlicense. Es la licencia más permisiva: se puede copiar, modificar y redistribuir sin atribuir. Aun así se muestra la fuente y su licencia en la pantalla de fuentes (transparencia, Principio X).
- **El riesgo que no se puede cerrar desde aquí**: ni free-exercise-db ni su origen documentan de dónde sacaron los **textos de los pasos**. Una dedicación al dominio público solo vale si quien la hizo era dueño del contenido. Para los hechos (nombre del ejercicio, músculo, equipamiento, categoría) el riesgo es mínimo: son datos y no obra creativa. Para los pasos redactados (unas 3.000 frases) no se puede asegurar.
- **Mitigación en el diseño**: la **descripción es un dato opcional y separado** (con su propio estado y su propia fuente de texto), así que el catálogo funciona igual si el autor decide retirarla. La importación puede omitir la descripción de una fuente con un parámetro (`--sin-descripcion`) y la carga siguiente la quita sin tocar el resto. Las imágenes de la fuente **no se importan** (la spec las deja fuera y su procedencia es todavía menos clara).
- **Tareas para el autor**, anotadas en `Documentacion/issues-autor/08-ejercicios-licencias.md` al implementar:
  1. Aceptar o revisar el riesgo de procedencia de los pasos de free-exercise-db antes de abrir la aplicación a terceros (el mismo tipo de revisión pendiente para ODbL en la spec 002). Para el MVP personal el riesgo es bajo.
  2. Confirmar la dedicación CC0 de `myguide-base` (es obra propia).
  3. Ir revisando las traducciones (Decisión 4).
- **Documentación obligatoria antes de importar** (Principio X): se agrega una sección de ejercicios a `Documentacion/fuentes-datos.md` con la licencia, la versión fijada y las obligaciones de cada fuente. La carga se rechaza si la fuente no tiene licencia y atribución registradas.

## Decisión 3: tipo de medición

- **Decisión**: cuatro tipos, definidos por la spec: `reps_weight` (repeticiones y peso), `reps_bodyweight` (repeticiones, peso corporal), `duration` (tiempo) y `distance_duration` (distancia y tiempo). La fuente no trae este dato, así que lo asigna la carga con **reglas documentadas más un archivo de excepciones revisable**.
- **Reglas por defecto** (en `normalize`, puras y probadas):

| Condición en la fuente | Tipo |
|---|---|
| categoría `stretching` | `duration` |
| categoría `cardio` | `duration`, salvo los que avanzan por distancia: `distance_duration` |
| categoría `plyometrics` o equipamiento `body only` | `reps_bodyweight` |
| el resto (barra, mancuernas, polea, máquina, pesas rusas, bandas, pelotas, otro, powerlifting, halterofilia, strongman) | `reps_weight` |

- **Excepciones**: `supabase/import/data/ejercicios-medicion.csv` (`source_item_id,tipo,motivo`) corrige los casos que la regla no resuelve. Con la versión analizada, la regla da 597 `reps_weight`, 142 `reps_bodyweight`, 128 `duration` y 9 `distance_duration`, y deja unos 110 ejercicios dudosos (equipamiento `other` o sin dato en fuerza, pliometría y cardio: el balancín, las sogas de batalla, los fondos, las dominadas asistidas...). Se resuelven una vez, a mano y con el autor, en ese archivo. Un ejercicio que ni la regla ni las excepciones clasifiquen se omite con un informe (FR-016).
- **Por qué no "sin definir"**: sin tipo, la spec 006 no sabría qué pedir al registrar una serie.
- **Alternativas**: pedir el tipo al importar cada ejercicio a mano (876 decisiones, sin reglas que se puedan volver a aplicar); inferirlo del texto de los pasos (frágil).

## Decisión 4: nombres y descripciones en español

- **Decisión**: igual que en la spec 002 para los genéricos USDA, **una sola vez y de forma asistida**, a un archivo versionado: `supabase/import/data/ejercicios-es.json`, con una entrada por `source_item_id`: `{ "nombre", "sinonimos": [], "pasos": [], "nombre_estado", "pasos_estado" }`. Los estados son `machine_translated` (sin revisar) y `reviewed` (revisada). Las traducciones se corrigen editando ese archivo y volviendo a cargar; una entrada marcada `reviewed` **no se pisa** por una carga posterior que traiga otra traducción automática.
- **Cómo se genera la primera versión**: la hace el desarrollo con asistencia de IA, en lotes, durante la implementación, y queda en el repositorio para revisarla con un `diff` (no hay dependencia de ningún servicio en tiempo de ejecución; los textos son públicos, sin datos personales). El autor las marca `reviewed` a su ritmo.
- **Nombre original y sinónimos**: el nombre en inglés de la fuente se guarda como `original_name` y los sinónimos en español (por ejemplo, «sentadilla» y «cuclillas») en `aliases`. La búsqueda encuentra por los tres (FR-013).
- **Lo que no trae traducción**: un ejercicio sin entrada en `ejercicios-es.json` se omite con el motivo `no_translation`, como los genéricos USDA, para que nunca aparezca un nombre en inglés sin avisar.
- **Alternativas**: usar las 645 traducciones de wger (descartado con la fuente, Decisión 1); traducir al vuelo con IA (depende de un tercero y gasta cuota); dejar los textos en inglés (incumple el Principio X).

## Decisión 5: listas cerradas de músculos y equipamiento

- **Decisión**: dos listas cerradas con código estable y nombre en español (FR-024). Los códigos son los de free-exercise-db, así la carga no necesita traducirlos, más `full_body` para la fuente propia.

| Código | Español | | Código | Español |
|---|---|---|---|---|
| `abdominals` | Abdominales | | `lower back` | Zona lumbar |
| `abductors` | Abductores | | `middle back` | Espalda media |
| `adductors` | Aductores | | `neck` | Cuello |
| `biceps` | Bíceps | | `quadriceps` | Cuádriceps |
| `calves` | Pantorrillas | | `shoulders` | Hombros |
| `chest` | Pecho | | `traps` | Trapecios |
| `forearms` | Antebrazos | | `triceps` | Tríceps |
| `glutes` | Glúteos | | `full_body` | Cuerpo completo |
| `hamstrings` | Isquiotibiales | | `lats` | Dorsales |

| Código | Español | | Código | Español |
|---|---|---|---|---|
| `body only` | Peso corporal | | `kettlebells` | Pesa rusa |
| `barbell` | Barra | | `bands` | Bandas elásticas |
| `dumbbell` | Mancuernas | | `medicine ball` | Pelota medicinal |
| `cable` | Polea | | `exercise ball` | Pelota de ejercicio |
| `machine` | Máquina | | `foam roll` | Rodillo de espuma |
| `e-z curl bar` | Barra Z | | `other` | Otro |

- **Faltantes**: un equipamiento ausente en la fuente (77 ejercicios) es un **dato faltante** («sin dato»), distinto de «Peso corporal», que es un valor informado (caso borde de la spec).
- **Dónde viven**: la base las impone con restricciones `check` sobre los códigos, y la aplicación las tiene en una constante (`exerciseLists.ts`) con los nombres en español. Una prueba pgTAP comprueba que cada código acepta y que otro se rechaza, y una prueba unitaria que la lista del cliente tiene los mismos códigos que la de la base (leyendo la migración).
- **Alternativas**: tablas de referencia con claves foráneas (más estructura para 35 valores que casi no cambian; agregar un valor es un cambio de la aplicación de todos modos); texto libre (no se puede filtrar ni agrupar).

## Decisión 6: modelo de datos

- **Decisión**: la misma forma que `foods`: **una tabla `exercises`** para el catálogo (`user_id` nulo) y los ejercicios propios, una tabla `exercise_sources` de solo lectura y un informe de cargas `private.exercise_import_runs`. Músculos y alias en **arreglos** (`text[]`) con restricciones, sin tablas intermedias.
- **Por qué arreglos y no tablas de unión**: los músculos y los alias se leen siempre junto con el ejercicio, nunca se consultan sueltos y son pocos (hasta 8 y 10). Un arreglo con `check (primary_muscles <@ lista)` simplifica las funciones de crear, editar y copiar, que quedan atómicas con una sola fila. La búsqueda por músculo usa el operador de intersección de arreglos.
- **Fuentes**: tabla propia `exercise_sources` (no se generaliza `food_sources`), para no tocar nada de la spec 002. La pantalla de fuentes junta las dos listas.
- **Cambios entre fuentes y copias**: `based_on_exercise_id` con `on delete set null`, igual que `based_on_food_id`.
- **Alternativa**: generalizar `food_sources` a `catalog_sources` y renombrar (toca migraciones, funciones, pruebas y pantallas de la 002 por un beneficio mínimo).

## Decisión 7: búsqueda

- **Decisión**: la de la spec 002: `unaccent` y `pg_trgm` sobre un texto normalizado, con índice GIN de trigramas. El texto de búsqueda reúne **nombre en español + nombre original + alias**, sin acentos y en minúsculas; el ordenamiento prefiere el nombre exacto, luego el prefijo del nombre, luego una coincidencia por alias u original y por último la similitud.
- **Filtros**: músculo (coincide si está entre los principales o los secundarios) y equipamiento, por igualdad de código; se combinan entre sí y con el texto. **Sin texto** y con al menos un filtro, la lista se ordena por nombre. Sin texto y sin filtros no hay búsqueda (FR-011).
- **El texto de búsqueda lo mantiene un disparador** (`private.exercise_search_fields`), no una columna generada: `array_to_string` no es inmutable y una columna generada lo exige. El disparador también calcula `name_norm`.
- **Paginación**: por tandas de 20 con desplazamiento.
- **Escala**: 900 ejercicios del catálogo más los propios; el tope de diseño es de 20.000 (SC-002 pide 2.000). A esta escala el índice casi no hace falta, pero se mantiene por consistencia con la 002 y se mide en un prototipo.

## Decisión 8: pipeline de carga

- **Decisión**: el mismo esquema de la 002 (`supabase/import/`): extraer a un formato intermedio normalizado (NDJSON), normalizar y validar con funciones puras y probadas, y cargar en lotes con la clave de servicio, por funciones exclusivas de `service_role`. Archivos nuevos: `extract-exercises.ts`, `normalize-exercises.ts` y `load-exercises.ts`, y los datos `ejercicios-es.json`, `ejercicios-medicion.csv` y `ejercicios-base.json`.
- **Fuente fijada**: `dist/exercises.json` del commit `f00c92c7…` se **versiona en el repositorio** (≈ 1 MB, con su `LICENSE.md`; la Unlicense lo permite) y la carga **verifica su SHA-256**; si no coincide, se detiene. Así la carga y las pruebas no necesitan red, son reproducibles y un cambio en el repositorio de origen no entra sin que el autor suba la versión a propósito.
- **Idempotencia**: clave `(fuente, source_item_id)`. Repetir la carga no duplica ni toca ejercicios propios, copias ni traducciones marcadas como revisadas.
- **Garantías heredadas**: sin licencia registrada, la carga se rechaza; los faltantes son `null`; los registros inválidos se omiten con motivo y no detienen el resto; sin datos personales en informes.

## Decisión 9: interfaz

- **Decisión**: rutas `/ejercicios`, `/ejercicios/nuevo`, `/ejercicios/:id` y `/ejercicios/:id/editar`, con el mismo patrón de la sección de alimentos (pestañas Todos / Del catálogo / Mis ejercicios, resultados por tandas, estado en la URL). La pantalla `/fuentes` pasa a mostrar dos secciones, «Alimentos» y «Ejercicios». Se agrega el enlace «Ejercicios» a la cabecera.
- **Filtros**: dos listas desplegables nativas («Todos los músculos» y «Todo el equipamiento»), con el estado en la URL (`?musculo=&equipo=`). Un filtro activo se ve como una etiqueta que se puede quitar y la lista anuncia cuántos resultados deja.
- **Formulario**: nombre, tipo de medición (opciones con su explicación), músculos principales y secundarios (casillas en una cuadrícula), equipamiento (lista), descripción y «Otros nombres» (hasta 5, opcional).
- **Reutilización**: `OriginTabs`, `Field`, `ConfirmDialog`, `useDraft`, `saveRemotely` y `newRequestId` tal cual; se extraen a un lugar común solo las piezas que hoy están dentro de `features/foods` y se necesitan en dos sitios (las pestañas de origen y la tabla de procedencia).

## Decisión 10: referencia estable para las sesiones (spec 006)

- **Decisión**: cada ejercicio tiene un `id` uuid estable. Las tablas futuras que lo referencien usarán `on delete set null` y guardarán una copia del **nombre** y del **tipo de medición** (Principio II). Lo hace cumplir una prueba guardiana en `exercises_schema.test.sql`, igual a la de `foods_schema.test.sql`: ninguna clave foránea hacia `exercises` puede ser `on delete cascade`.
- **Por qué**: la spec 006 podrá registrar sesiones sin que editar o eliminar un ejercicio, o cambiar su tipo de medición, reescriba lo ya realizado.

## Decisión 11: lo que se deja fuera, a propósito

- **Imágenes, GIF y videos**: no se importan (spec). La procedencia de las imágenes de free-exercise-db no está documentada.
- **Complementar con wger**: posible en una spec futura, con revisión de la obligación de compartir igual. La arquitectura admite varias fuentes.
- **Calorías por ejercicio**: no (spec 007/008).
- **Dificultad, fuerza y mecánica** (`level`, `force`, `mechanic` de la fuente): no se guardan; no los pide la spec y no se pueden mostrar con garantías de calidad.

## Riesgos y verificaciones previas a implementar

1. **Procedencia de los pasos de free-exercise-db** (Decisión 2): revisión del autor; mitigada porque la descripción es separable.
2. **Volumen de traducción**: unos 876 nombres y 3.000 frases. Se hace en lotes durante la implementación, con una prueba que verifica que todo ejercicio importado tiene traducción y que ninguna entrada mezcla inglés sin marcar.
3. **Clasificación del tipo de medición** (Decisión 3): unos 110 casos dudosos que hay que resolver a mano; la carga informa cuántos quedan sin excepción.
4. **Cobertura de resistencia**: 14 ejercicios de cardio en la base; lo cubre `myguide-base` y, si falta algo, cada persona crea el suyo.
5. **Dependencia de la fuente fijada**: ninguna en ejecución; la copia con su SHA-256 vive en el repositorio.
6. **Pruebas dependientes de datos locales**: lección de las specs 002 y 003. Las pruebas pgTAP del catálogo empiezan con `delete from public.exercises` dentro de su transacción.
7. **Estado de las listas cerradas entre cliente y base**: una prueba verifica que coinciden (Decisión 5).

## Resultados de prototipos

*(Se completa durante la implementación, tareas T001 y siguientes.)*

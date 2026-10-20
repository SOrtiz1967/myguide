# Contrato: rutas y estados de la interfaz

**Feature**: 005-catalogo-de-ejercicios | Toda la interfaz en español, con tratamiento de "tú". Todas las rutas son privadas (`RequireAuth`).

## Rutas

| Ruta | Propósito | Historia |
|---|---|---|
| `/ejercicios` | Búsqueda con pestañas **Todos**, **Del catálogo** y **Mis ejercicios**, filtros de músculo y equipamiento, y resultados por tandas | 1 |
| `/ejercicios/nuevo` | Crear un ejercicio propio (admite `?nombre=` para precargar lo buscado) | 2 |
| `/ejercicios/:id` | Detalle: datos, procedencia, acciones según el origen | 1, 3, 4 |
| `/ejercicios/:id/editar` | Editar un ejercicio propio o una copia | 4 |
| `/fuentes` | Fuentes, licencias y atribución: dos secciones, «Alimentos» y «Ejercicios» | 6 |

El enlace **Ejercicios** se agrega a la navegación de la cabecera, después de «Alimentos». La pestaña, el texto buscado y los filtros viven en la URL (`?q=&origen=&musculo=&equipo=`), así que sobreviven a ir al detalle y volver (FR-012).

## Glosario de términos en pantalla

| En pantalla | En la base de datos |
|---|---|
| **Del catálogo** (nunca "importado" ni "común") | `origin = 'imported'` |
| **Propio** | `origin = 'own'` |
| **Sin dato** | valor nulo o arreglo vacío |
| **Traducción sin revisar** | `*_status = 'machine_translated'` |
| **Traducción revisada** | `*_status = 'reviewed'` |
| **Repeticiones y peso** | `reps_weight` — «Se registra con repeticiones y peso» |
| **Repeticiones (peso corporal)** | `reps_bodyweight` — «Se registra con repeticiones, sin peso» |
| **Tiempo** | `duration` — «Se registra con el tiempo» |
| **Distancia y tiempo** | `distance_duration` — «Se registra con distancia y tiempo» |

Los nombres de músculos y de equipamiento son los de `research.md`, Decisión 5.

## Estados por pantalla

| Pantalla | Carga | Vacío | Éxito | Error |
|---|---|---|---|---|
| Búsqueda | "Buscando…" sin parpadeo de resultados viejos | sin resultados: mensaje y botón "Crear [lo buscado]"; con filtros activos y sin resultados: dice qué filtros están activos y ofrece quitarlos (sin botón de crear); catálogo vacío: aviso explícito; texto de menos de 2 caracteres sin filtros: indicación | lista de resultados con "Ver más" y cantidad anunciada | fallo de red: aviso con "Reintentar" (y mensaje sin conexión si corresponde) |
| Detalle | carga | ejercicio inexistente o ajeno: "No encontramos este ejercicio" | datos completos | fallo con "Reintentar" |
| Formulario | botón deshabilitado al enviar | n/a | "Ejercicio guardado" y vuelve al detalle | errores por campo; fallo de red: no se guardó, se conserva el borrador |
| Fuentes | carga | "Todavía no hay fuentes cargadas" (por sección) | lista | fallo con "Reintentar" |

## Reglas de presentación

- **Lista**: nombre (recortado con puntos suspensivos), tipo de medición en palabras, músculo principal y equipamiento (o «sin dato»), y la marca «Del catálogo» o «Propio».
- **Detalle**: nombre; «También se conoce como» (nombre original y alias, si los hay); tipo de medición explicado; músculos principales y secundarios (o «sin dato»); equipamiento (o «sin dato»); descripción como pasos numerados (o «sin dato»); procedencia.
- **Procedencia**: «Del catálogo · [Fuente] · código [id de origen] · importado el [fecha dd/mm/aaaa]», o «Propio» / «Propio, basado en [ejercicio]». Los textos traducidos sin revisar llevan «traducción sin revisar» junto al nombre y junto a la descripción.
- **Acciones en el detalle**: del catálogo → **Crear mi versión**; propio → **Editar**, **Eliminar** (con confirmación) y **Crear una copia**.
- **Formulario**: nombre (obligatorio), tipo de medición (obligatorio; cuatro opciones, cada una con su explicación, como botones de radio), músculos principales y secundarios (casillas en cuadrícula), equipamiento (lista con «Sin dato»), descripción (texto largo) y «Otros nombres» (hasta 5, opcional). Al guardar con un nombre que ya existe entre los propios, se avisa («Ya tienes un ejercicio con ese nombre») y se permite guardar igual (variantes).
- **Filtros**: dos listas nativas («Todos los músculos», «Todo el equipamiento») y, si hay uno activo, una etiqueta con «Quitar». La lista anuncia «N resultados» sin mover el foco.
- **Fuentes**: cada fuente con su nombre, licencia, texto de atribución, fecha de última importación y cantidad, bajo «Alimentos» o «Ejercicios».

## Accesibilidad (FR-036)

- Pestañas con rol y estado accesibles, navegables con flechas (las mismas de la sección de alimentos).
- El resultado de la búsqueda se anuncia ("12 resultados") sin mover el foco.
- El grupo de músculos es un `fieldset` con leyenda; el tipo de medición, un grupo de botones de radio; los errores se asocian a su campo y el foco va al primer error.
- Áreas táctiles de 44 px o más; verificación con axe y recorrido por teclado.

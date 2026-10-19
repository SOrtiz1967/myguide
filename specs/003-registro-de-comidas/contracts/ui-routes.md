# Contrato: rutas y estados de la interfaz

**Feature**: 003-registro-de-comidas | Toda la interfaz en español. Todas las rutas son privadas (`RequireAuth`).

## Rutas

| Ruta | Propósito | Historia |
|---|---|---|
| `/comidas` | Redirige al día propuesto (`log_day_status`) | 2, 5 |
| `/comidas/:fecha` | Vista del día: comidas, ítems, subtotales, total, navegación entre días, fotos | 2, 5, 7 |
| `/comidas/:fecha/agregar?comida=` | Agregar: recientes, búsqueda (la de la spec 002, reutilizada) y entrada manual; elegir cantidad o porción | 1, 3 |
| `/comidas/item/:id` | Detalle del ítem con todos sus nutrientes y origen; editar cantidad o porción, comida y día; eliminar; "Guardar como alimento propio" si es manual | 4 |

El enlace "Comidas" se agrega a la cabecera, antes de "Alimentos". `:fecha` usa el formato AAAA-MM-DD; una fecha inválida o fuera de rango muestra un aviso con un enlace a "Hoy".

## Glosario en pantalla

| En pantalla | Dato |
|---|---|
| Desayuno · Almuerzo · Merienda · Cena · Colación | `breakfast` · `lunch` · `snack` · `dinner` · `extra` |
| **Del catálogo** · **Propio** · **Manual** | `origin` = `catalog` · `own` · `manual` |
| **Estimado, sin confirmar** (reservado para la spec 009) | `status = pending` |
| **Sin dato** | valor `null` |
| "al menos 45 g · falta en 2 ítems" | total con faltantes |
| "Registrando en el lunes 18" · "Empezar el día de hoy" | `closing = true` |

## Estados por pantalla

| Pantalla | Carga | Vacío | Éxito | Error |
|---|---|---|---|---|
| Día | "Cargando el día…" | sin ítems: "Todavía no registraste nada este día" con un botón "Agregar" por comida | comidas con ítems, subtotales y total | fallo de red: aviso con "Reintentar" (y aviso de sin conexión si corresponde) |
| Agregar | recientes cargando sin bloquear la búsqueda | sin recientes: indicación de buscar o escribir; búsqueda sin resultados: "Crear alimento" o "Escribir a mano" | "Agregado al Almuerzo" y vuelve al día | no se guardó: se conserva el borrador y se puede reintentar |
| Ítem | carga | ítem inexistente o ajeno: "No encontramos este registro" | "Cambios guardados" | errores por campo; fallo de red con borrador |
| Foto | "Subiendo foto…" con progreso | botón "Agregar foto" | miniatura | archivo inválido, demasiado grande, sin conexión: mensaje claro; los ítems no se ven afectados |

## Reglas de presentación

- Cada valor lleva su unidad. Energía sin decimales y gramos con hasta un decimal, en formato es-AR. Los totales incompletos se marcan como tales.
- Cada ítem muestra su nombre y su marca (de la instantánea), la cantidad ("150 g", o "1,5 tazas (237 g)"), la energía y su origen. Si el alimento ya no existe: "Este alimento ya no está disponible; se muestran los valores registrados".
- La comida se elige con un control de cinco opciones; la cantidad, con un campo numérico (coma o punto) y, si el alimento tiene porciones, con un selector entre "g/ml" y cada porción.
- Un ítem con estado "estimado, sin confirmar" (reservado para la spec 009) se muestra con la etiqueta "Estimado, sin confirmar" y una nota de que puede contener errores.
- "Guardar como alimento propio" (desde el menú de un ítem manual) abre un diálogo que pide cuánto pesa o mide esa cantidad (g o ml), muestra los valores por 100 resultantes y crea el alimento con esa cantidad como porción; el ítem no cambia.
- Aviso informativo de coherencia de energía y macronutrientes en los manuales (como en la spec 002), sin impedir guardar.
- Repetir: desde el menú de una comida con ítems, "Repetir en…" (día y comida de destino) y una confirmación que dice cuántos ítems se recalculan y cuántos se copian.
- Ningún mensaje juzga lo comido (Principio IV): sin colores de "bien" o "mal" y sin comparaciones con un objetivo (spec 004).

## Accesibilidad

- Navegación entre días con botones etiquetados ("Día anterior: domingo 17") y un selector de fecha accesible.
- Las comidas son secciones con título; los subtotales se leen junto con su comida.
- El diálogo de eliminar reutiliza `ConfirmDialog` (foco atrapado, Escape, fondo inerte).
- El aviso "Registrando en el lunes 18" está en una región visible desde que se abre el día, no solo en un mensaje emergente.
- Áreas táctiles de 44 px o más; verificación con axe y recorrido por teclado.

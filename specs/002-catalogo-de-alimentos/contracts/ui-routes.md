# Contrato: rutas y estados de la interfaz

**Feature**: 002-catalogo-de-alimentos | Toda la interfaz en español. Todas las rutas son privadas (`RequireAuth`).

## Rutas

| Ruta | Propósito | Historia |
|---|---|---|
| `/alimentos` | Búsqueda con pestañas **Todos**, **Del catálogo** y **Mis alimentos**; resultados por tandas | 1 |
| `/alimentos/nuevo` | Crear un alimento propio (admite `?nombre=` para precargar lo que se buscó) | 2 |
| `/alimentos/:id` | Detalle: valores, porciones, procedencia, acciones según el origen | 1, 3, 4 |
| `/alimentos/:id/editar` | Editar un alimento propio o una copia | 4 |
| `/fuentes` | Fuentes, licencias y atribución | 6 |

El enlace "Alimentos" se agrega a la navegación de la cabecera. La pestaña activa y el texto buscado viven en la URL (`?q=&origen=`), así que sobreviven a ir al detalle y volver (FR-033).

## Glosario de términos en pantalla

| En pantalla | En la base de datos |
|---|---|
| **Del catálogo** (nunca "importado" ni "común") | `origin = 'imported'` |
| **Propio** | `origin = 'own'` |
| **Sin dato** | valor `null` |
| **Traducción sin revisar** | `name_status = 'machine_translated'` |

## Estados por pantalla

| Pantalla | Carga | Vacío | Éxito | Error |
|---|---|---|---|---|
| Búsqueda | "Buscando…" sin parpadeo de resultados viejos | sin resultados: mensaje y botón "Crear [lo buscado]"; catálogo vacío: aviso explícito; texto de menos de 2 caracteres: indicación | lista de resultados con "Ver más" | fallo de red: aviso con "Reintentar" (y mensaje sin conexión si corresponde) |
| Detalle | carga | alimento inexistente o ajeno: "No encontramos este alimento" | datos completos | fallo con "Reintentar" |
| Formulario | botón deshabilitado al enviar | n/a | "Alimento guardado" y vuelve al detalle | errores por campo; fallo de red: no se guardó, se conserva el borrador |
| Fuentes | carga | "Todavía no hay fuentes cargadas" | lista | fallo con "Reintentar" |

## Reglas de presentación

- Cada valor numérico lleva su **unidad** y su **base** ("por 100 g" / "por 100 ml"); los faltantes dicen **"sin dato"**, nunca 0 (FR-005, FR-006).
- Las porciones se muestran aparte ("Porciones": nombre y cantidad con su unidad) o "Sin porciones".
- La procedencia muestra: "Del catálogo · [Fuente] · código [id de origen] · importado el [fecha dd/mm/aaaa]" o "Propio" / "Propio, basado en [alimento]". Los nombres traducidos sin revisar llevan la etiqueta "traducción sin revisar".
- Acciones en el detalle: del catálogo → **Crear mi versión**; propio → **Editar**, **Eliminar** (con confirmación) y **Crear una copia**.
- Aviso informativo de coherencia (energía frente a macros) sin impedir guardar.
- Decimales con coma (`12,5`) en entrada y salida (FR-019).

## Accesibilidad (FR-030)

- Pestañas con rol y estado accesibles, navegables por teclado con flechas.
- El resultado de la búsqueda se anuncia ("12 resultados") sin mover el foco.
- Errores asociados a su campo; foco al primer error al enviar.
- Áreas táctiles de 44 px o más; verificación con axe y recorrido por teclado.

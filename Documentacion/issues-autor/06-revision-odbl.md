# Revisión legal de la licencia de Open Food Facts (ODbL) antes de abrir la app a otras personas

**Spec 002, tarea T078.** No es urgente mientras la app sea solo para vos.

## El tema

Los datos de productos de marca vienen de Open Food Facts, con licencia **ODbL 1.0**. Esa licencia exige:

1. **Atribución:** mencionar a Open Food Facts y la licencia. ✅ Ya se cumple en la pantalla `/fuentes` y en la procedencia de cada alimento.
2. **Compartir bajo la misma licencia (*share-alike*):** si una **base de datos derivada** se distribuye o se pone a disposición del público, hay que publicarla bajo la ODbL.

La duda es si ofrecer la app a otras personas cuenta como "poner a disposición" la base derivada, o si es solo una "obra producida", que requiere atribución pero no publicar la base.

## Qué hacer

- [ ] Antes de abrir la app a otras personas (o de permitir descargar o exportar el catálogo), consultar con alguien con conocimiento de licencias de datos. Material útil:
  - Texto de la licencia: <https://opendatacommons.org/licenses/odbl/1-0/>
  - Condiciones de Open Food Facts: <https://world.openfoodfacts.org/terms-of-use>
  - Resumen y estado actual en `Documentacion/fuentes-datos.md`, sección "Obligación de compartir bajo la misma licencia".
- [ ] Anotar la conclusión en esa sección de `Documentacion/fuentes-datos.md` (o pasármela y la anoto yo).

**Si la conclusión fuera que hay que compartir la base:** se puede publicar el catálogo importado (solo los datos de Open Food Facts con sus correcciones, nunca los alimentos propios de las personas) bajo la ODbL.

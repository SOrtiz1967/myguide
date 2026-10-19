# Tareas pendientes del autor

Cada archivo `NN-*.md` es un issue listo para publicar en GitHub: la primera línea (`# ...`) es el título y el resto es la descripción. Son las tareas que solo puede hacer el autor (cuentas, claves, decisiones legales); ninguna bloquea el desarrollo de las próximas specs.

| # | Tarea | Bloquea |
|---|---|---|
| 01 | Subir el repositorio a GitHub y publicar estos issues | Nada (es el primer paso para tener los issues en GitHub) |
| 02 | Descargar los datos de USDA para los alimentos genéricos | Que el catálogo tenga genéricos (arroz, pollo, manzana…) |
| 03 | Probar el envío real de correos con Brevo | El despliegue (04) |
| 04 | Despliegue inicial en producción | La carga del catálogo en producción (05) |
| 05 | Cargar el catálogo de alimentos en producción | Usar el catálogo en la app publicada |
| 06 | Revisión legal de la licencia de Open Food Facts (ODbL) | Abrir la app a otras personas |
| 07 | (Opcional) Instalar las skills de fitness | Nada |

## Publicarlos como issues

Con el repositorio ya subido (issue 01) y la CLI de GitHub autenticada:

```powershell
powershell -ExecutionPolicy Bypass -File Documentacion\issues-autor\publicar.ps1
```

El script crea la etiqueta `tarea del autor` y un issue por archivo. Se puede ejecutar una sola vez: si se repite, crea duplicados.

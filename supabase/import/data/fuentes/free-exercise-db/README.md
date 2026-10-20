# free-exercise-db (copia fijada)

Copia de `dist/exercises.json` de [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), usada por la carga del catálogo de ejercicios (spec 005).

| | |
|---|---|
| Commit | `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (2026-09-27) |
| SHA-256 de `exercises.json` | `5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf` |
| Licencia | Unlicense (dominio público); ver `LICENSE.md` |
| Ejercicios | 876 |

- La carga **verifica el SHA-256** antes de leer el archivo y se detiene si no coincide. Para subir de versión hay que cambiar a propósito el archivo, la constante y la prueba `source_pin.test.ts`.
- **No se copian ni se importan las imágenes** del repositorio de origen: la spec las deja fuera y su procedencia no está documentada.
- **Procedencia de los textos:** ni este repositorio ni el que lo originó (`exercises.json` de otro autor) documentan de dónde salen los pasos redactados. Es un riesgo conocido y registrado en `specs/005-catalogo-de-ejercicios/research.md` (Decisión 2) y en `Documentacion/issues-autor/05-ejercicios-licencias.md`. La descripción de cada ejercicio es separable del resto (opción `--sin-descripcion` de la carga).

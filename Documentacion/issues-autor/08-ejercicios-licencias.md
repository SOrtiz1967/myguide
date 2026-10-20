# Revisar las licencias y las traducciones del catálogo de ejercicios

**Spec 005, tarea T002.** Ninguna de estas tareas bloquea el desarrollo ni el uso personal de la app; sí conviene hacerlas antes de abrirla a otras personas.

## 1. Procedencia de los pasos de free-exercise-db

El catálogo de ejercicios se carga desde [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense, dominio público). El repositorio parte del `exercises.json` de otro autor y **ninguno de los dos documenta de dónde salen los pasos redactados** (unas 3.000 frases). Una dedicación al dominio público solo vale si quien la hizo era dueño del contenido.

- [ ] Decidir si se acepta ese riesgo, o consultar a alguien con conocimiento de licencias de datos antes de abrir la app a terceros. Los datos (nombre, músculo, equipamiento, categoría) son hechos; el riesgo está en el texto de los pasos.
- [ ] Si se decide retirar los pasos: `--sin-descripcion` en la carga (`npm run import:ejercicios`) los quita sin tocar el resto. Los ejercicios propios y las copias no se ven afectados.
- [ ] Anotar la conclusión en `Documentacion/fuentes-datos.md` (sección «Catálogo de ejercicios») o pasármela y la anoto yo.

## 2. Confirmar la dedicación CC0 de `myguide-base`

La fuente propia (`supabase/import/data/ejercicios-base.json`, unos 20 ejercicios de resistencia y deporte) es obra del proyecto y se publica bajo CC0 1.0.

- [ ] Confirmar que quedas de acuerdo con dedicarla al dominio público. Si prefieres otra licencia, se cambia en `exercise_sources` antes de cargarla.

## 3. Revisar traducciones y tipos de medición

Los nombres y los pasos se tradujeron de forma asistida y quedan marcados **«traducción sin revisar»** en la app.

- [ ] Ir revisando `supabase/import/data/ejercicios-es.json`: corregir lo que no suene bien y poner `reviewed` en `nombre_estado` / `pasos_estado`. Una carga posterior **no pisa** lo marcado `reviewed`.
- [ ] Revisar las excepciones del tipo de medición en `supabase/import/data/ejercicios-medicion.csv` (unas 110, con el criterio de cada grupo anotado).
- [ ] Volver a cargar: `npm run import:ejercicios`.

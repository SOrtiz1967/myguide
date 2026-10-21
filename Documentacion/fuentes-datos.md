# Fuentes de datos del catálogo de alimentos

Entregable obligatorio del Principio X de la Constitution: **la licencia y las obligaciones de atribución de cada fuente se documentan antes de importarla**, y la aplicación las cumple. La carga del catálogo rechaza cualquier fuente que no tenga licencia y atribución registradas (spec 002, FR-013).

Última revisión: 2026-10-18. Las licencias y condiciones pueden cambiar: confirma siempre en los enlaces oficiales antes de una carga nueva.

## Resumen

| Fuente | Qué aporta | Licencia | Obligaciones | Se importa |
|---|---|---|---|---|
| **Open Food Facts** | Productos de marca con código de barras (foco Argentina) | ODbL 1.0 (base de datos) y DbCL 1.0 (contenidos) | Atribución con enlace; mencionar la licencia; *share-alike* para bases derivadas que se distribuyan | Nombre, marca, valores por 100 g/ml, porción, código de barras |
| **USDA FoodData Central** | Alimentos genéricos (Foundation Foods y SR Legacy) | CC0 1.0 (dominio público) | Ninguna obligatoria; USDA pide citar la fuente y se cita igual | Nombre (traducido), valores por 100 g, porciones |

Ninguna imagen se importa.

## Open Food Facts

- **Sitio:** <https://world.openfoodfacts.org> · **Condiciones de uso:** <https://world.openfoodfacts.org/terms-of-use>
- **Licencias (verificadas en las condiciones de uso el 2026-10-17):**
  - Base de datos: *Open Database License* (ODbL) 1.0.
  - Contenidos individuales: *Database Contents License* (DbCL) 1.0.
  - Imágenes: CC BY-SA 3.0 (**no se importan**).
- **Atribución exigida:** "mencionar la licencia y atribuir la autoría a Open Food Facts", con un enlace a openfoodfacts.org (o a la página del producto cuando el dato es de un producto concreto). Se exige también en obras derivadas.
- **Texto de atribución que muestra la aplicación** (pantalla *Fuentes*):
  > Datos de productos de Open Food Facts (openfoodfacts.org), disponibles bajo la licencia ODbL 1.0. Los contenidos individuales están bajo la DbCL 1.0.
- **Qué se copia:** nombre, marca, base de referencia, valores nutricionales por 100 g o 100 ml, porciones y código de barras como identificador de origen.
- **Datos de terceros:** las condiciones indican que pueden aplicar derechos de terceros (diseño de envases, marcas registradas). MyGuide muestra nombres y marcas como datos descriptivos y no usa logotipos ni imágenes.
- **Cómo se obtiene:** API de búsqueda filtrada a Argentina, con `User-Agent` que identifica la aplicación y ritmo cortés; respaldo por el volcado completo publicado por el proyecto.

### Obligación de compartir bajo la misma licencia (*share-alike*)

La ODbL exige que una **base de datos derivada que se distribuya o se ponga a disposición del público** se comparta bajo la misma licencia. Una aplicación que solo **muestra** los datos (una "obra producida") requiere atribución, pero no obliga a publicar la base.

- **Hoy:** la base es privada y solo se muestran datos a las personas con cuenta, con la atribución visible. No se redistribuye la base.
- **Pendiente (tarea T078 de la spec 002):** antes de abrir la aplicación a otras personas, o de ofrecer la base para descarga, **revisar esta obligación con asesoramiento legal** y anotar aquí la conclusión.

## USDA FoodData Central

- **Sitio:** <https://fdc.nal.usda.gov> · **Descargas:** <https://fdc.nal.usda.gov/download-datasets>
- **Licencia (verificada en el sitio el 2026-10-17):** los datos son de dominio público y se publican bajo **CC0 1.0 Universal**. No se necesita permiso.
- **Conjuntos usados:** *Foundation Foods* (mayor calidad analítica, unos 365 alimentos) y *SR Legacy* (versión final de 2018, unos 7.800 alimentos).
- **Cita que muestra la aplicación** (pantalla *Fuentes*):
  > Datos de composición de alimentos de USDA FoodData Central (fdc.nal.usda.gov), de dominio público (CC0 1.0).
- **Qué se copia:** identificador `fdc_id`, valores por 100 g, porciones. Los nombres están en inglés y **se traducen al español** en esta aplicación (`supabase/import/data/usda-nombres-es.csv`), con el estado de cada traducción visible: *sin revisar* o *revisada*. Las traducciones son obra propia y se pueden corregir.
- **Límite conocido:** hay alimentos poco habituales en Argentina; el catálogo se complementa con alimentos propios.

## Fuentes evaluadas y no usadas

| Fuente | Motivo |
|---|---|
| APIs comerciales (FatSecret, Nutritionix, Edamam) | Limitan o prohíben guardar los datos; chocan con el Principio X (copia local) |
| ARGENFOODS (Universidad Nacional de Luján) | Referencia local, pero no se encontraron términos de descarga ni licencia; se contactará a la universidad como mejora futura |
| Tabla de composición del INTA | Sin datos abiertos ni licencia verificada |
| BEDCA (España) y tablas de Chile | Nombres en español, pero licencia sin verificar |
| Branded Foods de USDA | Productos de Estados Unidos; no aportan para Argentina |

## Cómo se aplica en la aplicación

1. Cada fuente tiene en la base de datos su licencia, el enlace de la licencia y el texto de atribución (`food_sources`); sin ellos la carga se rechaza.
2. La pantalla **Fuentes** (`/fuentes`) lista cada fuente con su licencia, su atribución, la fecha de la última importación y la cantidad de alimentos.
3. Cada alimento importado muestra su fuente, su identificador de origen y la fecha de importación.
4. Los alimentos propios y las copias nunca se publican: son privados de cada cuenta.

# Fuentes de datos del catálogo de ejercicios (spec 005)

Misma regla del Principio X: **la licencia y las obligaciones de cada fuente se documentan antes de importarla** y la carga rechaza una fuente sin licencia y atribución registradas (spec 005, FR-019). Última revisión: 2026-10-21, contra lo realmente cargado en la base local.

## Resumen

| Fuente | Qué aporta | Licencia | Obligaciones | Se importa |
|---|---|---|---|---|
| **free-exercise-db** ([yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)) | 876 ejercicios de fuerza, peso corporal, pliometría, halterofilia, movilidad y algo de cardio, en inglés | **Unlicense** (dominio público) | Ninguna. Igual se muestra la fuente y la licencia en la pantalla de fuentes | Nombre, categoría, músculos, equipamiento y pasos. **No** las imágenes |
| **MyGuide, ejercicios base** (`myguide-base`) | 21 ejercicios de resistencia, deporte y movilidad que la fuente anterior no cubre, ya en español | **CC0 1.0** (obra del autor del proyecto, dedicada al dominio público) | Ninguna | Todo |

Versión fijada de free-exercise-db: commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (2026-09-27), `dist/exercises.json` con SHA-256 `5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf`. La copia vive en `supabase/import/data/fuentes/free-exercise-db/` junto con su `LICENSE.md`, y la carga se detiene si el SHA-256 no coincide.

## Lo que está cargado

Carga real en la base local del 2026-10-21 (`npm run import:ejercicios`): **876 ejercicios de free-exercise-db** (los 876 de la copia fijada, ninguno omitido ni repetido) y **21 de `myguide-base`**. Los 876 tienen nombre y pasos traducidos al español, todos marcados «traducción sin revisar» (`machine_translated`); ninguno está «revisado». Cinco no tienen pasos en la fuente y se muestran «sin dato». La carga en producción (`npm run import:ejercicios:prod`) todavía no se hizo.

## free-exercise-db

- **Licencia:** Unlicense, declarada en el `LICENSE.md` del repositorio (GitHub la reconoce como `Unlicense`). Permite copiar, modificar, publicar y vender sin condiciones.
- **Lo que se toma:** nombre (en inglés, que se guarda como nombre original), categoría (para asignar el tipo de medición), músculos principales y secundarios, equipamiento y los pasos de ejecución. Los nombres y los pasos se traducen al español en un archivo propio versionado (`supabase/import/data/ejercicios-es.json`), con estado «sin revisar» o «revisada» por texto.
- **Lo que no se toma:** las imágenes (la spec las deja fuera y el repositorio no documenta su procedencia), y la dificultad, la fuerza y la mecánica del ejercicio.
- **Riesgo conocido, sin resolver:** el repositorio parte de `exercises.json` de otro autor y ninguno documenta de dónde salen los **pasos redactados**. La dedicación al dominio público solo vale si quien la hizo era dueño del contenido. Para los hechos (nombre, músculo, equipamiento, categoría) el riesgo es mínimo; para los pasos no se puede asegurar. Mitigación: la descripción es un dato separado y opcional, y la carga puede retirarla (`--sin-descripcion`) sin afectar al resto. Pendiente del autor: `Documentacion/issues-autor/08-ejercicios-licencias.md`.

## MyGuide, ejercicios base

- Obra original del proyecto (`supabase/import/data/ejercicios-base.json`), escrita en español, dedicada al dominio público con CC0 1.0. Pendiente del autor: confirmar la dedicación.

## Fuentes evaluadas y no usadas

| Fuente | Motivo |
|---|---|
| **wger** (`wger.de`) | Datos bajo **CC BY-SA 4.0 y 3.0** (más algunos CC0), por ejercicio y con su autor. Tiene 645 traducciones al español, pero obliga a atribuir cada ejercicio con su autor, a indicar los cambios (traducir lo es) y a **compartir igual** lo adaptado. Se descartó para esta spec y queda como complemento posible: la arquitectura admite varias fuentes |
| `wrkout/exercises.json` | Es el origen de free-exercise-db: misma licencia declarada y la misma duda sobre la procedencia, sin las correcciones posteriores |
| ExRx | Publica una página de licenciamiento comercial, no una licencia abierta |
| RepDB | Según su descripción pública, exige atribución incluso en el plan gratuito |
| MuscleWiki y otras APIs comerciales | No se revisaron sus términos; ninguna ofrece una licencia abierta para una copia local |

## Cómo se aplica en la aplicación

1. Cada fuente tiene en la base de datos su licencia, el enlace de la licencia y el texto de atribución (`exercise_sources`); sin ellos la carga se rechaza.
2. La pantalla **Fuentes** (`/fuentes`) lista, en la sección «Ejercicios», cada fuente con su licencia, su atribución, la fecha de la última importación y la cantidad de ejercicios.
3. Cada ejercicio importado muestra su fuente, su identificador de origen y la fecha de importación, y si su nombre o su descripción es una traducción sin revisar.
4. Los ejercicios propios y las copias nunca se publican: son privados de cada cuenta.

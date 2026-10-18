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

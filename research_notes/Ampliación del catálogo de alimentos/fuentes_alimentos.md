# Investigación: fuentes para ampliar el catálogo de alimentos (nota 7, spec 023)

Fecha: 2026-11-02. Búsquedas web y lectura directa de las páginas oficiales. Lo que no se pudo verificar se dice así.

## 1. Estado real del catálogo

La base local solo tiene la muestra de desarrollo (172 alimentos). Open Food Facts y USDA están en **0 alimentos** y la producción todavía no se cargó. Antes de sumar fuentes nuevas, lo que más amplía el catálogo es terminar las dos cargas que ya están programadas y probadas:

| Carga                             | Estado                                                                 | Qué falta (lo hace el autor)                                                         |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Open Food Facts (Argentina)       | Código listo (API y volcado). Sin cargar.                              | Desplegar (issue 04) y cargar en producción (issue 05).                              |
| USDA FoodData Central (genéricos) | Código listo. Faltan los CSV y las traducciones de nombres al español. | Descargar los CSV (issue 02, el DNS local no resuelve el dominio) y confirmar lotes. |

## 2. Cobertura medida

- **Open Food Facts, Argentina:** una consulta en vivo (2026-11-02) a la búsqueda con país Argentina y calorías informadas devolvió **7.056 productos**. No se pudo medir el total de productos con el país (el servidor respondió 503) ni la completitud de macronutrientes. Otras páginas espejo muestran cifras distintas y de fechas distintas; no son fiables. Son productos de marca: no cubren comida casera ni genéricos.
- **USDA:** Foundation Foods (publicación 10/2026 en la página de descargas, 04/2026 en el historial; la página no es consistente) y SR Legacy (04/2018). El código ya prevé unos 365 y unos 7.800 alimentos. Branded Foods (también publicado) es de Estados Unidos y no aporta a Argentina. FNDDS (2021 a 2023) son alimentos como se consumen en Estados Unidos, también en inglés.
- **ARGENFOODS (Universidad Nacional de Luján):** es el capítulo nacional de INFOODS (FAO y Universidad de las Naciones Unidas). El sitio dice que la base se está desarrollando y que parte de los datos pasó a la tabla de LATINFOODS. **No indica cuántos alimentos tiene, si hay descarga, ni qué licencia o permiso rige.** Un artículo de 2015 menciona una actualización de 258 alimentos. Sin términos de uso no se puede importar nada (Principio X).

## 3. Licencias

- **USDA FoodData Central:** el registro del proyecto (2026-10-17) dice dominio público, CC0 1.0. Esta vez ni la página de descargas ni las preguntas frecuentes repiten la declaración, así que hay que **reverificarla en la página de licencia del sitio** antes de la carga real. Lo que sí está claro: es un organismo del gobierno de Estados Unidos y sus datos son públicos.
- **Open Food Facts:** ODbL 1.0 (base) y DbCL 1.0 (contenidos). Obliga a atribuir y a compartir bajo la misma licencia **toda base derivada que se ponga a disposición del público**; el proyecto indica que una base combinada solo puede mezclarse con fuentes que permitan esa redistribución. Esa condición no es un problema con USDA (CC0) ni con los alimentos propios de cada cuenta (privados, nunca publicados). La pregunta de si ofrecer la app a otras personas cuenta como poner la base a disposición del público queda para el issue 06 (revisión legal).
- **Otras bases nacionales encontradas:** Reino Unido (CoFID, Open Government Licence), Australia (AFCD, licencia propia que obliga a redistribuir con los mismos términos), Italia (BDA, con derechos de autor y condiciones de uso exigibles), Minnesota NCC (licencia paga). Ninguna es de Argentina; las versiones están en inglés o italiano. No aportan nombres ni alimentos argentinos y su licencia añadiría obligaciones sin ganancia clara.

## 4. Costo de limpiar los nombres

- Open Food Facts viene en español pero sucio (mayúsculas, marcas mezcladas con el nombre, duplicados por código de barras); el normalizador existente ya lo resuelve y omite los incompletos.
- USDA viene en inglés: unas 8.000 traducciones a revisar por lotes. Es el costo mayor y ya está planificado.

## 5. Conclusión y recomendación

1. **No sumar fuentes nuevas ahora.** Ninguna candidata aporta datos argentinos con licencia clara.
2. **Terminar las cargas pendientes** (issues 02, 04 y 05): es lo que más amplía el catálogo.
3. **Pedir permiso a la Universidad Nacional de Luján** para usar ARGENFOODS (nuevo issue 09). Es la única fuente que aporta alimentos argentinos y genéricos con nombres locales. Hasta tener una autorización escrita, no se importa.
4. **Lo que queda por construir** (si el autor lo quiere): una capa de sinónimos argentinos en la búsqueda (palta y aguacate, choclo y maíz, zapallo y calabaza, etc.), para que «palta» encuentre lo que USDA llama «avocado». Es obra propia, sin licencia ajena. Solo tiene sentido cuando el catálogo ya tenga USDA cargado.

## Fuentes consultadas

- Open Food Facts, condiciones de uso: https://world.openfoodfacts.org/terms-of-use
- Open Food Facts, guía de licencia para quien reutiliza los datos: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side · https://wiki.openfoodfacts.org/ODBL_License
- Consulta en vivo de productos con país Argentina y calorías informadas: https://ar.openfoodfacts.org/cgi/search.pl?action=process&json=1&page_size=1&fields=code&nutriment_0=energy-kcal&nutriment_compare_0=gt&nutriment_value_0=-1
- USDA FoodData Central, descargas: http://fdc.nal.usda.gov/download-datasets/
- ARGENFOODS: https://www.argenfood.unlu.edu.ar/ · https://www.argenfood.unlu.edu.ar/Varios/IntroArgenfoods.htm
- Revisión sistemática sobre ARGENFOODS (2015): https://core.ac.uk/download/343666597.pdf
- Red INFOODS (FAO): https://www.fao.org/infoods/infoods/tables-and-databases/en/
- Licencias de bases nacionales: https://foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement · https://bda.ieo.it/?p=53

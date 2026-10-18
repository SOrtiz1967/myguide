# Research: Catálogo de alimentos

**Feature**: 002-catalogo-de-alimentos | **Fecha**: 2026-10-17

Resuelve la decisión técnica pendiente **#4** de la Constitution (fuentes de datos nutricionales del catálogo de alimentos). La parte de ejercicios queda para la spec 005. Datos verificados el 2026-10-17; los que no se pudieron medir están marcados como **a medir** y tienen una tarea de prototipo.

## Decisión 1: Fuente de productos de marca (Argentina)

- **Decisión**: **Open Food Facts (OFF)**, filtrado a productos con el país Argentina.
- **Razones**:
  - Es la única fuente abierta grande con productos de marca y código de barras, y tiene cobertura de productos vendidos en Argentina.
  - Datos ya normalizados por 100 g / 100 ml, con energía, grasas, saturadas, carbohidratos, azúcares, fibra, proteínas y sal/sodio.
  - Hay un volcado completo y una API de búsqueda, así que se puede obtener una copia local sin depender de ellos en producción.
- **Licencia (verificada en los términos de uso de OFF)**: base de datos bajo **ODbL 1.0**; contenidos individuales bajo **DbCL 1.0**; imágenes bajo CC BY-SA 3.0. Obligaciones: **atribuir a Open Food Facts** (con enlace) y mencionar la licencia, también en obras derivadas.
- **Imágenes**: no se importan (fuera de alcance de la spec y, además, tienen licencia distinta).
- **Share-alike**: la ODbL exige compartir bajo la misma licencia una *base de datos derivada* que se **distribuya** públicamente. MyGuide muestra los datos en una aplicación (una "obra producida") y no redistribuye la base; con atribución visible alcanza. **Si algún día se ofrece la base derivada para descarga o la aplicación se abre a terceros, hay que revisarlo con asesoramiento legal.** Queda como riesgo documentado, no resuelto por esta spec.
- **Calidad**: es colaborativa. Por eso: valores faltantes se conservan como faltantes, registros imposibles se omiten con informe, y la persona puede crear su copia corregida (Principio X).
- **Cobertura en Argentina**: **a medir**. El volcado completo tiene unos 4,8 millones de productos (medido hoy); la cantidad de productos de Argentina no se pudo obtener (la API devolvía 503 y la consulta remota al Parquet falla en este equipo). Se mide en el prototipo T001.
- **Alternativas evaluadas**:
  - *APIs comerciales (FatSecret, Nutritionix, Edamam)*: prohíben o limitan guardar los datos y chocan con el Principio X (copia local).
  - *Bases de supermercados / scraping*: sin licencia, descartado.
  - *Cargar a mano*: inviable como catálogo.

## Decisión 2: Fuente de alimentos genéricos

- **Decisión**: **USDA FoodData Central: Foundation Foods y SR Legacy** (dominio público, **CC0 1.0**).
- **Razones**:
  - Licencia inequívoca, sin obligaciones de redistribución; USDA pide citar la fuente, y se hace igual.
  - SR Legacy (~7.800 alimentos, versión final de 2018) y Foundation Foods (~365, mayor calidad analítica) cubren los genéricos habituales: frutas, verduras, carnes, lácteos, legumbres, cereales, aceites.
  - Descarga en CSV pequeña (decenas de MB).
- **Una sola fuente en la aplicación**: Foundation Foods y SR Legacy se registran juntas como la fuente `usda-fdc` (decisión del autor). Si un alimento aparece en ambas con el mismo nombre normalizado, **gana Foundation Foods** (mejor calidad analítica) y no se duplica. El `source_item_id` es el `fdc_id`, único en todo USDA.
- **Límite conocido**: los nombres están en **inglés** y hay alimentos poco habituales en Argentina. Mitigación en la Decisión 4.
- **Alternativas evaluadas**:
  - *ARGENFOODS (Universidad Nacional de Luján)*: es la referencia local, pero **no encontré términos de descarga ni licencia** documentados; se contacta a la universidad como mejora futura y no bloquea esta spec.
  - *Tabla de composición del INTA*: sin datos abiertos ni licencia verificada.
  - *BEDCA (España) y tablas de Chile*: nombres en español, pero licencia sin verificar.
  - *Branded Foods de USDA*: son productos de EE. UU.; no aportan para Argentina.

## Decisión 3: Volumen y presupuesto de almacenamiento

- El plan gratuito de Supabase da **500 MB** de base de datos, compartidos con Auth, perfiles, y las specs 003 a 010.
- **Presupuesto para el catálogo: 150 MB como máximo** (incluidos los índices de búsqueda).
- Estimación por alimento: ~0,6 KB de fila + ~2 KB de índice de texto. Con 50.000 alimentos ≈ 130 MB; con 100.000 se pasa del presupuesto.
- **Regla**: la carga corta en el límite configurado (por defecto 60.000 alimentos), priorizando los productos de Argentina más completos (con energía y macros informados). Si hay más, se prioriza por completitud del dato.
- **A medir**: tamaño real de la fila y del índice con una muestra de 5.000 alimentos (prototipo T001).

## Decisión 4: Nombres en español

- **Productos de marca (OFF)**: el nombre es un nombre propio de producto; se usa el que figura en español (`lang = es`) o el principal, **sin traducirlo** (estado `original`).
- **Genéricos (USDA)**: se traducen **una sola vez, de forma asistida**, a un archivo versionado (`supabase/import/data/usda-nombres-es.csv`) con estado `traducción sin revisar`. El archivo tiene las columnas `fdc_id,nombre_es,estado`, donde `estado` es `machine_translated` (sin revisar) o `reviewed` (revisada). Las traducciones se corrigen editando ese archivo —y se marcan `reviewed` al confirmarlas— y volviendo a cargar; la interfaz muestra el estado (`original`, `sin revisar`, `revisada`).
- **Razón**: cumple el Principio X (nombres en español, revisables y corregibles) sin depender de un servicio de traducción en tiempo de ejecución.
- **Alternativas**: traducir al vuelo con IA (rechazado: depende de un tercero y gasta cuota); dejar los nombres en inglés (rechazado por el Principio X).

## Decisión 5: Modelo de datos y propiedad

- **Una sola tabla `foods`** para el catálogo importado (`user_id` nulo) y los alimentos propios (`user_id` = dueño), con una restricción que liga origen y propiedad. Razón: la búsqueda, las copias y los futuros registros de comida (spec 003) tratan a ambos por igual; evita unir dos tablas en cada consulta.
- Excepción documentada a la convención de la spec 001 (`user_id not null`): en `foods` y `food_portions` el `user_id` nulo identifica filas del catálogo común. Las políticas lo hacen cumplir y el guardián `rls_guardrail` sigue exigiendo RLS, columna `user_id` y ninguna política abierta.
- **Solo lectura del catálogo**: las políticas de escritura exigen `user_id = auth.uid()`; ninguna fila del catálogo las cumple. Solo `service_role` (la carga) escribe filas del catálogo.
- **Copias**: `based_on_food_id` con `on delete set null`. Eliminar o actualizar el original no altera la copia.
- **Alternativa evaluada**: dos tablas (`catalog_foods` y `user_foods`): descartada por duplicar la lógica de búsqueda y de copia, y por romper el guardián de propiedad.

## Decisión 6: Búsqueda sin servicios externos

- **Decisión**: búsqueda en Postgres con `unaccent` y `pg_trgm` (extensiones disponibles en Supabase), sobre una columna de texto normalizado (nombre + marca, sin acentos, en minúsculas), con índice GIN de trigramas.
- **Orden**: nombre exacto, luego prefijo del nombre, luego marca, luego similitud; a igualdad, los alimentos más completos primero.
- **Paginación**: por tandas de 20 con desplazamiento (`offset`), suficiente para este volumen y para uso personal.
- **Consulta mínima**: 2 caracteres (FR-032).
- **Alternativas**: búsqueda de texto completo (`tsvector`) con diccionario en español: mejor para frases, peor para nombres de marca y coincidencias parciales; un motor externo (Algolia, Meilisearch): rechazado por depender de un tercero y por el costo.
- **A medir**: tiempo de respuesta con 50.000 alimentos para cumplir SC-002 (95 % en menos de 1 s).

## Decisión 7: Pipeline de carga (proceso del autor)

- **Dónde**: `supabase/import/`, con Deno (ya usado para las pruebas de funciones). Dos etapas: **extraer** (por fuente, a un archivo intermedio normalizado) y **cargar** (idéntico para todas las fuentes).
- **Extracción de OFF**: por la **API de búsqueda** de Open Food Facts, con identificación de la aplicación en `User-Agent`, paginado y a ritmo cortés. Respaldo: filtrar el volcado `jsonl.gz` por transmisión (sin descomprimirlo entero).
- **Extracción de USDA**: CSV descargado del sitio oficial.
- **Carga**: lotes por una función SQL exclusiva de `service_role` (`import_foods`), **idempotente** por `(fuente, identificador de origen)`: crea o actualiza solo filas del catálogo, jamás copias ni alimentos propios.
- **Normalización** (pura y probada): unidades a kcal/g/mg, kJ → kcal (÷ 4,184) solo si falta la energía en kcal, sodio desde sal (÷ 2,5) solo si falta el sodio, **nunca** cero por faltante, descarte de registros imposibles (negativos, macros > 100 g por 100 g, sin nombre) con informe.
- **Informe**: cada carga guarda cuántos creó, actualizó y omitió, y el motivo de cada omisión (sin datos personales).
- **Licencia**: la carga **rechaza** una fuente que no tenga licencia y atribución registradas (FR-013).

## Decisión 8: Interfaz

- Rutas nuevas: `/alimentos` (búsqueda con pestañas Todos / Del catálogo / Mis alimentos), `/alimentos/nuevo`, `/alimentos/:id`, `/alimentos/:id/editar`, `/fuentes`.
- Mismo stack de la spec 001: React Router, TanStack Query, React Hook Form + Zod, Tailwind. La búsqueda usa un retardo de 300 ms para no consultar en cada tecla.
- Reutiliza los borradores locales (spec 001) en los formularios de alimento y la escritura confirmada (`saveRemotely`).
- Dependencias nuevas: ninguna.

## Decisión 9: Valores y validación

- Nutrientes: energía (kcal), proteínas, carbohidratos, azúcares, grasas, saturadas, fibra (g) y sodio (mg). Todos opcionales en alimentos propios salvo la **energía**, que es obligatoria al crear (FR-015); en el catálogo importado la energía también puede faltar.
- Reglas (en cliente y **también en la base de datos**): no negativos; cada gramo ≤ 100 por 100; proteínas + carbohidratos + grasas ≤ 100; azúcares ≤ carbohidratos; saturadas ≤ grasas; energía ≤ 900 kcal por 100 (el máximo teórico de la grasa pura); sodio ≤ 40.000 mg por 100 g (sal pura).
- Aviso informativo de coherencia: energía declarada frente a 4·P + 4·C + 9·G con una diferencia mayor a 25 % y 30 kcal.
- Precisión: se almacena `numeric(8,2)`; se muestra con el formato regional y sin decimales sobrantes.

## Riesgos y preguntas abiertas

1. **Cobertura real de Argentina en OFF** (a medir, T001). Si es baja, la utilidad de buscar marcas baja y los alimentos propios cobran más peso.
2. **Disponibilidad de la API de OFF** (hoy devolvía 503): el respaldo es el volcado.
3. **Tamaño del índice de trigramas** frente al presupuesto de 150 MB (a medir).
4. **ODbL y reutilización pública**: revisar con asesoramiento legal antes de abrir la aplicación a terceros.
5. **Traducciones de genéricos USDA** sin revisar: revisión incremental.
6. **Licencia de ARGENFOODS**: sin verificar; contacto pendiente (mejora futura).

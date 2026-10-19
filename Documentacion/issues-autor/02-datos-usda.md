# Descargar los datos de USDA para los alimentos genéricos del catálogo

**Spec 002, tareas T050 a T053.** Hoy el catálogo tiene unos 3.900 productos de marca de Open Food Facts, pero casi ningún alimento genérico (arroz cocido, pechuga de pollo, manzana…). Esos salen de USDA FoodData Central (dominio público, CC0). El código para cargarlos ya está hecho y probado; faltan los datos.

**Por qué no lo hice yo:** esta computadora no puede resolver el dominio `fdc.nal.usda.gov` (el DNS local no responde para ese sitio, aunque el DNS público sí lo resuelve). Forzarlo desde la terminal quedó bloqueado por los permisos de seguridad.

**Tiempo estimado:** 10 minutos de tu parte. Después yo hago la traducción y la carga.

## Pasos

1. Abrir <https://fdc.nal.usda.gov/download-datasets> en el navegador.
   - Si no abre, cambiar el DNS de Windows a `8.8.8.8` y `8.8.4.4`: Configuración → Red e Internet → (tu conexión) → Asignación de servidor DNS → Editar → Manual → IPv4. Después se puede volver a "Automático".
2. Descargar, en formato **CSV**:
   - **Foundation Foods** (el más reciente).
   - **SR Legacy** (abril de 2018).
3. Descomprimir cada ZIP y copiar los archivos así (las carpetas no existen todavía; crearlas):
   ```text
   supabase/import/out/usda/foundation/   ← CSV de Foundation Foods
   supabase/import/out/usda/sr_legacy/    ← CSV de SR Legacy
   ```
   Cada carpeta debe contener al menos `food.csv`, `food_nutrient.csv`, `food_portion.csv` y `measure_unit.csv`. Si el ZIP trae una subcarpeta, copiar su contenido, no la subcarpeta. La carpeta `out/` no se sube a Git.
4. Avisarme. Yo hago el resto:
   - Traduzco los nombres al español (unos 365 de Foundation Foods y unos 7.800 de SR Legacy) en `supabase/import/data/usda-nombres-es.csv`, por grupos de alimentos. **Vos confirmás cada lote** antes de que lo cargue.
   - Cargo en la base local con `npm run import:usda`, reviso el informe y lo registro en `research.md`.

## Listo cuando

- [ ] Las dos carpetas existen con sus CSV.
- [ ] Traducciones revisadas por lotes y cargadas en local.
- [ ] Una búsqueda de "arroz" o "pollo" muestra genéricos del catálogo con "USDA FoodData Central" en la procedencia.

Detalle técnico: `supabase/README.md`, sección "Cargar USDA".

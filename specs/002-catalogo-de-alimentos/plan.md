# Implementation Plan: Catálogo de alimentos

**Branch**: `002-catalogo-de-alimentos` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-catalogo-de-alimentos/spec.md`

## Summary

Un catálogo de alimentos propio y de solo lectura (genéricos y productos de marca de Argentina) más alimentos privados de cada cuenta, con búsqueda sin acentos y con coincidencias parciales, copias editables, procedencia visible y valores faltantes mostrados como "sin dato".

Enfoque técnico (detalle y alternativas en [research.md](research.md)): una tabla `foods` en Postgres con RLS (catálogo común con `user_id` nulo, y alimentos propios), búsqueda con `unaccent` y `pg_trgm`, y funciones SQL atómicas para crear, editar y copiar. El catálogo se carga con un **pipeline del autor** (Deno) desde **Open Food Facts** (marcas, ODbL) y **USDA FoodData Central** (genéricos, CC0), con nombres genéricos traducidos una vez y marcados como "sin revisar". Sin dependencias nuevas en el frontend ni servicios externos en tiempo de ejecución.

Cierra la decisión técnica pendiente **#4** de la Constitution para alimentos (ejercicios, en la spec 005).

## Technical Context

**Language/Version**: TypeScript estricto (frontend y pipeline de carga con Deno), SQL (Postgres 17 de Supabase)

**Primary Dependencies**: las de la spec 001; en la base, extensiones `unaccent` y `pg_trgm`. Sin dependencias nuevas de frontend. El pipeline usa solo la biblioteca estándar de Deno (`@std/csv`).

**Storage**: Postgres de Supabase (`foods`, `food_portions`, `food_sources`, `private.import_runs`). Presupuesto del catálogo: **150 MB** de los 500 MB del plan gratuito.

**Testing**: pgTAP (RLS, funciones, restricciones, solo lectura del catálogo), Deno (normalización y carga), Vitest + Testing Library (búsqueda, formularios, detalle), Playwright + axe (flujos, accesibilidad, responsive)

**Target Platform**: la misma PWA de la spec 001

**Project Type**: aplicación web (frontend SPA + backend gestionado) más un proceso de carga que ejecuta el autor

**Performance Goals**: el 95 % de las búsquedas responde en menos de 1 s con 50.000 alimentos (SC-002); la primera tanda son 20 resultados

**Constraints**: sin servicios de terceros en la búsqueda y la consulta; el catálogo cabe en 150 MB; los datos faltantes nunca son cero; el catálogo no es editable desde la aplicación

**Scale/Scope**: hasta 60.000 alimentos del catálogo; alimentos propios de una persona (decenas a cientos); 5 pantallas

## Constitution Check

*GATE: debe pasar antes de la investigación (Fase 0); se vuelve a evaluar tras el diseño (Fase 1).* Evaluado contra la Constitution v1.2.0.

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Privacidad y seguridad** | Los alimentos propios son privados con RLS y pruebas de aislamiento entre cuentas; el catálogo es de solo lectura para todos; las funciones de carga solo son ejecutables por `service_role`; la clave de servicio vive solo en el entorno del autor (`supabase/.env`). No hay fotos ni proveedores de IA. | ✅ Cumple |
| **II. Integridad e idempotencia** | Creación y copia idempotentes (`client_request_id`); edición y copia atómicas; `based_on_food_id` con `on delete set null`; la regla "editar o borrar no altera el pasado" queda garantizada por diseño (los registros de la spec 003 guardarán *snapshot*) y se verifica con una prueba pgTAP de las claves foráneas. | ✅ Cumple |
| **III. Estimaciones transparentes** | Los valores se muestran con base y unidad; los faltantes como "sin dato" (nunca 0) en importación, almacenamiento y pantalla; aviso informativo de incoherencia energía/macros sin bloquear. | ✅ Cumple |
| **VI. Experiencia** | Responsive, español, estados definidos, formato regional, borradores locales y guardado confirmado reutilizados de la spec 001; la búsqueda y la consulta no dependen de integraciones externas. | ✅ Cumple |
| **VII. Arquitectura** | Cálculos y validaciones deterministas separados de la presentación; normalización de la carga pura y probada; la base reimpone las validaciones que hace el cliente; sin dependencias innecesarias. | ✅ Cumple |
| **VIII. Calidad y SDD** | Spec con criterios comprobables; TDD en cada tarea; comandos documentados en `quickstart.md`. | ✅ Cumple |
| **IX. Observabilidad** | La carga registra solo códigos de producto y motivos de omisión; sin datos personales; el informe se guarda en `private.import_runs`. | ✅ Cumple |
| **X. Catálogos de referencia** | Copia local importada; procedencia por ítem (fuente, identificador, fecha, origen); licencia y atribución registradas y exigidas antes de importar; alimentos propios y copias; valores por 100 g/ml con porciones aparte; faltantes visibles; nombres en español con estado de traducción revisable. | ✅ Cumple |
| **Decisiones pendientes** | Se cierra la #4 (fuentes de alimentos); la #4 de ejercicios y las #3, #5 a #9 siguen pendientes. | ✅ |

**Resultado**: sin violaciones. Se documenta una excepción a la convención de propiedad de la spec 001 en *Complexity Tracking*.

**Reevaluación tras el diseño (Fase 1)**: el diseño confirma el resultado; el guardián `rls_guardrail` se amplía con una lista explícita de tablas de referencia de solo lectura.

## Project Structure

### Documentation (this feature)

```text
specs/002-catalogo-de-alimentos/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database-api.md      # funciones RPC y acceso a tablas
│   ├── import-pipeline.md   # formato intermedio y reglas de la carga
│   └── ui-routes.md         # rutas, estados y accesibilidad
├── checklists/requirements.md
└── tasks.md                 # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
app/src/features/foods/
├── api.ts                   # llamadas a search_foods, create_food, update_food, copy_food
├── schema.ts                # validación Zod (mismas reglas que la base)
├── nutrition.ts             # funciones puras: coherencia energía/macros, formato de valores
├── useFoodSearch.ts         # búsqueda con retardo, pestañas y tandas
├── FoodSearchPage.tsx
├── FoodDetailPage.tsx
├── FoodForm.tsx             # alta y edición, con porciones
├── FoodProvenance.tsx
├── NutritionFacts.tsx       # tabla de valores con unidad y "sin dato"
└── SourcesPage.tsx
app/tests/{unit,component,e2e}/  # pruebas por pantalla

supabase/migrations/         # extensiones, tablas, RLS, funciones
supabase/tests/              # pgTAP del catálogo
supabase/import/
├── extract-off.ts
├── extract-usda.ts
├── normalize.ts             # puro y probado
├── load.ts
├── data/muestra.ndjson      # muestra para desarrollo y pruebas
└── data/usda-nombres-es.csv # traducciones de genéricos (estado: sin revisar)
Documentacion/fuentes-datos.md   # licencias y atribución de cada fuente
```

**Structure Decision**: se agrega `features/foods` al frontend y `supabase/import/` para el proceso del autor. La documentación de licencias (`Documentacion/fuentes-datos.md`) es un entregable obligatorio antes de cargar cualquier fuente (Principio X).

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| `foods` y `food_portions` con `user_id` nulo para el catálogo (excepción a la convención de la spec 001) | Un único modelo y una única búsqueda para catálogo y alimentos propios; las copias y la spec 003 tratan a ambos por igual | Dos tablas duplican la búsqueda y la lógica de copia, y complican las referencias de la spec 003 |
| `food_sources` sin `user_id` (tabla de referencia de solo lectura) | Es información común de fuentes y licencias, no un dato de usuario | Forzar `user_id` no tiene sentido; se agrega a una lista explícita del guardián con solo `select` |
| Pipeline propio con dos etapas (extraer y cargar) | Las fuentes tienen formatos distintos; la carga única y probada garantiza idempotencia y licencias | Un script por fuente repetiría la validación y las garantías |

## Riesgos y verificaciones previas a implementar

1. **Cobertura real de Argentina en Open Food Facts** (prototipo T001): determina cuánto aporta buscar marcas.
2. **Tamaño de la fila y del índice de trigramas** frente al presupuesto de 150 MB (prototipo T001).
3. **Tiempo de búsqueda con 50.000 alimentos** (prototipo T002): si no llega a 1 s, se ajusta el índice o el tope.
4. **Disponibilidad de la API de OFF**: hoy devolvía 503; el respaldo es el volcado por transmisión.
5. **ODbL**: atribución obligatoria; revisar con asesoramiento legal antes de abrir la aplicación a terceros.
6. **Licencia de ARGENFOODS**: sin verificar; mejora futura.

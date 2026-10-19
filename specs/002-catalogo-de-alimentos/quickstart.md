# Quickstart: validar la spec 002

**Feature**: 002-catalogo-de-alimentos

## Requisitos previos

Los de la spec 001 (Docker Desktop, `npx supabase start`, funciones y frontend en marcha). Además, una **muestra de catálogo** para desarrollo y pruebas, incluida en el repositorio (`supabase/import/data/muestra.ndjson`, ~200 alimentos entre genéricos y de marca, con datos completos, incompletos e inválidos).

```powershell
npx supabase db reset                         # aplica migraciones, incluida la 002
npm run import:muestra                        # carga la muestra en el catálogo local
npm run dev --prefix app
```

## Comandos de verificación

```powershell
npm run test:db          # pgTAP: RLS del catálogo, funciones, restricciones
npm run test:import      # Deno: normalización y carga
npm run test:functions
npm test --prefix app
npm run e2e --prefix app
npm run check:secrets --prefix app
```

## Escenarios de validación

| # | Escenario | Historia | Resultado esperado |
|---|---|---|---|
| 1 | Buscar "leche" | 1 | Lista con genéricos y de marca, con energía y marca de origen |
| 2 | Buscar "Dulce de Leche" y "dulce de leche" | 1 | Mismos resultados |
| 3 | Abrir un alimento completo | 1 | Todos los valores con unidad y base |
| 4 | Abrir un alimento sin fibra | 1 | La fibra dice "sin dato", no 0 |
| 5 | Ver la procedencia de un alimento importado | 1 | Fuente, código, fecha y "Del catálogo" |
| 6 | Buscar algo que no existe | 1 | Estado vacío con "Crear…" |
| 7 | Más resultados que los de una tanda | 1 | "Ver más" agrega sin perder los anteriores |
| 8 | Usar las pestañas Todos / Del catálogo / Mis alimentos | 1 | Filtra por origen y se conserva al ir al detalle y volver |
| 9 | Crear un alimento solo con nombre y energía | 2 | Se guarda; el resto "sin dato" |
| 10 | Crear un alimento con varias porciones | 2 | Se muestran aparte de los valores por 100 |
| 11 | Valores imposibles (negativo; macros > 100 g) | 2 | Rechazado con mensaje claro |
| 12 | Energía que no coincide con los macros | 2 | Se guarda con aviso informativo |
| 13 | Coma decimal | 2 | `12,5` se interpreta bien |
| 14 | Otra cuenta busca mi alimento | 2 | No lo ve |
| 15 | Doble clic en "Guardar" | 2 | Un solo alimento |
| 16 | "Crear mi versión" de un alimento del catálogo | 3 | Copia editable que dice "basado en…" |
| 17 | Editar la copia | 3 | El original no cambia; otra cuenta ve el original intacto |
| 18 | Repetir la carga del catálogo con datos distintos | 3 | La copia conserva sus valores |
| 19 | Editar y eliminar un alimento propio | 4 | Se actualiza / deja de aparecer |
| 20 | Intentar editar o eliminar un alimento del catálogo | 4 | No se puede; solo ofrece crear mi versión |
| 21 | Cortar la red al guardar | 4 | Aviso de que no se guardó; borrador conservado |
| 22 | Ejecutar la carga dos veces | 5 | 0 duplicados, 0 cambios en alimentos propios |
| 23 | Cargar registros sin dato, imposibles y sin nombre | 5 | Faltantes en `null`; imposibles omitidos con informe |
| 24 | Intentar cargar una fuente sin licencia | 5 | Rechazada |
| 25 | Abrir `/fuentes` | 6 | Cada fuente con licencia, atribución, fecha y cantidad |
| 26 | Buscar con el servidor sin acceso a internet | 1 | Funciona (solo depende de la propia base) |
| 27 | Medir 50.000 alimentos | 1 | El 95 % de las búsquedas responde en menos de 1 s |

## Criterio de terminado

Todos los comandos de verificación pasan y los 27 escenarios se cumplen. Las pruebas referencian el requisito o el escenario que verifican.
